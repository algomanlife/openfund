/**
 * Openfund Pay — deterministic payment test suite (ADR 0046).
 *
 * The REAL chain verifier (createRpcVerifier → analyzePayment, finality,
 * canonical-block and decimals checks), the REAL ledger and the REAL
 * database run against an in-memory fake EVM chain (receipts, Transfer
 * logs, blocks, reorgs, RPC outages) and a fake Solana JSON-RPC. Customer
 * routes and operator routes run in-process over HTTP.
 *
 * MOCKED CHAIN DATA IS NOT REAL-NETWORK ACCEPTANCE (docs/payments/ACTIVATION.md).
 * Run: node --test --test-concurrency=1 test/openfund-pay.test.mjs   (isolated test DATABASE_URL)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { createRpcVerifier, TRANSFER_TOPIC, SOLANA_CHAIN_ID } from '../payment-verification.js'
import { createSolanaVerifier } from '../solana-verification.js'
import { verifyAndConfirm, purchaseRoutes, watcherSettle, confirmPurchase, reconcileStrandedPayments } from '../purchases.js'
import { paymentAdminRoutes } from '../payments-admin.js'
import { createPaymentWatcher, escalatePendingPayments, reviewOverduePartialOrders, paymentMetrics } from '../payment-watcher.js'
import { derivePaymentStatus, PAYMENT_STATUS_CODES } from '../payment-status.js'
import { unitsToMicros, microsToUnits, formatMicros, usdToMicros, setPaymentMethod, paymentMethodSettings } from '../payment-ledger.js'

const DB = process.env.DATABASE_URL || ''
if (!/test|audit|_ci/.test(DB)) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: DB })
test.after(async () => { await pool.end() })

const lc = v => String(v).toLowerCase()
const addr = () => '0x' + crypto.randomBytes(20).toString('hex')
const hash = () => '0x' + crypto.randomBytes(32).toString('hex')
const b58 = n => { const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; return Array.from(crypto.randomBytes(n), b => A[b % 58]).join('') }
const pad = a => '0x' + '0'.repeat(24) + lc(a).slice(2)

/* settlement configuration under test — public test values only */
const ARB_TOKEN = addr(), ARB_TREASURY = addr(), BASE_TOKEN = addr(), BASE_TREASURY = addr(), BSC_TOKEN = addr(), BSC_TREASURY = addr()
const SOL_TREASURY = b58(44), SOL_MINT = b58(44), SOL_ATA = b58(44)
process.env.PURCHASE_PAYMENT_CHAINS = JSON.stringify([
  { blockchain: 'arbitrum', token: ARB_TOKEN, receiver: ARB_TREASURY, tokenDecimals: 6, tokenSymbol: 'USDC', minConfirmations: 2 },
  { blockchain: 'base', token: BASE_TOKEN, receiver: BASE_TREASURY, tokenDecimals: 6, tokenSymbol: 'USDC', minConfirmations: 0 },
  { blockchain: 'bsc', token: BSC_TOKEN, receiver: BSC_TREASURY, tokenDecimals: 18, tokenSymbol: 'USDT', minConfirmations: 0 },
  { blockchain: 'solana', token: SOL_MINT, receiver: SOL_TREASURY, tokenDecimals: 6, tokenSymbol: 'USDC', minConfirmations: 0, receiverTokenAccount: SOL_ATA },
])
process.env.PURCHASE_RPC_URLS = JSON.stringify({ 42161: 'http://fake', 8453: 'http://fake', 56: 'http://fake', solana: 'http://fake' })
process.env.ADMIN_API_TOKEN = 'openfund-pay-test-token-' + crypto.randomBytes(8).toString('hex')
delete process.env.PAYMENT_DEPAY_NEW_PAYMENTS

/* ------------------------------------------------------ fake EVM chain --- */
function fakeChain(chainId, { token, treasury, decimals }) {
  let head = 1000n, down = false, salt = 'a'
  const txs = new Map(), times = new Map()
  const blockHash = n => '0x' + salt.repeat(8) + BigInt(n).toString(16).padStart(56, '0')
  const notFound = () => Object.assign(new Error('not found'), { name: 'TransactionReceiptNotFoundError' })
  const guard = () => { if (down) throw new Error('fetch failed') }
  const client = {
    getChainId: async () => { guard(); return chainId },
    readContract: async () => { guard(); return decimals },
    getBlockNumber: async () => { guard(); return head },
    getBlock: async ({ blockNumber }) => { guard(); return { hash: blockHash(blockNumber), timestamp: BigInt(times.get(BigInt(blockNumber)) ?? Math.floor(Date.now() / 1000)) } },
    getTransactionReceipt: async ({ hash: h }) => {
      guard(); const t = txs.get(lc(h)); if (!t || t.block > head) throw notFound()
      return { status: t.status, transactionHash: t.hash, blockNumber: t.block, blockHash: blockHash(t.block), logs: t.logs.map(l => ({ ...l, blockHash: blockHash(t.block) })) }
    },
    getTransaction: async ({ hash: h }) => { guard(); const t = txs.get(lc(h)); if (!t) throw Object.assign(new Error('nf'), { name: 'TransactionNotFoundError' }); return { hash: t.hash, from: t.from, to: t.to, value: t.value } },
    request: async ({ method, params }) => {
      guard()
      if (method !== 'eth_getLogs') throw new Error('unsupported ' + method)
      const [{ address, topics, fromBlock, toBlock }] = params
      const out = []
      for (const t of txs.values()) {
        if (t.block < BigInt(fromBlock) || t.block > BigInt(toBlock) || t.block > head) continue
        for (const l of t.logs) if (lc(l.address) === lc(address) && lc(l.topics[2]) === lc(topics[2])) out.push({ ...l, blockHash: blockHash(t.block) })
      }
      return out
    },
  }
  return {
    client, chainId, token, treasury, decimals,
    mine: (n = 1) => { head += BigInt(n) },
    setDown: v => { down = v },
    reorgAll: () => { salt = salt === 'a' ? 'b' : 'a' },
    head: () => head,
    /** an ERC-20 transfer of `units` from `from` to `to`; options for wrong token / receiver / revert / contract wallets */
    transfer({ from, units, to = treasury, tok = token, status = 'success', txTo = tok, block = head, time = null, value = 0n, extraLogs = [] }) {
      const h = hash()
      const log = { address: tok, topics: [TRANSFER_TOPIC, pad(from), pad(to)], data: '0x' + BigInt(units).toString(16), removed: false, transactionHash: h, blockNumber: BigInt(block), logIndex: 0 }
      txs.set(h, { hash: h, from: lc(from), to: lc(txTo), value, status, block: BigInt(block), logs: [log, ...extraLogs.map(e => ({ ...e, transactionHash: h, blockNumber: BigInt(block) }))] })
      if (time) times.set(BigInt(block), Math.floor(new Date(time).getTime() / 1000))
      return h
    },
    native({ from, value, to = treasury }) { const h = hash(); txs.set(h, { hash: h, from: lc(from), to: lc(to), value: BigInt(value), status: 'success', block: head, logs: [] }); return h },
    drop: h => txs.delete(lc(h)),
  }
}
const ARB = fakeChain(42161, { token: ARB_TOKEN, treasury: ARB_TREASURY, decimals: 6 })
const BASE = fakeChain(8453, { token: BASE_TOKEN, treasury: BASE_TREASURY, decimals: 6 })
const BSC = fakeChain(56, { token: BSC_TOKEN, treasury: BSC_TREASURY, decimals: 18 })
const CHAINS = new Map([[42161, ARB], [8453, BASE], [56, BSC]])
const evm = createRpcVerifier({ clientFactory: chain => CHAINS.get(chain.id).client })

