/**
 * Backstage console operations (owner): user profile, notes and tags,
 * challenge decisions, granted entitlements and plan administration.
 *
 * Mounted at /admin/console behind the same service token as every admin
 * route (adminAuth) plus a named actor (X-Admin-Actor). Backstage adds the
 * owner session, CSRF, password re-entry and GLOBAL region in front of every
 * mutation (apps/backstage/operations/server.js). Every mutation requires a
 * reason and writes the audit log with the actor.
 *
 * Plans: the backend stays the source of enforced rules. A publication
 * validates the draft with the shared validator (packages/plan-validation)
 * AND the engine's normalizeRules, bumps catalogVersion, and records the
 * previous configuration in plan_catalog_history. Only new orders read the
 * published row; every existing challenge keeps its frozen rules_snapshot.
 * The website, checkout, rulebook, comparison and FAQ read the same rows
 * (CMS `challenge_plans`, with the bundled catalog as the offline fallback).
 */
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { adminAuth, adminActor } from './admin.js'
import { normalizeRules } from './evaluation.js'
import { issueEntitlementTx } from './entitlements.js'
import { planProblems, planFromConfiguration, configurationDiff } from '../../packages/plan-validation/index.mjs'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/
const fail = (status, error, details) => Object.assign(new Error(error), { status, ...(details ? { details } : {}) })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const reasonOf = value => {
  if (typeof value !== 'string' || value.trim().length < 3 || value.length > 1000) throw fail(400, 'reason_required')
  return value.trim()
}
/* optional tables owned by later features (tournament, migration) */
const exists = async (pool, table) => (await pool.query('SELECT to_regclass($1) AS t', [table])).rows[0].t !== null

/** A plan draft as submitted: { slug, nameFa, nameEn, configuration }. */
export function validatePlanDraft(body) {
  if (!body || typeof body !== 'object') throw fail(400, 'invalid_request')
  const { slug, nameFa, nameEn, configuration } = body
  if (!SLUG.test(String(slug || ''))) throw fail(400, 'invalid_slug')
  for (const name of [nameFa, nameEn]) if (typeof name !== 'string' || !name.trim() || name.length > 80 || name.includes('—')) throw fail(400, 'invalid_name')
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration) || JSON.stringify(configuration).length > 20000) throw fail(400, 'invalid_configuration')
  const name = `${nameFa.trim()} — ${nameEn.trim()}`
  const problems = planProblems(planFromConfiguration(slug, name, configuration))
  const rules = normalizeRules(configuration)
  if (!rules.evaluationCapable) problems.push(`plan ${slug}: the engine cannot evaluate these loss limits`)
  return { slug, name, configuration, problems, rules }
}

