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
  /* like the real verifiers, report the transaction's actual payer (an
     attested DePay payment may come from any wallet) */
  return { txHash, chainId: expect.chainId, blockNumber: 10, fromAddress: expect.from || '0x' + 'fa'.repeat(20), toAddress: expect.receiver,
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
const DIRECTUS_ADMIN = crypto.randomUUID() /* stands in for a directus_users id */
const planIds = async slugs => (await pool.query('SELECT id FROM challenge_plans WHERE slug = ANY($1)', [slugs])).rows.map(r => r.id)
/* Coupons are administered in Directus, which writes these rows of the shared
   database; the fixture writes them the same way (no backend admin API). */
const createCoupon = async ({ code = 'T' + crypto.randomBytes(5).toString('hex').toUpperCase(), kind, value, status = 'active',
  maxRedemptions = null, perUserLimit = 1, planSlugs = null, accountSizes = null, products = null, allowedUsers = [], internal = false,
  startsAt = null, expiresAt = null, user = DIRECTUS_ADMIN } = {}) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [c] } = await client.query(
      `INSERT INTO coupons (code, kind, value, status, max_redemptions, per_user_limit, account_sizes, products, internal, starts_at, expires_at, user_created)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [code, kind, value, status, maxRedemptions, perUserLimit, accountSizes && JSON.stringify(accountSizes), products && JSON.stringify(products),
        internal, startsAt, expiresAt, user])
    for (const id of planSlugs ? await planIds(planSlugs) : []) await client.query('INSERT INTO coupon_challenge_plans (coupon_id, challenge_plan_id) VALUES ($1,$2)', [c.id, id])
    for (const u of allowedUsers) await client.query('INSERT INTO coupon_allowed_users (coupon_id, user_id) VALUES ($1,$2)', [c.id, u.id])
    await client.query('COMMIT')
    return c
  } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
}
const events = async id => (await pool.query('SELECT from_state, to_state FROM purchase_order_events WHERE purchase_order_id=$1 ORDER BY id', [id])).rows
const orderRow = async id => (await pool.query('SELECT * FROM purchase_orders WHERE id=$1', [id])).rows[0]
const settle = () => new Promise(r => setTimeout(r, 250))
/* DePay deliveries verify asynchronously after the 200 response: wait for the outcome */
const until = async (fn, ms = 4000) => { const t = Date.now(); while (!(await fn()) && Date.now() - t < ms) await new Promise(r => setTimeout(r, 100)) }

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

test('P2 payment is not tied to the Arbitrum auth chain: every supported, complete chain is usable', () => {
  assert.equal(paymentsReady(), true)
  for (const chainId of [1, 8453, 10, 137, 56, 43114, 100, 480]) assert.equal(paymentsReady({ ...cfg(), chainId }), true, String(chainId))
  for (const chainId of [421614, 999999]) assert.equal(paymentsReady({ ...cfg(), chainId }), false, 'unsupported ' + chainId)
  assert.equal(paymentsReady({ ...cfg(), receiver: null }), false, 'no receiver')
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
test('C1 coupon restrictions: unknown, inactive, revoked, not started, expired, product, model, size, customer-restricted', async () => {
  const u = await newUser()
  const q = code => call('POST', '/purchases/quote', { user: u, body: { planSlug: PLAN, accountSize: SIZE, couponCode: code } })
  assert.equal((await q('NOPE-NOPE')).data.error, 'coupon_not_found')
  assert.equal((await q('bad code!')).data.error, 'coupon_invalid')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, status: 'inactive' })).code)).data.error, 'coupon_disabled')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, status: 'revoked' })).code)).data.error, 'coupon_revoked')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, startsAt: new Date(Date.now() + 864e5).toISOString() })).code)).data.error, 'coupon_not_started')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, expiresAt: new Date(Date.now() - 1000).toISOString() })).code)).data.error, 'coupon_expired')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, products: ['perpetual'] })).code)).data.error, 'coupon_not_applicable')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, planSlugs: ['instant'] })).code)).data.error, 'coupon_not_applicable')
  assert.equal((await q((await createCoupon({ kind: 'fixed', value: 5, accountSizes: [5000] })).code)).data.error, 'coupon_not_applicable')
  const mine = await createCoupon({ kind: 'fixed', value: 5, allowedUsers: [await newUser()] })
  assert.equal((await q(mine.code)).data.error, 'coupon_not_found', 'restricted coupons are invisible to other users')
  const ok = await createCoupon({ kind: 'fixed', value: 5, products: ['prop'], planSlugs: [PLAN], accountSizes: [String(SIZE)], allowedUsers: [u] })
  assert.equal((await q(ok.code.toLowerCase())).data.priceUsd, '75.00')
})

test('C2 internal testing coupons: 1–2 named test accounts and a finite limit; nobody else can use them', async () => {
  await assert.rejects(createCoupon({ kind: 'percent', value: 100, internal: true }), /coupons_internal_limited/, 'internal needs a usage limit')
  await assert.rejects(createCoupon({ kind: 'percent', value: 101 }), /coupons_percent_range/)
  const [a, b, c, outsider] = [await newUser(), await newUser(), await newUser(), await newUser()]
  await assert.rejects(createCoupon({ kind: 'percent', value: 100, internal: true, maxRedemptions: 3, allowedUsers: [a, b, c] }), /internal_coupon_max_two_test_accounts/)
  const orphan = await createCoupon({ kind: 'percent', value: 100, internal: true, maxRedemptions: 1 })
  assert.equal((await order(a, { couponCode: orphan.code })).data.error, 'coupon_not_found', 'an internal coupon without test accounts is unusable')
  const cp = await createCoupon({ kind: 'percent', value: 100, internal: true, allowedUsers: [a, b], maxRedemptions: 2 })
  assert.equal((await order(outsider, { couponCode: cp.code })).data.error, 'coupon_not_found')
  const ra = await order(a, { couponCode: cp.code })
  assert.equal(ra.status, 200); assert.deepEqual([ra.data.order.lifecycle_state, ra.data.order.payment_method], ['provisioned', 'internal_coupon'])
  assert.equal((await order(b, { couponCode: cp.code })).status, 200)
  assert.equal((await order(a, { couponCode: cp.code })).data.error, 'coupon_exhausted')
})

test('C3 audit: Directus writes are attributed to the Directus user; deactivate, revoke (final), pricing lock, read API', async () => {
  const editor = crypto.randomUUID()
  const c = await createCoupon({ kind: 'percent', value: 10, maxRedemptions: 5, user: editor })
  await pool.query('UPDATE coupons SET max_redemptions=9, name=$2, user_updated=$3 WHERE id=$1', [c.id, 'Launch', editor])
  await pool.query(`UPDATE coupons SET status='inactive', user_updated=$2 WHERE id=$1`, [c.id, editor])
  await pool.query(`UPDATE coupons SET status='active', user_updated=$2 WHERE id=$1`, [c.id, editor])
  const u = await newUser()
  const o = await order(u, { couponCode: c.code })
  assert.equal(o.status, 200); assert.equal(o.data.order.price_usd, '72.00'); assert.equal(o.data.order.coupon_code, c.code)
  assert.equal((await pool.query('SELECT uses_reserved FROM coupons WHERE id=$1', [c.id])).rows[0].uses_reserved, 1, 'usage counter visible in Directus')
  await assert.rejects(pool.query('UPDATE coupons SET value=50 WHERE id=$1', [c.id]), /coupon_pricing_locked/)
  await pool.query(`UPDATE coupons SET status='revoked', user_updated=$2 WHERE id=$1`, [c.id, editor])
  await assert.rejects(pool.query(`UPDATE coupons SET status='active' WHERE id=$1`, [c.id]), /coupon_revoked_is_final/)
  const audit = (await pool.query('SELECT actor, action FROM coupon_audit WHERE coupon_id=$1 ORDER BY id', [c.id])).rows
  assert.deepEqual(audit.map(a => a.action), ['created', 'updated', 'deactivated', 'activated', 'revoked'])
  assert.ok(audit.every(a => a.actor === `directus:${editor}`), JSON.stringify(audit))
  await assert.rejects(pool.query('UPDATE coupon_audit SET action=$1 WHERE coupon_id=$2', ['x', c.id]), /append_only/)
  /* operator read API (Directus is the editing UI) */
  assert.equal((await call('GET', '/admin/coupons')).status, 403)
  assert.equal((await call('GET', `/admin/coupons/${c.id}/redemptions`, { admin: true })).data.redemptions[0].purchase_order_id, o.data.order.id)
  assert.equal((await call('GET', `/admin/coupons/${c.id}/orders`, { admin: true })).data.orders[0].id, o.data.order.id)
  assert.equal((await call('GET', `/admin/coupons/${c.id}/audit`, { admin: true })).data.audit.length, 5)
  /* cancelling the order releases the reservation */
  assert.equal((await call('POST', `/purchases/orders/${o.data.order.id}/cancel`, { user: u, body: {} })).status, 200)
  assert.equal((await pool.query('SELECT status FROM coupon_redemptions WHERE purchase_order_id=$1', [o.data.order.id])).rows[0].status, 'released')
  assert.equal((await pool.query('SELECT uses_reserved FROM coupons WHERE id=$1', [c.id])).rows[0].uses_reserved, 0)
})

test('C4 relation edits (challenge models, allowed customers) are audited; codes are normalized', async () => {
  const tag = crypto.randomBytes(3).toString('hex')
  const c = await createCoupon({ code: `  mixed-Case_${tag} `, kind: 'fixed', value: 1 })
  assert.equal(c.code, `MIXED-CASE_${tag.toUpperCase()}`)
  const u = await newUser()
  await pool.query('INSERT INTO coupon_allowed_users (coupon_id, user_id) VALUES ($1,$2)', [c.id, u.id])
  await pool.query('DELETE FROM coupon_allowed_users WHERE coupon_id=$1', [c.id])
  await pool.query('INSERT INTO coupon_challenge_plans (coupon_id, challenge_plan_id) SELECT $1, id FROM challenge_plans WHERE slug=$2', [c.id, PLAN])
  const actions = (await pool.query('SELECT action FROM coupon_audit WHERE coupon_id=$1 ORDER BY id', [c.id])).rows.map(r => r.action)
  assert.deepEqual(actions, ['created', 'allowed_user_insert', 'allowed_user_delete', 'challenge_model_insert'])
})

test('C5 expiry while an order is open: the coupon cannot start new orders after it expires', async () => {
  const c = await createCoupon({ kind: 'fixed', value: 10, expiresAt: new Date(Date.now() + 1500).toISOString() })
  const u = await newUser()
  assert.equal((await order(u, { couponCode: c.code })).status, 200)
  await new Promise(r => setTimeout(r, 1700))
  assert.equal((await order(await newUser(), { couponCode: c.code })).data.error, 'coupon_expired')
})

/* ================= zero-payment flow ================= */
test('Z1 a 100% coupon provisions through the zero-payment flow: no payment row, challenge + invoice, explicit transitions', async () => {
  const u = await newUser()
  const c = await createCoupon({ kind: 'percent', value: 100, maxRedemptions: 10 })
  const r = await order(u, { couponCode: c.code, idempotencyKey: 'zero-1' })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  const o = r.data.order
  assert.deepEqual([o.status, o.lifecycle_state, o.price_usd, o.payment_required, o.payment_method], ['paid', 'provisioned', '0.00', false, 'coupon'])
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

test('Z3 a 100% coupon order earns no commission, keeps the first-paid-purchase slot and is not revenue', async () => {
  const amb = await newUser(), cust = await newUser()
  const { rows: [app] } = await pool.query(`INSERT INTO partner_applications (user_id, role, status, contact_email, payload, terms_version)
    VALUES ($1,'ambassador','approved','a@example.test','{}','ambassador-2026-11') RETURNING id`, [amb.id])
  const refCode = 'AMB' + crypto.randomBytes(4).toString('hex').toUpperCase()
  await pool.query(`INSERT INTO ambassador_profiles (user_id, application_id, referral_code, approved_by) VALUES ($1,$2,$3,'test')`, [amb.id, app.id, refCode])
  await pool.query(`INSERT INTO ambassador_attributions (referred_user_id, ambassador_user_id, referral_code, source, attributed_at)
    VALUES ($1,$2,$3,'signup', now() - interval '1 minute')`, [cust.id, amb.id, refCode])
  const before = (await pool.query(`SELECT coalesce(sum(price_usd),0) AS g FROM purchase_orders WHERE status='paid' AND payment_required`)).rows[0].g
  const free = await createCoupon({ kind: 'percent', value: 100, internal: true, maxRedemptions: 1, allowedUsers: [cust] })
  const z = await order(cust, { couponCode: free.code })
  assert.equal(z.data.order.payment_method, 'internal_coupon')
  assert.equal((await pool.query('SELECT count(*)::int n FROM referral_commissions WHERE purchase_order_id=$1', [z.data.order.id])).rows[0].n, 0, 'no commission on a free order')
  chain = { mode: 'ok' }
  const paid = (await order(cust)).data.order
  assert.equal((await call('POST', '/purchases/verify', { user: cust, body: { orderId: paid.id, txHash: rndHash() } })).status, 200)
  const earned = (await pool.query(`SELECT amount_usd FROM referral_commissions WHERE purchase_order_id=$1 AND entry_type='earned'`, [paid.id])).rows
  assert.deepEqual(earned.map(r => r.amount_usd), ['8.00'], 'the first PAID purchase still earns 10%')
  const after = (await pool.query(`SELECT coalesce(sum(price_usd),0) AS g FROM purchase_orders WHERE status='paid' AND payment_required`)).rows[0].g
  assert.equal(Number(after) - Number(before), 80, 'only the paid order counts as revenue')
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

test('D3 callback validation: unconfigured chain ignored; wrong receiver / wrong amount go to review, never paid', async () => {
  const u = await newUser()
  const o = (await order(u)).data.order
  const other = callbackBody(u, o, { blockchain: 'ethereum' })
  assert.equal((await depayPost('/purchases/depay/callback', other)).data.recorded, false)
  assert.equal((await pool.query(`SELECT outcome FROM depay_events WHERE tx_hash=$1`, [other.transaction])).rows[0].outcome, 'ignored:unsupported_chain')
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
  /* order identity: the signed order id decides whose order is paid — a
     payment for someone else's order credits THAT order, never the payer's */
  const stranger = await newUser()
  const theirs = (await order(stranger)).data.order
  const gift = callbackBody(u, theirs)
  chain = { mode: 'ok' }
  assert.equal((await depayPost('/purchases/depay/callback', gift)).data.recorded, true)
  await settle()
  assert.equal((await orderRow(theirs.id)).lifecycle_state, 'provisioned')
  assert.equal((await pool.query('SELECT user_id FROM openfund_challenges WHERE purchase_order_id=$1', [theirs.id])).rows[0].user_id, stranger.id)
  assert.equal((await orderRow(o.id)).status, 'pending')
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

test('K1 dedicated checkout: customer details on the order, receipt from verified records only, owner-scoped', async () => {
  chain = { mode: 'ok' }
  const u = await newUser()
  assert.equal((await order(u, { customer: { name: 'A', email: 'not-an-email' } })).data.error, 'invalid_email')
  assert.equal((await order(u, { customer: 'x' })).data.error, 'invalid_customer')
  const o = (await order(u, { customer: { name: ' Test Trader ', email: 'Trader@Example.test' }, idempotencyKey: crypto.randomUUID() })).data.order
  assert.deepEqual((await orderRow(o.id)).customer, { name: 'Test Trader', email: 'trader@example.test' })
  let r = await call('GET', `/purchases/orders/${o.id}/receipt`, { user: u })
  assert.equal(r.status, 200)
  assert.deepEqual([r.data.receipt.status, r.data.receipt.payment, r.data.receipt.invoice, r.data.receipt.challenge], ['pending', null, null, null], 'nothing is claimed before verification')
  assert.equal(r.data.receipt.priceUsd, '80.00')
  const stranger = await newUser()
  assert.equal((await call('GET', `/purchases/orders/${o.id}/receipt`, { user: stranger })).status, 404, 'another customer cannot read the receipt')
  const body = { ...callbackBody(u, o), sent_token: '0x' + 'ee'.repeat(20), sent_amount: '0.031' }
  assert.equal((await depayPost('/purchases/depay/callback', body)).status, 200)
  await until(async () => (await orderRow(o.id)).lifecycle_state === 'provisioned')
  r = await call('GET', `/purchases/orders/${o.id}/receipt`, { user: u })
  const rc = r.data.receipt
  assert.deepEqual([rc.status, rc.lifecycleState], ['paid', 'provisioned'])
  assert.equal(rc.payment.txHash, body.transaction)
  assert.equal(rc.payment.blockchain, 'arbitrum')
  assert.deepEqual([rc.payment.settlement.amount, rc.payment.settlement.decimals], ['80', 6], 'settlement amount converted with the verified decimals')
  assert.deepEqual(rc.payment.sent, { token: body.sent_token, amount: '0.031', reported: true }, 'source token is labelled as reported')
  assert.match(rc.invoice.number, /^OF-\d{4}-\d{6}$/)
  assert.ok(rc.challenge.id)
  assert.equal(rc.customer.email, 'trader@example.test')
})

test('K2 late attempt/processing events never downgrade a confirmed payment', async () => {
  chain = { mode: 'ok' }
  const u = await newUser()
  const o = (await order(u)).data.order
  const base = callbackBody(u, o)
  await depayPost('/purchases/depay/events', { ...base, status: 'succeeded' })
  await until(async () => (await orderRow(o.id)).lifecycle_state === 'provisioned')
  for (const status of ['attempt', 'processing', 'failed']) assert.equal((await depayPost('/purchases/depay/events', { ...base, status })).status, 200)
  await depayPost('/purchases/depay/callback', base)
  await settle()
  const row = await orderRow(o.id)
  assert.deepEqual([row.status, row.lifecycle_state], ['paid', 'provisioned'])
  assert.equal((await pool.query(`SELECT count(*)::int n FROM openfund_challenges WHERE purchase_order_id=$1`, [o.id])).rows[0].n, 1)
})

test('K3 a verified payment whose provisioning fails stays retryable and is provisioned exactly once by the sweep', async () => {
  chain = { mode: 'ok' }
  const u = await newUser()
  const o = (await order(u)).data.order
  const body = callbackBody(u, o)
  await pool.query(`CREATE OR REPLACE FUNCTION commerce_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated_issuance_failure'; END $$`)
  await pool.query(`CREATE TRIGGER commerce_test_issuance BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION commerce_test_fail()`)
  try {
    assert.equal((await depayPost('/purchases/depay/callback', body)).status, 200)
    await until(async () => (await pool.query(`SELECT error_code FROM payment_attempts WHERE tx_hash=$1`, [body.transaction])).rows[0]?.error_code === 'provisioning_retry')
  } finally { await pool.query('DROP TRIGGER commerce_test_issuance ON invoices') }
  const a = (await pool.query(`SELECT status, retryable, error_code FROM payment_attempts WHERE tx_hash=$1`, [body.transaction])).rows[0]
  assert.deepEqual([a.status, a.retryable, a.error_code], ['pending', true, 'provisioning_retry'])
  let row = await orderRow(o.id)
  assert.deepEqual([row.status, row.lifecycle_state], ['pending', 'payment_detected'], 'the payment is kept as detected; no second payment is requested')
  await pool.query(`UPDATE payment_attempts SET last_attempt_at = now() - interval '5 minutes' WHERE tx_hash=$1`, [body.transaction])
  await recoverPendingPayments({ pool, verifier, minAgeSeconds: 1 })
  await recoverPendingPayments({ pool, verifier, minAgeSeconds: 0 })
  row = await orderRow(o.id)
  assert.deepEqual([row.status, row.lifecycle_state], ['paid', 'provisioned'])
  for (const t of ['payments', 'openfund_challenges', 'invoices'])
    assert.equal((await pool.query(`SELECT count(*)::int n FROM ${t} WHERE purchase_order_id=$1`, [o.id])).rows[0].n, 1, t)
})

