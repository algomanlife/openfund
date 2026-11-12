/**
 * Payment verification — deterministic fixture tests (no network).
 *
 *  A. analyzePayment(): the correlation policy against receipt fixtures,
 *     including DePay-router style routed transfers.
 *  B. createRpcVerifier(): RPC failure, pending, finality, reorg, token
 *     decimals and chain-identity guards, with an injected fake client.
 *  C. verifyAndConfirm()/recoverPendingPayments(): attempt records,
 *     exactly-once provisioning, duplicates, underpayment review queue,
 *     late payment grace, restart/retry recovery, concurrency.
 *
 * MOCKED CHAIN DATA IS NOT REAL-NETWORK ACCEPTANCE. Real payments need an
 * approved low-value on-chain test (docs/payments/ACTIVATION.md).
 *
 * Run: node --test test/payment-verification.test.mjs   (isolated test DATABASE_URL)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'
import { TransactionReceiptNotFoundError } from 'viem'
import { analyzePayment, createRpcVerifier, toUnits, TRANSFER_TOPIC, padAddress } from '../payment-verification.js'
import { verifyAndConfirm, recoverPendingPayments, cfg, paymentsReady } from '../purchases.js'

const rnd = () => '0x' + crypto.randomBytes(20).toString('hex')
const hash = () => '0x' + crypto.randomBytes(32).toString('hex')
const TOKEN = '0x' + 'a1'.repeat(20)
const OTHER_TOKEN = '0x' + 'b2'.repeat(20)
const RECEIVER = '0x' + 'c3'.repeat(20)
const ROUTER = '0x' + 'd4'.repeat(20)
const CHAIN = 42161
const word = n => '0x' + BigInt(n).toString(16).padStart(64, '0')
const log = (address, from, to, value) => ({ address, topics: [TRANSFER_TOPIC, padAddress(from), padAddress(to)], data: word(value) })
const usdc = n => BigInt(Math.round(n * 1e6))

const expectBase = (over = {}) => ({
  chainId: CHAIN, receiver: RECEIVER, token: TOKEN, from: '', routers: [], allowNative: false,
  minAmountUnits: usdc(100).toString(), ...over,
})
const mined = (payer, logs, over = {}) => ({
  tx: { from: payer, to: TOKEN, value: 0n, hash: hash(), ...(over.tx || {}) },
  receipt: { status: 'success', transactionHash: hash(), blockNumber: 100n, blockHash: '0x' + '11'.repeat(32), logs, ...(over.receipt || {}) },
})
const code = fn => { try { fn(); return null } catch (e) { return e.message } }

/* ---------------------------------------------------------------- A --- */
test('toUnits is exact (no float rounding)', () => {
  assert.equal(toUnits('44.00', 6), '44000000')
  assert.equal(toUnits('0.01', 6), '10000')
  assert.equal(toUnits('44', 18), '44000000000000000000')
  assert.equal(toUnits('99999999999.99', 18), '99999999999990000000000000000')
  assert.throws(() => toUnits('1.0000001', 6), /price_precision/)
})

test('A1 direct stablecoin transfer is accepted', () => {
  const payer = rnd()
  const ev = analyzePayment(mined(payer, [log(TOKEN, payer, RECEIVER, usdc(100))]), expectBase({ from: payer }))
  assert.equal(ev.route, 'direct'); assert.equal(ev.amount, usdc(100).toString()); assert.equal(ev.overpaymentUnits, '0')
})

test('A2 DePay-router style routed payment is accepted (router sends to the merchant)', () => {
  const payer = rnd()
  const m = mined(payer, [
    log(TOKEN, payer, ROUTER, usdc(100)),          // pulled into the router
    log(TOKEN, ROUTER, RECEIVER, usdc(100)),       // paid out to the merchant
  ], { tx: { to: ROUTER } })
  const ev = analyzePayment(m, expectBase({ from: payer, routers: [ROUTER] }))
  assert.equal(ev.route, 'router'); assert.equal(ev.amount, usdc(100).toString())
})

