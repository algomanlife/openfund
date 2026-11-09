/**
 * Openfund administrative API (v0.3.1 soft launch).
 *
 * Service-token authorized operational endpoints for:
 *  - user directory + detail (profile, challenges, purchases, payments,
 *    withdrawal requests, recent audit trail);
 *  - challenge directory (evaluation status, stage, account, metrics);
 *  - withdrawal review (approve / reject / mark paid) with reason
 *    recording, duplicate-action prevention and audit logging.
 *
 * SECURITY MODEL
 *  - Authorization: `Authorization: Bearer <ADMIN_API_TOKEN>` matched
 *    with a constant-time comparison. While ADMIN_API_TOKEN is unset
 *    the whole admin API stays DISABLED (404) — no default token,
 *    production activation requires explicit configuration.
 *  - The backend remains the ONLY writer of financial records. These
 *    endpoints never mutate balances, positions, ledger, challenge
 *    evaluation state or payments — Directus keeps its read/edit
 *    interface, and withdrawal REVIEW is an operational decision on
 *    withdrawal_requests only. Payout EXECUTION (transferring real
 *    funds) is deliberately out of scope: marking 'paid' records the
 *    operator's payout reference and nothing more.
 */
import { Router } from 'express'
import crypto from 'node:crypto'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = (status, error) => { const e = new Error(error); e.status = status; return e }
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const PAGE = (v, def, max) => {
  const n = Number(v)
  if (v === undefined) return def
  if (!Number.isInteger(n) || n < 0 || n > max) throw fail(400, 'invalid_pagination')
  return n
}

