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
 *    funds) is external. Reward settlement records verified evidence for
 *    a transfer the operator has already made.
 */
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import crypto from 'node:crypto'
import { governanceAdminRoutes } from './governance-routes.js'
import { reverseRewardTx, onRewardPaidTx } from './rewards.js'
import { financialAudit } from './financial-audit.js'
import { createPayoutClaimClient } from './payout-claims.js'
import { payoutHash, payoutVerifier } from './payout-settlement.js'

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

export function adminRoutes({ pool, audit, verifyPayout = payoutVerifier(), claimPayout = createPayoutClaimClient({ region: 'GLOBAL' }) }) {
  const router = Router()
  router.use(adminAuth)

  /* Company Management governance operations (same token gate; no financial endpoints) */
  router.use('/governance', governanceAdminRoutes({ pool }))

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
              w.reviewed_at, w.payout_ref, w.challenge_id, w.recipient_wallet, w.approved_by, w.payment_evidence, w.eligibility,
              (SELECT p.slug FROM openfund_challenges c JOIN challenge_plans p ON p.id = c.challenge_plan_id WHERE c.id = w.challenge_id) AS plan_slug
         FROM withdrawal_requests w JOIN openfund_users u ON u.id = w.user_id
        WHERE ${where} ORDER BY w.requested_at DESC LIMIT ${limit + 1} OFFSET ${offset}`, params)
    res.json({ total, withdrawals: rows.slice(0, limit) })
  }))

  const withdrawalReviewLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'rate_limited' } })
  router.post('/withdrawals/:id/review', withdrawalReviewLimit, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'withdrawal_not_found')
    const { action, note, payoutRef } = req.body || {}
    const spec = WITHDRAWAL_ACTIONS[action]
    if (!spec) throw fail(400, 'invalid_action')
    if (note != null && (typeof note !== 'string' || note.length > 500)) throw fail(400, 'invalid_note')
    if (action === 'reject' && !(typeof note === 'string' && note.trim())) throw fail(400, 'reason_required')
    if (action === 'paid' && (typeof payoutRef !== 'string' || !payoutRef.trim() || payoutRef.length > 200))
      throw fail(400, 'payout_ref_required')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const w = (await client.query('SELECT * FROM withdrawal_requests WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0]
      if (!w) throw fail(404, 'withdrawal_not_found')
      const reward = w.kind === 'reward'
      if (w.status === spec.to) {
        if (reward && action === 'paid' && w.payout_ref?.toLowerCase() !== payoutRef.trim().toLowerCase())
          throw fail(409, 'payout_already_recorded')
        await client.query('COMMIT')
        return res.json({ ok: true, duplicate: true, status: w.status })
      }
      if (w.status !== spec.from) throw fail(409, `withdrawal_${w.status}_not_reviewable`)
      const actor = reward ? adminActor(req) : null
      let evidence = null
      let reference = action === 'paid' ? payoutRef.trim() : null
      let recipient = w.recipient_wallet
      if (reward && !recipient && action === 'approve') {
        recipient = (await client.query('SELECT wallet_address FROM openfund_users WHERE id=$1 FOR SHARE', [w.user_id])).rows[0].wallet_address
      }
      if (reward && action === 'paid') {
        if (!payoutHash.test(reference)) throw fail(400, 'payout_transaction_hash_required')
        reference = reference.toLowerCase()
        if (!w.approved_by || !recipient) throw fail(409, 'payout_approval_evidence_required')
        const used = await client.query(`SELECT 1 FROM withdrawal_requests WHERE lower(payout_ref)=$1 AND status='paid' LIMIT 1`, [reference])
        if (used.rowCount) throw fail(409, 'payout_transaction_already_recorded')
        await client.query(`SELECT openfund_assert_account_writable(c.demo_account_id)
          FROM openfund_challenges c WHERE c.id=$1 AND c.demo_account_id IS NOT NULL`, [w.challenge_id])
        evidence = { ...await verifyPayout({ hash: reference, recipient, amount: w.amount_usd, approvedAt: w.reviewed_at }), recordedBy: actor }
        await claimPayout(client, { hash: reference, requestId: w.id })
      }
      await client.query(
        `UPDATE withdrawal_requests SET status=$2, reviewed_at=now(), note=coalesce($3, note),
           payout_ref=coalesce($4, payout_ref), recipient_wallet=$5, approved_by=$6, payment_evidence=$7
          WHERE id=$1`,
        [w.id, spec.to, note ?? null, reference, recipient, reward && action === 'approve' ? actor : w.approved_by, evidence])
      if (reward) {
        await financialAudit(client, actor, `withdrawal_${spec.to}`, 'withdrawal', w.id, { status: w.status },
          { status: spec.to, amount: w.amount_usd, recipient, reason: note ?? null, payment: evidence })
      }
      if (spec.to === 'rejected') await reverseRewardTx(client, w, 'rejected_by_operator')
      const feeRefund = spec.to === 'paid' ? await onRewardPaidTx(client, { ...w, status: 'paid' }, actor) : null
      await client.query('COMMIT')
      await audit(`withdrawal_${spec.to}`, w.user_id, req, {
        withdrawalId: req.params.id, amount: Number(w.amount_usd), action, note: note ?? null,
        payoutRef: action === 'paid' ? payoutRef.trim() : undefined,
      })
      res.json({ ok: true, status: spec.to, ...(feeRefund ? { feeRefund: { id: feeRefund.id, amountUsd: feeRefund.amount_usd, status: feeRefund.status } } : {}) })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.constraint === 'idx_withdrawals_verified_hash') throw fail(409, 'payout_transaction_already_recorded')
      throw e
    } finally { client.release() }
  }))

  return router
}
