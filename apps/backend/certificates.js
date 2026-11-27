/** Certificates attest recorded events; they never authorize financial mutations. */
import { Router } from 'express'
import { limiter } from './rate-limit-store.js'
import { adminAuth, adminActor } from './admin.js'
import { chainRecordsConfig, CERTIFICATE_CHAIN_KEY, txUrl, tokenUrl } from './chain-records.js'
const fail = (status, code) => Object.assign(new Error(code), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const serialPattern = /^[0-9a-f]{32}$/
export function certificateName(value) {
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw fail(400, 'invalid_certificate_name')
  const name = value.trim().normalize('NFC')
  if (name.length < 2 || name.length > 80 || /[\p{Cc}\p{Cf}<>]/u.test(name.replace(/\u200c/g, ''))) throw fail(400, 'invalid_certificate_name')
  return name
}
const view = r => ({ serial: r.serial, kind: r.kind, status: r.status, holder: r.holder,
  plan: r.plan, amount: r.amount, currency: r.currency, eventAt: r.event_at, issuedAt: r.issued_at,
  revokedAt: r.revoked_at, chain: r.chain ?? null })

/** ADR 0063: the matching on-chain certificate (soulbound NFT), when recorded. */
const chainCfg = chainRecordsConfig()
async function withChain(pool, rows) {
  const keys = rows.map(r => CERTIFICATE_CHAIN_KEY[r.kind] && r.source_id ? `cert:${CERTIFICATE_CHAIN_KEY[r.kind]}:${r.source_id}` : null)
  const wanted = keys.filter(Boolean)
  if (!wanted.length) return rows
  const found = new Map((await pool.query(`SELECT record_key, status, tx_hash, token_id FROM chain_records WHERE record_key = ANY($1)`, [wanted])
    .catch(() => ({ rows: [] }))).rows.map(c => [c.record_key, c]))
  return rows.map((r, i) => {
    const c = keys[i] && found.get(keys[i])
    return c ? { ...r, chain: { network: chainCfg.network, status: c.status, txUrl: txUrl(chainCfg, c.tx_hash), tokenUrl: tokenUrl(chainCfg, c.token_id) } } : r
  })
}

/** Reconcile from server-owned evidence, serialized per user and idempotent per event. */
export async function syncCertificates(pool, userId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const identity = (await client.query(`SELECT i.display_name, u.wallet_address FROM certificate_identities i
      JOIN openfund_users u ON u.id=i.user_id WHERE i.user_id=$1 FOR UPDATE OF i`, [userId])).rows[0]
    if (!identity) { await client.query('COMMIT'); return }
    const holder = identity.display_name || identity.wallet_address
    const events = (await client.query(`
      SELECT 'purchase' AS kind, o.id AS source_id, p.name AS plan, o.account_size_usd AS amount, o.paid_at AS event_at
      FROM purchase_orders o JOIN challenge_plans p ON p.id=o.challenge_plan_id
      WHERE o.user_id=$1 AND o.status='paid' AND o.paid_at IS NOT NULL AND EXISTS
        (SELECT 1 FROM openfund_challenges c WHERE c.purchase_order_id=o.id AND c.user_id=o.user_id
          AND NOT coalesce(c.rules_snapshot ? 'controlledTest',false))
      UNION ALL
      SELECT 'completion', c.id, p.name, c.account_size_usd, c.completed_at
      FROM challenge_reviews r JOIN openfund_challenges c ON c.id=r.challenge_id
      JOIN challenge_plans p ON p.id=c.challenge_plan_id
      WHERE c.user_id=$1 AND c.status='passed' AND c.completed_at IS NOT NULL AND c.account_size_usd > 0
        AND (c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id))
        AND NOT coalesce(c.rules_snapshot ? 'controlledTest',false)
        AND r.decision='approved' AND r.actor IS NOT NULL AND r.funded_challenge_id IS NOT NULL
      UNION ALL
      SELECT 'payout', w.id, p.name, w.amount_usd, (w.payment_evidence->>'transactionAt')::timestamptz
      FROM withdrawal_requests w JOIN openfund_challenges c ON c.id=w.challenge_id
      JOIN challenge_plans p ON p.id=c.challenge_plan_id
      WHERE w.user_id=$1 AND c.user_id=w.user_id AND w.status='paid'
        AND (c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id))
        AND w.payment_evidence->>'finality'='finalized' AND w.payment_evidence->>'transactionAt' IS NOT NULL
      UNION ALL
      /* ADR 0062: Free Trial activation (the stage-1 trial row), any phase-1
         pass of a two-phase evaluation (trial or paid), and the final pass of
         a Free Trial (no reviewer: a trial is never funded) */
      SELECT 'trial', c.id, p.name, c.account_size_usd, c.started_at
      FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id
      WHERE c.user_id=$1 AND c.parent_challenge_id IS NULL AND c.started_at IS NOT NULL AND c.account_size_usd > 0
        AND coalesce((c.rules_snapshot->>'free')::boolean, false)
        AND (c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id))
      UNION ALL
      SELECT 'stage_pass', c.id, p.name, c.account_size_usd, c.completed_at
      FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id
      WHERE c.user_id=$1 AND c.stage=1 AND c.status='passed' AND c.completed_at IS NOT NULL AND c.account_size_usd > 0
        AND NOT coalesce(c.rules_snapshot ? 'controlledTest',false)
        AND EXISTS (SELECT 1 FROM challenge_events e WHERE e.challenge_id=c.id AND e.kind='stage_passed')
        AND (c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id))
      UNION ALL
      SELECT 'trial_pass', c.id, p.name, c.account_size_usd, c.completed_at
      FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id
      WHERE c.user_id=$1 AND c.status='passed' AND c.completed_at IS NOT NULL AND c.account_size_usd > 0
        AND coalesce((c.rules_snapshot->>'free')::boolean, false)
        AND EXISTS (SELECT 1 FROM challenge_events e WHERE e.challenge_id=c.id AND e.kind='passed')
        AND (c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id))
      UNION ALL
      /* Premium League badges (rank 1–10 and Finisher): amount = frozen final equity */
      SELECT 'tournament', a.id, t.name_en || ' · ' || a.item, s.final_equity, s.frozen_at
      FROM tournament_awards a JOIN tournament_registrations r ON r.id=a.registration_id
      JOIN tournaments t ON t.id=a.tournament_id
      JOIN tournament_standings s ON s.tournament_id=a.tournament_id AND s.registration_id=a.registration_id
      WHERE r.user_id=$1 AND a.kind='badge' AND a.status='issued' AND s.final_equity > 0`, [userId])).rows
    for (const event of events) {
      const inserted = await client.query(`INSERT INTO certificates (user_id,kind,source_id,holder,plan,amount,event_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (kind,source_id) DO NOTHING RETURNING serial`,
      [userId, event.kind, event.source_id, holder, event.plan, event.amount, event.event_at])
      if (inserted.rowCount) await client.query(`INSERT INTO certificate_events (serial,action,actor,detail)
        VALUES ($1,'issued','server', $2)`, [inserted.rows[0].serial, JSON.stringify({ kind: event.kind, sourceId: event.source_id })])
    }
    await client.query('COMMIT')
  } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
}

