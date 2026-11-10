/**
 * Openfund — operator payment investigation and recovery (/admin/payments).
 *
 * Reuses the existing service-token authorization (hardened with individual
 * operators in the withdrawal-operations change). Capabilities:
 *  - look up a payment case by order id and/or transaction hash;
 *  - list attempts needing review (underpayment, wrong token, late payment,
 *    duplicate, overpayment) or stuck on a retryable chain condition;
 *  - re-run the authoritative on-chain verification for an attempt
 *    (recovers "paid on chain, never provisioned");
 *  - record the outcome of a review. Refund EXECUTION is never automatic:
 *    a refund is recorded afterwards through /admin/economy payment
 *    adjustments with the settlement reference.
 */
import { Router } from 'express'
import { adminAuth, adminActor } from './admin.js'
import { financialAudit } from './financial-audit.js'
import { verifyAndConfirm } from './purchases.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txRe = /^0x[0-9a-f]{64}$/i
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

export function paymentAdminRoutes({ pool, verifier }) {
  const router = Router()
  router.use(adminAuth)

  const attemptRows = async (where, params, limit = 50) => (await pool.query(
    `SELECT a.id, a.purchase_order_id, a.user_id, u.wallet_address, a.chain_id, a.tx_hash, a.status, a.error_code,
            a.retryable, a.classification, a.detail, a.attempts, a.first_seen_at, a.last_attempt_at,
            a.review_status, a.review_note, a.reviewed_by, a.reviewed_at,
            o.status AS order_status, o.price_usd, o.expires_at
       FROM payment_attempts a
       JOIN purchase_orders o ON o.id=a.purchase_order_id
       JOIN openfund_users u ON u.id=a.user_id
      WHERE ${where} ORDER BY a.last_attempt_at DESC LIMIT ${limit}`, params)).rows

  /* investigation by order id and/or tx hash */
  router.get('/lookup', wrap(async (req, res) => {
    const { orderId, txHash } = req.query
    if (!orderId && !txHash) throw fail(400, 'order_or_tx_required')
    if (orderId && !uuid.test(orderId)) throw fail(400, 'invalid_order')
    if (txHash && !txRe.test(txHash)) throw fail(400, 'invalid_tx')
    const conds = [], params = []
    if (orderId) { params.push(orderId); conds.push(`a.purchase_order_id=$${params.length}`) }
    if (txHash) { params.push(String(txHash).toLowerCase()); conds.push(`a.tx_hash=$${params.length}`) }
    const attempts = await attemptRows(conds.join(' AND '), params)
    const payConds = [], payParams = []
    if (orderId) { payParams.push(orderId); payConds.push(`purchase_order_id=$${payParams.length}`) }
    if (txHash) { payParams.push(String(txHash).toLowerCase()); payConds.push(`lower(tx_hash)=$${payParams.length}`) }
    const payments = (await pool.query(
      `SELECT id, purchase_order_id, tx_hash, chain_id, block_number, from_address, to_address, amount, token_address, status, verified_at, verification
         FROM payments WHERE ${payConds.join(' AND ')}`, payParams)).rows
    const order = orderId
      ? (await pool.query(`SELECT o.*, u.wallet_address FROM purchase_orders o JOIN openfund_users u ON u.id=o.user_id WHERE o.id=$1`, [orderId])).rows[0] || null
      : null
    res.json({ order, payments, attempts })
  }))

  /* work queues */
  router.get('/attempts', wrap(async (req, res) => {
    const conds = ['TRUE'], params = []
    if (['open', 'resolved', 'none'].includes(req.query.review)) { params.push(req.query.review); conds.push(`a.review_status=$${params.length}`) }
    if (['pending', 'rejected', 'confirmed'].includes(req.query.status)) { params.push(req.query.status); conds.push(`a.status=$${params.length}`) }
    if (req.query.retryable === '1') conds.push('a.retryable')
    res.json({ attempts: await attemptRows(conds.join(' AND '), params, Math.min(Number(req.query.limit) || 50, 200)) })
  }))

  /* re-run the authoritative on-chain verification for an attempt */
  router.post('/attempts/:id/reverify', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'attempt_not_found')
    const actor = adminActor(req)
    const { rows: [a] } = await pool.query(
      `SELECT a.*, o.price_usd, o.created_at AS order_created_at, o.status AS order_status, u.wallet_address
         FROM payment_attempts a JOIN purchase_orders o ON o.id=a.purchase_order_id JOIN openfund_users u ON u.id=a.user_id
        WHERE a.id=$1`, [req.params.id])
    if (!a) throw fail(404, 'attempt_not_found')
    if (a.order_status === 'paid') return res.json({ ok: true, alreadyPaid: true })
    if (!['pending', 'expired'].includes(a.order_status)) throw fail(409, 'order_not_pending')
    await financialAudit(pool, actor, 'payment_reverify_requested', 'payment_attempt', a.id, null, { orderId: a.purchase_order_id, txHash: a.tx_hash })
    try {
      const result = await verifyAndConfirm({
        pool, verifier, order: { id: a.purchase_order_id, price_usd: a.price_usd, created_at: a.order_created_at },
        userId: a.user_id, walletAddress: a.wallet_address, txHash: a.tx_hash, source: 'operator',
        chainId: a.chain_id, attested: a.attested, reported: a.reported,
      })
      await financialAudit(pool, actor, 'payment_reverify_confirmed', 'payment_attempt', a.id, null, result)
      res.json({ ok: true, result })
    } catch (e) {
      await financialAudit(pool, actor, 'payment_reverify_rejected', 'payment_attempt', a.id, null, { error: e.message })
      if ((e.status && e.status < 500) || e.retryable) return res.status(e.status || 409).json({ ok: false, error: e.message, retryable: !!e.retryable })
      throw e
    }
  }))

  /* record the outcome of a human review (no money moves here) */
  router.post('/attempts/:id/review', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'attempt_not_found')
    const actor = adminActor(req)
    const { note } = req.body || {}
    if (typeof note !== 'string' || note.trim().length < 3 || note.length > 1000) throw fail(400, 'note_required')
    const { rows: [a] } = await pool.query(
      `UPDATE payment_attempts SET review_status='resolved', review_note=$2, reviewed_by=$3, reviewed_at=now()
        WHERE id=$1 AND review_status='open' RETURNING id, purchase_order_id`, [req.params.id, note.trim(), actor])
    if (!a) throw fail(409, 'attempt_not_open_for_review')
    await financialAudit(pool, actor, 'payment_review_resolved', 'payment_attempt', a.id, null, { orderId: a.purchase_order_id, note: note.trim() })
    res.json({ ok: true })
  }))

  return router
}
