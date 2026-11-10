/**
 * Coupons, zero-payment purchases, the explicit order lifecycle and the
 * DePay dynamic-configuration / callback / events endpoints.
 *
 * In-process: the real purchase and coupon-admin routers are mounted on a
 * local Express app against an isolated PostgreSQL test database (migrated
 * and seeded). The chain verifier is a test double, so nothing here is
 * evidence of a real payment — it proves the server logic, signatures,
 * idempotency, state transitions and race safety.
 *
 * Run: DATABASE_URL=postgres://…/openfund_test node --test test/commerce.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { purchaseRoutes, recoverPendingPayments, paymentsReady, cfg } from '../purchases.js'
import { couponAdminRoutes, applyCoupon } from '../coupons.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 30 })

const RECEIVER = '0x' + 'c1'.repeat(20)
const USDC_ARBITRUM = '0xaf88d065e77c8cc2239327c5edb3a432268e5831' /* USDC on Arbitrum One (public contract) */
const ADMIN = crypto.randomBytes(24).toString('hex') /* per-run test value, never a credential */
Object.assign(process.env, {
  PURCHASE_PAYMENT_RECEIVER: RECEIVER, PURCHASE_PAYMENT_CHAIN: '42161', PURCHASE_PAYMENT_TOKEN: USDC_ARBITRUM,
  PURCHASE_PAYMENT_DECIMALS: '6', ADMIN_API_TOKEN: ADMIN,
})
/* test-only RSA key pairs: "Openfund" (signs configuration) and "DePay" (signs deliveries) */
const pemOf = k => k.export({ type: k.type === 'private' ? 'pkcs8' : 'spki', format: 'pem' }).toString()
const openfundKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const depayKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.DEPAY_CONFIG_PRIVATE_KEY = pemOf(openfundKeys.privateKey)
process.env.DEPAY_VERIFY_PUBLIC_KEY = pemOf(depayKeys.publicKey)
const depaySign = (raw, key = depayKeys.privateKey) => crypto.sign('sha256', Buffer.from(raw),
  { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }).toString('base64url')

/* ---- chain verifier double: the test decides what "the chain" says ---- */
let chain = { mode: 'ok' }
const verifier = async (txHash, expect) => {
  if (chain.mode === 'rpc_down') throw Object.assign(new Error('rpc_unavailable'), { retryable: true, status: 503 })
  if (chain.mode === 'wrong_receiver') throw Object.assign(new Error('wrong_receiver'), { status: 409 })
  if (chain.mode === 'insufficient') throw Object.assign(new Error('insufficient_amount'), { status: 409 })
  return { txHash, chainId: expect.chainId, blockNumber: 10, fromAddress: expect.from, toAddress: expect.receiver,
    amount: String(Math.round(Number(expect.priceUsd) * 1e6)), tokenAddress: expect.token,
    blockTimestamp: new Date().toISOString(), overpaymentUnits: '0', route: 'direct', confirmations: 20 }
}

/* ---- in-process app: real routers, header-based test authentication ---- */
const app = express()
const DEPAY = new Set(['/purchases/depay/configuration', '/purchases/depay/callback', '/purchases/depay/events'])
app.use(express.json({ limit: '32kb', verify: (req, res, buf) => { if (DEPAY.has(req.path)) req.rawBody = buf } }))
const requireAuth = async (req, res, next) => {
  const id = req.headers['x-test-user']
  if (!id) return res.status(401).json({ error: 'unauthenticated' })
  const { rows: [u] } = await pool.query('SELECT id AS user_id, wallet_address FROM openfund_users WHERE id=$1', [id])
  req.user = u; next()
}
app.use(purchaseRoutes({ pool, requireAuth, audit: async () => {}, verifier }))
app.use('/admin/coupons', couponAdminRoutes({ pool }))
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal' }))
const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)) })
const BASE = `http://127.0.0.1:${server.address().port}`
test.after(async () => { server.close(); await pool.end() })