/* fake Solana JSON-RPC (finalized only) */
const solTxs = new Map()
const solRpc = async (method, params) => {
  if (method === 'getTransaction') return solTxs.get(params[0])?.tx ?? null
  if (method === 'getTokenSupply') return { value: { decimals: 6 } }
  if (method === 'getSignaturesForAddress') return [...solTxs.keys()].reverse().map(signature => ({ signature, err: null }))
  throw new Error(method)
}
const solTransfer = ({ memo, units, payer = b58(44), mint = SOL_MINT }) => {
  const sig = b58(88)
  solTxs.set(sig, { tx: { slot: 77, blockTime: Math.floor(Date.now() / 1000),
    transaction: { message: { accountKeys: [{ pubkey: payer }], instructions: memo ? [{ program: 'spl-memo', parsed: memo }] : [] } },
    meta: { err: null, innerInstructions: [], preTokenBalances: [{ owner: SOL_TREASURY, mint, uiTokenAmount: { amount: '0' } }],
      postTokenBalances: [{ owner: SOL_TREASURY, mint, uiTokenAmount: { amount: String(units) } }] } } })
  return sig
}
const sol = createSolanaVerifier({ rpc: solRpc })
const verifier = (tx, expect) => (expect.chainId === SOLANA_CHAIN_ID ? sol : evm)(tx, expect)

/* ------------------------------------------------------------ fixtures --- */
const u6 = usd => BigInt(Math.round(usd * 1e6))        // test helper for literal amounts only
let planId = null
async function plan() {
  if (planId) return planId
  planId = (await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ('ofpay-test','Openfund Pay Test',$1)
     ON CONFLICT (slug) DO UPDATE SET configuration = EXCLUDED.configuration RETURNING id`,
    [JSON.stringify({ accountSizesUsd: [5000], priceUsd: { 5000: 12 }, phases: 1 })])).rows[0].id
  return planId
}
async function customer() {
  const wallet = addr()
  const { rows: [u] } = await pool.query(`INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id`, [wallet])
  return { wallet, userId: u.id }
}
/* a discounted order: list 12.00, coupon −1.20 → 10.80 (the v0.7.0 real test price) */
async function order(c, { price = '10.80', list = '12.00', expiresIn = '1 hour', coupon = true, createdAgo = '0 seconds' } = {}) {
  let couponId = null
  if (!coupon) list = price
  if (coupon) {
    couponId = (await pool.query(`INSERT INTO coupons (code, kind, value, status, max_redemptions, per_user_limit) VALUES ($1,'fixed',$2,'active',$3,1) RETURNING id`,
      ['OFP' + crypto.randomBytes(5).toString('hex').toUpperCase(), (Number(list) - Number(price)).toFixed(2), typeof coupon === 'object' ? coupon.max : 100])).rows[0].id
  }
  const { rows: [o] } = await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, list_price_usd, discount_usd, price_usd, coupon_id, expires_at, created_at)
     VALUES ($1,$2,5000,$3,$4,$5,$6, now() + $7::interval, now() - $8::interval) RETURNING id, price_usd, created_at`,
    [c.userId, await plan(), list, coupon ? (Number(list) - Number(price)).toFixed(2) : '0', price, couponId, expiresIn, createdAgo])
  if (couponId) await pool.query(`INSERT INTO coupon_redemptions (coupon_id, user_id, purchase_order_id, list_price_usd, discount_usd, net_price_usd) VALUES ($1,$2,$3,$4,$5,$6)`,
    [couponId, c.userId, o.id, list, (Number(list) - Number(price)).toFixed(2), price])
  return { ...o, couponId }
}
const pay = (c, o, txHash, chainId = 42161, extra = {}) => verifyAndConfirm({ pool, verifier, order: o, userId: c.userId, walletAddress: c.wallet, txHash, source: 'manual', chainId, ...extra })
const code = async p => { try { await p; return null } catch (e) { return e.message } }
const one = async (sql, p) => (await pool.query(sql, p)).rows[0]
const n = async (sql, p) => Number((await one(sql, p)).n)
const orderRow = id => one('SELECT status, lifecycle_state, partial_deadline_at FROM purchase_orders WHERE id=$1', [id])
const challenges = id => n('SELECT count(*) n FROM openfund_challenges WHERE purchase_order_id=$1', [id])
const invoices = id => n('SELECT count(*) n FROM invoices WHERE purchase_order_id=$1', [id])

async function server() {
  const app = express()
  app.use(express.json())
  let user = null
  app.use(purchaseRoutes({ pool, requireAuth: (req, res, next) => { req.user = user; next() }, audit: async () => {}, verifier }))
  app.use('/admin/payments', paymentAdminRoutes({ pool, verifier, refundVerifier: async () => ({ ok: true }) }))
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }))
  const s = app.listen(0); await new Promise(r => s.once('listening', r))
  const base = `http://127.0.0.1:${s.address().port}`
  const call = async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, data: await r.json().catch(() => null) }
  }
  const admin = { Authorization: 'Bearer ' + process.env.ADMIN_API_TOKEN, 'X-Admin-Actor': 'ops.owner' }
  return { as: c => { user = { user_id: c.userId, wallet_address: c.wallet } }, call, admin: (m, p, b, h = {}) => call(m, p, b, { ...admin, ...h }), close: () => new Promise(r => s.close(r)) }
}
const srv = await server()
test.after(() => srv.close())

