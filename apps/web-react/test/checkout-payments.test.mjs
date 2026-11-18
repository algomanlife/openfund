/* Checkout: DePay + Manual Payment on one order, statuses derived only from
   server records (checkoutStatus.ts), and the source contract of the page. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkoutStatus, STATUS_TEXT, txIdValid, PAYMENT_STATUS_TEXT, statusTone } from '../src/features/purchase/checkoutStatus.ts'

const page = readFileSync(new URL('../src/features/purchase/CheckoutPage.tsx', import.meta.url), 'utf8')
const pay = readFileSync(new URL('../src/features/purchase/OpenfundPay.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/features/purchase/checkout-page.css', import.meta.url), 'utf8')

test('status mapping follows the server order state machine and the latest attempt', () => {
  const o = (lifecycle_state, status = 'pending') => ({ status, lifecycle_state })
  assert.equal(checkoutStatus(null), null)
  assert.equal(checkoutStatus(o('awaiting_payment')), 'awaiting_payment')
  assert.equal(checkoutStatus(o('awaiting_payment'), { status: 'rejected', error_code: 'insufficient_amount' }), 'payment_failed')
  assert.equal(checkoutStatus(o('payment_detected')), 'verification_pending')
  assert.equal(checkoutStatus(o('awaiting_payment'), { status: 'pending', error_code: 'tx_not_final' }), 'verification_pending')
  assert.equal(checkoutStatus(o('payment_detected'), { status: 'pending', error_code: 'provisioning_retry' }), 'activation_pending')
  assert.equal(checkoutStatus(o('paid', 'paid')), 'payment_confirmed')
  assert.equal(checkoutStatus(o('provisioned', 'paid')), 'challenge_activated')
  assert.equal(checkoutStatus(o('expired', 'expired')), 'expired')
  /* an expired order whose payment is being verified is still followed */
  assert.equal(checkoutStatus(o('payment_detected', 'expired')), 'verification_pending')
  assert.equal(checkoutStatus(o('cancelled', 'cancelled')), 'closed')
  /* v0.7.0 defect: payment_detected (DePay hint) + rejected verification
     (insufficient_amount) must show the failure, not "Verification Pending" */
  assert.equal(checkoutStatus(o('payment_detected'), { status: 'rejected', error_code: 'insufficient_amount' }), 'payment_failed')
  assert.equal(checkoutStatus(o('payment_detected'), { status: 'pending', error_code: 'tx_not_final' }), 'verification_pending')
  assert.equal(checkoutStatus(o('partially_paid'), { status: 'confirmed' }), 'verification_pending')
  /* a rejected attempt never shows a paid order as failed */
  assert.equal(checkoutStatus(o('provisioned', 'paid'), { status: 'rejected' }), 'challenge_activated')
})

test('every status has Persian and English text', () => {
  for (const [k, [fa, en]] of Object.entries(STATUS_TEXT)) assert.ok(fa && en && /[؀-ۿ]/.test(fa) && !/[؀-ۿ]/.test(en), k)
  assert.equal(STATUS_TEXT.verification_pending[1], 'Verification Pending')
  assert.equal(STATUS_TEXT.challenge_activated[1], 'Challenge Activated')
})

test('transaction id formats per network family', () => {
  assert.equal(txIdValid('evm', '0x' + 'ab'.repeat(32)), true)
  assert.equal(txIdValid('evm', '0x1234'), false)
  assert.equal(txIdValid('solana', '5'.repeat(88)), true)
  assert.equal(txIdValid('solana', '0x' + 'ab'.repeat(32)), false)   /* 0 and x are not base58 */
})

