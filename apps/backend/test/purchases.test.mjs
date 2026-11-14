/**
 * Openfund backend purchase/profile/invoice/withdrawal test suite.
 *
 * Two layers:
 *  1. DB-level unit tests of confirmPurchase() — exactly-once provisioning,
 *     invoice generation, replay and cross-order transaction reuse.
 *  2. HTTP tests against the running backend (:8080, like siwe.test.mjs):
 *     profile PATCH (display name + avatar validation), purchase catalog,
 *     order creation, the full purchase lifecycle through the SIM_TEST_MODE
 *     confirmation seam, history, invoice PDF download and ownership
 *     isolation, withdrawal requests.
 *
 * Run: node test/purchases.test.mjs  (backend must be running on :8080)
 * Full purchase lifecycle requires the server env PURCHASE_PAYMENT_RECEIVER
 * to be set (CI sets a test-only address; otherwise those checks SKIP).
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import pg from 'pg'
import { confirmPurchase } from '../purchases.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

/* conduct sales gate: news-dependent plans need verified calendar coverage
   (same labelled fixture the SIM_TEST_MODE server writes at start-up) */
await pool.query(`INSERT INTO economic_calendar_coverage (source, covers_from, covers_to, event_count, actor)
  SELECT 'sim-test-mode', now() - interval '1 day', now() + interval '60 days', 0, 'sim-test-mode'
   WHERE NOT EXISTS (SELECT 1 FROM economic_calendar_coverage WHERE source='sim-test-mode' AND covers_to > now() + interval '30 days')`)

const BASE = process.env.TEST_BACKEND_URL || 'http://localhost:8080'
const DOMAIN = 'localhost:5173'
const CHAIN = 42161

let passed = 0, failed = 0, skipped = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('PASS -', name) }
  else { failed++; console.log('FAIL -', name, extra) }
}
const skip = (name) => { skipped++; console.log('SKIP -', name) }
const j = async (method, path, body, cookie, raw = false) => {
  const res = await fetch(BASE + path, {
    method,
    signal: AbortSignal.timeout(45000),
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) }
  const setCookie = res.headers.get('set-cookie') || ''
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data, cookie: setCookie.split(';')[0] }
}

const fakeAddress = () => '0x' + [...crypto.getRandomValues(new Uint8Array(20))].map(b => b.toString(16).padStart(2, '0')).join('')

async function authenticate(wallet) {
  const n = (await j('POST', '/auth/nonce', { address: wallet.address })).data
  const message = createSiweMessage({ domain: DOMAIN, address: wallet.address, uri: 'http://localhost:5173/', chainId: CHAIN, nonce: n.nonce, version: '1' })
  const signature = await wallet.signMessage({ message })
  return (await j('POST', '/auth/verify', { message, signature })).cookie
}

