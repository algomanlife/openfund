/**
 * Openfund Pay — the customer-facing payment status, derived ONLY from
 * server records (order lifecycle, ledger totals, payment attempts, open
 * intents, refund liabilities). The browser displays this code; it never
 * derives "paid" by itself (docs/payments/OPENFUND_PAY.md, Status model).
 *
 * Separate dimensions are reported separately:
 *   transaction  — the latest attempt's chain condition
 *   settlement   — received / remaining / excess (ledger)
 *   order        — lifecycle_state
 *   challenge    — provisioned or not
 *   refund       — worst open liability status
 * and folded into ONE headline `code` with this precedence:
 *   challenge_activated > challenge_activation_pending > refund_* (closed
 *   orders) > in-flight transaction (submitted / confirmations / pending,
 *   escalated after 15 and 20 minutes) > partially_received > latest
 *   rejection (incorrect token / network / receiver, wrong sender,
 *   duplicate, rejected) > review > detected > expired > awaiting.
 *
 * A rejected attempt is never hidden behind an older "payment detected"
 * lifecycle (the v0.7.0 defect: DePay hint → payment_detected, verifier →
 * insufficient_amount, page kept showing "Verification Pending").
 */
export const STATUS_DELAY_MS = 15 * 60_000
export const STATUS_REVIEW_MS = 20 * 60_000

export const PAYMENT_STATUS_CODES = [
  'awaiting_payment', 'awaiting_wallet_signature', 'transaction_submitted', 'transaction_detected',
  'awaiting_confirmations', 'partially_received', 'fully_received', 'verification_pending', 'requires_review',
  'incorrect_token', 'incorrect_network', 'incorrect_receiver', 'wrong_sender', 'duplicate_transaction',
  'payment_rejected', 'payment_confirmed', 'challenge_activation_pending', 'challenge_activated',
  'order_expired', 'refund_pending', 'refund_completed',
]

const REJECTION = {
  wrong_token: 'incorrect_token', native_payment_unsupported: 'incorrect_token',
  unsupported_chain: 'incorrect_network',
  wrong_receiver: 'incorrect_receiver', unapproved_contract: 'incorrect_receiver',
  wrong_sender: 'wrong_sender', transfer_not_from_payer: 'wrong_sender', memo_missing: 'wrong_sender',
  tx_already_used: 'duplicate_transaction', order_already_paid: 'duplicate_transaction',
  order_expired: 'requires_review', coupon_unavailable: 'requires_review', dust: 'requires_review',
}
const IN_FLIGHT = { tx_pending: 'transaction_submitted', tx_not_final: 'awaiting_confirmations', rpc_unavailable: 'verification_pending', tx_reorged: 'verification_pending' }
const OPEN_REFUND = new Set(['refund_due', 'refund_review', 'refund_approved', 'refund_sent', 'refund_failed'])

/**
 * @param {object} p
 *   order: { status, lifecycle_state, payment_required, expires_at }
 *   totals: { receivedUsd, remainingUsd, excessUsd } (strings) | null
 *   attempts: [{ status, error_code, first_seen_at, last_attempt_at }] newest first
 *   intent: latest intent { status, created_at } | null
 *   refunds: [{ status }]
 *   hasChallenge: boolean
 *   now: Date
 */
export function derivePaymentStatus({ order, totals = null, attempts = [], intent = null, refunds = [], hasChallenge = false, now = new Date() }) {
  if (!order) return null
  const lifecycle = order.lifecycle_state || (order.status === 'pending' ? 'awaiting_payment' : order.status === 'paid' ? 'provisioned' : order.status)
  const open = refunds.filter(r => OPEN_REFUND.has(r.status))
  const refund = open.length ? 'refund_pending' : refunds.some(r => r.status === 'refund_confirmed') ? 'refund_completed' : null
  const base = { lifecycle, refund, escalation: null, reason: null, checking: false }
  const received = totals && totals.receivedUsd && totals.receivedUsd !== '0'

  if (lifecycle === 'provisioned' || lifecycle === 'partially_refunded' || lifecycle === 'refunded' || (order.status === 'paid' && hasChallenge))
    return { ...base, code: 'challenge_activated' }
  if (lifecycle === 'paid' || order.status === 'paid') return { ...base, code: 'challenge_activation_pending' }
  if (lifecycle === 'cancelled') return { ...base, code: refund || 'payment_rejected', reason: 'order_cancelled' }

  const latest = attempts[0] || null
  if (latest?.status === 'pending' && latest.error_code === 'provisioning_retry')
    return { ...base, code: 'challenge_activation_pending', checking: true }
  if (latest?.status === 'pending') {
    const age = now.getTime() - new Date(latest.first_seen_at || latest.last_attempt_at || now).getTime()
    const code = IN_FLIGHT[latest.error_code] || 'transaction_detected'
    /* never a silent spinner: after 15 minutes the exact condition is
       explained; after 20 the case is under review — and background
       verification continues (a delay is never declared a failure) */
    if (age >= STATUS_REVIEW_MS) return { ...base, code: 'requires_review', escalation: 'review', reason: latest.error_code || 'pending', checking: true }
    return { ...base, code, escalation: age >= STATUS_DELAY_MS ? 'delayed' : null, reason: latest.error_code || null, checking: true }
  }
  if (lifecycle === 'partially_paid' || (received && totals.remainingUsd !== '0'))
    return { ...base, code: 'partially_received' }
  if (latest?.status === 'rejected')
    return { ...base, code: REJECTION[latest.error_code] || 'payment_rejected', reason: latest.error_code || null }
  if (lifecycle === 'manual_review') return { ...base, code: 'requires_review', reason: 'manual_review' }
  if (lifecycle === 'payment_detected') return { ...base, code: 'transaction_detected', checking: true }
  if (refund) return { ...base, code: refund }
  if (lifecycle === 'expired' || order.status === 'expired' || (order.expires_at && new Date(order.expires_at) < now)) return { ...base, code: 'order_expired' }
  if (intent?.status === 'open' && now.getTime() - new Date(intent.created_at).getTime() < 10 * 60_000)
    return { ...base, code: 'awaiting_wallet_signature' }
  return { ...base, code: 'awaiting_payment' }
}
