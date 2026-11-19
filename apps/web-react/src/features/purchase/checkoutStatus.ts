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
  if (latest?.status === 'pending') return 'verification_pending'
  /* v0.7.0 defect: a DePay hint moved the order to payment_detected and the
     verifier then REJECTED the payment (insufficient_amount); the page kept
     showing "Verification Pending" because the lifecycle was checked first.
     A rejected latest attempt with nothing pending is shown as failed. */
  if (latest?.status === 'rejected' && lifecycle !== 'partially_paid' && lifecycle !== 'manual_review') return 'payment_failed'
  if (lifecycle === 'payment_detected' || lifecycle === 'manual_review' || lifecycle === 'partially_paid') return 'verification_pending'
  if (lifecycle === 'expired') return 'expired'
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

/**
 * Openfund Pay — the server's authoritative payment status codes
 * (apps/backend/payment-status.js). The page shows exactly the code the
 * server derived; it never decides "paid" itself.
 */
export type PaymentStatusCode =
  | 'awaiting_payment' | 'awaiting_wallet_signature' | 'transaction_submitted' | 'transaction_detected'
  | 'awaiting_confirmations' | 'partially_received' | 'fully_received' | 'verification_pending' | 'requires_review'
  | 'incorrect_token' | 'incorrect_network' | 'incorrect_receiver' | 'wrong_sender' | 'duplicate_transaction'
  | 'payment_rejected' | 'payment_confirmed' | 'challenge_activation_pending' | 'challenge_activated'
  | 'order_expired' | 'refund_pending' | 'refund_completed'
export interface ServerPaymentStatus { code: PaymentStatusCode, escalation: 'delayed' | 'review' | null, reason: string | null, checking: boolean, refund: 'refund_pending' | 'refund_completed' | null }

export const PAYMENT_STATUS_TEXT: Record<PaymentStatusCode, [fa: string, en: string]> = {
  awaiting_payment: label('در انتظار پرداخت', 'Awaiting Payment'),
  awaiting_wallet_signature: label('در انتظار امضای کیف پول', 'Awaiting Wallet Signature'),
  transaction_submitted: label('تراکنش ارسال شد', 'Transaction Submitted'),
  transaction_detected: label('تراکنش شناسایی شد', 'Transaction Detected'),
  awaiting_confirmations: label('در انتظار تأییدهای بلاک‌چین', 'Awaiting Blockchain Confirmations'),
  partially_received: label('بخشی از مبلغ دریافت شد', 'Payment Partially Received'),
  fully_received: label('کل مبلغ دریافت شد', 'Payment Fully Received'),
  verification_pending: label('در حال بررسی تراکنش', 'Payment Verification Pending'),
  requires_review: label('نیازمند بررسی پشتیبانی', 'Payment Requires Review'),
  incorrect_token: label('توکن نادرست', 'Incorrect Token'),
  incorrect_network: label('شبکهٔ نادرست', 'Incorrect Network'),
  incorrect_receiver: label('گیرندهٔ نادرست', 'Incorrect Receiver'),
  wrong_sender: label('کیف پول فرستنده نادرست است', 'Wrong Sender'),
  duplicate_transaction: label('تراکنش تکراری', 'Duplicate Transaction'),
  payment_rejected: label('پرداخت رد شد', 'Payment Rejected'),
  payment_confirmed: label('پرداخت تأیید شد', 'Payment Confirmed'),
  challenge_activation_pending: label('پرداخت تأیید شد · در انتظار فعال‌سازی چالش', 'Challenge Activation Pending'),
  challenge_activated: label('چالش فعال شد', 'Challenge Activated'),
  order_expired: label('سفارش منقضی شد', 'Order Expired'),
  refund_pending: label('بازپرداخت در جریان است', 'Refund Pending'),
  refund_completed: label('بازپرداخت انجام شد', 'Refund Completed'),
}
/** tone of a status for styling (success / progress / attention / error) */
export function statusTone(code: PaymentStatusCode | null | undefined): 'ok' | 'progress' | 'attention' | 'error' {
  if (!code) return 'progress'
  if (code === 'challenge_activated' || code === 'payment_confirmed' || code === 'fully_received' || code === 'refund_completed') return 'ok'
  if (['incorrect_token', 'incorrect_network', 'incorrect_receiver', 'wrong_sender', 'duplicate_transaction', 'payment_rejected', 'order_expired'].includes(code)) return 'error'
  if (code === 'requires_review' || code === 'partially_received' || code === 'refund_pending') return 'attention'
  return 'progress'
}
