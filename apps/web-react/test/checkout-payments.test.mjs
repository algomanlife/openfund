/* Checkout: DePay + Manual Payment on one order, statuses derived only from
   server records (checkoutStatus.ts), and the source contract of the page. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkoutStatus, STATUS_TEXT, txIdValid } from '../src/features/purchase/checkoutStatus.ts'

const page = readFileSync(new URL('../src/features/purchase/CheckoutPage.tsx', import.meta.url), 'utf8')

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

test('checkout offers both methods and the manual path is server-verified', () => {
  assert.match(page, /t\('پرداخت با DePay', 'Pay with DePay'\)/)
  assert.match(page, /t\('پرداخت دستی', 'Manual Payment'\)/)
  /* manual verification posts the chosen network and the id to the server verifier */
  assert.match(page, /apiFetch\('\/purchases\/verify', \{ method: 'POST', body: JSON\.stringify\(\{ orderId: order\.id, chainId: manualChain\.chainId, txHash: txHash\.trim\(\) \}\)/)
  /* the treasury address comes from the server order payload, never hard-coded */
  assert.doesNotMatch(page, /0x2BB7c512|9U7cmxeH/i)
  assert.match(page, /payment\?\.manual\?\.chains/)
  /* DePay networks are not narrowed to the Arbitrum sign-in chain */
  assert.doesNotMatch(page, /blockchains:\s*\[/)
  /* the page never marks an order paid from the browser except after a 200 from the server verifier */
  assert.equal((page.match(/status: 'paid'/g) || []).length, 1)
  assert.match(page, /if \(r\.ok\) \{ await loadReceipt\(order\.id\); setOrder\(o => o && \{ \.\.\.o, status: 'paid'/)
})
