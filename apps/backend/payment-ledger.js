/**
 * Openfund Pay — payment ledger and reconciliation engine (ADR 0046,
 * docs/payments/OPENFUND_PAY.md).
 *
 * One engine settles every payment method (direct wallet, manual transfer,
 * DePay-attested legacy payments, watcher discoveries, operator
 * associations). It runs AFTER the chain verifier has proven a transaction
 * (token, receiver, finality, canonical block) and decides, under row locks
 * in one database transaction, how that verified value is allocated:
 *
 *   order    the part that settles the order's remaining balance
 *   excess   the part above the order total → refund liability
 *   refund   a whole transaction returned without an order (operator)
 *
 * Invariants (enforced in code AND by database triggers/constraints):
 *  - one on-chain transaction belongs to at most one order, set once;
 *  - allocations never exceed the transaction's verified value;
 *  - allocations are append-only; a replay never allocates twice;
 *  - the challenge is provisioned exactly once, when the order allocations
 *    reach the frozen order total (purchase_orders.price_usd);
 *  - excess value is never revenue: it becomes a refund liability that a
 *    person reviews, approves and executes outside Openfund.
 *
 * Valuation: approved USD stablecoins at 1:1 (the existing settlement
 * policy), measured in integer micro-USD. Raw token units are kept
 * separately and never summed across different tokens. No floating point.
 */
import { toUnits } from './payment-verification.js'

export const MICROS = 1_000_000n
const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, ...extra })

/** exact decimal USD string → micro-USD bigint */
export const usdToMicros = usd => BigInt(toUnits(String(usd), 6))

/** micro-USD → plain decimal string ("10.8", "0.162", "12") */
export function formatMicros(m) {
  const v = BigInt(m ?? 0)
  const neg = v < 0n, a = neg ? -v : v
  const frac = (a % MICROS).toString().padStart(6, '0').replace(/0+$/, '')
  return (neg ? '-' : '') + (a / MICROS).toString() + (frac ? '.' + frac : '')
}

/** micro-USD → USD string with at least two decimals ("49.00", "0.162") — the
 *  order-price format the checkout and DePay already use */
export function formatUsd(m) {
  const s = formatMicros(m)
  const [i, f = ''] = s.split('.')
  return i + '.' + f.padEnd(2, '0')
}

/** token base units → micro-USD (1:1 stablecoin); value below one micro-USD is not counted */
export function unitsToMicros(units, decimals) {
  const u = BigInt(units), d = Number(decimals)
  if (!Number.isInteger(d) || d < 0 || d > 36) throw fail(500, 'invalid_token_decimals')
  return d >= 6 ? u / 10n ** BigInt(d - 6) : u * 10n ** BigInt(6 - d)
}

/** micro-USD → token base units, rounded UP so a requested amount always covers the value */
export function microsToUnits(micros, decimals) {
  const m = BigInt(micros), d = Number(decimals)
  if (d >= 6) return m * 10n ** BigInt(d - 6)
  const div = 10n ** BigInt(6 - d)
  return (m + div - 1n) / div
}

/** token base units → human string with the token's decimals */
export function formatUnits(units, decimals) {
  if (units == null || !Number.isInteger(Number(decimals))) return null
  const v = BigInt(String(units).split('.')[0]), base = 10n ** BigInt(decimals)
  const frac = (v % base).toString().padStart(Number(decimals), '0').replace(/0+$/, '')
  return (v / base).toString() + (frac ? '.' + frac : '')
}

export const partialBalanceHours = () => Math.max(Number(process.env.PAYMENT_PARTIAL_BALANCE_HOURS) || 72, 1)

