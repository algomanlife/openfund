/**
 * Checkout status shown to the customer, derived ONLY from server records:
 * the order's lifecycle state (purchase_orders.lifecycle_state, the order
 * state machine in apps/backend/schema.sql) and the latest payment attempt
 * (payment_attempts). No separate client-side state machine exists; this
 * is a display mapping, so it can never mark anything paid on its own.
 *
 *   awaiting_payment                         → awaiting_payment
 *   awaiting_payment + latest attempt rejected → payment_failed (retry allowed)
 *   payment_detected / latest attempt pending  → verification_pending
 *   attempt pending with provisioning_retry    → activation_pending (paid on-chain,
 *                                                 challenge provisioning is being retried)
 *   paid                                     → payment_confirmed
 *   provisioned (challenge exists)           → challenge_activated
 *   expired                                  → expired  (unless a payment is being verified)
 *   cancelled / refunded                     → closed
 */
export type CheckoutStatus =
  | 'awaiting_payment' | 'verification_pending' | 'payment_failed' | 'payment_confirmed'
  | 'activation_pending' | 'challenge_activated' | 'expired' | 'closed'

export interface StatusOrder { status: string, lifecycle_state?: string | null }
export interface StatusAttempt { status: string, error_code?: string | null }

export function checkoutStatus(order: StatusOrder | null, latest?: StatusAttempt | null, hasChallenge = false): CheckoutStatus | null {
  if (!order) return null
  const lifecycle = order.lifecycle_state || (order.status === 'pending' ? 'awaiting_payment' : order.status === 'paid' ? 'provisioned' : order.status)
  if (lifecycle === 'provisioned' || (order.status === 'paid' && hasChallenge)) return 'challenge_activated'
  if (lifecycle === 'paid' || order.status === 'paid') return 'payment_confirmed'
  if (lifecycle === 'cancelled' || lifecycle === 'refunded' || lifecycle === 'partially_refunded') return 'closed'
  if (latest?.status === 'pending' && latest.error_code === 'provisioning_retry') return 'activation_pending'
  if (lifecycle === 'payment_detected' || lifecycle === 'manual_review' || latest?.status === 'pending') return 'verification_pending'
  if (lifecycle === 'expired') return 'expired'
  if (latest?.status === 'rejected') return 'payment_failed'
  return 'awaiting_payment'
}

/* label(fa, en): a plain pair, written as a call so the i18n source
   inventory (scripts/i18n-sources.mjs) picks the English text up */
const label = (fa: string, en: string): [fa: string, en: string] => [fa, en]
export const STATUS_TEXT: Record<CheckoutStatus, [fa: string, en: string]> = {
  awaiting_payment: label('در انتظار پرداخت', 'Awaiting Payment'),
  verification_pending: label('در حال بررسی تراکنش', 'Verification Pending'),
  payment_failed: label('پرداخت تأیید نشد', 'Payment Failed'),
  payment_confirmed: label('پرداخت تأیید شد', 'Payment Confirmed'),
  activation_pending: label('پرداخت تأیید شد · در انتظار فعال‌سازی چالش', 'Payment Confirmed · Challenge Activation Pending'),
  challenge_activated: label('چالش فعال شد', 'Challenge Activated'),
  expired: label('سفارش منقضی شد', 'Expired'),
  closed: label('سفارش بسته شد', 'Order Closed'),
}

/* transaction id formats: an EVM hash (0x + 64 hex) or a Solana signature (base58) */
export const EVM_TX = /^0x[0-9a-fA-F]{64}$/
export const SOLANA_SIG = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/
export const txIdValid = (family: 'evm' | 'solana', tx: string) => (family === 'solana' ? SOLANA_SIG : EVM_TX).test(tx.trim())