test('checkout offers Openfund Pay first, Manual Transfer second, DePay only while enabled; every path is server-verified', () => {
  assert.match(page, /t\('پرداخت با کیف پول', 'Pay with Wallet'\)/)
  assert.match(page, /t\('انتقال دستی', 'Manual Transfer'\)/)
  assert.match(page, /t\('پرداخت با DePay', 'Pay with DePay'\)/)
  /* DePay is offered only when the server enables it for NEW payments */
  assert.match(page, /const useDePay = depayConfigured\(\) && methods\.depay/)
  assert.ok(page.indexOf("'Pay with Wallet'") < page.indexOf("'Manual Transfer'"), 'wallet payment is the primary method')
  /* manual verification posts the chosen network and the id to the server verifier */
  assert.match(page, /apiFetch\('\/purchases\/verify', \{ method: 'POST', body: JSON\.stringify\(\{ orderId: order\.id, chainId: manualChain\.chainId, txHash: txHash\.trim\(\) \}\)/)
  /* the treasury address comes from the server order payload, never hard-coded */
  assert.doesNotMatch(page, /0x2BB7c512|9U7cmxeH/i)
  assert.doesNotMatch(pay, /0x[0-9a-fA-F]{40}/)
  assert.match(page, /payment\?\.manual\?\.chains/)
  /* DePay networks are not narrowed to the Arbitrum sign-in chain */
  assert.doesNotMatch(page, /blockchains:\s*\[/)
  /* the page never marks an order paid from the browser except after a 200
     from the server verifier that is NOT a partial payment */
  assert.equal((page.match(/status: 'paid'/g) || []).length, 1)
  assert.match(page, /if \(r\.data\?\.outcome === 'partially_paid'\) \{[^\n]*return \}\n\s*await loadReceipt\(order\.id\); setOrder\(o => o && \{ \.\.\.o, status: 'paid'/)
})

test('the EVM manual transfer shows the mandatory red sender warning and requires acknowledgment before the address', () => {
  assert.match(pay, /'هشدار بسیار مهم'/)
  assert.match(pay, /'پرداخت را حتماً از همان کیف پولی انجام دهید که با آن وارد Openfund شده و امضا کرده‌اید\.'/)
  assert.match(pay, /'پرداخت از کیف پول دیگر یا صرافی به‌صورت خودکار به سفارش شما متصل و تأیید نمی‌شود و نیازمند بررسی پشتیبانی خواهد بود\.'/)
  /* the address is rendered only after the acknowledgment (EVM); Solana keeps the memo rule */
  assert.match(page, /manualChain\.correlation === 'sender' && <ManualWarning/)
  assert.match(page, /\(manualChain\.correlation !== 'sender' \|\| manualAck\) && <>/)
  assert.match(css, /\.of-pay-warning\s*\{[^}]*(--of-pay-danger|#|rgb)/)
})

test('wallet payment signs exactly one server-prepared ERC-20 transfer and persists the hash before anything else', () => {
  assert.match(pay, /functionName: 'transfer', args: \[intent\.receiver, BigInt\(intent\.amountUnits\)\]/)
  assert.doesNotMatch(pay, /functionName: '(approve|permit|transferFrom|increaseAllowance)'|signTypedData|sendTransaction/)
  assert.equal((pay.match(/writeContractAsync\(/g) || []).length, 1)
  assert.ok(pay.indexOf('savePending(orderId, { intentId: intent.id, txHash: hash })') < pay.indexOf('/purchases/intents/${intent.id}/submit'))
  /* a switched wallet account is refused before signing (identity never follows another wallet) */
  assert.match(pay, /if \(wrongAccount\) \{ setError\(errText\('wallet_mismatch'\)\); return \}/)
})

test('server payment status codes all have Persian and English labels', () => {
  const codes = ['awaiting_payment', 'awaiting_wallet_signature', 'transaction_submitted', 'transaction_detected', 'awaiting_confirmations',
    'partially_received', 'fully_received', 'verification_pending', 'requires_review', 'incorrect_token', 'incorrect_network', 'incorrect_receiver',
    'wrong_sender', 'duplicate_transaction', 'payment_rejected', 'payment_confirmed', 'challenge_activation_pending', 'challenge_activated',
    'order_expired', 'refund_pending', 'refund_completed']
  for (const c of codes) { const v = PAYMENT_STATUS_TEXT[c]; assert.ok(v && /[؀-ۿ]/.test(v[0]) && !/[؀-ۿ]/.test(v[1]), c) }
  assert.equal(statusTone('partially_received'), 'attention')
  assert.equal(statusTone('challenge_activated'), 'ok')
})
