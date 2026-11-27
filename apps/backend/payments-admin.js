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
import { verifyAndConfirm, chainConfig } from './purchases.js'
import { orderLedger, paymentMethodSettings, setPaymentMethod, formatMicros, formatUnits, paymentEvent, unitsToMicros } from './payment-ledger.js'
import { paymentMetrics } from './payment-watcher.js'
import { normalizeTxId, SOLANA_CHAIN_ID } from './payment-verification.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txRe = /^(0x[0-9a-f]{64}|[1-9A-HJ-NP-Za-km-z]{64,90})$/i
const walletRe = /^(0x[0-9a-f]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/i
const noteOf = (v, min = 3) => {
  if (typeof v !== 'string' || v.trim().length < min || v.length > 1000) throw fail(400, 'note_required')
  return v.trim()
}
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

export function paymentAdminRoutes({ pool, verifier, refundVerifier = defaultRefundVerifier(verifier) }) {
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
    if (txHash) { params.push(String(txHash).toLowerCase()); conds.push(`lower(a.tx_hash)=$${params.length}`) }
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
    /* Openfund Pay ledger: transactions, allocations, refunds, intents, timeline */
    const txRows = (await pool.query(
      `SELECT * FROM payment_transactions WHERE ${orderId ? 'purchase_order_id=$1' : 'lower(tx_hash)=$1'}${orderId && txHash ? ' OR lower(tx_hash)=$2' : ''} ORDER BY first_seen_at`,
      orderId && txHash ? [orderId, String(txHash).toLowerCase()] : [orderId || String(txHash).toLowerCase()])).rows
    const ledger = orderId ? await orderLedger(pool, orderId) : null
    const intents = orderId ? (await pool.query(`SELECT id, status, chain_id, token_address, amount_units::text, usd_micros::text, payer_address, tx_hash, created_at, submitted_at, expires_at
                                                 FROM payment_intents WHERE purchase_order_id=$1 ORDER BY created_at`, [orderId])).rows : []
    const events = (await pool.query(
      `SELECT id, purchase_order_id, transaction_id, liability_id, attempt_id, kind, actor, detail, created_at FROM payment_events
        WHERE ${orderId ? 'purchase_order_id=$1' : 'transaction_id = ANY($1)'} ORDER BY id LIMIT 500`, [orderId || txRows.map(t => t.id)])).rows
    const orderEvents = orderId ? (await pool.query(`SELECT from_state, to_state, actor, reason, created_at FROM purchase_order_events WHERE purchase_order_id=$1 ORDER BY id`, [orderId])).rows : []
    res.json({ order, payments, attempts, transactions: txRows.map(txView), ledger, intents, events, orderEvents })
  }))

  /* ---------- Openfund Pay operations ---------- */
  const txView = t => ({ ...t, amount: formatUnits(t.amount_units, t.token_decimals), usd: t.usd_micros == null ? null : formatMicros(t.usd_micros) })

  router.get('/overview', wrap(async (req, res) => {
    const metrics = await paymentMetrics(pool)
    const { rows: [rej] } = await pool.query(`SELECT count(*)::int AS rejected FROM payment_attempts WHERE status='rejected'`)
    res.json({ ...metrics, rejectedAttempts: rej.rejected, methods: await paymentMethodSettings(pool) })
  }))

  /* investigation search: order id, wallet, transaction hash, chain, method, date range, status */
  router.get('/search', wrap(async (req, res) => {
    const q = req.query, conds = ['TRUE'], params = []
    const add = (sql, v) => { params.push(v); conds.push(sql.replace('$?', '$' + params.length)) }
    if (q.orderId) { if (!uuid.test(q.orderId)) throw fail(400, 'invalid_order'); add('o.id=$?', q.orderId) }
    if (q.wallet) { if (!walletRe.test(q.wallet)) throw fail(400, 'invalid_wallet')
      add(`(lower(u.wallet_address)=lower($?) OR EXISTS (SELECT 1 FROM payment_transactions t WHERE t.purchase_order_id=o.id AND lower(t.from_address)=lower($?)))`.replace('$?', '$' + (params.length + 1)), q.wallet) }
    if (q.txHash) { if (!txRe.test(q.txHash)) throw fail(400, 'invalid_tx')
      add(`(EXISTS (SELECT 1 FROM payment_transactions t WHERE t.purchase_order_id=o.id AND lower(t.tx_hash)=lower($?)) OR EXISTS (SELECT 1 FROM payment_attempts a WHERE a.purchase_order_id=o.id AND lower(a.tx_hash)=lower($?)))`.replaceAll('$?', '$' + (params.length + 1)), q.txHash) }
    if (q.chainId) { if (!Number.isInteger(Number(q.chainId))) throw fail(400, 'invalid_chain')
      add(`(EXISTS (SELECT 1 FROM payment_transactions t WHERE t.purchase_order_id=o.id AND t.chain_id=$?) OR EXISTS (SELECT 1 FROM payment_attempts a WHERE a.purchase_order_id=o.id AND a.chain_id=$?))`.replaceAll('$?', '$' + (params.length + 1)), Number(q.chainId)) }
    if (q.method) { if (!['wallet', 'manual', 'depay', 'watcher', 'operator', 'coupon'].includes(q.method)) throw fail(400, 'invalid_method')
      if (q.method === 'coupon') conds.push('NOT o.payment_required')
      else add(`EXISTS (SELECT 1 FROM payment_transactions t WHERE t.purchase_order_id=o.id AND t.source=$?)`, q.method) }
    if (q.status) { if (!/^[a-z_]{3,30}$/.test(q.status)) throw fail(400, 'invalid_status'); add('o.lifecycle_state=$?', q.status) }
    if (q.from) { if (Number.isNaN(Date.parse(q.from))) throw fail(400, 'invalid_date'); add('o.created_at >= $?::timestamptz', q.from) }
    if (q.to) { if (Number.isNaN(Date.parse(q.to))) throw fail(400, 'invalid_date'); add('o.created_at <= $?::timestamptz', q.to) }
    const { rows } = await pool.query(
      `SELECT o.id, o.status, o.lifecycle_state, o.price_usd, o.payment_required, o.created_at, o.paid_at, u.wallet_address,
              (SELECT coalesce(sum(a.usd_micros) FILTER (WHERE a.kind='order'),0)::text FROM payment_allocations a WHERE a.purchase_order_id=o.id) AS received_micros,
              (SELECT coalesce(sum(a.usd_micros) FILTER (WHERE a.kind='excess'),0)::text FROM payment_allocations a WHERE a.purchase_order_id=o.id) AS excess_micros,
              (SELECT count(*)::int FROM payment_transactions t WHERE t.purchase_order_id=o.id) AS transactions,
              (SELECT count(*)::int FROM payment_attempts a WHERE a.purchase_order_id=o.id) AS attempts
         FROM purchase_orders o JOIN openfund_users u ON u.id=o.user_id
        WHERE ${conds.join(' AND ')} ORDER BY o.created_at DESC LIMIT ${Math.min(Number(req.query.limit) || 50, 200)}`, params)
    res.json({ orders: rows.map(({ received_micros, excess_micros, ...r }) => ({ ...r, received_usd: formatMicros(received_micros), excess_usd: formatMicros(excess_micros) })) })
  }))

  /* deposit queues: unmatched / ambiguous / rejected / reorged transactions */
  router.get('/transactions', wrap(async (req, res) => {
    const conds = ['TRUE'], params = []
    if (['unmatched', 'ambiguous', 'matched', 'ignored'].includes(req.query.match)) { params.push(req.query.match); conds.push(`match_status=$${params.length}`) }
    if (['open', 'resolved', 'none'].includes(req.query.review)) { params.push(req.query.review); conds.push(`review_status=$${params.length}`) }
    if (['observed', 'pending', 'verified', 'rejected', 'reorged'].includes(req.query.status)) { params.push(req.query.status); conds.push(`status=$${params.length}`) }
    const { rows } = await pool.query(`SELECT * FROM payment_transactions WHERE ${conds.join(' AND ')} ORDER BY first_seen_at DESC LIMIT ${Math.min(Number(req.query.limit) || 50, 200)}`, params)
    res.json({ transactions: rows.map(txView) })
  }))

  const txById = async id => {
    if (!uuid.test(id)) throw fail(404, 'transaction_not_found')
    const t = (await pool.query('SELECT * FROM payment_transactions WHERE id=$1', [id])).rows[0]
    if (!t) throw fail(404, 'transaction_not_found')
    return t
  }

  /* re-run verification for a transaction already attributed to an order */
  router.post('/transactions/:id/reverify', wrap(async (req, res) => {
    const actor = adminActor(req)
    const t = await txById(req.params.id)
    const orderId = t.purchase_order_id || t.detail?.candidateOrderId
    if (!orderId) throw fail(409, 'transaction_not_attributed')
    const o = (await pool.query(`SELECT o.id, o.price_usd, o.created_at, o.user_id, u.wallet_address FROM purchase_orders o JOIN openfund_users u ON u.id=o.user_id WHERE o.id=$1`, [orderId])).rows[0]
    await financialAudit(pool, actor, 'payment_tx_reverify_requested', 'payment_transaction', t.id, null, { orderId })
    try {
      const result = await verifyAndConfirm({ pool, verifier, order: o, userId: o.user_id, walletAddress: o.wallet_address, txHash: t.tx_hash,
        source: 'recovery', chainId: t.chain_id, matchMethod: t.match_method || 'attempt' })
      res.json({ ok: true, result })
    } catch (e) {
      if ((e.status && e.status < 500) || e.retryable) return res.status(e.status || 409).json({ ok: false, error: e.message, retryable: !!e.retryable })
      throw e
    }
  }))

  /* Exceptional attribution: an operator associates an unmatched or
     ambiguous deposit with an order on DOCUMENTED proof (Backstage owner
     gate: session + CSRF + password re-entry). The sender rule is lifted
     for this one transaction; token, receiver, amount and finality are
     still verified on-chain and the ledger still allocates exactly once. */
  router.post('/transactions/:id/associate', wrap(async (req, res) => {
    const actor = adminActor(req)
    const t = await txById(req.params.id)
    const { orderId } = req.body || {}
    const note = noteOf(req.body?.note, 10), evidence = noteOf(req.body?.evidence, 10)
    if (!uuid.test(orderId || '')) throw fail(400, 'invalid_order')
    if (!['unmatched', 'ambiguous'].includes(t.match_status)) throw fail(409, 'transaction_already_attributed')
    const o = (await pool.query(`SELECT o.id, o.price_usd, o.created_at, o.user_id, o.payment_required, u.wallet_address FROM purchase_orders o JOIN openfund_users u ON u.id=o.user_id WHERE o.id=$1`, [orderId])).rows[0]
    if (!o) throw fail(404, 'order_not_found')
    if (!o.payment_required) throw fail(409, 'zero_payment_order')
    await financialAudit(pool, actor, 'payment_tx_association_requested', 'payment_transaction', t.id, { matchStatus: t.match_status }, { orderId, note, evidence })
    await paymentEvent(pool, { orderId, transactionId: t.id, kind: 'operator_association_requested', actor, detail: { note, evidence } })
    try {
      const result = await verifyAndConfirm({ pool, verifier, order: o, userId: o.user_id, walletAddress: o.wallet_address, txHash: t.tx_hash,
        source: 'operator', chainId: t.chain_id, operator: actor, matchMethod: 'operator' })
      await pool.query(`UPDATE payment_transactions SET review_status='resolved', review_note=$2 WHERE id=$1`, [t.id, note])
      await financialAudit(pool, actor, 'payment_tx_associated', 'payment_transaction', t.id, null, { orderId, outcome: result.outcome })
      res.json({ ok: true, result })
    } catch (e) {
      await financialAudit(pool, actor, 'payment_tx_association_rejected', 'payment_transaction', t.id, null, { orderId, error: e.message })
      if ((e.status && e.status < 500) || e.retryable) return res.status(e.status || 409).json({ ok: false, error: e.message, retryable: !!e.retryable })
      throw e
    }
  }))

  /* close an investigation with an explicit reason (no money moves) */
  router.post('/transactions/:id/close', wrap(async (req, res) => {
    const actor = adminActor(req)
    const t = await txById(req.params.id)
    const note = noteOf(req.body?.note, 10)
    const ignore = req.body?.resolution === 'ignored'
    const { rowCount } = await pool.query(
      `UPDATE payment_transactions SET review_status='resolved', review_note=$2, match_status = CASE WHEN $3 AND match_status IN ('unmatched','ambiguous') THEN 'ignored' ELSE match_status END
        WHERE id=$1 AND review_status='open'`, [t.id, note, ignore])
    if (!rowCount) throw fail(409, 'transaction_not_open_for_review')
    await paymentEvent(pool, { orderId: t.purchase_order_id, transactionId: t.id, kind: 'investigation_closed', actor, detail: { note, ignored: ignore } })
    await financialAudit(pool, actor, 'payment_tx_investigation_closed', 'payment_transaction', t.id, null, { note, ignored: ignore })
    res.json({ ok: true })
  }))

  /* open a refund case for the UNALLOCATED value of a verified transaction
     (late payment outside grace, payment to a closed order, or a deposit
     proven to belong to no order). Recording only: nothing is sent. */
  router.post('/transactions/:id/refund-case', wrap(async (req, res) => {
    const actor = adminActor(req)
    const note = noteOf(req.body?.note, 10)
    const t = await txById(req.params.id)
    const reason = ['late_payment', 'unmatched', 'operator'].includes(req.body?.reason) ? req.body.reason : 'operator'
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      let tx = (await client.query('SELECT * FROM payment_transactions WHERE id=$1 FOR UPDATE', [t.id])).rows[0]
      /* an unattributed observation is verified first (token, receiver, finality) */
      if (tx.status !== 'verified') {
        await client.query('ROLLBACK')
        const c = chainConfig(tx.chain_id)
        if (!c) throw fail(409, 'unsupported_chain')
        let v
        try {
          v = await verifier(tx.tx_hash, { chainId: c.chainId, receiver: c.receiver, token: c.token, tokenDecimals: c.tokenDecimals, priceUsd: '0',
            routers: c.routers, requireSender: false, attestedSender: tx.from_address, allowPartial: true, notBefore: 0, minConfirmations: c.minConfirmations })
        } catch (e) { return res.status(e.status || 409).json({ ok: false, error: e.message, retryable: !!e.retryable }) }
        await client.query('BEGIN')
        tx = (await client.query('SELECT * FROM payment_transactions WHERE id=$1 FOR UPDATE', [t.id])).rows[0]
        const decimals = Number(v.tokenDecimals ?? 18)
        tx = (await client.query(`UPDATE payment_transactions SET status='verified', amount_units=$2, usd_micros=$3, token_decimals=$4, from_address=$5,
                                   block_number=$6, block_time=$7, verified_at=now() WHERE id=$1 RETURNING *`,
          [tx.id, v.amount, unitsToMicros(v.amount, decimals).toString(), decimals, v.fromAddress, v.blockNumber, v.blockTimestamp ?? null])).rows[0]
      }
      const { rows: [used] } = await client.query(`SELECT coalesce(sum(usd_micros),0)::text AS m, coalesce(sum(amount_units),0)::text AS u FROM payment_allocations WHERE transaction_id=$1`, [tx.id])
      const micros = BigInt(tx.usd_micros) - BigInt(used.m), units = BigInt(tx.amount_units) - BigInt(used.u)
      if (micros <= 0n || units <= 0n) throw fail(409, 'nothing_unallocated')
      const kind = tx.purchase_order_id ? 'excess' : 'refund'
      const { rows: [a] } = await client.query(
        `INSERT INTO payment_allocations (transaction_id, purchase_order_id, kind, usd_micros, amount_units, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [tx.id, tx.purchase_order_id, kind, micros.toString(), units.toString(), actor])
      const { rows: [l] } = await client.query(
        `INSERT INTO payment_refund_liabilities (allocation_id, transaction_id, purchase_order_id, reason, usd_micros, amount_units, chain_id, token_address, destination)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [a.id, tx.id, tx.purchase_order_id, reason, micros.toString(), units.toString(), tx.chain_id, tx.token_address, tx.from_address])
      await client.query(`UPDATE payment_transactions SET review_status='resolved', review_note=$2 WHERE id=$1`, [tx.id, note])
      await paymentEvent(client, { orderId: tx.purchase_order_id, transactionId: tx.id, liabilityId: l.id, kind: 'refund_liability_created', actor, detail: { reason, usd: formatMicros(micros), note } })
      await financialAudit(client, actor, 'refund_liability_created', 'payment_refund_liability', l.id, null, { transactionId: tx.id, reason, usdMicros: micros.toString(), note })
      await client.query('COMMIT')
      res.json({ ok: true, liabilityId: l.id })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.code === '23505') throw fail(409, 'refund_case_exists')
      throw e
    } finally { client.release() }
  }))

  /* ---------- refund liabilities (never executed by Openfund) ---------- */
  router.get('/refunds', wrap(async (req, res) => {
    const conds = ['TRUE'], params = []
    if (/^refund_[a-z]+$/.test(req.query.status || '')) { params.push(req.query.status); conds.push(`l.status=$${params.length}`) }
    const { rows } = await pool.query(
      `SELECT l.*, l.usd_micros::text AS usd_micros, l.amount_units::text AS amount_units, t.tx_hash AS original_tx_hash, t.token_decimals,
              t.from_address AS original_payer, t.block_time AS original_block_time
         FROM payment_refund_liabilities l JOIN payment_transactions t ON t.id=l.transaction_id
        WHERE ${conds.join(' AND ')} ORDER BY l.created_at DESC LIMIT 200`, params)
    res.json({ refunds: rows.map(r => ({ ...r, usd: formatMicros(r.usd_micros), amount: formatUnits(r.amount_units, r.token_decimals) })) })
  }))

  /* one guarded transition; the database trigger rejects anything not in
     refund_due → refund_review → refund_approved → refund_sent →
     refund_confirmed (plus rejected / failed) */
  const transition = async (req, res, from, to, fields = {}, check = null) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'refund_not_found')
    const note = noteOf(req.body?.note, 5)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const l = (await client.query('SELECT * FROM payment_refund_liabilities WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0]
      if (!l) throw fail(404, 'refund_not_found')
      if (!from.includes(l.status)) throw fail(409, 'refund_invalid_state')
      if (check) await check(l, client)
      const sets = ['status=$2', 'decision_note=$3'], params = [l.id, to, note]
      for (const [k, v] of Object.entries(typeof fields === 'function' ? fields(actor, l) : fields)) { params.push(v); sets.push(`${k}=$${params.length}`) }
      await client.query(`UPDATE payment_refund_liabilities SET ${sets.join(', ')} WHERE id=$1`, params)
      await paymentEvent(client, { orderId: l.purchase_order_id, transactionId: l.transaction_id, liabilityId: l.id, kind: to, actor, detail: { note } })
      await financialAudit(client, actor, to, 'payment_refund_liability', l.id, { status: l.status }, { status: to, note, ...(typeof fields === 'function' ? fields(actor, l) : fields) })
      await client.query('COMMIT')
      res.json({ ok: true, status: to })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.code === '23505') throw fail(409, 'refund_tx_already_recorded')
      throw e
    } finally { client.release() }
  }
  router.post('/refunds/:id/review', wrap((req, res) => transition(req, res, ['refund_due', 'refund_failed'], 'refund_review', a => ({ reviewed_by: a }))))
  /* approval re-states the destination and chain: the operator must
     explicitly confirm the original payer, never a user-supplied address */
  router.post('/refunds/:id/approve', wrap((req, res) => transition(req, res, ['refund_review'], 'refund_approved', a => ({ approved_by: a }), l => {
    if (String(req.body?.destination || '').toLowerCase() !== String(l.destination).toLowerCase() || Number(req.body?.chainId) !== l.chain_id)
      throw fail(409, 'refund_destination_mismatch')
  })))
  router.post('/refunds/:id/reject', wrap((req, res) => transition(req, res, ['refund_due', 'refund_review', 'refund_approved'], 'refund_rejected')))
  /* the refund was executed OUTSIDE Openfund (treasury Safe); record the hash */
  router.post('/refunds/:id/sent', wrap((req, res) => {
    const chainId = Number(req.body?.chainId)
    const hash = normalizeTxId(chainId, req.body?.refundTxHash)
    if (!hash) throw fail(400, 'invalid_tx')
    return transition(req, res, ['refund_approved'], 'refund_sent', a => ({ sent_by: a, refund_chain_id: chainId, refund_tx_hash: hash }), l => {
      if (chainId !== l.chain_id) throw fail(409, 'refund_chain_mismatch')
    })
  }))
  router.post('/refunds/:id/failed', wrap((req, res) => transition(req, res, ['refund_sent'], 'refund_failed')))
  /* confirmation verifies the OUTGOING transfer on-chain: approved token,
     from the treasury, to the recorded destination, at least the liability */
  router.post('/refunds/:id/confirm', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'refund_not_found')
    const l = (await pool.query('SELECT * FROM payment_refund_liabilities WHERE id=$1', [req.params.id])).rows[0]
    if (!l) throw fail(404, 'refund_not_found')
    if (l.status !== 'refund_sent') throw fail(409, 'refund_invalid_state')
    const c = chainConfig(l.chain_id)
    if (!c) throw fail(409, 'unsupported_chain')
    if (l.chain_id !== SOLANA_CHAIN_ID) {
      try {
        await refundVerifier(l.refund_tx_hash, { chainId: l.chain_id, token: l.token_address, treasury: c.receiver, destination: l.destination, minAmountUnits: String(l.amount_units), minConfirmations: c.minConfirmations })
      } catch (e) {
        return res.status(e.status && e.status < 500 ? e.status : 409).json({ ok: false, error: e.message, retryable: !!e.retryable })
      }
    } else if (req.body?.manualEvidence == null) throw fail(400, 'solana_refund_evidence_required')
    return transition(req, res, ['refund_sent'], 'refund_confirmed', a => ({ confirmed_by: a }))
  }))

  /* ---------- runtime payment settings (audited) ---------- */
  router.get('/settings', wrap(async (req, res) => res.json({ methods: await paymentMethodSettings(pool) })))
  router.post('/settings', wrap(async (req, res) => {
    const actor = adminActor(req)
    const reason = noteOf(req.body?.reason, 5)
    res.json({ methods: await setPaymentMethod(pool, { method: req.body?.method, enabled: req.body?.enabled, actor, reason }) })
  }))

  /* ---------- operational metrics (counts/ages only) ---------- */
  router.get('/metrics', wrap(async (req, res) => res.json(await paymentMetrics(pool))))

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

/**
 * Outgoing refund verification. Reuses the inbound analyzer with the roles
 * swapped: the "receiver" is the refund destination and the only accepted
 * sender of the Transfer logs is the treasury (works for an EOA treasury and
 * for a Safe, whose transaction is sent by a signer but whose Transfer log
 * is from the Safe). Needs the same dedicated RPC as inbound verification.
 */
export function defaultRefundVerifier(verifierOrNull) {
  return async (txHash, { chainId, token, treasury, destination, minAmountUnits, minConfirmations }) => {
    const { createRpcVerifier } = await import('./payment-verification.js')
    const { paymentChains } = await import('./purchases.js')
    void verifierOrNull
    const c = paymentChains().find(x => x.chainId === chainId)
    const v = createRpcVerifier({ rpcUrls: { [chainId]: c?.rpcUrl } })
    /* reuse the RPC verifier's finality + canonical-block checks */
    const units = BigInt(minAmountUnits)
    return v(txHash, { chainId, receiver: destination, token, tokenDecimals: null, priceUsd: '0', routers: [], requireSender: false,
      attestedSender: treasury, allowPartial: false, notBefore: 0, minConfirmations, minUnitsOverride: units.toString() })
  }
}