const call = async (method, path, { body, user, admin, raw, headers = {} } = {}) => {
  const res = await fetch(BASE + path, {
    method, body: raw ?? (body ? JSON.stringify(body) : undefined),
    headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user.id } : {}),
      ...(admin ? { Authorization: `Bearer ${ADMIN}`, 'X-Admin-Actor': 'commerce-test' } : {}), ...headers },
  })
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers }
}
const rndAddr = () => '0x' + crypto.randomBytes(20).toString('hex')
const rndHash = () => '0x' + crypto.randomBytes(32).toString('hex')
const newUser = async () => {
  const wallet = rndAddr()
  const { rows: [u] } = await pool.query(`INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id`, [wallet])
  return { id: u.id, wallet }
}
const PLAN = 'standard', SIZE = 10000, LIST = 80 /* seed-plans.js */
const order = (user, extra = {}) => call('POST', '/purchases/orders', { user, body: { planSlug: PLAN, accountSize: SIZE, ...extra } })
const createCoupon = async (spec) => {
  const r = await call('POST', '/admin/coupons', { admin: true, body: { code: 'T' + crypto.randomBytes(5).toString('hex').toUpperCase(), ...spec } })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  return r.data.coupon
}
const events = async id => (await pool.query('SELECT from_state, to_state FROM purchase_order_events WHERE purchase_order_id=$1 ORDER BY id', [id])).rows
const orderRow = async id => (await pool.query('SELECT * FROM purchase_orders WHERE id=$1', [id])).rows[0]
const settle = () => new Promise(r => setTimeout(r, 250))

await pool.query(`SELECT 1 FROM challenge_plans WHERE slug=$1`, [PLAN]).then(r => { if (!r.rowCount) throw new Error('run npm run seed-plans first') })

/* ================= pricing ================= */
test('P1 coupon pricing: percent rounds half-up to cents, fixed is capped at the price, 100% is zero', () => {
  assert.deepEqual(applyCoupon('80.00', { kind: 'percent', value: '12.5' }), { list: '80.00', discount: '10.00', net: '70.00' })
  assert.deepEqual(applyCoupon('44.00', { kind: 'percent', value: '33.33' }), { list: '44.00', discount: '14.67', net: '29.33' })
  assert.deepEqual(applyCoupon('80.00', { kind: 'fixed', value: '25' }), { list: '80.00', discount: '25.00', net: '55.00' })
  assert.deepEqual(applyCoupon('80.00', { kind: 'fixed', value: '500' }), { list: '80.00', discount: '80.00', net: '0.00' })
  assert.deepEqual(applyCoupon('80.00', { kind: 'percent', value: '100' }), { list: '80.00', discount: '80.00', net: '0.00' })
  assert.deepEqual(applyCoupon('80.00', null), { list: '80.00', discount: '0.00', net: '80.00' })
})

test('P2 checkout is Arbitrum-only: any other payment chain disables purchases', () => {
  assert.equal(paymentsReady(), true)
  for (const chainId of [11155111, 1, 8453, 421614]) assert.equal(paymentsReady({ ...cfg(), chainId }), false, String(chainId))
})

test('P3 the quote is computed by the server from the plan of record and the coupon', async () => {
  const u = await newUser()
  const plain = await call('POST', '/purchases/quote', { user: u, body: { planSlug: PLAN, accountSize: SIZE, priceUsd: 1 } })
  assert.equal(plain.status, 200); assert.equal(plain.data.priceUsd, '80.00'); assert.equal(plain.data.paymentRequired, true)
  const c = await createCoupon({ kind: 'percent', value: 25 })
  const q = await call('POST', '/purchases/quote', { user: u, body: { planSlug: PLAN, accountSize: SIZE, couponCode: c.code.toLowerCase() } })
  assert.equal(q.status, 200); assert.deepEqual([q.data.listPriceUsd, q.data.discountUsd, q.data.priceUsd], ['80.00', '20.00', '60.00'])
  assert.equal((await call('POST', '/purchases/quote', { user: u, body: { planSlug: PLAN, accountSize: 12345 } })).data.error, 'invalid_account_size')
  assert.equal((await call('POST', '/purchases/quote', { body: { planSlug: PLAN, accountSize: SIZE } })).status, 401)
})

