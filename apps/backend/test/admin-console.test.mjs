/**
 * Backstage console operations (admin-console.js) on real PostgreSQL with
 * the real engine: user profile, notes and tags; challenge decisions
 * (extend, void, manual fail, manual pass to the next stage, settlement
 * refused without a fresh mark); granted entitlements redeemed through the
 * one provisioning path (funded stage 0); plan preview, publish (catalog
 * version bump, history, existing snapshots untouched), retire/reactivate.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { Engine } from '../engine.js'
import { consoleAdminRoutes, validatePlanDraft } from '../admin-console.js'
import { provisionOrderTx } from '../purchases.js'
import { PLAN_SEEDS } from '../plan-catalog.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'console-test-token-0123456789abcdef'
const market = { price: '50000', at: Date.now(), fresh: true,
  markets: new Map([['BTC/USD', { base: 'BTC', group: 'crypto', maxLeverage: 100 }]]),
  marketMeta(m) { return this.markets.get(m) },
  mark(m) { return this.marketMeta(m) && this.fresh ? { mark: this.price, at: Date.now() } : null },
  tradeable(m) { return this.fresh && this.marketMeta(m) ? { ok: true, mark: this.price, meta: this.marketMeta(m) } : { ok: false, reason: 'stale_price' } } }
const engine = new Engine(pool, market)
const audits = []
let server, base, user, wallet, standard

const call = async (method, path, body, actor = 'qa owner') => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...(actor ? { 'x-admin-actor': actor } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const newChallenge = async (status = 'started', stage = 1, slug = 'standard', expires = "now() + interval '10 days'") => {
  const plan = (await pool.query('SELECT id, configuration FROM challenge_plans WHERE slug=$1', [slug])).rows[0]
  const { rows: [c] } = await pool.query(
    `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, stage, account_size_usd, rules_snapshot, started_at, expires_at)
     VALUES ($1,$2,$3,$4,10000,$5, now(), ${expires}) RETURNING *`, [user.id, plan.id, status, stage, JSON.stringify({ phases: plan.configuration.phases, rulesVersion: 3, dailyLossPct: 5, maxTotalLossPct: 10 })])
  return c
}

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  for (const p of PLAN_SEEDS) await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING`, [p.slug, p.name, JSON.stringify(p.configuration)])
  wallet = '0x' + crypto.randomBytes(20).toString('hex')
  user = (await pool.query('INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id', [wallet])).rows[0]
  standard = (await pool.query(`SELECT * FROM challenge_plans WHERE slug='standard'`)).rows[0]
  const app = express()
  app.use(express.json())
  app.use('/admin/console', consoleAdminRoutes({ pool, engine, audit: async (action, userId, _req, details) => { audits.push({ action, userId, details }) } }))
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { server?.close(); await pool.end() })

test('the console requires the service token and a named actor', async () => {
  const anonymous = await fetch(base + '/admin/console/plans')
  assert.equal(anonymous.status, 403)
  const noActor = await call('POST', `/admin/console/users/${user.id}/notes`, { note: 'x' }, null)
  assert.equal(noActor.status, 400)
  assert.equal(noActor.data.error, 'admin_actor_required')
})

test('user profile aggregates records, notes are append-only and tags are a set', async () => {
  assert.equal((await call('POST', `/admin/console/users/${user.id}/notes`, { note: 'Called about a payout delay.' })).status, 201)
  assert.equal((await call('POST', `/admin/console/users/${user.id}/tags`, { tags: ['vip', 'onboarding', 'vip'], reason: 'onboarding review' })).status, 200)
  const badTag = await call('POST', `/admin/console/users/${user.id}/tags`, { tags: ['Not Valid'], reason: 'test' })
  assert.equal(badTag.status, 400)
  const { status, data } = await call('GET', `/admin/console/users/${user.id}/profile`)
  assert.equal(status, 200)
  assert.equal(data.user.wallet_address, wallet)
  assert.deepEqual(data.tags, ['onboarding', 'vip'])
  assert.equal(data.notes[0].note, 'Called about a payout delay.')
  assert.equal(data.notes[0].actor, 'admin:qa owner')
  for (const key of ['purchases', 'challenges', 'support', 'certificates', 'entitlements', 'tournament', 'migration']) assert.ok(Array.isArray(data[key]), key)
  await assert.rejects(pool.query('UPDATE user_admin_notes SET note=$1 WHERE user_id=$2', ['edited', user.id]), /append_only_table/)
  assert.ok(audits.some(a => a.action === 'user_tags_set' && a.details.reason === 'onboarding review'))
})

test('challenge decisions: extend, manual fail, void and the next stage on a manual pass', async () => {
  const extend = await newChallenge()
  const before = (await pool.query('SELECT expires_at FROM openfund_challenges WHERE id=$1', [extend.id])).rows[0].expires_at
  const r1 = await call('POST', `/admin/console/challenges/${extend.id}/action`, { action: 'extend', days: 5, reason: 'platform outage on 21 Nov' })
  assert.equal(r1.status, 200)
  assert.equal(new Date(r1.data.expiresAt) - new Date(before), 5 * 86_400_000)
  assert.equal((await call('POST', `/admin/console/challenges/${extend.id}/action`, { action: 'extend', days: 500, reason: 'too long' })).data.error, 'invalid_days')
  assert.equal((await call('POST', `/admin/console/challenges/${extend.id}/action`, { action: 'extend', days: 3 })).data.error, 'reason_required')
  const unlimited = await newChallenge('started', 1, 'standard', 'NULL')
  assert.equal((await call('POST', `/admin/console/challenges/${unlimited.id}/action`, { action: 'extend', days: 3, reason: 'no limit to extend' })).data.error, 'no_time_limit')

  const failed = await newChallenge()
  assert.equal((await call('POST', `/admin/console/challenges/${failed.id}/action`, { action: 'fail', reason: 'copy trading between accounts' })).data.status, 'failed')
  const event = (await pool.query(`SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='violation'`, [failed.id])).rows[0].detail
  assert.equal(event.violations[0].rule, 'manual_review')
  assert.equal(event.actor, 'admin:qa owner')
  assert.equal((await call('POST', `/admin/console/challenges/${failed.id}/action`, { action: 'pass', reason: 'already terminal' })).status, 409)

  const voided = await newChallenge('created')
  assert.equal((await call('POST', `/admin/console/challenges/${voided.id}/action`, { action: 'void', reason: 'duplicate order refunded' })).data.status, 'cancelled')

  const stage1 = await newChallenge()
  const pass = await call('POST', `/admin/console/challenges/${stage1.id}/action`, { action: 'pass', reason: 'target reached before a stale mark' })
  assert.equal(pass.data.status, 'passed')
  const next = (await pool.query('SELECT status, stage, parent_challenge_id FROM openfund_challenges WHERE id=$1', [pass.data.nextChallengeId])).rows[0]
  assert.deepEqual([next.status, next.stage, next.parent_challenge_id], ['started', 2, stage1.id])
  assert.ok(audits.some(a => a.action === 'challenge_admin_pass' && a.details.challengeId === stage1.id))
})

test('a terminal decision is refused while an open position has no fresh mark, then settles through the engine', async () => {
  const plan = (await pool.query(`SELECT id FROM challenge_plans WHERE slug='standard'`)).rows[0]
  const { rows: [c] } = await pool.query(
    `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, stage, account_size_usd) VALUES ($1,$2,'created',1,10000) RETURNING *`, [user.id, plan.id])
  const started = await engine.challenges.start(user.id, c.id)
  await engine.submitOrder(user.id, { market: 'BTC/USD', side: 'long', order_type: 'market', margin: 100, leverage: 2 }, crypto.randomUUID(), started.demo_account_id)
  const openCount = async () => (await pool.query(`SELECT count(*)::int n FROM trading_positions WHERE account_id=$1 AND status='open'`, [started.demo_account_id])).rows[0].n
  assert.equal(await openCount(), 1)
  market.fresh = false
  try {
    assert.equal((await call('POST', `/admin/console/challenges/${c.id}/action`, { action: 'fail', reason: 'manual review' })).data.error, 'settlement_unavailable')
    assert.equal((await pool.query('SELECT status FROM openfund_challenges WHERE id=$1', [c.id])).rows[0].status, 'started')
  } finally { market.fresh = true }
  assert.equal((await call('POST', `/admin/console/challenges/${c.id}/action`, { action: 'fail', reason: 'manual review' })).data.status, 'failed')
  assert.equal(await openCount(), 0, 'the open position closed at the server mark')
  assert.equal((await pool.query('SELECT status FROM demo_accounts WHERE id=$1', [started.demo_account_id])).rows[0].status, 'closed')
})

test('entitlements: single-use internal coupons; a funded entitlement provisions stage 0', async () => {
  const bad = await call('POST', '/admin/console/entitlements', { walletAddress: wallet, planSlug: 'standard', accountSizeUsd: 12345, reason: 'wrong size' })
  assert.equal(bad.data.error, 'invalid_account_size')
  const r = await call('POST', '/admin/console/entitlements', { walletAddress: wallet, planSlug: 'standard', accountSizeUsd: 10000, funded: true, reason: 'goodwill after outage' })
  assert.equal(r.status, 201)
  assert.equal(r.data.start_stage, 0)
  const coupon = (await pool.query('SELECT * FROM coupons WHERE code=$1', [r.data.code])).rows[0]
  assert.deepEqual([coupon.kind, Number(coupon.value), coupon.max_redemptions, coupon.internal], ['percent', 100, 1, true])
  /* the one provisioning path reads the entitlement and starts at the funded stage */
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [order] } = await client.query(
      `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, coupon_id, payment_required, payment_method)
       VALUES ($1,$2,10000,0,'pending',$3,false,'internal_coupon') RETURNING *`, [user.id, standard.id, coupon.id])
    await provisionOrderTx(client, { order, source: 'test' })
    const challenge = (await client.query('SELECT stage, rules_snapshot FROM openfund_challenges WHERE purchase_order_id=$1', [order.id])).rows[0]
    assert.equal(challenge.stage, 0)
    assert.equal(challenge.rules_snapshot.funded, true)
    const redeemed = (await client.query(`SELECT detail FROM challenge_events e JOIN openfund_challenges c ON c.id=e.challenge_id WHERE c.purchase_order_id=$1 AND e.kind='entitlement_redeemed'`, [order.id])).rows[0]
    assert.equal(redeemed.detail.source, 'admin')
  } finally { await client.query('ROLLBACK').catch(() => {}); client.release() }
})