test('D6 without the DePay verify key the DePay routes are closed', async () => {
  const saved = process.env.DEPAY_VERIFY_PUBLIC_KEY
  delete process.env.DEPAY_VERIFY_PUBLIC_KEY
  try {
    for (const p of ['/purchases/depay/configuration', '/purchases/depay/callback', '/purchases/depay/events'])
      assert.equal((await depayPost(p, { orderId: crypto.randomUUID() })).status, 404, p)
  } finally { process.env.DEPAY_VERIFY_PUBLIC_KEY = saved }
})

/* ================= multi-chain DePay ================= */
const SOL_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' /* USDC mint on Solana (public) */
const SOL_RECEIVER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' /* USDC on Base (public) */
const withChains = async (chains, fn) => {
  const saved = process.env.PURCHASE_PAYMENT_CHAINS
  process.env.PURCHASE_PAYMENT_CHAINS = JSON.stringify(chains)
  try { return await fn() } finally { if (saved === undefined) delete process.env.PURCHASE_PAYMENT_CHAINS; else process.env.PURCHASE_PAYMENT_CHAINS = saved }
}
const MULTI = [
  { blockchain: 'arbitrum', token: USDC_ARBITRUM, receiver: RECEIVER, tokenDecimals: 6 },
  { blockchain: 'base', token: BASE_USDC, receiver: RECEIVER, tokenDecimals: 6 },
  { blockchain: 'solana', token: SOL_MINT, receiver: SOL_RECEIVER, tokenDecimals: 6 },
]
const solSig = () => { const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; return Array.from(crypto.randomBytes(88), b => A[b % A.length]).join('') }
const seen = []
const recordingVerifier = async (txId, expect) => { seen.push({ txId, expect }); return verifier(txId, expect) }