export async function paymentEvent(q, { orderId = null, transactionId = null, liabilityId = null, attemptId = null, kind, actor = 'system', detail = {} }) {
  await q.query(
    `INSERT INTO payment_events (purchase_order_id, transaction_id, liability_id, attempt_id, kind, actor, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [orderId, transactionId, liabilityId, attemptId, kind, actor, JSON.stringify(detail)])
}

/** order allocations so far (micro-USD), excess and open liabilities */
export async function orderTotals(q, orderId) {
  const { rows: [r] } = await q.query(
    `SELECT coalesce(sum(usd_micros) FILTER (WHERE kind='order'),0)::text AS received,
            coalesce(sum(usd_micros) FILTER (WHERE kind='excess'),0)::text AS excess,
            count(DISTINCT transaction_id)::int AS transactions
       FROM payment_allocations WHERE purchase_order_id=$1`, [orderId])
  return { received: BigInt(r.received), excess: BigInt(r.excess), transactions: r.transactions }
}

/**
 * Coupon capacity for a late payment: an expired order released its coupon
 * reservation, so before it is paid again the coupon's usage limits are
 * re-checked under the coupon row lock (never more provisioned challenges
 * than the coupon allows).
 */
async function couponStillAvailable(client, order) {
  if (!order.coupon_id) return true
  const { rows: [red] } = await client.query('SELECT status FROM coupon_redemptions WHERE purchase_order_id=$1', [order.id])
  if (!red || red.status !== 'released') return true
  const { rows: [c] } = await client.query('SELECT max_redemptions, per_user_limit, status FROM coupons WHERE id=$1 FOR UPDATE', [order.coupon_id])
  if (!c) return false
  const { rows: [used] } = await client.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE user_id=$2)::int AS mine
       FROM coupon_redemptions WHERE coupon_id=$1 AND status IN ('reserved','consumed') AND purchase_order_id<>$3`,
    [order.coupon_id, order.user_id, order.id])
  if (c.max_redemptions != null && used.total >= c.max_redemptions) return false
  if (c.per_user_limit != null && used.mine >= c.per_user_limit) return false
  return true
}