/* ================= coupon validation ================= */
test('C1 coupon restrictions: unknown, disabled, not started, expired, plan, size, user-restricted', async () => {
  const u = await newUser()
  const q = code => call('POST', '/purchases/quote', { user: u, body: { planSlug: PLAN, accountSize: SIZE, couponCode: code } })
  assert.equal((await q('NOPE-NOPE')).data.error, 'coupon_not_found')
  assert.equal((await q('bad code!')).data.error, 'coupon_invalid')
  const disabled = await createCoupon({ kind: 'fixed', value: 5 })
  assert.equal((await call('POST', `/admin/coupons/${disabled.id}/disable`, { admin: true })).status, 200)
  assert.equal((await q(disabled.code)).data.error, 'coupon_disabled')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, startsAt: new Date(Date.now() + 864e5).toISOString() })).code)).data.error, 'coupon_not_started')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, expiresAt: new Date(Date.now() - 1000).toISOString() })).code)).data.error, 'coupon_expired')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, planSlugs: ['instant'] })).code)).data.error, 'coupon_not_applicable')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, accountSizes: [5000] })).code)).data.error, 'coupon_not_applicable')
  const mine = await createCoupon({ kind: 'fixed', value: 5, allowedWallets: [rndAddr()] })
  assert.equal((await q(mine.code)).data.error, 'coupon_not_found', 'restricted coupons are invisible to other users')
  const ok = await createCoupon({ kind: 'fixed', value: 5, planSlugs: [PLAN], accountSizes: [SIZE], allowedWallets: [u.wallet] })
  assert.equal((await q(ok.code)).data.priceUsd, '75.00')
})

test('C2 internal testing coupons: at most two named test wallets and a finite limit; nobody else can use them', async () => {
  const bad = [
    { internal: true },
    { internal: true, allowedWallets: [rndAddr()] },
    { internal: true, allowedWallets: [rndAddr(), rndAddr(), rndAddr()], maxRedemptions: 2 },
    { kind: 'percent', value: 101 },
  ]
  for (const extra of bad) {
    const r = await call('POST', '/admin/coupons', { admin: true, body: { code: 'BAD' + crypto.randomBytes(4).toString('hex').toUpperCase(), kind: 'percent', value: 100, ...extra } })
    assert.equal(r.status, 400, JSON.stringify(extra))
  }
  const [a, b, outsider] = [await newUser(), await newUser(), await newUser()]
  const c = await createCoupon({ kind: 'percent', value: 100, internal: true, allowedWallets: [a.wallet, b.wallet], maxRedemptions: 2 })
  assert.equal((await order(outsider, { couponCode: c.code })).data.error, 'coupon_not_found')
  const ra = await order(a, { couponCode: c.code }); assert.equal(ra.status, 200); assert.equal(ra.data.order.lifecycle_state, 'provisioned')
  const rb = await order(b, { couponCode: c.code }); assert.equal(rb.status, 200)
  assert.equal((await order(a, { couponCode: c.code })).data.error, 'coupon_exhausted')
})