export function consoleAdminRoutes({ pool, engine, audit }) {
  const router = Router()
  router.use(adminAuth)
  const limit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'rate_limited' } })
  router.use(limit)
  const record = (action, userId, req, details) => audit?.(action, userId, req, details)

  /* ---------- users: full profile, internal notes and tags ---------- */
  router.get('/users/:id/profile', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'user_not_found')
    const id = req.params.id
    const { rows: [user] } = await pool.query(
      `SELECT id, wallet_address, wallet_chain, display_name, status, created_at, updated_at, last_login_at FROM openfund_users WHERE id=$1`, [id])
    if (!user) throw fail(404, 'user_not_found')
    const q = async (sql, params = [id]) => (await pool.query(sql, params)).rows
    const profile = {
      user,
      purchases: await q(`SELECT o.id, o.status, o.account_size_usd, o.price_usd, o.created_at, o.paid_at, p.slug AS plan_slug
        FROM purchase_orders o JOIN challenge_plans p ON p.id=o.challenge_plan_id WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100`),
      challenges: await q(`SELECT c.id, c.status, c.stage, c.account_size_usd, c.created_at, c.started_at, c.completed_at, c.expires_at, p.slug AS plan_slug
        FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id WHERE c.user_id=$1 ORDER BY c.created_at DESC LIMIT 100`),
      support: await q(`SELECT reference, subject, department, status, created_at FROM support_messages WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`),
      certificates: await q(`SELECT serial, kind, plan, status, issued_at FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC LIMIT 50`),
      entitlements: await q(`SELECT e.id, e.source, e.start_stage, e.account_size_usd, e.reference, e.created_at, c.code, c.status AS coupon_status, c.uses_consumed, p.slug AS plan_slug
        FROM granted_entitlements e JOIN coupons c ON c.id=e.coupon_id JOIN challenge_plans p ON p.id=e.challenge_plan_id WHERE e.user_id=$1 ORDER BY e.created_at DESC`),
      tournament: await exists(pool, 'tournament_registrations')
        ? await q(`SELECT r.id, r.tournament_id, r.status, r.nickname, r.created_at FROM tournament_registrations r WHERE r.user_id=$1 ORDER BY r.created_at DESC`) : [],
      migration: await exists(pool, 'migration_requests')
        ? await q(`SELECT m.id, m.status, m.firm_slug, m.created_at, m.decided_at FROM migration_requests m WHERE m.user_id=$1 ORDER BY m.created_at DESC`) : [],
      notes: await q(`SELECT id, note, actor, created_at FROM user_admin_notes WHERE user_id=$1 ORDER BY id DESC LIMIT 100`),
      tags: (await q(`SELECT tag FROM user_admin_tags WHERE user_id=$1 ORDER BY tag`)).map(r => r.tag),
    }
    res.set('Cache-Control', 'no-store').json(profile)
  }))

  router.post('/users/:id/notes', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'user_not_found')
    const note = req.body?.note
    if (typeof note !== 'string' || !note.trim() || note.length > 2000) throw fail(400, 'invalid_note')
    const { rows: [row] } = await pool.query(
      `INSERT INTO user_admin_notes (user_id, note, actor) SELECT id, $2, $3 FROM openfund_users WHERE id=$1 RETURNING id, created_at`,
      [req.params.id, note.trim(), actor])
    if (!row) throw fail(404, 'user_not_found')
    await record('user_note_added', req.params.id, req, { actor, noteId: row.id })
    res.status(201).json({ ok: true, id: row.id })
  }))

  router.post('/users/:id/tags', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'user_not_found')
    const tags = req.body?.tags
    if (!Array.isArray(tags) || tags.length > 20 || tags.some(t => typeof t !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(t))) throw fail(400, 'invalid_tags')
    const reason = reasonOf(req.body?.reason)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [user] } = await client.query('SELECT id FROM openfund_users WHERE id=$1 FOR UPDATE', [req.params.id])
      if (!user) throw fail(404, 'user_not_found')
      const before = (await client.query('SELECT tag FROM user_admin_tags WHERE user_id=$1', [user.id])).rows.map(r => r.tag)
      await client.query('DELETE FROM user_admin_tags WHERE user_id=$1 AND NOT (tag = ANY($2::text[]))', [user.id, tags])
      for (const tag of new Set(tags)) await client.query('INSERT INTO user_admin_tags (user_id, tag, actor) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [user.id, tag, actor])
      await client.query('COMMIT')
      await record('user_tags_set', user.id, req, { actor, reason, before, after: [...new Set(tags)].sort() })
      res.json({ ok: true, tags: [...new Set(tags)].sort() })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  /* ---------- challenges: owner decisions (engine.adminChallengeAction) ---------- */
  router.post('/challenges/:id/action', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'challenge_not_found')
    const { action, reason, days } = req.body || {}
    if (!engine) throw fail(503, 'engine_unavailable')
    const result = await engine.adminChallengeAction(req.params.id, { action, reason, actor, days: days == null ? null : Number(days) })
    const { rows: [c] } = await pool.query('SELECT user_id FROM openfund_challenges WHERE id=$1', [req.params.id])
    await record(`challenge_admin_${action}`, c?.user_id ?? null, req, { actor, reason: String(reason).trim(), challengeId: req.params.id, days: days ?? null, result })
    res.json({ ok: true, ...result })
  }))

  /* ---------- entitlements: issue a challenge or a funded account ---------- */
  router.post('/entitlements', wrap(async (req, res) => {
    const actor = adminActor(req)
    const { walletAddress, planSlug, accountSizeUsd, funded, expiresDays, reason } = req.body || {}
    if (typeof walletAddress !== 'string' || !/^0x[0-9a-f]{40}$/i.test(walletAddress)) throw fail(400, 'invalid_wallet')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const out = await issueEntitlementTx(client, { walletAddress, planSlug: String(planSlug || ''), accountSizeUsd, startStage: funded === true ? 0 : 1,
        source: 'admin', reason: reasonOf(reason), actor, expiresDays: expiresDays == null ? 30 : Number(expiresDays) })
      await client.query('COMMIT')
      await record('entitlement_issued', out.user_id, req, { actor, reason: reason.trim(), entitlementId: out.id, plan: out.plan_slug, size: out.account_size_usd, startStage: out.start_stage })
      res.status(201).set('Cache-Control', 'no-store').json(out)
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.get('/entitlements', wrap(async (_req, res) => {
    const { rows } = await pool.query(`SELECT e.id, e.source, e.start_stage, e.account_size_usd, e.reference, e.reason, e.issued_by, e.created_at,
        u.wallet_address, p.slug AS plan_slug, c.code, c.status AS coupon_status, c.uses_consumed, c.expires_at
      FROM granted_entitlements e JOIN openfund_users u ON u.id=e.user_id JOIN challenge_plans p ON p.id=e.challenge_plan_id JOIN coupons c ON c.id=e.coupon_id
      ORDER BY e.created_at DESC LIMIT 200`)
    res.set('Cache-Control', 'no-store').json({ entitlements: rows })
  }))

  /* ---------- plans: list, validate, diff, publish, retire ---------- */
  router.get('/plans', wrap(async (_req, res) => {
    const { rows } = await pool.query(`SELECT p.id, p.slug, p.name, p.status, p.configuration, p.created_at,
        (SELECT count(*)::int FROM openfund_challenges c WHERE c.challenge_plan_id=p.id) AS challenges,
        (SELECT jsonb_agg(jsonb_build_object('action', h.action, 'version', h.catalog_version, 'actor', h.actor, 'reason', h.reason, 'at', h.created_at) ORDER BY h.id DESC)
           FROM plan_catalog_history h WHERE h.plan_slug=p.slug) AS history
      FROM challenge_plans p ORDER BY p.created_at`)
    res.set('Cache-Control', 'no-store').json({ plans: rows })
  }))

  /* dry run: problems, the normalized engine rules and the diff against the published row */
  router.post('/plans/preview', wrap(async (req, res) => {
    const draft = validatePlanDraft(req.body)
    const { rows: [current] } = await pool.query('SELECT name, status, configuration FROM challenge_plans WHERE slug=$1', [draft.slug])
    const version = Number(current?.configuration?.catalogVersion ?? 0) + 1
    res.json({ slug: draft.slug, name: draft.name, problems: draft.problems, rules: draft.rules, nextCatalogVersion: version,
      exists: !!current, diff: configurationDiff(current?.configuration ?? {}, { ...draft.configuration, catalogVersion: version }),
      nameChanged: current ? current.name !== draft.name : true })
  }))

  router.post('/plans/publish', wrap(async (req, res) => {
    const actor = adminActor(req)
    const reason = reasonOf(req.body?.reason)
    const draft = validatePlanDraft(req.body)
    if (draft.problems.length) throw fail(422, 'plan_invalid', draft.problems)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [current] } = await client.query('SELECT id, name, status, configuration FROM challenge_plans WHERE slug=$1 FOR UPDATE', [draft.slug])
      const version = Number(current?.configuration?.catalogVersion ?? 0) + 1
      const configuration = { ...draft.configuration, catalogVersion: version }
      if (current && configurationDiff(current.configuration, configuration).length === 0 && current.name === draft.name) throw fail(409, 'plan_unchanged')
      if (current) await client.query(`UPDATE challenge_plans SET name=$2, configuration=$3, status='active' WHERE id=$1`, [current.id, draft.name, JSON.stringify(configuration)])
      else await client.query(`INSERT INTO challenge_plans (slug, name, configuration, status) VALUES ($1,$2,$3,'active')`, [draft.slug, draft.name, JSON.stringify(configuration)])
      await client.query(`INSERT INTO plan_catalog_history (plan_slug, action, catalog_version, name, previous, configuration, actor, reason)
        VALUES ($1,'publish',$2,$3,$4,$5,$6,$7)`, [draft.slug, version, draft.name, current ? JSON.stringify(current.configuration) : null, JSON.stringify(configuration), actor, reason])
      await client.query('COMMIT')
      await record('plan_published', null, req, { actor, reason, slug: draft.slug, catalogVersion: version })
      res.json({ ok: true, slug: draft.slug, catalogVersion: version })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  const planState = action => wrap(async (req, res) => {
    const actor = adminActor(req)
    const reason = reasonOf(req.body?.reason)
    if (!SLUG.test(req.params.slug)) throw fail(404, 'plan_not_found')
    const retire = action === 'retire'
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [plan] } = await client.query('SELECT id, name, status, configuration FROM challenge_plans WHERE slug=$1 FOR UPDATE', [req.params.slug])
      if (!plan) throw fail(404, 'plan_not_found')
      if ((plan.status === 'inactive') === retire) throw fail(409, retire ? 'plan_already_retired' : 'plan_already_active')
      await client.query('UPDATE challenge_plans SET status=$2 WHERE id=$1', [plan.id, retire ? 'inactive' : 'active'])
      await client.query(`INSERT INTO plan_catalog_history (plan_slug, action, catalog_version, name, previous, configuration, actor, reason)
        VALUES ($1,$2,$3,$4,$5,$5,$6,$7)`, [req.params.slug, action, Number(plan.configuration?.catalogVersion ?? 1), plan.name, JSON.stringify(plan.configuration), actor, reason])
      await client.query('COMMIT')
      await record(`plan_${action}d`, null, req, { actor, reason, slug: req.params.slug })
      res.json({ ok: true, slug: req.params.slug, status: retire ? 'inactive' : 'active' })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  })
  router.post('/plans/:slug/retire', planState('retire'))
  router.post('/plans/:slug/reactivate', planState('reactivate'))

  /* JSON problems for the console (422 carries the validator's list) */
  router.use((error, _req, res, next) => {
    if (error?.status === 422 && Array.isArray(error.details)) return res.status(422).json({ error: error.message, details: error.details })
    next(error)
  })
  return router
}