async function createLiability(client, { allocation, tx, orderId, reason, actor }) {
  const { rows: [l] } = await client.query(
    `INSERT INTO payment_refund_liabilities (allocation_id, transaction_id, purchase_order_id, reason, usd_micros, amount_units, chain_id, token_address, destination)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [allocation.id, tx.id, orderId, reason, allocation.usd_micros, allocation.amount_units, tx.chain_id, tx.token_address, tx.from_address])
  await paymentEvent(client, { orderId, transactionId: tx.id, liabilityId: l.id, kind: 'refund_liability_created', actor,
    detail: { reason, usd: formatMicros(allocation.usd_micros), destination: tx.from_address } })
  await client.query(`INSERT INTO financial_audit_log (actor, action, entity, entity_id, after) VALUES ($1,'refund_liability_created','payment_refund_liability',$2,$3)`,
    [actor, l.id, JSON.stringify({ orderId, transactionId: tx.id, reason, usdMicros: String(allocation.usd_micros) })])
  return l.id
}

async function allocate(client, { tx, orderId, kind, micros, units, paymentId = null, actor }) {
  const { rows: [a] } = await client.query(
    `INSERT INTO payment_allocations (transaction_id, purchase_order_id, kind, usd_micros, amount_units, payment_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, usd_micros, amount_units`,
    [tx.id, orderId, kind, micros.toString(), units.toString(), paymentId, actor])
  await paymentEvent(client, { orderId, transactionId: tx.id, kind: `allocation_${kind}`, actor, detail: { usd: formatMicros(micros), units: units.toString() } })
  return a
}

/**
 * Record a VERIFIED inbound transaction against an order and allocate it.
 * Caller owns BEGIN/COMMIT. `provision(client, { order, paymentId,
 * payerAddress })` provisions the challenge (injected by purchases.js).
 *
 * Returns { outcome, ... } where outcome is one of
 *   provisioned | partially_paid | replayed | excess_only |
 *   order_expired | coupon_unavailable | dust
 * The last three leave the transaction recorded and open for review; the
 * caller reports them as rejections AFTER committing the evidence.
 */
export async function settleVerifiedPaymentTx(client, { orderId, userId = null, evidence, source, matchMethod = 'customer', actor = null, lateGraceMinutes = 60, provision, now = new Date() }) {
  const who = actor || `system:${source}`
  await client.query(`SELECT set_config('openfund.actor', $1, true), set_config('openfund.reason', $2, true)`,
    [who, `payment:${evidence.chainId}:${evidence.txHash}`.slice(0, 200)])
  const order = (await client.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE', [orderId])).rows[0]
  if (!order || (userId && order.user_id !== userId)) throw fail(404, 'order_not_found')
  if (order.payment_required === false) throw fail(409, 'zero_payment_order')
  const chainId = Number(evidence.chainId), txHash = String(evidence.txHash)
  if (evidence.tokenDecimals == null) throw fail(503, 'payment_misconfigured')
  const decimals = Number(evidence.tokenDecimals)
  const units = BigInt(String(evidence.amount))
  /* native coins are never valued, except on non-production test chains
     (the verifier only accepts them there, 1:1 like the legacy path) */
  const testNative = !evidence.tokenAddress && evidence.route === 'native' && process.env.NODE_ENV !== 'production'
  const micros = evidence.tokenAddress || testNative ? unitsToMicros(units, decimals) : 0n

  /* legacy single-use guard: a transaction that paid another order before
     this ledger existed can never be reused */
  const legacy = (await client.query('SELECT id, purchase_order_id FROM payments WHERE chain_id=$1 AND tx_hash=$2', [chainId, txHash])).rows[0]
  if (legacy && legacy.purchase_order_id !== orderId) throw fail(409, 'tx_already_used')

  await client.query(
    `INSERT INTO payment_transactions (chain_id, tx_hash, source) VALUES ($1,$2,$3) ON CONFLICT (chain_id, tx_hash) DO NOTHING`,
    [chainId, txHash, ['watcher', 'wallet', 'manual', 'depay', 'operator', 'recovery'].includes(source) ? source : 'manual'])
  let tx = (await client.query('SELECT * FROM payment_transactions WHERE chain_id=$1 AND tx_hash=$2 FOR UPDATE', [chainId, txHash])).rows[0]
  if (tx.purchase_order_id && tx.purchase_order_id !== orderId) throw fail(409, 'tx_already_used')

  const settledAlready = (await client.query('SELECT count(*)::int n FROM payment_allocations WHERE transaction_id=$1', [tx.id])).rows[0].n > 0
  if (settledAlready || (legacy && legacy.purchase_order_id === orderId)) {
    const totals = await orderTotals(client, orderId)
    /* idempotent replay returns the records already provisioned */
    const pay = legacy || (await client.query('SELECT id FROM payments WHERE chain_id=$1 AND tx_hash=$2', [chainId, txHash])).rows[0]
    const inv = (await client.query('SELECT id, number FROM invoices WHERE purchase_order_id=$1', [orderId])).rows[0]
    const ch = (await client.query('SELECT id FROM openfund_challenges WHERE purchase_order_id=$1', [orderId])).rows[0]
    return { outcome: 'replayed', replayed: true, orderId, transactionId: tx.id, paymentId: pay?.id ?? null, invoiceId: inv?.id ?? null,
      invoiceNumber: inv?.number ?? null, challengeId: ch?.id ?? null, ...summarize(order, totals) }
  }

  tx = (await client.query(
    `UPDATE payment_transactions SET token_address=$2, token_decimals=$3, from_address=$4, to_address=$5, amount_units=$6, usd_micros=$7,
            block_number=$8, block_hash=$9, block_time=$10, confirmations=$11, status='verified', verification_code=NULL,
            match_status='matched', match_method=coalesce(match_method,$12), purchase_order_id=$13,
            matched_by=coalesce(matched_by,$14), matched_at=coalesce(matched_at, now()), verified_at=now(),
            detail = detail || $15::jsonb
      WHERE id=$1 RETURNING *`,
    [tx.id, evidence.tokenAddress ?? null, decimals, evidence.fromAddress ?? null, evidence.toAddress ?? null, units.toString(), micros.toString(),
      evidence.blockNumber ?? null, evidence.blockHash ?? null, evidence.blockTimestamp ?? null, Number.isInteger(evidence.confirmations) ? evidence.confirmations : null,
      matchMethod, orderId, who, JSON.stringify({ route: evidence.route ?? null, reported: evidence.reported ?? null })])).rows[0]
  await paymentEvent(client, { orderId, transactionId: tx.id, kind: 'transaction_verified', actor: who,
    detail: { chainId, txHash, usd: formatMicros(micros), source, matchMethod, confirmations: evidence.confirmations ?? null } })

  const review = async (code, note) => {
    await client.query(`UPDATE payment_transactions SET review_status='open', verification_code=$2, review_note=$3 WHERE id=$1`, [tx.id, code, note])
    await paymentEvent(client, { orderId, transactionId: tx.id, kind: 'review_required', actor: who, detail: { code } })
    return { outcome: code, orderId, transactionId: tx.id, ...summarize(order, await orderTotals(client, orderId)) }
  }
  if (micros <= 0n) return review('dust', 'verified value below one micro-USD (or native coin) — not counted')

  const price = usdToMicros(order.price_usd)
  const before = await orderTotals(client, orderId)
  const paid = order.status === 'paid' || before.received >= price
  const closed = ['cancelled', 'refunded', 'partially_refunded'].includes(order.lifecycle_state)

  /* already settled or closed: the whole transaction is owed back */
  if (paid || closed) {
    const reason = closed ? 'order_cancelled' : 'duplicate_payment'
    const a = await allocate(client, { tx, orderId, kind: 'excess', micros, units, actor: who })
    await createLiability(client, { allocation: a, tx, orderId, reason, actor: who })
    await client.query(`UPDATE payment_transactions SET review_status='open', verification_code=$2 WHERE id=$1`, [tx.id, reason])
    return { outcome: 'excess_only', orderId, transactionId: tx.id, ...summarize(order, await orderTotals(client, orderId)) }
  }

  /* late-payment policy: an order with NO prior allocation that expired
     accepts a payment mined inside the grace window; outside it the funds
     stay recorded for operator review (never dropped, never auto-applied).
     A partially paid order never expires (it has a balance deadline). */
  const expired = order.status === 'expired' || (order.expires_at && new Date(order.expires_at) < now)
  if (before.received === 0n && expired && order.lifecycle_state !== 'partially_paid') {
    const minedAt = evidence.blockTimestamp ? new Date(evidence.blockTimestamp).getTime() : NaN
    if (!Number.isFinite(minedAt) || minedAt > new Date(order.expires_at).getTime() + lateGraceMinutes * 60_000)
      return review('order_expired', 'payment mined after the late-payment grace window')
    if (!(await couponStillAvailable(client, order))) return review('coupon_unavailable', 'coupon limit reached after the order expired')
  }

  const remaining = price - before.received
  const toOrder = micros < remaining ? micros : remaining
  const excess = micros - toOrder
  const orderUnits = excess === 0n ? units : microsToUnits(toOrder, decimals)
  const excessUnits = units - orderUnits

  /* the confirmed payment of record (one row per settling transaction) */
  const payment = (await client.query(
    `INSERT INTO payments (purchase_order_id, user_id, tx_hash, chain_id, blockchain, block_number, from_address, to_address, amount, token_address,
                           source_token, source_amount, status, verification)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'confirmed',$13) RETURNING id`,
    [orderId, order.user_id, txHash, chainId, evidence.blockchain ?? null, evidence.blockNumber ?? null, evidence.fromAddress, evidence.toAddress ?? null,
      units.toString(), evidence.tokenAddress ?? null, evidence.reported?.sentToken ?? null, evidence.reported?.sentAmount ?? null,
      JSON.stringify({ ...evidence, source, allocatedUsdMicros: toOrder.toString(), excessUsdMicros: excess.toString() })])).rows[0]
  await allocate(client, { tx, orderId, kind: 'order', micros: toOrder, units: orderUnits, paymentId: payment.id, actor: who })
  if (excess > 0n && excessUnits > 0n) {
    const a = await allocate(client, { tx, orderId, kind: 'excess', micros: excess, units: excessUnits, actor: who })
    await createLiability(client, { allocation: a, tx, orderId, reason: 'overpayment', actor: who })
  }

  const received = before.received + toOrder
  if (received >= price) {
    const result = await provision(client, { order, paymentId: payment.id, payerAddress: evidence.fromAddress, source })
    await paymentEvent(client, { orderId, transactionId: tx.id, kind: 'order_settled', actor: who,
      detail: { transactions: before.transactions + 1, challengeId: result.challengeId, invoiceNumber: result.invoiceNumber } })
    return { outcome: 'provisioned', replayed: false, orderId, transactionId: tx.id, paymentId: payment.id, ...result,
      ...summarize({ ...order, status: 'paid' }, await orderTotals(client, orderId)) }
  }
  await client.query(
    `UPDATE purchase_orders SET lifecycle_state='partially_paid',
            partial_deadline_at = coalesce(partial_deadline_at, now() + make_interval(hours => $2))
      WHERE id=$1 AND lifecycle_state <> 'partially_paid'`, [orderId, partialBalanceHours()])
  await paymentEvent(client, { orderId, transactionId: tx.id, kind: 'order_partially_paid', actor: who,
    detail: { received: formatMicros(received), remaining: formatMicros(price - received) } })
  return { outcome: 'partially_paid', replayed: false, orderId, transactionId: tx.id, paymentId: payment.id,
    ...summarize(order, { ...before, received, excess: before.excess + excess }) }
}

function summarize(order, totals) {
  const price = usdToMicros(order.price_usd)
  const remaining = totals.received >= price ? 0n : price - totals.received
  return { totalUsd: formatMicros(price), receivedUsd: formatMicros(totals.received), remainingUsd: formatMicros(remaining), excessUsd: formatMicros(totals.excess) }
}

export async function settleVerifiedPayment(pool, args) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const out = await settleVerifiedPaymentTx(client, args)
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally { client.release() }
}

/**
 * The customer/operator view of one order's money: verified transactions,
 * allocations, totals and refund liabilities — read from the ledger only.
 */
export async function orderLedger(q, orderId) {
  const { rows: [order] } = await q.query('SELECT id, price_usd, status, lifecycle_state, partial_deadline_at FROM purchase_orders WHERE id=$1', [orderId])
  if (!order) return null
  const transactions = (await q.query(
    `SELECT t.id, t.chain_id, t.tx_hash, t.token_address, t.token_decimals, t.from_address, t.to_address, t.amount_units::text,
            t.usd_micros::text, t.block_number, t.block_time, t.confirmations, t.status, t.verification_code, t.source, t.match_method,
            t.first_seen_at, t.verified_at, t.review_status,
            coalesce((SELECT sum(a.usd_micros) FROM payment_allocations a WHERE a.transaction_id=t.id AND a.kind='order'),0)::text AS order_micros,
            coalesce((SELECT sum(a.usd_micros) FROM payment_allocations a WHERE a.transaction_id=t.id AND a.kind='excess'),0)::text AS excess_micros
       FROM payment_transactions t WHERE t.purchase_order_id=$1 ORDER BY t.first_seen_at`, [orderId])).rows
  const liabilities = (await q.query(
    `SELECT id, transaction_id, reason, usd_micros::text, amount_units::text, chain_id, token_address, destination, status,
            refund_tx_hash, refund_chain_id, created_at, updated_at
       FROM payment_refund_liabilities WHERE purchase_order_id=$1 ORDER BY created_at`, [orderId])).rows
  const totals = await orderTotals(q, orderId)
  const price = usdToMicros(order.price_usd)
  return {
    totalUsd: formatMicros(price),
    receivedUsd: formatMicros(totals.received),
    remainingUsd: formatMicros(totals.received >= price ? 0n : price - totals.received),
    excessUsd: formatMicros(totals.excess),
    partialDeadlineAt: order.partial_deadline_at,
    transactions: transactions.map(t => ({
      id: t.id, chainId: t.chain_id, txHash: t.tx_hash, token: t.token_address, decimals: t.token_decimals, sender: t.from_address,
      receiver: t.to_address, amount: formatUnits(t.amount_units, t.token_decimals), usd: t.usd_micros == null ? null : formatMicros(t.usd_micros),
      allocatedUsd: formatMicros(t.order_micros), excessUsd: formatMicros(t.excess_micros), blockNumber: t.block_number, blockTime: t.block_time,
      confirmations: t.confirmations, status: t.status, code: t.verification_code, source: t.source, matchMethod: t.match_method,
      firstSeenAt: t.first_seen_at, verifiedAt: t.verified_at, reviewStatus: t.review_status,
    })),
    refunds: liabilities.map(l => ({
      id: l.id, transactionId: l.transaction_id, reason: l.reason, usd: formatMicros(l.usd_micros), chainId: l.chain_id, token: l.token_address,
      destination: l.destination, status: l.status, refundTxHash: l.refund_tx_hash, refundChainId: l.refund_chain_id, createdAt: l.created_at, updatedAt: l.updated_at,
    })),
  }
}

/* ------------------------------------------------- payment settings --- */
export const PAYMENT_METHODS = ['wallet', 'manual', 'depay']
const envDefault = method => {
  if (method === 'depay') return process.env.PAYMENT_DEPAY_NEW_PAYMENTS === 'true'
  const v = process.env[method === 'wallet' ? 'PAYMENT_WALLET_ENABLED' : 'PAYMENT_MANUAL_ENABLED']
  return v === undefined || v === '' ? true : v === 'true'
}
/**
 * Methods offered for NEW payments. Defaults come from the environment
 * (DePay is off unless PAYMENT_DEPAY_NEW_PAYMENTS=true — the provider is
 * retiring); an operator row in payment_settings overrides it at runtime.
 * Historical DePay callbacks, events and recovery never depend on this flag.
 */
export async function paymentMethodSettings(q) {
  const rows = await q.query('SELECT method, enabled, reason, updated_by, updated_at FROM payment_settings').then(r => r.rows).catch(() => [])
  const out = {}
  for (const m of PAYMENT_METHODS) {
    const row = rows.find(r => r.method === m)
    out[m] = { enabled: row ? row.enabled : envDefault(m), source: row ? 'operator' : 'environment', updatedBy: row?.updated_by ?? null, updatedAt: row?.updated_at ?? null, reason: row?.reason ?? null }
  }
  return out
}
export async function setPaymentMethod(pool, { method, enabled, actor, reason }) {
  if (!PAYMENT_METHODS.includes(method) || typeof enabled !== 'boolean') throw fail(400, 'invalid_request')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const before = (await client.query('SELECT enabled FROM payment_settings WHERE method=$1 FOR UPDATE', [method])).rows[0] ?? null
    await client.query(
      `INSERT INTO payment_settings (method, enabled, reason, updated_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT (method) DO UPDATE SET enabled=EXCLUDED.enabled, reason=EXCLUDED.reason, updated_by=EXCLUDED.updated_by, updated_at=now()`,
      [method, enabled, reason, actor])
    await client.query(`INSERT INTO financial_audit_log (actor, action, entity, entity_id, before, after) VALUES ($1,'payment_method_setting','payment_settings',$2,$3,$4)`,
      [actor, method, JSON.stringify(before), JSON.stringify({ enabled, reason })])
    await client.query('COMMIT')
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  return paymentMethodSettings(pool)
}