test('C3 admin: authentication, named actor, edit, disable, immutable pricing fields, redemptions, orders and audit', async () => {
  assert.equal((await call('GET', '/admin/coupons')).status, 403)
  assert.equal((await call('POST', '/admin/coupons', { body: {}, headers: { Authorization: `Bearer ${ADMIN}` } })).data.error, 'admin_actor_required')
  const c = await createCoupon({ kind: 'percent', value: 10, maxRedemptions: 5 })
  assert.equal((await call('POST', '/admin/coupons', { admin: true, body: { code: c.code, kind: 'fixed', value: 1 } })).data.error, 'code_exists')
  assert.equal((await call('PATCH', `/admin/coupons/${c.id}`, { admin: true, body: { value: 50 } })).data.error, 'value_immutable')
  const e = await call('PATCH', `/admin/coupons/${c.id}`, { admin: true, body: { maxRedemptions: 9, description: 'launch' } })
  assert.equal(e.status, 200); assert.equal(e.data.coupon.maxRedemptions, 9)
  const u = await newUser()
  const o = await order(u, { couponCode: c.code })
  assert.equal(o.status, 200); assert.equal(o.data.order.price_usd, '72.00'); assert.equal(o.data.order.coupon_code, c.code)
  assert.equal((await call('POST', `/admin/coupons/${c.id}/disable`, { admin: true })).data.coupon.status, 'disabled')
  const red = (await call('GET', `/admin/coupons/${c.id}/redemptions`, { admin: true })).data.redemptions
  assert.equal(red.length, 1); assert.equal(red[0].status, 'reserved'); assert.equal(red[0].purchase_order_id, o.data.order.id)
  assert.equal((await call('GET', `/admin/coupons/${c.id}/orders`, { admin: true })).data.orders[0].id, o.data.order.id)
  const audit = (await call('GET', `/admin/coupons/${c.id}/audit`, { admin: true })).data.audit
  assert.deepEqual(audit.map(a => a.action), ['created', 'updated', 'disabled'])
  assert.equal(audit[0].actor, 'admin:commerce-test')
  await assert.rejects(pool.query('UPDATE coupon_audit SET action=$1 WHERE coupon_id=$2', ['x', c.id]), /append_only/)
  /* cancelling the order releases the reservation */
  assert.equal((await call('POST', `/purchases/orders/${o.data.order.id}/cancel`, { user: u, body: {} })).status, 200)
  assert.equal((await pool.query('SELECT status FROM coupon_redemptions WHERE purchase_order_id=$1', [o.data.order.id])).rows[0].status, 'released')
})