test('A3 routed swap: the input-token leg is ignored, only the approved token to the merchant counts', () => {
  const payer = rnd()
  const m = mined(payer, [
    log(OTHER_TOKEN, payer, ROUTER, 5_000_000_000_000_000n),   // payer paid some other token in
    log(OTHER_TOKEN, ROUTER, rnd(), 5_000_000_000_000_000n),   // swapped away
    log(TOKEN, rnd(), ROUTER, usdc(100)),
    log(TOKEN, ROUTER, RECEIVER, usdc(100)),
  ], { tx: { to: ROUTER } })
  assert.equal(analyzePayment(m, expectBase({ from: payer, routers: [ROUTER] })).route, 'router')
})

test('A4 the first Transfer log is never assumed to be the payment', () => {
  const payer = rnd()
  const m = mined(payer, [
    log(OTHER_TOKEN, payer, rnd(), 1),
    log(TOKEN, payer, rnd(), usdc(500)),        // big transfer to someone else
    log(TOKEN, payer, RECEIVER, usdc(100)),     // the real payment, third
  ])
  assert.equal(analyzePayment(m, expectBase({ from: payer })).amount, usdc(100).toString())
})

test('A5 wrong token rejected', () => {
  const payer = rnd()
  assert.equal(code(() => analyzePayment(mined(payer, [log(OTHER_TOKEN, payer, RECEIVER, usdc(100))]), expectBase({ from: payer }))), 'wrong_token')
})

test('A6 wrong receiver rejected', () => {
  const payer = rnd()
  assert.equal(code(() => analyzePayment(mined(payer, [log(TOKEN, payer, rnd(), usdc(100))]), expectBase({ from: payer }))), 'wrong_receiver')
})

test('A7 insufficient amount rejected and reports what was received', () => {
  const payer = rnd()
  let err
  try { analyzePayment(mined(payer, [log(TOKEN, payer, RECEIVER, usdc(99.99))]), expectBase({ from: payer })) } catch (e) { err = e }
  assert.equal(err.message, 'insufficient_amount'); assert.equal(err.received, usdc(99.99).toString())
})

test('A8 partial transfers are summed (split payment)', () => {
  const payer = rnd()
  const m = mined(payer, [log(TOKEN, payer, RECEIVER, usdc(60)), log(TOKEN, payer, RECEIVER, usdc(40))])
  assert.equal(analyzePayment(m, expectBase({ from: payer })).amount, usdc(100).toString())
})

test('A9 reverted transaction rejected', () => {
  const payer = rnd()
  const m = mined(payer, [log(TOKEN, payer, RECEIVER, usdc(100))], { receipt: { status: 'reverted' } })
  assert.equal(code(() => analyzePayment(m, expectBase({ from: payer }))), 'tx_not_successful')
})

test('A10 a transaction signed by another wallet is rejected', () => {
  const payer = rnd()
  assert.equal(code(() => analyzePayment(mined(rnd(), [log(TOKEN, payer, RECEIVER, usdc(100))]), expectBase({ from: payer }))), 'wrong_sender')
})

test('A11 an unapproved contract target is rejected even if a matching log is present', () => {
  const payer = rnd()
  const m = mined(payer, [log(TOKEN, payer, RECEIVER, usdc(100))], { tx: { to: rnd() } })
  assert.equal(code(() => analyzePayment(m, expectBase({ from: payer }))), 'unapproved_contract')
})

test('A12 an unrelated third-party transfer to the receiver cannot satisfy the order', () => {
  const payer = rnd()
  const m = mined(payer, [log(TOKEN, rnd(), RECEIVER, usdc(100))], { tx: { to: ROUTER } })
  assert.equal(code(() => analyzePayment(m, expectBase({ from: payer, routers: [ROUTER] }))), 'transfer_not_from_payer')
})

test('A13 removed (reorged) logs are ignored', () => {
  const payer = rnd()
  const m = mined(payer, [{ ...log(TOKEN, payer, RECEIVER, usdc(100)), removed: true }])
  assert.equal(code(() => analyzePayment(m, expectBase({ from: payer }))), 'wrong_receiver')
})