/* ===================================================== pure arithmetic === */
test('A1 exact integer arithmetic: units ↔ micro-USD, 6 and 18 decimals, precision boundaries', () => {
  assert.equal(unitsToMicros(10_638_000n, 6), 10_638_000n)
  assert.equal(unitsToMicros(10_638_000_000_000_000_000n, 18), 10_638_000n)
  assert.equal(unitsToMicros(999_999_999_999n, 18), 0n)                         // dust below one micro-USD
  assert.equal(microsToUnits(162_000n, 18), 162_000_000_000_000_000n)
  assert.equal(microsToUnits(1n, 2), 1n)                                          // rounds UP so a request covers the value
  assert.equal(formatMicros(usdToMicros('10.80') - 10_638_000n), '0.162')
  assert.equal(formatMicros(usdToMicros('99999999.99')), '99999999.99')          // large amounts stay exact
  assert.equal(unitsToMicros(10n ** 30n, 18), 10n ** 18n)
})

/* ======================================================= core scenarios === */
test('P01 correct wallet payment confirms and activates exactly once', async () => {
  const c = await customer(), o = await order(c)
  const tx = ARB.transfer({ from: c.wallet, units: u6(10.8) })
  assert.equal(await code(pay(c, o, tx)), 'tx_not_final')                       // finality: 1 of 2 confirmations
  ARB.mine(2)
  const r = await pay(c, o, tx)
  assert.equal(r.outcome, 'provisioned'); assert.equal(r.remainingUsd, '0')
  const again = await pay(c, o, tx)
  assert.equal(again.outcome, 'replayed')
  assert.equal(await challenges(o.id), 1); assert.equal(await invoices(o.id), 1)
  assert.equal((await orderRow(o.id)).lifecycle_state, 'provisioned')
})

test('P16 discounted order: the verifier and ledger use the frozen net price (10.80, not 12.00)', async () => {
  const c = await customer(), o = await order(c)
  const tx = BASE.transfer({ from: c.wallet, units: u6(10.8) })
  const r = await pay(c, o, tx, 8453)
  assert.equal(r.outcome, 'provisioned'); assert.equal(r.totalUsd, '10.8')
  assert.equal((await one(`SELECT status FROM coupon_redemptions WHERE purchase_order_id=$1`, [o.id])).status, 'consumed')
})

test('P03/P04 the v0.7.0 shortfall: 10.638 of 10.80 is partially paid, 0.162 completes it, activation once', async () => {
  const c = await customer(), o = await order(c)
  const first = BASE.transfer({ from: c.wallet, units: 10_638_000n })
  const r1 = await pay(c, o, first, 8453)
  assert.equal(r1.outcome, 'partially_paid'); assert.equal(r1.receivedUsd, '10.638'); assert.equal(r1.remainingUsd, '0.162')
  const row = await orderRow(o.id)
  assert.equal(row.lifecycle_state, 'partially_paid'); assert.ok(row.partial_deadline_at)
  assert.equal(await challenges(o.id), 0)
  const second = BASE.transfer({ from: c.wallet, units: 162_000n })
  const r2 = await pay(c, o, second, 8453)
  assert.equal(r2.outcome, 'provisioned'); assert.equal(r2.receivedUsd, '10.8')
  assert.equal(await challenges(o.id), 1); assert.equal(await invoices(o.id), 1)
  assert.equal(await n(`SELECT count(*) n FROM payments WHERE purchase_order_id=$1`, [o.id]), 2)   // both transactions are evidence of record
})

test('P05 three partial payments aggregate to the exact total', async () => {
  const c = await customer(), o = await order(c)
  for (const [units, expect] of [[3_000_000n, '7.8'], [4_000_000n, '3.8']]) {
    const r = await pay(c, o, BASE.transfer({ from: c.wallet, units }), 8453)
    assert.equal(r.outcome, 'partially_paid'); assert.equal(r.remainingUsd, expect)
  }
  const r = await pay(c, o, BASE.transfer({ from: c.wallet, units: 3_800_000n }), 8453)
  assert.equal(r.outcome, 'provisioned'); assert.equal(r.excessUsd, '0')
  assert.equal(await n(`SELECT count(*) n FROM payment_allocations WHERE purchase_order_id=$1 AND kind='order'`, [o.id]), 3)
})

test('P06 overpayment: order total allocated, excess recorded as a refund liability, never revenue', async () => {
  const c = await customer(), o = await order(c)
  const tx = BASE.transfer({ from: c.wallet, units: 12_000_000n })
  const r = await pay(c, o, tx, 8453)
  assert.equal(r.outcome, 'provisioned'); assert.equal(r.excessUsd, '1.2')
  const l = await one(`SELECT reason, status, usd_micros::text m, destination FROM payment_refund_liabilities WHERE purchase_order_id=$1`, [o.id])
  assert.deepEqual([l.reason, l.status, l.m, l.destination], ['overpayment', 'refund_due', '1200000', lc(c.wallet)])
  assert.equal((await one(`SELECT total_usd FROM invoices WHERE purchase_order_id=$1`, [o.id])).total_usd, '10.80')
  const a = await one(`SELECT classification, review_status FROM payment_attempts WHERE purchase_order_id=$1`, [o.id])
  assert.deepEqual([a.classification, a.review_status], ['overpayment', 'open'])
})

test('P07/P21 manual EVM payment from another wallet never auto-confirms', async () => {
  const c = await customer(), o = await order(c)
  const tx = BASE.transfer({ from: addr(), units: u6(10.8) })
  assert.equal(await code(pay(c, o, tx, 8453)), 'wrong_sender')
  assert.equal(await challenges(o.id), 0)
  assert.equal(await n(`SELECT count(*) n FROM payment_allocations WHERE purchase_order_id=$1`, [o.id]), 0)
})

test('P08/P09/P10 wrong network, wrong token, wrong receiver, native coin, reverted: never counted', async () => {
  const c = await customer(), o = await order(c)
  assert.equal(await code(pay(c, o, hash(), 137)), 'unsupported_chain')
  assert.equal(await code(pay(c, o, BASE.transfer({ from: c.wallet, units: u6(10.8), tok: addr() }), 8453)), 'unapproved_contract')
  assert.equal(await code(pay(c, o, BASE.transfer({ from: c.wallet, units: u6(10.8), tok: addr(), txTo: BASE_TOKEN }), 8453)), 'wrong_token')
  assert.equal(await code(pay(c, o, BASE.transfer({ from: c.wallet, units: u6(10.8), to: addr() }), 8453)), 'wrong_receiver')
  assert.equal(await code(pay(c, o, BASE.native({ from: c.wallet, value: 10n ** 19n }), 8453)), 'unapproved_contract')
  assert.equal(await code(pay(c, o, BASE.transfer({ from: c.wallet, units: u6(10.8), status: 'reverted' }), 8453)), 'tx_not_successful')
  assert.equal(await challenges(o.id), 0)
})