/* ================= 1. DB unit: confirmPurchase ================= */
{
  const wallet = fakeAddress()
  const { rows: [user] } = await pool.query(
    `INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, $2) RETURNING id`, [wallet, CHAIN])
  const { rows: [plan] } = await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    ['purchase-test-plan', 'Purchase Test — plan', JSON.stringify({ accountSizesUsd: [5000], priceUsd: { 5000: 44 }, phases: 1 })])
  const makeOrder = async () => (await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd)
     VALUES ($1,$2,5000,44) RETURNING id`, [user.id, plan.id])).rows[0]

  const o1 = await makeOrder()
  const txHash = '0x' + 'ab'.repeat(32)
  const r1 = await confirmPurchase(pool, {
    orderId: o1.id, userId: user.id,
    evidence: { txHash, chainId: CHAIN, blockNumber: 42, fromAddress: wallet, toAddress: wallet, amount: '44', tokenAddress: null },
    source: 'unit_test',
  })
  ok('confirmPurchase provisions (order/challenge/invoice)', !r1.replayed && r1.challengeId && r1.invoiceId && r1.invoiceNumber)
  ok('invoice number format OF-YYYY-NNNNNN', /^OF-\d{4}-\d{6}$/.test(r1.invoiceNumber), r1.invoiceNumber)

  const order = (await pool.query('SELECT status, paid_at FROM purchase_orders WHERE id=$1', [o1.id])).rows[0]
  ok('order marked paid exactly once', order.status === 'paid' && order.paid_at != null)
  const challenge = (await pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [r1.challengeId])).rows[0]
  ok('challenge created (created, size, order link, owner)',
    challenge.status === 'created' && Number(challenge.account_size_usd) === 5000 &&
    challenge.purchase_order_id === o1.id && challenge.user_id === user.id)
  const nPayments = (await pool.query('SELECT count(*)::int AS n FROM payments WHERE purchase_order_id=$1', [o1.id])).rows[0].n
  ok('exactly one payment row', nPayments === 1)
  const nInvoices = (await pool.query('SELECT count(*)::int AS n FROM invoices WHERE purchase_order_id=$1', [o1.id])).rows[0].n
  ok('exactly one invoice row', nInvoices === 1)

  const r2 = await confirmPurchase(pool, {
    orderId: o1.id, userId: user.id, evidence: { txHash, chainId: CHAIN }, source: 'unit_test',
  })
  ok('replay is idempotent (no second challenge/payment)', r2.replayed === true && r2.challengeId === r1.challengeId)
  ok('replay creates no duplicates',
    (await pool.query('SELECT count(*)::int AS n FROM openfund_challenges WHERE purchase_order_id=$1', [o1.id])).rows[0].n === 1 &&
    (await pool.query('SELECT count(*)::int AS n FROM payments WHERE purchase_order_id=$1', [o1.id])).rows[0].n === 1)

  const o2 = await makeOrder()
  let reuseError = null
  try {
    await confirmPurchase(pool, {
      orderId: o2.id, userId: user.id,
      evidence: { txHash, chainId: CHAIN, blockNumber: 43, fromAddress: wallet, toAddress: wallet, amount: '44', tokenAddress: null },
      source: 'unit_test',
    })
  } catch (e) { reuseError = e }
  ok('same on-chain tx cannot pay a second order', reuseError && reuseError.status === 409 && reuseError.message === 'tx_already_used')

  let foreignError = null
  try {
    await confirmPurchase(pool, { orderId: o1.id, userId: crypto.randomUUID(), evidence: { txHash, chainId: CHAIN }, source: 'unit_test' })
  } catch (e) { foreignError = e }
  ok('foreign user cannot confirm someone else\'s order', foreignError && foreignError.status === 404)

  /* v0.3.1: provisioning creates a challenge demo account + funding
     ledger rows — remove them before the user cascade delete */
  await pool.query(`DELETE FROM trading_ledger WHERE user_id=$1 AND account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1 AND account_type='challenge')`, [user.id])
  await pool.query('DELETE FROM openfund_challenges WHERE user_id=$1', [user.id])
  await pool.query(`DELETE FROM demo_accounts WHERE user_id=$1 AND account_type='challenge'`, [user.id])
  await pool.query('DELETE FROM openfund_users WHERE id=$1', [user.id]) /* cascades */
  await pool.query('DELETE FROM challenge_plans WHERE slug=$1', ['purchase-test-plan'])
}

/* ================= 2. HTTP: profile editing ================= */
const walletA = privateKeyToAccount(generatePrivateKey())
const walletB = privateKeyToAccount(generatePrivateKey())
let cookieA = null, cookieB = null
{
  cookieA = await authenticate(walletA)
  ok('wallet A authenticated', !!cookieA)
  cookieB = await authenticate(walletB)
  ok('wallet B authenticated', !!cookieB)

  const me0 = await j('GET', '/auth/me', null, cookieA)
  ok('auth/me has no avatar initially', me0.status === 200 && me0.data.user.avatarUrl == null)

  const badName = await j('PATCH', '/auth/profile', { displayName: '' }, cookieA)
  ok('empty display name rejected', badName.status === 400 && badName.data.error === 'invalid_display_name')
  const badName2 = await j('PATCH', '/auth/profile', { displayName: 'x'.repeat(61) }, cookieA)
  ok('over-long display name rejected', badName2.status === 400)
  const badAvatar = await j('PATCH', '/auth/profile', { avatarUrl: 'javascript:alert(1)' }, cookieA)
  ok('non-image avatar rejected', badAvatar.status === 400 && badAvatar.data.error === 'invalid_avatar')
  const bigAvatar = await j('PATCH', '/auth/profile', { avatarUrl: 'data:image/png;base64,' + 'A'.repeat(300 * 1024) }, cookieA)
  ok('oversized avatar rejected', bigAvatar.status === 400)
  const nothing = await j('PATCH', '/auth/profile', {}, cookieA)
  ok('empty update rejected', nothing.status === 400 && nothing.data.error === 'nothing_to_update')
  const anon = await j('PATCH', '/auth/profile', { displayName: 'X' })
  ok('profile PATCH requires auth', anon.status === 401)

  const good = await j('PATCH', '/auth/profile', { displayName: 'Ali Trader' }, cookieA)
  ok('display name updated', good.status === 200 && good.data.displayName === 'Ali Trader')
  const tinyAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const good2 = await j('PATCH', '/auth/profile', { avatarUrl: tinyAvatar }, cookieA)
  ok('data-URL avatar accepted', good2.status === 200 && good2.data.avatarUrl === tinyAvatar)
  const me = await j('GET', '/auth/me', null, cookieA)
  ok('auth/me reflects profile edits', me.status === 200 && me.data.user.displayName === 'Ali Trader' && me.data.user.avatarUrl === tinyAvatar)
  const urlAvatar = await j('PATCH', '/auth/profile', { avatarUrl: 'https://example.com/a.png' }, cookieA)
  ok('https avatar URL accepted', urlAvatar.status === 200)
}

/* ================= 3. HTTP: purchase flow ================= */
let plansData = null
{
  const plans = await j('GET', '/purchases/plans', null, cookieA)
  ok('plans catalog served', plans.status === 200 && Array.isArray(plans.data.plans) && plans.data.plans.length > 0)
  plansData = plans.data
  const standard = plans.data.plans.find(p => p.slug === 'standard')
  ok('standard plan priced from catalog', standard && Number(standard.priceUsd[5000]) === 44, JSON.stringify(standard?.priceUsd).slice(0, 80))

  if (!plans.data.paymentsEnabled) {
    skip('order creation + lifecycle (server PURCHASE_PAYMENT_RECEIVER unset — purchases disabled)')
  }
}

let provisioned = null
if (plansData?.paymentsEnabled) {
  /* order creation */
  const badOrder = await j('POST', '/purchases/orders', { planSlug: 'standard', accountSize: 1234 }, cookieA)
  ok('invalid account size rejected', badOrder.status === 400 && badOrder.data.error === 'invalid_account_size')
  const freeOrder = await j('POST', '/purchases/orders', { planSlug: 'free-trial', accountSize: 5000 }, cookieA)
  ok('free-trial plan not purchasable', freeOrder.status === 400 && freeOrder.data.error === 'not_purchasable')
  const foreignPlan = await j('POST', '/purchases/orders', { planSlug: 'no-such-plan', accountSize: 5000 }, cookieA)
  ok('unknown plan rejected', foreignPlan.status === 404)

  const order = await j('POST', '/purchases/orders', { planSlug: 'standard', accountSize: 5000, idempotencyKey: 'test-order-1' }, cookieA)
  ok('order created with server-controlled price', order.status === 200 && Number(order.data.order.price_usd) === 44 && order.data.order.status === 'pending')
  ok('payment instructions include receiver + reference', order.data.payment?.receiver && order.data.payment.reference === order.data.order.id)
  const idem = await j('POST', '/purchases/orders', { planSlug: 'standard', accountSize: 5000, idempotencyKey: 'test-order-1' }, cookieA)
  ok('idempotency key returns same order', idem.status === 200 && idem.data.order.id === order.data.order.id)
  const foreignView = await j('GET', `/purchases/orders/${order.data.order.id}`, null, cookieB)
  ok('other wallet cannot view order', foreignView.status === 404)

  const verifyBad = await j('POST', '/purchases/verify', { orderId: order.data.order.id, txHash: '0x1234' }, cookieA)
  ok('malformed tx hash rejected', verifyBad.status === 400)
  const verifyForeign = await j('POST', '/purchases/verify', { orderId: order.data.order.id, txHash: '0x' + 'cd'.repeat(32) }, cookieB)
  ok('other wallet cannot verify order', verifyForeign.status === 404)

  /* lifecycle through the test seam (SIM_TEST_MODE=1 + test DB only) */
  /* random per-run tx hash: repeat runs against a persistent test DB must
     not collide with the UNIQUE (chain_id, tx_hash) payment guard */
  const seamTx = '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('')
  const probe = await j('POST', '/internal/confirm-order', { orderId: order.data.order.id, txHash: seamTx }, cookieA)
  if (probe.status === 404) {
    skip('purchase lifecycle via test seam (server not in SIM_TEST_MODE)')
  } else {
    ok('payment confirmed and provisioned', probe.status === 200 && probe.data.challengeId && probe.data.invoiceNumber, JSON.stringify(probe.data).slice(0, 120))
    provisioned = probe.data
    const replay = await j('POST', '/internal/confirm-order', { orderId: order.data.order.id, txHash: seamTx }, cookieA)
    ok('confirmation replay is idempotent', replay.status === 200 && replay.data.replayed === true && replay.data.challengeId === provisioned.challengeId)
    const me = await j('GET', '/auth/me', null, cookieA)
    ok('new challenge appears in /auth/me', me.status === 200 && me.data.challenges.some(c => c.id === provisioned.challengeId))
    const accounts = await j('GET', '/accounts', null, cookieA)
    ok('challenge appears in account directory', accounts.status === 200 &&
      accounts.data.accounts.some(a => a.id === provisioned.challengeId && a.type === 'challenge'))
  }

  /* cancellation of a fresh pending order */
  const order2 = await j('POST', '/purchases/orders', { planSlug: 'standard', accountSize: 10000 }, cookieA)
  const cancel = await j('POST', `/purchases/orders/${order2.data.order.id}/cancel`, {}, cookieA)
  ok('pending order cancellable', cancel.status === 200)
  const cancelAgain = await j('POST', `/purchases/orders/${order2.data.order.id}/cancel`, {}, cookieA)
  ok('cancelled order not cancellable twice', cancelAgain.status === 409)

  /* history */
  const history = await j('GET', '/purchases/history', null, cookieA)
  ok('purchase history lists orders', history.status === 200 && history.data.orders.length >= 2)
  const paidRow = history.data.orders.find(o => o.id === order.data.order.id)
  ok('paid order carries payment + invoice in history', paidRow?.status === 'paid' && paidRow?.payment?.txHash && paidRow?.invoice?.number)
  const historyB = await j('GET', '/purchases/history', null, cookieB)
  ok('history is wallet-scoped', !historyB.data.orders.some(o => o.id === order.data.order.id))

  /* invoice PDF */
  if (provisioned) {
    const pdf = await j('GET', `/invoices/${provisioned.invoiceId}`, null, cookieA, true)
    ok('invoice downloads as PDF', pdf.status === 200 && pdf.buf.subarray(0, 5).toString() === '%PDF-')
    const pdfForeign = await j('GET', `/invoices/${provisioned.invoiceId}`, null, cookieB)
    ok('other wallet cannot download invoice', pdfForeign.status === 404)
  }
} else {
  const disabled = await j('POST', '/purchases/orders', { planSlug: 'standard', accountSize: 5000 }, cookieA)
  ok('orders refused while payments disabled', disabled.status === 403 && disabled.data.error === 'purchases_disabled')
}

/* ================= 4. HTTP: withdrawals (server-computed reward requests) ================= */
{
  const free = await j('POST', '/withdrawals', { amountUsd: 120.5, note: 'first payout' }, cookieA)
  ok('free-amount withdrawal refused (reward account required)', free.status === 400 && free.data?.error === 'reward_account_required')
  const bad = await j('POST', '/withdrawals', { challengeId: 'not-a-uuid' }, cookieA)
  ok('malformed challenge id rejected', bad.status === 400)
  const userA = (await j('GET', '/auth/me', null, cookieA)).data?.user?.id
  const { rows: [legacy] } = await pool.query(
    `INSERT INTO withdrawal_requests (user_id, amount_usd, note) SELECT id, 120.5, 'legacy' FROM openfund_users WHERE id=$1 RETURNING id`, [userA])
  const list = await j('GET', '/withdrawals', null, cookieA)
  ok('withdrawal listed', list.status === 200 && list.data.withdrawals.some(x => x.id === legacy?.id && Number(x.amount_usd) === 120.5))
  const listB = await j('GET', '/withdrawals', null, cookieB)
  ok('withdrawals wallet-scoped', !listB.data.withdrawals.some(x => x.id === legacy?.id))
  const cancelB = await j('POST', `/withdrawals/${legacy?.id}/cancel`, {}, cookieB)
  ok('other wallet cannot cancel', cancelB.status === 409 || cancelB.status === 404)
  const cancel = await j('POST', `/withdrawals/${legacy?.id}/cancel`, {}, cookieA)
  ok('withdrawal cancellable while requested', cancel.status === 200)
  if (provisioned) {
    const w2 = await j('POST', '/withdrawals', { challengeId: provisioned.challengeId }, cookieA)
    ok('an evaluation account is not a reward account', w2.status === 409 && w2.data?.error === 'not_a_funded_account')
    const w3 = await j('POST', '/withdrawals', { challengeId: provisioned.challengeId }, cookieB)
    ok('withdrawal cannot reference foreign challenge', w3.status === 404)
  }
}

await pool.end()
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`)
process.exit(failed ? 1 : 0)