test('A14 overpayment is accepted but flagged', () => {
  const payer = rnd()
  const ev = analyzePayment(mined(payer, [log(TOKEN, payer, RECEIVER, usdc(130))]), expectBase({ from: payer }))
  assert.equal(ev.overpaymentUnits, usdc(30).toString())
})

test('A15 native value is never treated as USD in production mode', () => {
  const payer = rnd()
  const m = mined(payer, [], { tx: { to: RECEIVER, value: 10n ** 20n } })
  assert.equal(code(() => analyzePayment(m, expectBase({ from: payer, token: null }))), 'native_payment_unsupported')
  assert.equal(analyzePayment(m, expectBase({ from: payer, token: null, allowNative: true, minAmountUnits: '100' })).route, 'native')
})

/* ---------------------------------------------------------------- B --- */
function fakeClient({ decimals = 6, chainId = CHAIN, head = 200n, payer, receiptBlock = 100n, blockHash = '0x' + '11'.repeat(32),
  chainBlockHash = blockHash, ts = Math.floor(Date.now() / 1000), receipt = 'ok', down = false, amount = 100 } = {}) {
  const guard = () => { if (down) throw new Error('fetch failed') }
  return {
    getChainId: async () => { guard(); return chainId },
    readContract: async () => { guard(); return decimals },
    getTransactionReceipt: async () => {
      guard()
      if (receipt === 'missing') throw new TransactionReceiptNotFoundError({ hash: hash() })
      return { status: 'success', transactionHash: hash(), blockNumber: receiptBlock, blockHash, logs: [log(TOKEN, payer, RECEIVER, usdc(amount))] }
    },
    getTransaction: async () => { guard(); return { from: payer, to: TOKEN, value: 0n } },
    getBlock: async () => { guard(); return { hash: chainBlockHash, timestamp: BigInt(ts) } },
    getBlockNumber: async () => { guard(); return head },
  }
}
const verifierWith = opts => createRpcVerifier({ clientFactory: () => fakeClient(opts) })
const rpcExpect = (payer, over = {}) => ({
  chainId: CHAIN, receiver: RECEIVER, token: TOKEN, tokenDecimals: 6, priceUsd: '100.00', from: payer, routers: [],
  allowNative: false, notBefore: Date.now() - 600_000, minConfirmations: 12, ...over,
})
const rejects = async (p, msg, extra) => {
  await assert.rejects(p, e => { assert.equal(e.message, msg); if (extra) for (const [k, v] of Object.entries(extra)) assert.equal(e[k], v); return true })
}

test('B1 happy path derives units from on-chain decimals and checks finality', async () => {
  const payer = rnd()
  const ev = await verifierWith({ payer })(hash(), rpcExpect(payer))
  assert.equal(ev.minAmountUnits, '100000000'); assert.equal(ev.confirmations, 101); assert.equal(ev.tokenDecimals, 6)
})
test('B2 receipt not yet available → tx_pending (retryable)', async () => {
  const payer = rnd()
  await rejects(verifierWith({ payer, receipt: 'missing' })(hash(), rpcExpect(payer)), 'tx_pending', { retryable: true })
})
test('B3 RPC outage → rpc_unavailable (retryable, never a payment verdict)', async () => {
  const payer = rnd()
  await rejects(verifierWith({ payer, down: true })(hash(), rpcExpect(payer)), 'rpc_unavailable', { retryable: true })
})
test('B4 insufficient confirmations → tx_not_final (retryable)', async () => {
  const payer = rnd()
  await rejects(verifierWith({ payer, head: 105n })(hash(), rpcExpect(payer)), 'tx_not_final', { retryable: true, confirmations: 6, required: 12 })
})
test('B5 reorganised block → tx_reorged', async () => {
  const payer = rnd()
  await rejects(verifierWith({ payer, chainBlockHash: '0x' + '22'.repeat(32) })(hash(), rpcExpect(payer)), 'tx_reorged', { retryable: true })
})
test('B6 configured decimals that disagree with the contract fail closed', async () => {
  const payer = rnd()
  await rejects(verifierWith({ payer, decimals: 18 })(hash(), rpcExpect(payer, { tokenDecimals: 6 })), 'payment_misconfigured')
})
test('B7 an RPC endpoint on the wrong chain fails closed', async () => {
  const payer = rnd()
  await rejects(verifierWith({ payer, chainId: 1 })(hash(), rpcExpect(payer)), 'payment_misconfigured')
})
test('B8 a payment mined before the order existed is rejected', async () => {
  const payer = rnd()
  await rejects(verifierWith({ payer, ts: Math.floor(Date.now() / 1000) - 7200 })(hash(), rpcExpect(payer)), 'tx_too_old')
})
test('B9 with decimals unset the contract value is used (no silent 18-decimals default)', async () => {
  const payer = rnd()
  const ev = await verifierWith({ payer, decimals: 6 })(hash(), rpcExpect(payer, { tokenDecimals: null }))
  assert.equal(ev.minAmountUnits, '100000000')
})
test('B10 no RPC URL and no injected client → misconfigured (no public fallback)', async () => {
  const payer = rnd()
  await rejects(createRpcVerifier({})(hash(), rpcExpect(payer)), 'payment_misconfigured')
})