/* the admin API is disabled until the operator sets ADMIN_API_TOKEN */
export function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN || null
  if (!expected) return res.status(404).json({ error: 'not_found' })
  const provided = String((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
  const a = Buffer.from(provided), b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return res.status(403).json({ error: 'admin_forbidden' })
  next()
}

/**
 * Named operator for financial decisions (`X-Admin-Actor`). The shared
 * service token authorizes; the actor name attributes the decision in the
 * financial audit trail. Decisions without a valid actor are refused.
 */
export function adminActor(req) {
  const actor = String(req.headers['x-admin-actor'] || '').trim()
  if (!/^[\w.@ -]{2,60}$/.test(actor)) throw Object.assign(new Error('admin_actor_required'), { status: 400 })
  return `admin:${actor}`
}

export function adminRoutes({ pool, audit }) {
  const router = Router()
  router.use(adminAuth)

  /* ---------- users ---------- */
  router.get('/users', wrap(async (req, res) => {
    const limit = PAGE(req.query.limit, 25, 100), offset = PAGE(req.query.offset, 0, 1000000)
    const params = []
    let where = 'TRUE'
    if (req.query.search) {
      params.push(`%${String(req.query.search).slice(0, 80).toLowerCase()}%`)
      where += ` AND (lower(u.wallet_address) LIKE $1 OR lower(coalesce(u.display_name,'')) LIKE $1)`
    }
    if (['active', 'suspended'].includes(req.query.status)) {
      params.push(req.query.status)
      where += ` AND u.status = $${params.length}`
    }
    const total = (await pool.query(`SELECT count(*)::int c FROM openfund_users u WHERE ${where}`, params)).rows[0].c
    const { rows } = await pool.query(
      `SELECT u.id, u.wallet_address, u.display_name, u.status, u.created_at, u.last_login_at,
              (SELECT count(*)::int FROM openfund_challenges c WHERE c.user_id = u.id) AS challenges,
              (SELECT count(*)::int FROM purchase_orders o WHERE o.user_id = u.id AND o.status = 'paid') AS purchases
         FROM openfund_users u WHERE ${where}
        ORDER BY u.created_at DESC LIMIT ${limit + 1} OFFSET ${offset}`, params)
    res.json({ total, users: rows.slice(0, limit) })
  }))

  router.get('/users/:id', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'user_not_found')
    const { rows: [user] } = await pool.query(
      `SELECT id, wallet_address, wallet_chain, display_name, status, created_at, updated_at, last_login_at
         FROM openfund_users WHERE id=$1`, [req.params.id])
    if (!user) throw fail(404, 'user_not_found')
    const challenges = (await pool.query(
      `SELECT c.id, c.status, c.stage, c.account_size_usd, c.created_at, c.started_at, c.completed_at,
              p.slug AS plan_slug, c.demo_account_id
         FROM openfund_challenges c JOIN challenge_plans p ON p.id = c.challenge_plan_id
        WHERE c.user_id=$1 ORDER BY c.created_at DESC`, [req.params.id])).rows
    const purchases = (await pool.query(
      `SELECT o.id, o.status, o.account_size_usd, o.price_usd, o.created_at, o.paid_at,
              (SELECT json_build_object('txHash', pm.tx_hash, 'chainId', pm.chain_id, 'status', pm.status, 'verifiedAt', pm.verified_at)
                 FROM payments pm WHERE pm.purchase_order_id = o.id LIMIT 1) AS payment,
              (SELECT c.id FROM openfund_challenges c WHERE c.purchase_order_id = o.id LIMIT 1) AS challenge_id
         FROM purchase_orders o WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 50`, [req.params.id])).rows
    const withdrawals = (await pool.query(
      `SELECT w.id, w.amount_usd, w.status, w.note, w.requested_at, w.reviewed_at, w.payout_ref
         FROM withdrawal_requests w WHERE w.user_id=$1 ORDER BY w.requested_at DESC LIMIT 50`, [req.params.id])).rows
    const activity = (await pool.query(
      `SELECT action, ts, ip, details FROM audit_log WHERE user_id=$1 ORDER BY id DESC LIMIT 50`, [req.params.id])).rows
    res.json({ user, challenges, purchases, withdrawals, activity })
  }))

  /* ---------- challenges ---------- */
  router.get('/challenges', wrap(async (req, res) => {
    const limit = PAGE(req.query.limit, 25, 100), offset = PAGE(req.query.offset, 0, 1000000)
    const params = []
    let where = 'TRUE'
    if (['created', 'started', 'passed', 'failed', 'expired', 'cancelled'].includes(req.query.status)) {
      params.push(req.query.status)
      where += ` AND c.status = $${params.length}`
    }
    if (uuid.test(req.query.user_id || '')) { params.push(req.query.user_id); where += ` AND c.user_id = $${params.length}` }
    const total = (await pool.query(`SELECT count(*)::int c FROM openfund_challenges c WHERE ${where}`, params)).rows[0].c
    const { rows } = await pool.query(
      `SELECT c.id, c.status, c.stage, c.account_size_usd, c.created_at, c.started_at, c.completed_at, c.expires_at,
              c.demo_account_id, p.slug AS plan_slug,
              u.wallet_address
         FROM openfund_challenges c
         JOIN challenge_plans p ON p.id = c.challenge_plan_id
         JOIN openfund_users u ON u.id = c.user_id
        WHERE ${where} ORDER BY c.created_at DESC LIMIT ${limit + 1} OFFSET ${offset}`, params)
    res.json({ total, challenges: rows.slice(0, limit) })
  }))

  /* ---------- withdrawals review ----------
     requested → approved | rejected (review)
     approved  → paid (payout reference recorded; no funds move here) */
  const WITHDRAWAL_ACTIONS = {
    approve: { from: 'requested', to: 'approved' },
    reject: { from: 'requested', to: 'rejected' },
    paid: { from: 'approved', to: 'paid' },
  }

  router.get('/withdrawals', wrap(async (req, res) => {
    const limit = PAGE(req.query.limit, 25, 100), offset = PAGE(req.query.offset, 0, 1000000)
    const params = []
    let where = 'TRUE'
    if (['requested', 'approved', 'paid', 'rejected', 'cancelled'].includes(req.query.status)) {
      params.push(req.query.status)
      where += ` AND w.status = $${params.length}`
    }
    const total = (await pool.query(`SELECT count(*)::int c FROM withdrawal_requests w WHERE ${where}`, params)).rows[0].c
    const { rows } = await pool.query(
      `SELECT w.id, w.user_id, u.wallet_address, w.amount_usd, w.status, w.note, w.requested_at,
              w.reviewed_at, w.payout_ref, w.challenge_id,
              (SELECT p.slug FROM openfund_challenges c JOIN challenge_plans p ON p.id = c.challenge_plan_id WHERE c.id = w.challenge_id) AS plan_slug
         FROM withdrawal_requests w JOIN openfund_users u ON u.id = w.user_id
        WHERE ${where} ORDER BY w.requested_at DESC LIMIT ${limit + 1} OFFSET ${offset}`, params)
    res.json({ total, withdrawals: rows.slice(0, limit) })
  }))

  router.post('/withdrawals/:id/review', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'withdrawal_not_found')
    const { action, note, payoutRef } = req.body || {}
    const spec = WITHDRAWAL_ACTIONS[action]
    if (!spec) throw fail(400, 'invalid_action')
    if (note != null && (typeof note !== 'string' || note.length > 500)) throw fail(400, 'invalid_note')
    if (action === 'paid' && (typeof payoutRef !== 'string' || !payoutRef.trim() || payoutRef.length > 200))
      throw fail(400, 'payout_ref_required')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const w = (await client.query('SELECT * FROM withdrawal_requests WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0]
      if (!w) throw fail(404, 'withdrawal_not_found')
      if (w.status === spec.to) { await client.query('COMMIT'); return res.json({ ok: true, duplicate: true, status: w.status }) }
      if (w.status !== spec.from) throw fail(409, `withdrawal_${w.status}_not_reviewable`)
      await client.query(
        `UPDATE withdrawal_requests SET status=$2, reviewed_at=now(), note=coalesce($3, note), payout_ref=coalesce($4, payout_ref)
          WHERE id=$1`,
        [req.params.id, spec.to, note ?? null, action === 'paid' ? payoutRef.trim() : null])
      await client.query('COMMIT')
      await audit(`withdrawal_${spec.to}`, w.user_id, req, {
        withdrawalId: req.params.id, amount: Number(w.amount_usd), action, note: note ?? null,
        payoutRef: action === 'paid' ? payoutRef.trim() : undefined,
      })
      res.json({ ok: true, status: spec.to })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally { client.release() }
  }))

  return router
}