test('P11 the same transaction can never credit two orders (or one order twice)', async () => {
  const c = await customer(), o1 = await order(c), o2 = await order(c)
  const tx = BASE.transfer({ from: c.wallet, units: u6(10.8) })
  assert.equal((await pay(c, o1, tx, 8453)).outcome, 'provisioned')
  assert.equal(await code(pay(c, o2, tx, 8453)), 'tx_already_used')
  assert.equal((await pay(c, o1, tx, 8453)).outcome, 'replayed')
  await assert.rejects(pool.query(`UPDATE payment_transactions SET purchase_order_id=$1 WHERE chain_id=8453 AND tx_hash=$2`, [o2.id, tx]), /immutable/)
  const t = await one(`SELECT id FROM payment_transactions WHERE tx_hash=$1`, [tx])
  await assert.rejects(pool.query(`INSERT INTO payment_allocations (transaction_id, purchase_order_id, kind, usd_micros, amount_units, created_by) VALUES ($1,$2,'excess',1,1,'t')`, [t.id, o1.id]), /exceeds/)
  await assert.rejects(pool.query(`DELETE FROM payment_allocations WHERE transaction_id=$1`, [t.id]), /append_only/)
})

test('P12 RPC outage: retryable, evidence kept on the attempt, recovered later', async () => {
  const c = await customer(), o = await order(c)
  const tx = BASE.transfer({ from: c.wallet, units: u6(10.8) })
  BASE.setDown(true)
  const e = await code(pay(c, o, tx, 8453))
  BASE.setDown(false)
  assert.equal(e, 'rpc_unavailable')
  const a = await one(`SELECT status, retryable FROM payment_attempts WHERE purchase_order_id=$1`, [o.id])
  assert.deepEqual([a.status, a.retryable], ['pending', true])
  assert.equal((await pay(c, o, tx, 8453)).outcome, 'provisioned')
})

test('P13 chain reorganization: a block that is no longer canonical is not settled', async () => {
  const c = await customer(), o = await order(c)
  const tx = ARB.transfer({ from: c.wallet, units: u6(10.8) })
  ARB.mine(3)
  const real = ARB.client.getBlock
  ARB.client.getBlock = async a => ({ ...(await real(a)), hash: '0x' + 'f'.repeat(64) })
  assert.equal(await code(pay(c, o, tx)), 'tx_reorged')
  ARB.client.getBlock = real
  assert.equal(await challenges(o.id), 0)
  assert.equal((await pay(c, o, tx)).outcome, 'provisioned')
})

test('P14/P15 browser closes after submit; wallet switch is refused; status recovered from records', async () => {
  const c = await customer(), o = await order(c)
  srv.as(c)
  const intent = await srv.call('POST', `/purchases/orders/${o.id}/intents`, { chainId: 8453, payerAddress: c.wallet })
  assert.equal(intent.status, 200); assert.equal(intent.data.intent.amountUnits, '10800000'); assert.equal(intent.data.intent.receiver, lc(BASE_TREASURY))
  assert.equal((await srv.call('POST', `/purchases/orders/${o.id}/intents`, { chainId: 8453, payerAddress: addr() })).data.error, 'wallet_mismatch')
  /* the wallet signed from ANOTHER account (switched mid-checkout): recorded, never credited */
  const foreign = BASE.transfer({ from: addr(), units: u6(10.8) })
  const sub = await srv.call('POST', `/purchases/intents/${intent.data.intent.id}/submit`, { txHash: foreign })
  assert.equal(sub.status, 202)
  await new Promise(r => setTimeout(r, 300))
  let st = await srv.call('GET', `/purchases/orders/${o.id}/payment-status`)
  assert.equal(st.data.status.code, 'wrong_sender')
  assert.equal(await challenges(o.id), 0)
  /* a correct transfer from the authenticated wallet; the "browser" never calls back */
  const i2 = await srv.call('POST', `/purchases/orders/${o.id}/intents`, { chainId: 8453 })
  const good = BASE.transfer({ from: c.wallet, units: u6(10.8) })
  assert.equal((await srv.call('POST', `/purchases/intents/${i2.data.intent.id}/submit`, { txHash: good })).status, 202)
  await new Promise(r => setTimeout(r, 300))
  st = await srv.call('GET', `/purchases/orders/${o.id}/payment-status`)
  assert.equal(st.data.status.code, 'challenge_activated')
  assert.ok(st.data.timeline.some(e => e.kind === 'transaction_submitted'))
  assert.equal(st.data.ledger.receivedUsd, '10.8')
})