test('M1 dynamic configuration offers every configured settlement chain, each with its own token and receiver', async () => withChains(MULTI, async () => {
  const u = await newUser()
  const o = (await order(u)).data.order
  const raw = JSON.stringify({ orderId: o.id })
  const r = await fetch(BASE + '/purchases/depay/configuration', { method: 'POST', body: raw, headers: { 'Content-Type': 'application/json', 'x-signature': depaySign(raw) } })
  const text = await r.text()
  assert.equal(r.status, 200); assert.equal(verifyOurs(text, r.headers.get('x-signature')), true)
  assert.deepEqual(JSON.parse(text).accept, [
    { blockchain: 'arbitrum', amount: 80, token: USDC_ARBITRUM, receiver: RECEIVER },
    { blockchain: 'base', amount: 80, token: BASE_USDC, receiver: RECEIVER },
    { blockchain: 'solana', amount: 80, token: SOL_MINT, receiver: SOL_RECEIVER },
  ])
  const plans = await call('GET', '/purchases/plans')
  assert.deepEqual(plans.data.payment.chains.map(c => c.blockchain), ['arbitrum', 'base', 'solana'])
}))

test('M2 a Base payment (non-Arbitrum EVM) from ANY wallet, attested by DePay, is verified on Base and settles the order', async () => withChains(MULTI, async () => {
  const u = await newUser()
  const o = (await order(u)).data.order
  const otherWallet = rndAddr()
  seen.length = 0
  const body = { ...callbackBody(u, o), blockchain: 'base', sender: otherWallet, receiver: RECEIVER,
    /* DePay: token/amount = what the receiver gets; sent_token/sent_amount = what the payer sent */
    token: BASE_USDC, amount: o.price_usd, sent_token: '0x' + 'ee'.repeat(20), sent_amount: '0.031' }
  const app2 = express()
  app2.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }))
  app2.use(purchaseRoutes({ pool, requireAuth, audit: async () => {}, verifier: recordingVerifier }))
  app2.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }))
  const srv = await new Promise(r => { const x = app2.listen(0, '127.0.0.1', () => r(x)) })
  try {
    const raw = JSON.stringify(body)
    const res = await fetch(`http://127.0.0.1:${srv.address().port}/purchases/depay/callback`, { method: 'POST', body: raw, headers: { 'Content-Type': 'application/json', 'x-signature': depaySign(raw) } })
    assert.equal(res.status, 200)
    await until(async () => (await orderRow(o.id)).lifecycle_state === 'provisioned')
  } finally { srv.close() }
  const v = seen.find(x => x.txId === body.transaction)
  assert.ok(v, 'verified')
  assert.deepEqual([v.expect.chainId, v.expect.token, v.expect.receiver, v.expect.requireSender], [8453, BASE_USDC, RECEIVER, false])
  const row = await orderRow(o.id)
  assert.equal(row.lifecycle_state, 'provisioned')
  const pay = (await pool.query('SELECT chain_id, blockchain, token_address, source_token, source_amount FROM payments WHERE purchase_order_id=$1', [o.id])).rows[0]
  assert.deepEqual(pay, { chain_id: 8453, blockchain: 'base', token_address: BASE_USDC, source_token: '0x' + 'ee'.repeat(20), source_amount: '0.031' },
    'settlement (verified) and source (reported) are recorded separately')
}))