test('plans: preview shows problems and the diff; publish bumps the version; retire and reactivate', async () => {
  /* the published row is the base of the draft, as in Backstage */
  const base = { configuration: (await pool.query(`SELECT configuration FROM challenge_plans WHERE slug='standard'`)).rows[0].configuration }
  const draft = { slug: 'standard', nameFa: 'استاندارد', nameEn: 'Standard', configuration: { ...base.configuration, phase1TargetPct: 9 } }
  const preview = await call('POST', '/admin/console/plans/preview', draft)
  assert.equal(preview.status, 200)
  assert.deepEqual(preview.data.problems, [])
  assert.deepEqual(preview.data.diff.map(d => d.field), ['phase1TargetPct'])
  const invalid = await call('POST', '/admin/console/plans/preview', { ...draft, configuration: { ...draft.configuration, dailyLossPct: 0 } })
  assert.ok(invalid.data.problems.some(p => /loss limits must be positive/.test(p)))
  assert.ok(invalid.data.problems.some(p => /cannot evaluate/.test(p)))
  assert.equal((await call('POST', '/admin/console/plans/publish', { ...draft, configuration: { ...draft.configuration, dailyLossPct: 0 }, reason: 'bad draft' })).status, 422)

  const existing = await newChallenge()
  const snapshotBefore = (await pool.query('SELECT rules_snapshot FROM openfund_challenges WHERE id=$1', [existing.id])).rows[0].rules_snapshot
  const versionBefore = Number((await pool.query(`SELECT configuration->>'catalogVersion' v FROM challenge_plans WHERE slug='standard'`)).rows[0].v)
  const published = await call('POST', '/admin/console/plans/publish', { ...draft, reason: 'raise phase-1 target after review' })
  assert.equal(published.status, 200)
  assert.equal(published.data.catalogVersion, versionBefore + 1)
  const row = (await pool.query(`SELECT name, configuration FROM challenge_plans WHERE slug='standard'`)).rows[0]
  assert.equal(row.configuration.phase1TargetPct, 9)
  assert.equal(row.name, 'استاندارد — Standard')
  assert.deepEqual((await pool.query('SELECT rules_snapshot FROM openfund_challenges WHERE id=$1', [existing.id])).rows[0].rules_snapshot, snapshotBefore, 'existing challenges keep their snapshot')
  const history = (await pool.query(`SELECT action, catalog_version, previous->>'phase1TargetPct' AS was FROM plan_catalog_history WHERE plan_slug='standard' ORDER BY id DESC LIMIT 1`)).rows[0]
  assert.deepEqual([history.action, history.catalog_version, history.was], ['publish', versionBefore + 1, String(base.configuration.phase1TargetPct)])
  assert.equal((await call('POST', '/admin/console/plans/publish', { ...draft, reason: 'same again' })).data.error, 'plan_unchanged')

  assert.equal((await call('POST', '/admin/console/plans/standard/retire', { reason: 'replaced by v2' })).data.status, 'inactive')
  assert.equal((await call('POST', '/admin/console/plans/standard/retire', { reason: 'twice' })).data.error, 'plan_already_retired')
  assert.equal((await call('POST', '/admin/console/plans/standard/reactivate', { reason: 'restored' })).data.status, 'active')
  /* restore the seed so other suites see the published catalog */
  await pool.query(`UPDATE challenge_plans SET configuration=$1 WHERE slug='standard'`, [JSON.stringify({ ...base.configuration, catalogVersion: versionBefore })])
  const list = await call('GET', '/admin/console/plans')
  assert.ok(list.data.plans.find(p => p.slug === 'standard').history.length >= 3)
})

test('the draft validator rejects malformed identity before touching the database', () => {
  assert.throws(() => validatePlanDraft({ slug: 'Bad Slug', nameFa: 'a', nameEn: 'b', configuration: {} }), /invalid_slug/)
  assert.throws(() => validatePlanDraft({ slug: 'ok-plan', nameFa: 'a — b', nameEn: 'b', configuration: {} }), /invalid_name/)
  assert.throws(() => validatePlanDraft({ slug: 'ok-plan', nameFa: 'a', nameEn: 'b', configuration: [] }), /invalid_configuration/)
})