/* ================= zero-payment flow ================= */
test('Z1 a 100% coupon provisions through the zero-payment flow: no payment row, challenge + invoice, explicit transitions', async () => {
  const u = await newUser()
  const c = await createCoupon({ kind: 'percent', value: 100, maxRedemptions: 10 })
  const r = await order(u, { couponCode: c.code, idempotencyKey: 'zero-1' })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  const o = r.data.order
  assert.deepEqual([o.status, o.lifecycle_state, o.price_usd, o.payment_required], ['paid', 'provisioned', '0.00', false])
  assert.equal(r.data.payment, null, 'no payment instructions for a zero-payment order')
  assert.ok(r.data.result.challengeId); assert.ok(r.data.result.invoiceNumber); assert.equal(r.data.result.paymentId, null)
  assert.equal((await pool.query('SELECT count(*)::int n FROM payments WHERE purchase_order_id=$1', [o.id])).rows[0].n, 0)
  assert.equal((await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE purchase_order_id=$1', [o.id])).rows[0].n, 1)
  assert.equal((await pool.query('SELECT total_usd FROM invoices WHERE purchase_order_id=$1', [o.id])).rows[0].total_usd, '0.00')
  assert.deepEqual(await events(o.id), [
    { from_state: null, to_state: 'awaiting_payment' }, { from_state: 'awaiting_payment', to_state: 'paid' }, { from_state: 'paid', to_state: 'provisioned' }])
  assert.equal((await pool.query('SELECT status FROM coupon_redemptions WHERE purchase_order_id=$1', [o.id])).rows[0].status, 'consumed')
  /* idempotent replay: same key → same order, still one challenge */
  const again = await order(u, { couponCode: c.code, idempotencyKey: 'zero-1' })
  assert.equal(again.data.order.id, o.id)
  assert.equal((await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE user_id=$1', [u.id])).rows[0].n, 1)
  /* per-user limit (default 1) */
  assert.equal((await order(u, { couponCode: c.code })).data.error, 'coupon_already_used')
  /* never sent to DePay, never verified on-chain */
  assert.equal((await call('POST', '/purchases/verify', { user: u, body: { orderId: o.id, txHash: rndHash() } })).data.error, 'zero_payment_order')
})

test('Z2 a zero-payment order is atomic: a provisioning failure leaves no order, no reservation, no challenge', async () => {
  const u = await newUser()
  const c = await createCoupon({ kind: 'percent', value: 100, maxRedemptions: 5 })
  await pool.query(`CREATE OR REPLACE FUNCTION commerce_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated_db_failure'; END $$`)
  await pool.query(`CREATE TRIGGER commerce_test_fail BEFORE INSERT ON invoices FOR EACH ROW WHEN (NEW.total_usd = 0) EXECUTE FUNCTION commerce_test_fail()`)
  try {
    const r = await order(u, { couponCode: c.code })
    assert.equal(r.status, 500)
  } finally { await pool.query('DROP TRIGGER commerce_test_fail ON invoices') }
  assert.equal((await pool.query('SELECT count(*)::int n FROM purchase_orders WHERE user_id=$1', [u.id])).rows[0].n, 0)
  assert.equal((await pool.query('SELECT count(*)::int n FROM coupon_redemptions WHERE user_id=$1', [u.id])).rows[0].n, 0)
  const retry = await order(u, { couponCode: c.code })
  assert.equal(retry.data.order.lifecycle_state, 'provisioned', 'the user can simply retry after recovery')
})

/* ================= concurrency ================= */
test('R1 coupon redemption race: 12 users at once on a 3-use 100% coupon → exactly 3 accounts', async () => {
  const c = await createCoupon({ kind: 'percent', value: 100, maxRedemptions: 3 })
  const users = await Promise.all(Array.from({ length: 12 }, newUser))
  const rs = await Promise.all(users.map(u => order(u, { couponCode: c.code })))
  assert.equal(rs.filter(r => r.status === 200).length, 3)
  assert.equal(rs.filter(r => r.data?.error === 'coupon_exhausted').length, 9)
  assert.equal((await pool.query(`SELECT count(*)::int n FROM openfund_challenges ch JOIN purchase_orders o ON o.id=ch.purchase_order_id WHERE o.coupon_id=$1`, [c.id])).rows[0].n, 3)
})

test('R2 one user, 10 parallel requests, per-user limit 1, unlimited total → exactly one redemption', async () => {
  const c = await createCoupon({ kind: 'percent', value: 100 })
  const u = await newUser()
  const rs = await Promise.all(Array.from({ length: 10 }, () => order(u, { couponCode: c.code })))
  assert.equal(rs.filter(r => r.status === 200).length, 1)
  assert.equal(rs.filter(r => r.data?.error === 'coupon_already_used').length, 9)
})

test('R3 simultaneous purchases with one idempotency key → one order', async () => {
  const u = await newUser()
  const rs = await Promise.all(Array.from({ length: 8 }, () => order(u, { idempotencyKey: 'same-key' })))
  assert.ok(rs.every(r => r.status === 200), JSON.stringify(rs.map(r => r.data)))
  assert.equal(new Set(rs.map(r => r.data.order.id)).size, 1)
  assert.equal((await pool.query('SELECT count(*)::int n FROM purchase_orders WHERE user_id=$1', [u.id])).rows[0].n, 1)
})

/* ================= lifecycle ================= */
test('L1 invalid transitions and pricing changes are rejected by the database; refunds are explicit states', async () => {
  const u = await newUser()
  const o = (await order(u)).data.order
  await assert.rejects(pool.query(`UPDATE purchase_orders SET lifecycle_state='provisioned' WHERE id=$1`, [o.id]).then(() =>
    pool.query(`UPDATE purchase_orders SET lifecycle_state='awaiting_payment' WHERE id=$1`, [o.id])), /invalid_order_transition/)
  await assert.rejects(pool.query(`UPDATE purchase_orders SET price_usd=1 WHERE id=$1`, [o.id]), /order_pricing_immutable/)
  await assert.rejects(pool.query(`UPDATE purchase_order_events SET to_state='x' WHERE purchase_order_id=$1`, [o.id]), /append_only/)
  await assert.rejects(pool.query(`DELETE FROM purchase_order_events WHERE purchase_order_id=$1`, [o.id]), /append_only/)
  const u2 = await newUser()
  const paid = (await order(u2)).data.order
  const tx = rndHash()
  assert.equal((await call('POST', '/purchases/verify', { user: u2, body: { orderId: paid.id, txHash: tx } })).status, 200)
  const pay = (await pool.query('SELECT id FROM payments WHERE purchase_order_id=$1', [paid.id])).rows[0]
  await pool.query(`INSERT INTO payment_adjustments (payment_id, purchase_order_id, kind, amount_usd, reference, recorded_by) VALUES ($1,$2,'refund',30,'r1','admin:test')`, [pay.id, paid.id])
  assert.equal((await orderRow(paid.id)).lifecycle_state, 'partially_refunded')
  await pool.query(`INSERT INTO payment_adjustments (payment_id, purchase_order_id, kind, amount_usd, reference, recorded_by) VALUES ($1,$2,'refund',50,'r2','admin:test')`, [pay.id, paid.id])
  const final = await orderRow(paid.id)
  assert.deepEqual([final.lifecycle_state, final.status, final.price_usd], ['refunded', 'paid', '80.00'], 'the purchase record itself is preserved')
  const hist = (await call('GET', `/purchases/orders/${paid.id}/events`, { user: u2 })).data.events.map(e => e.to_state)
  assert.deepEqual(hist, ['awaiting_payment', 'paid', 'provisioned', 'partially_refunded', 'refunded'])
  assert.equal((await call('GET', `/purchases/orders/${paid.id}/events`, { user: u })).data.events.length, 0, 'history is owner-scoped')
})

test('L2 an order with a detected payment cannot be cancelled by its owner', async () => {
  const u = await newUser()
  const o = (await order(u)).data.order
  await pool.query(`UPDATE purchase_orders SET lifecycle_state='payment_detected' WHERE id=$1`, [o.id])
  assert.equal((await call('POST', `/purchases/orders/${o.id}/cancel`, { user: u, body: {} })).data.error, 'order_not_cancellable')
})

/* ================= DePay ================= */
const depayPost = (path, body, sig) => {
  const raw = JSON.stringify(body)
  return call('POST', path, { raw, headers: sig === null ? {} : { 'x-signature': sig ?? depaySign(raw) } })
}
const verifyOurs = (raw, sig) => crypto.verify('sha256', Buffer.from(raw), { key: openfundKeys.publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }, Buffer.from(sig, 'base64url'))

test('D1 dynamic configuration: DePay-signed request only; signed Arbitrum-only response with the discounted server price', async () => {
  const u = await newUser()
  const c = await createCoupon({ kind: 'fixed', value: 30 })
  const o = (await order(u, { couponCode: c.code })).data.order
  assert.equal((await depayPost('/purchases/depay/configuration', { orderId: o.id }, null)).status, 401, 'unsigned')
  assert.equal((await depayPost('/purchases/depay/configuration', { orderId: o.id }, depaySign('{}'))).status, 401, 'signature over other bytes')
  assert.equal((await depayPost('/purchases/depay/configuration', { orderId: o.id }, depaySign(JSON.stringify({ orderId: o.id }), openfundKeys.privateKey))).status, 401, 'wrong key')
  const raw = JSON.stringify({ orderId: o.id, priceUsd: 1, receiver: rndAddr() })
  const res = await fetch(BASE + '/purchases/depay/configuration', { method: 'POST', body: raw, headers: { 'Content-Type': 'application/json', 'x-signature': depaySign(raw) } })
  assert.equal(res.status, 200)
  const text = await res.text()
  assert.equal(verifyOurs(text, res.headers.get('x-signature')), true, 'response signed with the Openfund key')
  assert.deepEqual(JSON.parse(text), { accept: [{ blockchain: 'arbitrum', amount: 50, token: USDC_ARBITRUM, receiver: RECEIVER }] })
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.equal((await depayPost('/purchases/depay/configuration', { orderId: crypto.randomUUID() })).status, 404, 'missing order')
  await pool.query(`UPDATE purchase_orders SET status='expired' WHERE id=$1`, [o.id])
  assert.equal((await depayPost('/purchases/depay/configuration', { orderId: o.id })).data.error, 'order_not_payable', 'expired order')
})

const callbackBody = (u, o, over = {}) => ({ blockchain: 'arbitrum', transaction: rndHash(), sender: u.wallet, receiver: RECEIVER, token: USDC_ARBITRUM,
  amount: String(o.price_usd), payload: { orderId: o.id }, after_block: '1', commitment: 'confirmed', confirmations: 1,
  created_at: new Date().toISOString(), confirmed_at: new Date().toISOString(), ...over })

test('D2 callback: invalid signature rejected; duplicate deliveries and retries provision exactly once', async () => {
  chain = { mode: 'ok' }
  const u = await newUser()
  const o = (await order(u)).data.order
  const body = callbackBody(u, o)
  assert.equal((await depayPost('/purchases/depay/callback', body, depaySign('tampered'))).status, 401)
  const rs = await Promise.all(Array.from({ length: 5 }, () => depayPost('/purchases/depay/callback', body)))
  assert.ok(rs.every(r => r.status === 200))
  await settle()
  const row = await orderRow(o.id)
  assert.equal(row.lifecycle_state, 'provisioned')
  for (const [t, n] of [['payments', 1], ['openfund_challenges', 1], ['invoices', 1], ['payment_attempts', 1]])
    assert.equal((await pool.query(`SELECT count(*)::int n FROM ${t} WHERE purchase_order_id=$1`, [o.id])).rows[0].n, n, t)
  assert.equal((await pool.query(`SELECT count(*)::int n FROM depay_events WHERE tx_hash=$1`, [body.transaction])).rows[0].n, 1, 'retries recorded once')
  await assert.rejects(pool.query(`DELETE FROM depay_events WHERE tx_hash=$1`, [body.transaction]), /append_only/)
  await assert.rejects(pool.query(`UPDATE depay_events SET outcome='x' WHERE tx_hash=$1`, [body.transaction]), /append_only/)
  /* a late retry after provisioning is still a 200 and changes nothing */
  assert.equal((await depayPost('/purchases/depay/callback', body)).status, 200)
  await settle()
  assert.equal((await pool.query(`SELECT count(*)::int n FROM openfund_challenges WHERE purchase_order_id=$1`, [o.id])).rows[0].n, 1)
})

test('D3 callback validation: other chain ignored; wrong receiver / wrong amount go to review, never paid', async () => {
  const u = await newUser()
  const o = (await order(u)).data.order
  const other = callbackBody(u, o, { blockchain: 'ethereum' })
  assert.equal((await depayPost('/purchases/depay/callback', other)).data.recorded, false)
  assert.equal((await pool.query(`SELECT outcome FROM depay_events WHERE tx_hash=$1`, [other.transaction])).rows[0].outcome, 'ignored:other_chain')
  chain = { mode: 'wrong_receiver' }
  const wrong = callbackBody(u, o, { receiver: rndAddr() })
  assert.equal((await depayPost('/purchases/depay/callback', wrong)).data.recorded, true)
  await settle()
  assert.equal((await pool.query(`SELECT outcome FROM depay_events WHERE tx_hash=$1`, [wrong.transaction])).rows[0].outcome, 'hint_registered:wrong_receiver')
  let a = (await pool.query(`SELECT * FROM payment_attempts WHERE tx_hash=$1`, [wrong.transaction])).rows[0]
  assert.deepEqual([a.status, a.classification, a.review_status], ['rejected', 'wrong_receiver', 'open'])
  chain = { mode: 'insufficient' }
  const under = callbackBody(u, o)
  await depayPost('/purchases/depay/callback', under); await settle()
  a = (await pool.query(`SELECT * FROM payment_attempts WHERE tx_hash=$1`, [under.transaction])).rows[0]
  assert.deepEqual([a.status, a.classification], ['rejected', 'underpayment'])
  assert.equal((await orderRow(o.id)).status, 'pending', 'never paid by a callback alone')
  /* order identity: an order id that is not the sender's own is not matched */
  const stranger = await newUser()
  const theirs = (await order(stranger)).data.order
  const spoof = callbackBody(u, theirs)
  assert.equal((await depayPost('/purchases/depay/callback', spoof)).data.recorded, false)
  chain = { mode: 'ok' }
})

test('D4 events: attempt/processing only mark detection, failed is recorded, succeeded verifies; out-of-order safe', async () => {
  chain = { mode: 'ok' }
  const u = await newUser()
  const o = (await order(u)).data.order
  const base = callbackBody(u, o)
  assert.equal((await depayPost('/purchases/depay/events', { ...base, status: 'attempt' }, null)).status, 401)
  assert.equal((await depayPost('/purchases/depay/events', { ...base, status: 'attempt', transaction: null })).status, 200)
  assert.equal((await orderRow(o.id)).lifecycle_state, 'awaiting_payment', 'attempt without a transaction changes nothing')
  /* succeeded arrives BEFORE processing (out of order) */
  chain = { mode: 'rpc_down' }
  assert.equal((await depayPost('/purchases/depay/events', { ...base, status: 'succeeded' })).status, 200)
  await settle()
  let row = await orderRow(o.id)
  assert.deepEqual([row.status, row.lifecycle_state], ['pending', 'payment_detected'], 'RPC down: detected, not paid')
  const a = (await pool.query(`SELECT * FROM payment_attempts WHERE tx_hash=$1`, [base.transaction])).rows[0]
  assert.deepEqual([a.status, a.retryable, a.error_code], ['pending', true, 'rpc_unavailable'])
  assert.equal((await depayPost('/purchases/depay/events', { ...base, status: 'processing' })).status, 200)
  assert.equal((await depayPost('/purchases/depay/events', { ...base, status: 'failed' })).status, 200)
  assert.equal((await orderRow(o.id)).status, 'pending', 'a failed event never changes payment state by itself')
  /* backend recovery after the RPC returns */
  chain = { mode: 'ok' }
  await pool.query(`UPDATE payment_attempts SET last_attempt_at = now() - interval '5 minutes' WHERE tx_hash=$1`, [base.transaction])
  const rec = await recoverPendingPayments({ pool, verifier, minAgeSeconds: 1 })
  assert.ok(rec.recovered >= 1)
  row = await orderRow(o.id)
  assert.deepEqual([row.status, row.lifecycle_state], ['paid', 'provisioned'])
  assert.deepEqual((await events(o.id)).map(e => e.to_state), ['awaiting_payment', 'payment_detected', 'paid', 'provisioned'])
  const kinds = (await pool.query(`SELECT status FROM depay_events WHERE tx_hash=$1 ORDER BY id`, [base.transaction])).rows.map(r => r.status)
  assert.deepEqual(kinds, ['succeeded', 'processing', 'failed'])
})

test('D5 database failure during a callback returns 500 so DePay retries; the retry succeeds', async () => {
  chain = { mode: 'ok' }
  const u = await newUser()
  const o = (await order(u)).data.order
  const body = callbackBody(u, o)
  await pool.query(`CREATE OR REPLACE FUNCTION commerce_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated_db_failure'; END $$`)
  await pool.query(`CREATE TRIGGER commerce_test_fail BEFORE INSERT ON depay_events FOR EACH ROW EXECUTE FUNCTION commerce_test_fail()`)
  try { assert.equal((await depayPost('/purchases/depay/callback', body)).status, 500) }
  finally { await pool.query('DROP TRIGGER commerce_test_fail ON depay_events') }
  assert.equal((await depayPost('/purchases/depay/callback', body)).status, 200)
  await settle()
  assert.equal((await orderRow(o.id)).lifecycle_state, 'provisioned')
})

test('D6 without the DePay verify key the DePay routes are closed', async () => {
  const saved = process.env.DEPAY_VERIFY_PUBLIC_KEY
  delete process.env.DEPAY_VERIFY_PUBLIC_KEY
  try {
    for (const p of ['/purchases/depay/configuration', '/purchases/depay/callback', '/purchases/depay/events'])
      assert.equal((await depayPost(p, { orderId: crypto.randomUUID() })).status, 404, p)
  } finally { process.env.DEPAY_VERIFY_PUBLIC_KEY = saved }
})