/* ---------------------------------------------------------------- C --- */
const DB = process.env.DATABASE_URL || ''
if (!/test|audit|_ci/.test(DB)) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: DB })
test.after(async () => { await pool.end() })

const env = { PURCHASE_PAYMENT_RECEIVER: RECEIVER, PURCHASE_PAYMENT_CHAIN: String(CHAIN), PURCHASE_PAYMENT_TOKEN: TOKEN,
  PURCHASE_PAYMENT_DECIMALS: '6', PURCHASE_ROUTER_ADDRESSES: ROUTER, PURCHASE_PAYMENT_MIN_CONFIRMATIONS: '0' }
for (const [k, v] of Object.entries(env)) process.env[k] = v

async function fixture() {
  const wallet = rnd()
  const { rows: [user] } = await pool.query(`INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, $2) RETURNING id`, [wallet, CHAIN])
  const { rows: [plan] } = await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ('pv-test-plan','PV Test',$1)
     ON CONFLICT (slug) DO UPDATE SET configuration = EXCLUDED.configuration RETURNING id`,
    [JSON.stringify({ accountSizesUsd: [5000], priceUsd: { 5000: 100 }, phases: 1 })])
  const order = async (over = {}) => {
    const { rows: [o] } = await pool.query(
      `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, expires_at)
       VALUES ($1,$2,5000,100,$3,$4) RETURNING id, price_usd, created_at`,
      [user.id, plan.id, over.status || 'pending', over.expiresAt || new Date(Date.now() + 3600_000)])
    return o
  }
  return { wallet, userId: user.id, order }
}
const ok = (payer, amount = 100) => async (txHash) => ({
  txHash, chainId: CHAIN, blockNumber: 1, fromAddress: payer, toAddress: RECEIVER, amount: usdc(amount).toString(),
  tokenAddress: TOKEN, blockTimestamp: new Date().toISOString(), overpaymentUnits: '0', route: 'direct',
})
const run = (f, o, verifier, txHash = hash()) => verifyAndConfirm({ pool, verifier, order: o, userId: f.userId, walletAddress: f.wallet, txHash, source: 'test' })
const attempt = async (orderId) => (await pool.query('SELECT * FROM payment_attempts WHERE purchase_order_id=$1 ORDER BY first_seen_at', [orderId])).rows

test('C0 readiness: production requires an approved token and a dedicated RPC', () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    assert.equal(paymentsReady({ ...cfg(), rpcUrl: null }), false)
    assert.equal(paymentsReady({ ...cfg(), rpcUrl: 'https://rpc.example', token: null }), false)
    assert.equal(paymentsReady({ ...cfg(), rpcUrl: 'https://rpc.example' }), true)
    assert.equal(cfg().minConfirmations, 0) // explicit env wins
    delete process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS
    assert.equal(cfg().minConfirmations, 12) // conservative production default
  } finally { process.env.NODE_ENV = prev; if (prev === undefined) delete process.env.NODE_ENV; process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS = '0' }
})

test('C1 confirmed payment provisions exactly one challenge, invoice and payment; repeat is idempotent', async () => {
  const f = await fixture(); const o = await f.order(); const v = ok(f.wallet)
  const tx = hash()
  const r1 = await run(f, o, v, tx)
  const r2 = await run(f, o, v, tx)
  assert.equal(r1.replayed, false); assert.equal(r2.replayed, true); assert.equal(r2.challengeId, r1.challengeId)
  const n = async t => (await pool.query(`SELECT count(*)::int n FROM ${t} WHERE purchase_order_id=$1`, [o.id])).rows[0].n
  assert.deepEqual([await n('openfund_challenges'), await n('payments'), await n('invoices')], [1, 1, 1])
  const [a] = await attempt(o.id)
  assert.equal(a.status, 'confirmed'); assert.equal(a.review_status, 'none')
})

test('C2 concurrent verification of one payment creates exactly one challenge', async () => {
  const f = await fixture(); const o = await f.order(); const v = ok(f.wallet); const tx = hash()
  const results = await Promise.allSettled([1, 2, 3, 4, 5].map(() => run(f, o, v, tx)))
  assert.ok(results.every(r => r.status === 'fulfilled'), JSON.stringify(results.filter(r => r.status === 'rejected').map(r => r.reason?.message)))
  assert.equal((await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE purchase_order_id=$1', [o.id])).rows[0].n, 1)
})

test('C3 a transaction hash cannot pay a second order (duplicate → review queue)', async () => {
  const f = await fixture(); const o1 = await f.order(); const o2 = await f.order(); const tx = hash()
  await run(f, o1, ok(f.wallet), tx)
  await assert.rejects(run(f, o2, ok(f.wallet), tx), e => e.message === 'tx_already_used' && e.status === 409)
  const [a] = await attempt(o2.id)
  assert.equal(a.status, 'rejected'); assert.equal(a.classification, 'duplicate'); assert.equal(a.review_status, 'open')
})

test('C4 underpayment is rejected, not provisioned, and queued for operator review', async () => {
  const f = await fixture(); const o = await f.order()
  const v = async () => { throw Object.assign(new Error('insufficient_amount'), { status: 400, received: '99000000' }) }
  await assert.rejects(run(f, o, v), e => e.message === 'insufficient_amount')
  const [a] = await attempt(o.id)
  assert.equal(a.classification, 'underpayment'); assert.equal(a.review_status, 'open'); assert.equal(a.detail.received, '99000000')
  assert.equal((await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE purchase_order_id=$1', [o.id])).rows[0].n, 0)
})

test('C5 overpayment provisions and is queued for review', async () => {
  const f = await fixture(); const o = await f.order()
  const v = async (t) => ({ ...(await ok(f.wallet, 130)(t)), overpaymentUnits: usdc(30).toString() })
  await run(f, o, v)
  const [a] = await attempt(o.id)
  assert.equal(a.status, 'confirmed'); assert.equal(a.classification, 'overpayment'); assert.equal(a.review_status, 'open')
})

test('C6 pending / RPC-down conditions stay retryable and the recovery sweep provisions later', async () => {
  const f = await fixture(); const o = await f.order(); const tx = hash()
  const down = async () => { throw Object.assign(new Error('rpc_unavailable'), { status: 503, retryable: true }) }
  await assert.rejects(run(f, o, down, tx), e => e.retryable === true)
  let [a] = await attempt(o.id)
  assert.equal(a.status, 'pending'); assert.equal(a.retryable, true); assert.equal(a.review_status, 'none')
  /* simulate elapsed time, then an application restart (new process, same DB) */
  await pool.query(`UPDATE payment_attempts SET last_attempt_at = now() - interval '2 minutes' WHERE id=$1`, [a.id])
  const r = await recoverPendingPayments({ pool, verifier: ok(f.wallet) })
  assert.ok(r.recovered >= 1)
  ;[a] = await attempt(o.id)
  assert.equal(a.status, 'confirmed')
  assert.equal((await pool.query('SELECT status FROM purchase_orders WHERE id=$1', [o.id])).rows[0].status, 'paid')
  assert.equal((await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE purchase_order_id=$1', [o.id])).rows[0].n, 1)
})

test('C7 a payment mined within the grace window pays an order the sweeper already marked expired', async () => {
  const f = await fixture(); const o = await f.order({ status: 'expired', expiresAt: new Date(Date.now() - 600_000) })
  const v = async (t) => ({ ...(await ok(f.wallet)(t)), blockTimestamp: new Date(Date.now() - 300_000).toISOString() })
  const r = await run(f, o, v)
  assert.equal(r.replayed, false)
  assert.equal((await pool.query('SELECT status FROM purchase_orders WHERE id=$1', [o.id])).rows[0].status, 'paid')
})

test('C8 a payment mined after the grace window is rejected as late and queued for review', async () => {
  const f = await fixture(); const o = await f.order({ status: 'expired', expiresAt: new Date(Date.now() - 4 * 3600_000) })
  await assert.rejects(run(f, o, ok(f.wallet)), e => e.message === 'order_expired' && e.status === 409)
  const [a] = await attempt(o.id)
  assert.equal(a.classification, 'late'); assert.equal(a.review_status, 'open')
})

test('C9 a rolled-back provisioning leaves no partial financial records', async () => {
  const f = await fixture(); const o = await f.order()
  /* force a failure LATE in provisioning (after payment + order update) */
  await pool.query(`CREATE OR REPLACE FUNCTION pv_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'pv_forced_failure'; END $$`)
  await pool.query('CREATE TRIGGER pv_fail_trg BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION pv_fail()')
  /* the payment is proven, so the failure is retryable (the sweep re-runs it) and keeps the cause */
  try { await assert.rejects(run(f, o, ok(f.wallet)), e => e.message === 'provisioning_retry' && e.retryable === true && /pv_forced_failure/.test(e.detail)) } finally {
    await pool.query('DROP TRIGGER pv_fail_trg ON invoices')
  }
  const cnt = async t => (await pool.query(`SELECT count(*)::int n FROM ${t} WHERE purchase_order_id=$1`, [o.id])).rows[0].n
  assert.equal(await cnt('payments'), 0); assert.equal(await cnt('invoices'), 0); assert.equal(await cnt('openfund_challenges'), 0)
  assert.equal((await pool.query('SELECT status FROM purchase_orders WHERE id=$1', [o.id])).rows[0].status, 'pending')
})

/* ---------------------------------------------------------------- D --- */
import { verifyDepaySignature, recordPaymentHint } from '../purchases.js'

test('D1 DePay callback signature: valid RSA-PSS accepted; tampered body / wrong key / garbage rejected', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const body = Buffer.from(JSON.stringify({ transaction: hash(), sender: rnd() }))
  const sig = crypto.sign('sha256', body, { key: privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }).toString('base64url')
  assert.equal(verifyDepaySignature(body, sig, pem), true)
  assert.equal(verifyDepaySignature(Buffer.from(body.toString() + ' '), sig, pem), false)
  assert.equal(verifyDepaySignature(body, sig, other.publicKey.export({ type: 'spki', format: 'pem' }).toString()), false)
  assert.equal(verifyDepaySignature(body, 'not-a-signature', pem), false)
  assert.equal(verifyDepaySignature(body, undefined, 'not a key'), false)
})

test('D2 a callback only registers a retryable HINT; it never confirms or provisions anything', async () => {
  const f = await fixture(); const o = await f.order(); const tx = hash()
  const out = await recordPaymentHint(pool, { transaction: tx, sender: f.wallet, blockchain: 'arbitrum', payload: { orderId: o.id }, amount: '1000000', token: 'forged' })
  assert.equal(out.recorded, true)
  const [a] = await attempt(o.id)
  assert.equal(a.status, 'pending'); assert.equal(a.retryable, true); assert.equal(a.detail.source, 'depay_callback')
  assert.equal((await pool.query('SELECT status FROM purchase_orders WHERE id=$1', [o.id])).rows[0].status, 'pending')
  assert.equal((await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE purchase_order_id=$1', [o.id])).rows[0].n, 0)
  /* the sweep then proves it on-chain */
  await pool.query(`UPDATE payment_attempts SET last_attempt_at = now() - interval '2 minutes' WHERE id=$1`, [a.id])
  await recoverPendingPayments({ pool, verifier: ok(f.wallet) })
  assert.equal((await pool.query('SELECT status FROM purchase_orders WHERE id=$1', [o.id])).rows[0].status, 'paid')
})

test('D3 callback hints without an order id, on unconfigured chains or with bad payloads are ignored', async () => {
  const f = await fixture(); const o = await f.order()
  /* correlation is by the signed order id only — a known wallet is not enough */
  assert.equal((await recordPaymentHint(pool, { transaction: hash(), sender: f.wallet, blockchain: 'arbitrum' })).reason, 'missing_order_id')
  assert.equal((await recordPaymentHint(pool, { transaction: hash(), sender: f.wallet, blockchain: 'polygon', payload: { orderId: o.id } })).reason, 'unsupported_chain')
  assert.equal((await recordPaymentHint(pool, { transaction: 'nope', sender: f.wallet, blockchain: 'arbitrum', payload: { orderId: o.id } })).reason, 'invalid_payload')
  assert.equal((await recordPaymentHint(pool, { transaction: hash(), sender: f.wallet, blockchain: 'arbitrum', payload: { orderId: crypto.randomUUID() } })).reason, 'no_open_order')
})

/* ---------------------------------------------------------------- E --- */
import { buildDepayConfiguration, signDepayConfiguration } from '../purchases.js'

test('E1 dynamic configuration is built only from the server order and configuration', async () => {
  const f = await fixture(); const o = await f.order()
  const c = await buildDepayConfiguration(pool, o.id)
  assert.deepEqual(c, { accept: [{ blockchain: 'arbitrum', amount: 100, token: TOKEN, receiver: RECEIVER }] })
})
test('E2 dynamic configuration is refused for unknown, malformed, paid, cancelled and expired orders', async () => {
  const f = await fixture()
  await assert.rejects(buildDepayConfiguration(pool, crypto.randomUUID()), e => e.message === 'order_not_found')
  await assert.rejects(buildDepayConfiguration(pool, 'x'), e => e.message === 'invalid_order')
  for (const status of ['paid', 'cancelled', 'expired']) {
    const o = await f.order({ status })
    await assert.rejects(buildDepayConfiguration(pool, o.id), e => e.message === 'order_not_payable', status)
  }
  const stale = await f.order({ expiresAt: new Date(Date.now() - 1000) })
  await assert.rejects(buildDepayConfiguration(pool, stale.id), e => e.message === 'order_not_payable')
})
test('E3 the signed configuration verifies with the public key (RSA-PSS, salt 64, SHA-256, base64url)', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const json = JSON.stringify({ accept: [{ blockchain: 'arbitrum', amount: '1', token: TOKEN, receiver: RECEIVER }] })
  const sig = signDepayConfiguration(json, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
  assert.equal(/^[A-Za-z0-9_-]+$/.test(sig), true)
  assert.equal(crypto.verify('sha256', Buffer.from(json), { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }, Buffer.from(sig, 'base64url')), true)
  assert.equal(crypto.verify('sha256', Buffer.from(json + ' '), { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }, Buffer.from(sig, 'base64url')), false)
})

test('B11 a real HTTP 503 from the RPC (viem HttpRequestError carries .status) is retryable rpc_unavailable', async () => {
  const http = await import('node:http')
  const srv = http.createServer((req, res) => { res.writeHead(503); res.end('unavailable') })
  await new Promise(r => srv.listen(0, '127.0.0.1', r))
  try {
    const payer = rnd()
    await rejects(createRpcVerifier({ rpcUrl: `http://127.0.0.1:${srv.address().port}` })(hash(), rpcExpect(payer)), 'rpc_unavailable', { retryable: true })
  } finally { await new Promise(r => srv.close(r)) }
})
