/** Certificates attest recorded events; they never authorize financial mutations. */
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { adminAuth, adminActor } from './admin.js'
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
  revokedAt: r.revoked_at })

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
        (SELECT 1 FROM openfund_challenges c WHERE c.purchase_order_id=o.id AND c.user_id=o.user_id)
      UNION ALL
      SELECT 'completion', c.id, p.name, c.account_size_usd, c.completed_at
      FROM challenge_reviews r JOIN openfund_challenges c ON c.id=r.challenge_id
      JOIN challenge_plans p ON p.id=c.challenge_plan_id
      WHERE c.user_id=$1 AND c.status='passed' AND c.completed_at IS NOT NULL AND c.account_size_usd > 0
        AND r.decision='approved' AND r.actor IS NOT NULL AND r.funded_challenge_id IS NOT NULL
      UNION ALL
      SELECT 'payout', w.id, p.name, w.amount_usd, w.reviewed_at
      FROM withdrawal_requests w JOIN openfund_challenges c ON c.id=w.challenge_id
      JOIN challenge_plans p ON p.id=c.challenge_plan_id
      WHERE w.user_id=$1 AND c.user_id=w.user_id AND w.status='paid'
        AND nullif(trim(w.payout_ref),'') IS NOT NULL AND w.reviewed_at IS NOT NULL`, [userId])).rows
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
  const publicLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'rate_limited' } })
  router.post('/certificates/verify', publicLimit, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const serial = req.body?.serial
    if (typeof serial !== 'string' || !serialPattern.test(serial)) return res.status(404).json({ status: 'not_found' })
    const row = (await pool.query('SELECT * FROM certificates WHERE serial=$1', [serial])).rows[0]
    if (!row) return res.status(404).json({ status: 'not_found' })
    // A revoked record discloses only its identifier and revocation date.
    res.json(row.status === 'revoked' ? { status: 'revoked', serial, revokedAt: row.revoked_at } : { status: 'valid', certificate: view(row) })
  }))
  router.get('/certificates', requireAuth, wrap(async (req, res) => {
    await syncCertificates(pool, req.user.user_id)
    const identity = (await pool.query('SELECT display_name, confirmed_at FROM certificate_identities WHERE user_id=$1', [req.user.user_id])).rows[0]
    const rows = (await pool.query('SELECT * FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC', [req.user.user_id])).rows
    res.set('Cache-Control', 'no-store').json({ identity: identity || null, certificates: rows.map(view) })
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
    if (!/^[0-9a-f-]{36}$/.test(req.params.userId)) throw fail(400, 'invalid_user')
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