test('P17 100% coupon activates without any payment transaction', async () => {
  const c = await customer(), seed = await order(c)
  const z = (await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, list_price_usd, discount_usd, price_usd, coupon_id, payment_required, payment_method)
     VALUES ($1,$2,5000,'12.00','12.00','0',$3,false,'coupon') RETURNING id, created_at`, [c.userId, await plan(), seed.couponId])).rows[0]
  const r = await confirmPurchase(pool, { orderId: z.id, userId: c.userId, evidence: null, source: 'zero_payment' })
  assert.ok(r.challengeId)
  assert.equal(await n(`SELECT count(*) n FROM payment_transactions WHERE purchase_order_id=$1`, [z.id]), 0)
  assert.equal(await n(`SELECT count(*) n FROM payments WHERE purchase_order_id=$1`, [z.id]), 0)
  assert.equal(await code(pay(c, { ...z, price_usd: '0' }, BASE.transfer({ from: c.wallet, units: 1n }), 8453)), 'zero_payment_order')
})

test('P18 expired order: inside grace it settles; outside grace funds are recorded for review, never auto-applied', async () => {
  const c = await customer()
  const inGrace = await order(c, { expiresIn: '-10 minutes', createdAgo: '2 hours' })
  await pool.query(`UPDATE purchase_orders SET status='expired' WHERE id=$1`, [inGrace.id])
  assert.equal((await pay(c, inGrace, BASE.transfer({ from: c.wallet, units: u6(10.8) }), 8453)).outcome, 'provisioned')
  const late = await order(c, { expiresIn: '-3 hours', createdAgo: '5 hours' })
  await pool.query(`UPDATE purchase_orders SET status='expired' WHERE id=$1`, [late.id])
  const tx = BASE.transfer({ from: c.wallet, units: u6(10.8) })
  assert.equal(await code(pay(c, late, tx, 8453)), 'order_expired')
  const t = await one(`SELECT status, match_status, review_status, purchase_order_id FROM payment_transactions WHERE tx_hash=$1`, [tx])
  assert.deepEqual([t.status, t.match_status, t.review_status, t.purchase_order_id], ['verified', 'matched', 'open', late.id])
  assert.equal(await challenges(late.id), 0)
})

test('P18b a late payment cannot exceed the coupon limit after the reservation was released', async () => {
  const c = await customer(), other = await customer()
  const o = await order(c, { expiresIn: '-5 minutes', createdAgo: '2 hours', coupon: { max: 1 } })
  await pool.query(`UPDATE purchase_orders SET status='expired' WHERE id=$1`, [o.id])          // releases the reservation
  await pool.query(`INSERT INTO coupon_redemptions (coupon_id, user_id, purchase_order_id, list_price_usd, discount_usd, net_price_usd, status)
                    VALUES ($1,$2,(SELECT id FROM purchase_orders WHERE user_id=$2 LIMIT 1),'12','1.2','10.8','consumed')`,
    [o.couponId, other.userId]).catch(async () => {
    const oo = await order(other, { coupon: false })
    await pool.query(`INSERT INTO coupon_redemptions (coupon_id, user_id, purchase_order_id, list_price_usd, discount_usd, net_price_usd, status) VALUES ($1,$2,$3,'12','1.2','10.8','consumed')`, [o.couponId, other.userId, oo.id])
  })
  assert.equal(await code(pay(c, o, BASE.transfer({ from: c.wallet, units: u6(10.8) }), 8453)), 'coupon_unavailable')
  assert.equal(await challenges(o.id), 0)
})

test('P19 pending after 20 minutes escalates to review without declaring failure', async () => {
  const c = await customer(), o = await order(c)
  const tx = hash()                                                               // never mined
  assert.equal(await code(pay(c, o, tx, 8453)), 'tx_pending')
  await pool.query(`UPDATE payment_attempts SET first_seen_at = now() - interval '21 minutes' WHERE purchase_order_id=$1`, [o.id])
  const r = await escalatePendingPayments(pool)
  assert.ok(r.escalated >= 1)
  await escalatePendingPayments(pool)                                            // idempotent
  assert.equal(await n(`SELECT count(*) n FROM payment_events WHERE purchase_order_id=$1 AND kind='escalated_review'`, [o.id]), 1)
  const a = await one(`SELECT status, review_status FROM payment_attempts WHERE purchase_order_id=$1`, [o.id])
  assert.deepEqual([a.status, a.review_status], ['pending', 'open'])              // still being checked
  srv.as(c)
  const st = await srv.call('GET', `/purchases/orders/${o.id}/payment-status`)
  assert.equal(st.data.status.code, 'requires_review'); assert.equal(st.data.status.checking, true)
})

test('P20 two concurrent verification workers: exactly-once allocation and provisioning', async () => {
  const c = await customer(), o = await order(c)
  const tx = BASE.transfer({ from: c.wallet, units: u6(10.8) })
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => pay(c, o, tx, 8453)))
  assert.ok(results.some(r => r.status === 'fulfilled' && r.value.outcome === 'provisioned'))
  assert.equal(await challenges(o.id), 1); assert.equal(await invoices(o.id), 1)
  assert.equal(await n(`SELECT count(*) n FROM payment_allocations WHERE purchase_order_id=$1`, [o.id]), 1)
})

test('P22 manual Solana payment: the order Memo attributes it; no EVM sender rule', async () => {
  const c = await customer(), o = await order(c)
  const sig = solTransfer({ memo: `Openfund ${o.id}`, units: 10_800_000n })
  const r = await pay(c, o, sig, SOLANA_CHAIN_ID)
  assert.equal(r.outcome, 'provisioned')
  const o2 = await order(c)
  assert.equal(await code(pay(c, o2, solTransfer({ memo: null, units: 10_800_000n }), SOLANA_CHAIN_ID)), 'memo_missing')
})

test('P03r the 2026-11-18 incident: a v0.7.0 insufficient_amount rejection is reconciled once into a partial payment', async () => {
  const c = await customer(), o = await order(c)
  const tx = BASE.transfer({ from: c.wallet, units: 10_638_000n })
  /* the row v0.7.0 left behind: rejected, no ledger entry, order still payable */
  await pool.query(`INSERT INTO payment_attempts (purchase_order_id, user_id, chain_id, tx_hash, status, error_code, classification, review_status, first_seen_at, last_attempt_at)
    VALUES ($1,$2,8453,$3,'rejected','insufficient_amount','underpayment','open', now() - interval '10 days', now() - interval '10 days')`, [o.id, c.userId, tx])
  const r = await reconcileStrandedPayments({ pool, verifier })
  assert.ok(r.reconciled >= 1)
  const a = await one(`SELECT status, error_code, detail FROM payment_attempts WHERE purchase_order_id=$1 AND tx_hash=$2`, [o.id, tx])
  assert.deepEqual([a.status, a.error_code, a.detail.outcome, a.detail.remainingUsd, a.detail.reconciledStranded], ['confirmed', null, 'partially_paid', '0.162', true])
  assert.equal((await orderRow(o.id)).lifecycle_state, 'partially_paid')
  assert.equal(await challenges(o.id), 0, 'never force-confirmed')
  /* the transaction is now in the ledger: a second sweep leaves it alone */
  const again = await reconcileStrandedPayments({ pool, verifier })
  assert.equal(await n(`SELECT count(*) n FROM payment_allocations WHERE purchase_order_id=$1`, [o.id]), 1)
  assert.ok(again.checked >= 0)
  /* the customer completes the 0.162 balance: activated once */
  const done = await pay(c, o, BASE.transfer({ from: c.wallet, units: 162_000n }), 8453)
  assert.equal(done.outcome, 'provisioned'); assert.equal(await challenges(o.id), 1)
})

test('P03s a stranded rejection that fails again for a final reason is marked and not retried', async () => {
  const c = await customer(), o = await order(c)
  const wrong = BASE.transfer({ from: c.wallet, units: 10_638_000n, tok: addr() })      // a token Openfund does not accept
  await pool.query(`INSERT INTO payment_attempts (purchase_order_id, user_id, chain_id, tx_hash, status, error_code, first_seen_at, last_attempt_at)
    VALUES ($1,$2,8453,$3,'rejected','insufficient_amount', now() - interval '2 days', now() - interval '2 days')`, [o.id, c.userId, wrong])
  await reconcileStrandedPayments({ pool, verifier })
  const a = await one(`SELECT status, error_code, detail FROM payment_attempts WHERE purchase_order_id=$1 AND tx_hash=$2`, [o.id, wrong])
  assert.equal(a.status, 'rejected'); assert.notEqual(a.error_code, 'insufficient_amount'); assert.equal(a.detail.reconciledStranded, true)
  await pool.query(`UPDATE payment_attempts SET last_attempt_at = now() - interval '1 hour' WHERE purchase_order_id=$1`, [o.id])
  const before = (await one(`SELECT attempts, last_attempt_at FROM payment_attempts WHERE purchase_order_id=$1 AND tx_hash=$2`, [o.id, wrong])).last_attempt_at
  await reconcileStrandedPayments({ pool, verifier })
  const after = (await one(`SELECT last_attempt_at FROM payment_attempts WHERE purchase_order_id=$1 AND tx_hash=$2`, [o.id, wrong])).last_attempt_at
  assert.equal(String(after), String(before), 're-verified exactly once')
})

test('P23 DePay disabled: no new configuration, legacy attested recovery still settles', async () => {
  const settings = await paymentMethodSettings(pool)
  assert.equal(settings.depay.enabled, false)                                     // retiring provider: off unless explicitly enabled
  const c = await customer(), o = await order(c)
  srv.as(c)
  const cfg = await srv.call('POST', '/purchases/depay/configuration', { orderId: o.id })
  assert.equal(cfg.status, 404); assert.equal(cfg.data.error, 'depay_disabled')
  /* a historical DePay-attested payment from the owner's wallet still settles */
  const tx = BASE.transfer({ from: c.wallet, units: 10_638_000n })
  const r = await pay(c, o, tx, 8453, { attested: true, source: 'depay_callback' })
  assert.equal(r.outcome, 'partially_paid'); assert.equal(r.remainingUsd, '0.162')
})

test('P23b OF-2026-11-05: an attested payment from another wallet is held for operator review, never auto-provisioned', async () => {
  const c = await customer(), o = await order(c)
  const other = BASE.transfer({ from: addr(), units: 12_000_000n })
  /* the callback path passes no walletAddress: the owner is looked up server-side */
  const err = await code(verifyAndConfirm({ pool, verifier, order: o, userId: c.userId, txHash: other, source: 'depay_callback', chainId: 8453, attested: true }))
  assert.equal(err, 'attested_payer_unbound')
  assert.equal(await challenges(o.id), 0)
  const a = await one(`SELECT status, classification, review_status FROM payment_attempts WHERE purchase_order_id=$1 AND tx_hash=$2`, [o.id, other])
  assert.deepEqual([a.status, a.classification, a.review_status], ['rejected', 'payer_review', 'open'])
  /* an operator association with documented proof settles the same verified transaction */
  const ok = await verifyAndConfirm({ pool, verifier, order: o, userId: c.userId, txHash: other, source: 'operator', chainId: 8453, attested: true, operator: 'admin:ops.reviewer' })
  assert.equal(ok.outcome, 'provisioned'); assert.equal(await challenges(o.id), 1)
})

test('P24/P30 refund lifecycle: authorization, destination check, single refund, audit trail', async () => {
  const c = await customer(), o = await order(c)
  await pay(c, o, BASE.transfer({ from: c.wallet, units: 12_000_000n }), 8453)
  const l = await one(`SELECT id, destination, chain_id FROM payment_refund_liabilities WHERE purchase_order_id=$1`, [o.id])
  assert.equal((await srv.call('POST', `/admin/payments/refunds/${l.id}/review`, { note: 'checking' })).status, 403)   // no service token
  const noToken = await srv.call('POST', `/admin/payments/refunds/${l.id}/review`, { note: 'checking' }, { Authorization: 'Bearer wrong', 'X-Admin-Actor': 'x.y' })
  assert.equal(noToken.status, 403)
  assert.equal((await srv.admin('POST', `/admin/payments/refunds/${l.id}/review`, { note: 'x' }, { 'X-Admin-Actor': '' })).status, 400)
  assert.equal((await srv.admin('POST', `/admin/payments/refunds/${l.id}/approve`, { note: 'early', destination: l.destination, chainId: l.chain_id })).data.error, 'refund_invalid_state')
  assert.equal((await srv.admin('POST', `/admin/payments/refunds/${l.id}/review`, { note: 'overpayment of 1.2 USDC verified' })).status, 200)
  assert.equal((await srv.admin('POST', `/admin/payments/refunds/${l.id}/approve`, { note: 'approve', destination: addr(), chainId: l.chain_id })).data.error, 'refund_destination_mismatch')
  assert.equal((await srv.admin('POST', `/admin/payments/refunds/${l.id}/approve`, { note: 'owner approved', destination: l.destination, chainId: l.chain_id })).status, 200)
  const refundTx = hash()
  const sent = await Promise.all([1, 2].map(() => srv.admin('POST', `/admin/payments/refunds/${l.id}/sent`, { note: 'sent from Safe', chainId: 8453, refundTxHash: refundTx })))
  assert.deepEqual(sent.map(s => s.status).sort(), [200, 409])                    // duplicate request refused
  assert.equal((await srv.admin('POST', `/admin/payments/refunds/${l.id}/confirm`, { note: 'confirmed on-chain' })).status, 200)
  assert.equal((await srv.admin('POST', `/admin/payments/refunds/${l.id}/confirm`, { note: 'again' })).data.error, 'refund_invalid_state')
  assert.equal(await n(`SELECT count(*) n FROM payment_refund_liabilities WHERE id=$1 AND status='refund_confirmed'`, [l.id]), 1)
  assert.ok(await n(`SELECT count(*) n FROM financial_audit_log WHERE entity='payment_refund_liability' AND entity_id=$1`, [l.id]) >= 5)
  await assert.rejects(pool.query(`UPDATE payment_refund_liabilities SET status='refund_due' WHERE id=$1`, [l.id]), /invalid_refund_transition/)
  await assert.rejects(pool.query(`UPDATE payment_refund_liabilities SET destination=$2 WHERE id=$1`, [l.id, addr()]), /immutable/)
})

test('P28 multiple payment methods on one order (DePay-attested partial + direct wallet) reconcile without double charge', async () => {
  const c = await customer(), o = await order(c)
  await pay(c, o, BASE.transfer({ from: c.wallet, units: 5_000_000n }), 8453, { attested: true, source: 'depay_callback' })
  const r = await pay(c, o, ARB.transfer({ from: c.wallet, units: 5_800_000n }), 42161).catch(e => e.message)
  assert.equal(r, 'tx_not_final'); ARB.mine(3)
  const tx = (await one(`SELECT tx_hash FROM payment_attempts WHERE purchase_order_id=$1 AND chain_id=42161`, [o.id])).tx_hash
  const done = await pay(c, o, tx, 42161)
  assert.equal(done.outcome, 'provisioned'); assert.equal(done.excessUsd, '0')
  assert.equal(await challenges(o.id), 1)
})

test('P29 invoice and challenge: exactly one per settled order, invoice only once fully paid', async () => {
  const c = await customer(), o = await order(c)
  await pay(c, o, BASE.transfer({ from: c.wallet, units: 1_000_000n }), 8453)
  assert.equal(await invoices(o.id), 0)
  srv.as(c)
  const rcpt = await srv.call('GET', `/purchases/orders/${o.id}/receipt`)
  assert.equal(rcpt.data.receipt.final, false); assert.equal(rcpt.data.receipt.invoice, null); assert.equal(rcpt.data.receipt.ledger.remainingUsd, '9.8')
  await pay(c, o, BASE.transfer({ from: c.wallet, units: 9_800_000n }), 8453)
  await pay(c, o, BASE.transfer({ from: c.wallet, units: 1_000_000n }), 8453)     // a third, duplicate payment → refund liability
  assert.equal(await invoices(o.id), 1); assert.equal(await challenges(o.id), 1)
  const done = await srv.call('GET', `/purchases/orders/${o.id}/receipt`)
  assert.equal(done.data.receipt.final, true); assert.equal(done.data.receipt.ledger.transactions.length, 3)
  assert.equal(done.data.receipt.ledger.refunds[0].reason, 'duplicate_payment')
  const hist = await srv.call('GET', '/purchases/history')
  const h = hist.data.orders.find(x => x.id === o.id)
  assert.deepEqual([h.received_usd, h.remaining_usd, h.excess_usd, h.refunds.length], ['10.8', '0', '1', 1])
})

test('18-decimal stablecoin above $100 settles (payments.amount no longer overflows)', async () => {
  const c = await customer(), o = await order(c, { price: '250.00', list: '250.00', coupon: false })
  const r = await pay(c, o, BSC.transfer({ from: c.wallet, units: 250n * 10n ** 18n }), 56)
  assert.equal(r.outcome, 'provisioned')
})

test('incorrect configured decimals fail closed (no payment is mis-valued)', async () => {
  const wrong = createRpcVerifier({ clientFactory: () => BSC.client })
  await assert.rejects(wrong(BSC.transfer({ from: addr(), units: 1n }), { chainId: 56, receiver: BSC_TREASURY, token: BSC_TOKEN, tokenDecimals: 6, priceUsd: '1', notBefore: 0, minConfirmations: 0, requireSender: false, allowPartial: true }),
    e => e.message === 'payment_misconfigured')
})

test('dust (below one micro-USD) is recorded for review, never allocated', async () => {
  const c = await customer(), o = await order(c)
  assert.equal(await code(pay(c, o, BSC.transfer({ from: c.wallet, units: 5n }), 56)), 'dust')
  assert.equal(await n(`SELECT count(*) n FROM payment_allocations WHERE purchase_order_id=$1`, [o.id]), 0)
})

/* ============================================================ watcher === */
const watcher = (opts = {}) => createPaymentWatcher({
  pool, chains: () => [
    { chainId: 8453, solana: false, token: lc(BASE_TOKEN), receiver: lc(BASE_TREASURY), rpcUrl: 'fake', watchFromBlock: 1 },
    { chainId: SOLANA_CHAIN_ID, solana: true, token: SOL_MINT, receiver: SOL_TREASURY, rpcUrl: 'fake', receiverTokenAccount: SOL_ATA },
  ],
  settle: watcherSettle({ pool, verifier }), clientFactory: c => CHAINS.get(c.chainId).client, solanaRpc: () => solRpc,
  settings: { enabled: true, reorgBlocks: 8, maxRange: 500, backfillBlocks: 100, leaseSeconds: 60 }, ...opts,
})

test('P02/P25/P26/P27 watcher: discovery without TXID, unmatched and ambiguous held, restart resumes from cursor', async () => {
  await pool.query(`DELETE FROM payment_monitor_cursors`)
  /* settle anything the earlier tests left on the fake chains first */
  const w = watcher()
  await w.runOnce()
  const single = await customer(), o = await order(single)
  const multi = await customer(), m1 = await order(multi), m2 = await order(multi)
  BASE.mine(1)
  const txSingle = BASE.transfer({ from: single.wallet, units: u6(10.8) })
  const txAmbiguous = BASE.transfer({ from: multi.wallet, units: u6(10.8) })
  const txStranger = BASE.transfer({ from: addr(), units: u6(3) })
  BASE.mine(1)
  await w.runOnce()
  assert.equal(await challenges(o.id), 1)                                         // P02: no TXID submitted, uniquely attributable
  const amb = await one(`SELECT match_status, review_status FROM payment_transactions WHERE tx_hash=$1`, [txAmbiguous])
  assert.deepEqual([amb.match_status, amb.review_status], ['ambiguous', 'open']) // P27
  assert.equal((await challenges(m1.id)) + (await challenges(m2.id)), 0)
  const un = await one(`SELECT match_status, review_status, amount_units::text u FROM payment_transactions WHERE tx_hash=$1`, [txStranger])
  assert.deepEqual([un.match_status, un.review_status, un.u], ['unmatched', 'open', '3000000'])   // P26: recorded, not guessed
  /* P25: a restarted worker resumes from the persisted cursor and re-observes nothing new */
  const before = BigInt((await one(`SELECT last_block FROM payment_monitor_cursors WHERE chain_id=8453`)).last_block)
  const fresh = watcher()
  const res = await fresh.runOnce()
  assert.equal(res.find(r => r.chainId === 8453)?.skipped, 'lease_held')          // a second owner never scans concurrently
  await pool.query(`UPDATE payment_monitor_cursors SET lease_until = now() - interval '1 second'`)
  BASE.mine(5)
  await fresh.runOnce()
  const after = BigInt((await one(`SELECT last_block FROM payment_monitor_cursors WHERE chain_id=8453`)).last_block)
  assert.ok(after > before)
  assert.equal(await n(`SELECT count(*) n FROM payment_transactions WHERE tx_hash IN ($1,$2,$3)`, [txSingle, txAmbiguous, txStranger]), 3)
  assert.equal(await challenges(o.id), 1)
  /* operator association of the ambiguous deposit, with documented proof */
  const t = await one(`SELECT id FROM payment_transactions WHERE tx_hash=$1`, [txAmbiguous])
  assert.equal((await srv.admin('POST', `/admin/payments/transactions/${t.id}/associate`, { orderId: m1.id, note: 'short', evidence: 'x' })).status, 400)
  const assoc = await srv.admin('POST', `/admin/payments/transactions/${t.id}/associate`, { orderId: m1.id, note: 'customer confirmed by support ticket', evidence: 'support ticket OF-123456-ABCDEF' })
  assert.equal(assoc.status, 200); assert.equal(assoc.data.result.outcome, 'provisioned')
  assert.equal((await srv.admin('POST', `/admin/payments/transactions/${t.id}/associate`, { orderId: m2.id, note: 'second attempt here', evidence: 'should be refused' })).status, 409)
  /* unmatched deposit → refund case (recording only) */
  const s = await one(`SELECT id FROM payment_transactions WHERE tx_hash=$1`, [txStranger])
  const rc = await srv.admin('POST', `/admin/payments/transactions/${s.id}/refund-case`, { note: 'no customer claimed this deposit', reason: 'unmatched' })
  assert.equal(rc.status, 200)
  assert.equal((await srv.admin('POST', `/admin/payments/transactions/${s.id}/refund-case`, { note: 'no customer claimed this deposit', reason: 'unmatched' })).status, 409)
})

test('P13b watcher: an unsettled observation that leaves the canonical chain is marked reorged', async () => {
  await pool.query(`UPDATE payment_monitor_cursors SET lease_until = now() - interval '1 second'`)
  const tx = BASE.transfer({ from: addr(), units: 7n })
  BASE.mine(1)
  await watcher().runOnce()
  assert.equal((await one(`SELECT status FROM payment_transactions WHERE tx_hash=$1`, [tx])).status, 'observed')
  BASE.drop(tx); BASE.mine(1)
  await pool.query(`UPDATE payment_monitor_cursors SET lease_until = now() - interval '1 second'`)
  await watcher().runOnce()
  assert.equal((await one(`SELECT status FROM payment_transactions WHERE tx_hash=$1`, [tx])).status, 'reorged')
})

test('watcher Solana: memo-attributed transfer settles without a submitted signature', async () => {
  const c = await customer(), o = await order(c)
  solTransfer({ memo: o.id, units: 10_800_000n })
  await pool.query(`UPDATE payment_monitor_cursors SET lease_until = now() - interval '1 second'`)
  await watcher().runOnce()
  assert.equal(await challenges(o.id), 1)
})

/* ======================================== partial deadline & settings === */
test('partially paid orders never expire; past the balance deadline they move to review', async () => {
  const c = await customer(), o = await order(c, { expiresIn: '1 minute' })
  await pay(c, o, BASE.transfer({ from: c.wallet, units: 1_000_000n }), 8453)
  await pool.query(`UPDATE purchase_orders o SET status='expired' WHERE o.id=$1 AND o.lifecycle_state NOT IN ('partially_paid','manual_review')
                      AND NOT EXISTS (SELECT 1 FROM payment_allocations a WHERE a.purchase_order_id=o.id)`, [o.id])
  assert.equal((await orderRow(o.id)).lifecycle_state, 'partially_paid')
  await pool.query(`UPDATE purchase_orders SET partial_deadline_at = now() - interval '1 minute' WHERE id=$1`, [o.id])
  await reviewOverduePartialOrders(pool)
  assert.equal((await orderRow(o.id)).lifecycle_state, 'manual_review')
  /* the customer can still complete it; funds were never dropped */
  assert.equal((await pay(c, o, BASE.transfer({ from: c.wallet, units: 9_800_000n }), 8453)).outcome, 'provisioned')
})

test('payment settings: audited runtime toggle; disabled wallet method refuses new intents', async () => {
  await setPaymentMethod(pool, { method: 'wallet', enabled: false, actor: 'admin:test', reason: 'maintenance window' })
  const c = await customer(), o = await order(c); srv.as(c)
  assert.equal((await srv.call('POST', `/purchases/orders/${o.id}/intents`, { chainId: 8453 })).data.error, 'method_disabled')
  const r = await srv.admin('POST', '/admin/payments/settings', { method: 'wallet', enabled: true, reason: 'maintenance done' })
  assert.equal(r.status, 200); assert.equal(r.data.methods.wallet.enabled, true)
  assert.ok(await n(`SELECT count(*) n FROM financial_audit_log WHERE action='payment_method_setting'`) >= 2)
  assert.equal((await srv.call('POST', `/purchases/orders/${o.id}/intents`, { chainId: 8453 })).status, 200)
  assert.equal((await srv.call('POST', `/purchases/orders/${o.id}/intents`, { chainId: SOLANA_CHAIN_ID })).data.error, 'unsupported_chain')
})

test('operator overview, search and metrics expose counts, never secrets', async () => {
  const ov = await srv.admin('GET', '/admin/payments/overview')
  assert.equal(ov.status, 200)
  for (const k of ['orders', 'transactions', 'refunds', 'attempts', 'watcher', 'alerts', 'methods']) assert.ok(k in ov.data, k)
  const s = await srv.admin('GET', '/admin/payments/search?status=partially_paid')
  assert.equal(s.status, 200)
  assert.equal((await srv.admin('GET', '/admin/payments/search?wallet=nope')).status, 400)
  const m = await paymentMetrics(pool)
  assert.ok(!JSON.stringify(m).includes('fake'))                                   // no RPC URLs
})

/* ================================================ status derivation === */
test('status: a rejected attempt is never hidden behind payment_detected (v0.7.0 defect)', () => {
  const now = new Date()
  const s = derivePaymentStatus({ order: { status: 'pending', lifecycle_state: 'payment_detected' }, attempts: [{ status: 'rejected', error_code: 'wrong_token', first_seen_at: now }], now })
  assert.equal(s.code, 'incorrect_token')
  assert.equal(derivePaymentStatus({ order: { status: 'pending', lifecycle_state: 'partially_paid' }, totals: { receivedUsd: '10.638', remainingUsd: '0.162' }, now }).code, 'partially_received')
  assert.equal(derivePaymentStatus({ order: { status: 'pending', lifecycle_state: 'awaiting_payment' }, attempts: [{ status: 'pending', error_code: 'tx_not_final', first_seen_at: new Date(now - 16 * 60_000) }], now }).escalation, 'delayed')
  assert.equal(derivePaymentStatus({ order: { status: 'paid', lifecycle_state: 'provisioned' }, refunds: [{ status: 'refund_due' }], now }).refund, 'refund_pending')
  for (const c of ['incorrect_network', 'incorrect_receiver', 'wrong_sender', 'duplicate_transaction'])
    assert.ok(PAYMENT_STATUS_CODES.includes(c))
})