export function certificateRoutes({ pool, requireAuth }) {
  const router = Router()
  const publicLimit = limiter('certificates.public', { windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'rate_limited' } })
  router.post('/certificates/verify', publicLimit, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const serial = req.body?.serial
    if (typeof serial !== 'string' || !serialPattern.test(serial)) return res.status(404).json({ status: 'not_found' })
    /* ADR 0033: a certificate issued by the other region is verified from its synchronized read model */
    const row = (await pool.query('SELECT * FROM certificates WHERE serial=$1', [serial])).rows[0]
      ?? (await pool.query(`SELECT data FROM region_remote_rows WHERE entity='certificate' AND entity_id=$1`, [serial]).catch(() => ({ rows: [] }))).rows[0]?.data
    if (!row) return res.status(404).json({ status: 'not_found' })
    // A revoked record discloses only its identifier and revocation date.
    res.json(row.status === 'revoked' ? { status: 'revoked', serial, revokedAt: row.revoked_at } : { status: 'valid', certificate: view((await withChain(pool, [row]))[0]) })
  }))
  router.get('/certificates', requireAuth, wrap(async (req, res) => {
    await syncCertificates(pool, req.user.user_id)
    const identity = (await pool.query('SELECT display_name, confirmed_at FROM certificate_identities WHERE user_id=$1', [req.user.user_id])).rows[0]
    const rows = (await pool.query('SELECT * FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC', [req.user.user_id])).rows
    res.set('Cache-Control', 'no-store').json({ identity: identity || null, certificates: (await withChain(pool, rows)).map(view) })
  }))
  router.post('/certificates/identity', requireAuth, publicLimit, wrap(async (req, res) => {
    if (req.body?.confirmed !== true) throw fail(400, 'certificate_confirmation_required')
    const name = certificateName(req.body?.displayName)
    const result = await pool.query(`INSERT INTO certificate_identities (user_id,display_name) VALUES ($1,$2)
      ON CONFLICT (user_id) DO NOTHING RETURNING user_id`, [req.user.user_id, name])
    if (!result.rowCount) throw fail(409, 'certificate_name_locked')
    await syncCertificates(pool, req.user.user_id)
    res.status(201).json({ ok: true })
  }))
  return router
}

export function certificateAdminRoutes({ pool }) {
  const router = Router()
  router.use(adminAuth)
  router.post('/:serial/revoke', wrap(async (req, res) => {
    const actor = adminActor(req), reason = req.body?.reason
    if (!serialPattern.test(req.params.serial) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) throw fail(400, 'invalid_revocation')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const row = (await client.query('SELECT * FROM certificates WHERE serial=$1 FOR UPDATE', [req.params.serial])).rows[0]
      if (!row) throw fail(404, 'certificate_not_found')
      if (row.status !== 'revoked') {
        await client.query(`UPDATE certificates SET status='revoked',revoked_at=now() WHERE serial=$1`, [row.serial])
        await client.query(`INSERT INTO certificate_events (serial,action,actor,detail) VALUES ($1,'revoked',$2,$3)`, [row.serial, actor, JSON.stringify({ reason: reason.trim() })])
      }
      await client.query('COMMIT')
      res.json({ ok: true, status: 'revoked' })
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
  }))
  // Corrections affect future issuance only. Existing snapshots require revocation.
  router.post('/identities/:userId/correct', wrap(async (req, res) => {
    const actor = adminActor(req), reason = req.body?.reason, name = certificateName(req.body?.displayName)
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) throw fail(400, 'reason_required')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.userId)) throw fail(400, 'invalid_user')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const old = (await client.query('SELECT * FROM certificate_identities WHERE user_id=$1 FOR UPDATE', [req.params.userId])).rows[0]
      if (!old) throw fail(404, 'identity_not_found')
      await client.query('UPDATE certificate_identities SET display_name=$2 WHERE user_id=$1', [req.params.userId, name])
      await client.query(`INSERT INTO audit_log (action,user_id,details) VALUES ('certificate_identity_corrected',$1,$2)`,
        [req.params.userId, JSON.stringify({ actor, reason: reason.trim(), previous: old.display_name, next: name })])
      await client.query('COMMIT'); res.json({ ok: true })
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
  }))
  return router
}