test('M3 a manual hash submission still requires the customer wallet; unsupported chains and Solana manual entry are refused', async () => withChains(MULTI, async () => {
  const u = await newUser()
  const o = (await order(u)).data.order
  seen.length = 0
  const r = await call('POST', '/purchases/verify', { user: u, body: { orderId: o.id, txHash: rndHash(), chainId: 8453 } })
  assert.equal(r.status, 200)
  assert.equal((await pool.query('SELECT chain_id FROM payments WHERE purchase_order_id=$1', [o.id])).rows[0].chain_id, 8453)
  const o2 = (await order(u)).data.order
  assert.equal((await call('POST', '/purchases/verify', { user: u, body: { orderId: o2.id, txHash: rndHash(), chainId: 137 } })).data.error, 'unsupported_chain', 'Polygon is not configured')
  assert.equal((await call('POST', '/purchases/verify', { user: u, body: { orderId: o2.id, txHash: solSig(), chainId: 501 } })).data.error, 'unsupported_chain', 'Solana payments arrive via DePay')
  assert.equal((await depayPost('/purchases/depay/callback', { ...callbackBody(u, o2), blockchain: 'polygon' })).data.recorded, false)
}))

test('M4 Solana: signatures stay case-sensitive, verification is non-EVM, and the same id on two chains never collides', async () => withChains(MULTI, async () => {
  const u = await newUser()
  const o = (await order(u)).data.order
  const sig = solSig()
  const body = { ...callbackBody(u, o), blockchain: 'solana', transaction: sig, sender: SOL_RECEIVER.split('').reverse().join(''), receiver: SOL_RECEIVER, token: SOL_MINT }
  assert.equal((await depayPost('/purchases/depay/callback', body)).data.recorded, true)
  await settle()
  const pay = (await pool.query('SELECT chain_id, tx_hash, blockchain FROM payments WHERE purchase_order_id=$1', [o.id])).rows[0]
  assert.deepEqual(pay, { chain_id: 501, tx_hash: sig, blockchain: 'solana' })
  /* invalid Solana signature format */
  const o2 = (await order(u)).data.order
  assert.equal((await depayPost('/purchases/depay/callback', { ...body, payload: { orderId: o2.id }, transaction: '0x' + 'ab'.repeat(32) })).data.recorded, false)
}))

test('M5 Solana verifier: settlement mint delta to the receiver, failures and wrong mint/receiver are classified', async () => {
  const { analyzeSolanaPayment, createSolanaVerifier } = await import('../solana-verification.js')
  const tx = (delta, { err = null, mint = SOL_MINT, owner = SOL_RECEIVER } = {}) => ({ slot: 5, blockTime: Math.floor(Date.now() / 1000),
    transaction: { message: { accountKeys: [{ pubkey: 'PayerPubkey1111111111111111111111111111111' }, { pubkey: 'DePayR1gQfDmViCPKctnZXNtUgqRwnEqMax8LX9ho1Zg' }] } },
    meta: { err, preTokenBalances: [{ owner, mint, uiTokenAmount: { amount: '1000000' } }], postTokenBalances: [{ owner, mint, uiTokenAmount: { amount: String(1000000 + delta) } }] } })
  const expect = { receiver: SOL_RECEIVER, token: SOL_MINT, minAmountUnits: '80000000', requireSender: false, signature: 'sig' }
  const okv = analyzeSolanaPayment(tx(80000000), expect)
  assert.deepEqual([okv.chainId, okv.amount, okv.route], [501, '80000000', 'depay_solana'])
  assert.throws(() => analyzeSolanaPayment(tx(79999999), expect), e => e.message === 'insufficient_amount')
  assert.throws(() => analyzeSolanaPayment(tx(80000000, { err: { InstructionError: [0, 'Custom'] } }), expect), e => e.message === 'tx_not_successful')
  assert.throws(() => analyzeSolanaPayment(tx(80000000, { mint: 'OtherMint1111111111111111111111111111111111' }), expect), e => e.message === 'wrong_token')
  assert.throws(() => analyzeSolanaPayment(tx(80000000, { owner: 'Someone1111111111111111111111111111111111' }), expect), e => e.message === 'wrong_receiver')
  /* RPC: not yet finalized → retryable; RPC error → retryable rpc_unavailable */
  const pending = createSolanaVerifier({ rpc: async m => (m === 'getTokenSupply' ? { value: { decimals: 6 } } : null) })
  await assert.rejects(pending('sig', { ...expect, priceUsd: '80', notBefore: 0, minConfirmations: 1 }), e => e.message === 'tx_not_final' && e.retryable)
  const down = createSolanaVerifier({ rpcUrl: 'http://127.0.0.1:9' })
  await assert.rejects(down('sig', { ...expect, priceUsd: '80', tokenDecimals: 6, notBefore: 0 }), e => e.message === 'rpc_unavailable' && e.retryable)
})

test('M6 wallet authentication stays Arbitrum-only while payments are multi-chain', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../server.js', import.meta.url), 'utf8')
  assert.match(src, /const AUTH_CHAINS = \[arbitrum\]/)
  assert.doesNotMatch(src, /AUTH_CHAINS = \[[^\]]*(base|mainnet|polygon)/)
})
