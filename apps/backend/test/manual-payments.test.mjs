/**
 * Manual payment checkout — deterministic tests (no network, no real funds).
 *
 *  M. Solana SPL verification: memo binding, mint/receiver/amount/decimals,
 *     failed / pending / not-final transactions (injected JSON-RPC).
 *  N. verifyAndConfirm() correlation for manual vs DePay-attested payments,
 *     concurrent claims of one transaction by two orders, EVM decimals.
 *  P. POST /purchases/verify (the manual route) on an in-process Express
 *     app with an injected chain verifier: validation, Verification Pending,
 *     rejection reasons, idempotent replay, "already paid", rate limiting,
 *     and that nothing provisions before an independent chain verdict.
 *
 * MOCKED CHAIN DATA IS NOT REAL-NETWORK ACCEPTANCE (docs/payments/ACTIVATION.md).
 * Run: node --test test/manual-payments.test.mjs   (isolated test DATABASE_URL)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { analyzeSolanaPayment, createSolanaVerifier, solanaMemos } from '../solana-verification.js'
import { toUnits, SOLANA_CHAIN_ID } from '../payment-verification.js'
import { verifyAndConfirm, purchaseRoutes } from '../purchases.js'

const DB = process.env.DATABASE_URL || ''
if (!/test|audit|_ci/.test(DB)) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: DB })
test.after(async () => { await pool.end() })

const rnd = () => '0x' + crypto.randomBytes(20).toString('hex')
const hash = () => '0x' + crypto.randomBytes(32).toString('hex')
const b58 = n => { const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; return Array.from(crypto.randomBytes(n), b => A[b % 58]).join('') }
const SOL_RECEIVER = b58(44), SOL_MINT = b58(44), OTHER_MINT = b58(44), PAYER = b58(44)
const EVM_RECEIVER = '0x' + 'c3'.repeat(20), EVM_TOKEN = '0x' + 'a1'.repeat(20)
const SIG = () => b58(88)

/* settlement configuration under test: Arbitrum USDC + Solana USDC (public test values) */
process.env.PURCHASE_PAYMENT_CHAINS = JSON.stringify([
  { blockchain: 'arbitrum', token: EVM_TOKEN, receiver: EVM_RECEIVER, tokenDecimals: 6, tokenSymbol: 'USDC', minConfirmations: 0 },
  { blockchain: 'solana', token: SOL_MINT, receiver: SOL_RECEIVER, tokenDecimals: 6, tokenSymbol: 'USDC', minConfirmations: 0 },
])

/* ---------------------------------------------------------------- M --- */
const solTx = ({ memo = null, innerMemo = null, pre = 0n, post = 49_000_000n, mint = SOL_MINT, owner = SOL_RECEIVER, err = null, blockTime = Math.floor(Date.now() / 1000) } = {}) => ({
  slot: 1234, blockTime,
  transaction: { message: { accountKeys: [{ pubkey: PAYER }], instructions: memo == null ? [] : [{ program: 'spl-memo', programId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', parsed: memo }] } },
  meta: {
    err,
    innerInstructions: innerMemo == null ? [] : [{ index: 0, instructions: [{ program: 'spl-memo', parsed: innerMemo }] }],
    preTokenBalances: [{ owner, mint, uiTokenAmount: { amount: String(pre) } }],
    postTokenBalances: [{ owner, mint, uiTokenAmount: { amount: String(post) } }],
  },
})
const solExpect = (over = {}) => ({ receiver: SOL_RECEIVER, token: SOL_MINT, requireSender: false, signature: 'sig', minAmountUnits: toUnits('49', 6), ...over })
const code = fn => { try { fn(); return null } catch (e) { return e.message } }

test('M1 SPL transfer with the order id in a Memo is accepted (top-level and inner memo)', () => {
  const memo = crypto.randomUUID()
  assert.equal(analyzeSolanaPayment(solTx({ memo: `Openfund ${memo}` }), solExpect({ memo })).amount, '49000000')
  assert.equal(analyzeSolanaPayment(solTx({ innerMemo: memo.toUpperCase() }), solExpect({ memo })).amount, '49000000')
  assert.deepEqual(solanaMemos(solTx({ memo: 'a', innerMemo: 'b' })), ['a', 'b'])
})
test('M2 a manual Solana transfer without the order memo can not be claimed', () => {
  const memo = crypto.randomUUID()
  assert.equal(code(() => analyzeSolanaPayment(solTx(), solExpect({ memo }))), 'memo_missing')
  assert.equal(code(() => analyzeSolanaPayment(solTx({ memo: crypto.randomUUID() }), solExpect({ memo }))), 'memo_missing')
})
test('M3 wrong mint, wrong receiver, underpayment and failed transactions are rejected', () => {
  assert.equal(code(() => analyzeSolanaPayment(solTx({ mint: OTHER_MINT }), solExpect())), 'wrong_token')
  assert.equal(code(() => analyzeSolanaPayment(solTx({ owner: b58(44) }), solExpect())), 'wrong_receiver')
  assert.equal(code(() => analyzeSolanaPayment(solTx({ post: 48_999_999n }), solExpect())), 'insufficient_amount')
  assert.equal(code(() => analyzeSolanaPayment(solTx({ err: { InstructionError: [0, 'Custom'] } }), solExpect())), 'tx_not_successful')
  assert.equal(code(() => analyzeSolanaPayment(null, solExpect())), 'tx_pending')
})
test('M4 SPL amounts use the mint decimals exactly (no float rounding)', async () => {
  const memo = crypto.randomUUID()
  let asked = null
  const v = createSolanaVerifier({ rpc: async (method, params) => {
    if (method === 'getTokenSupply') return { value: { decimals: 6 } }
    asked = params[1].commitment
    return solTx({ memo, post: 49_990_000n })
  } })
  const r = await v(SIG(), { token: SOL_MINT, receiver: SOL_RECEIVER, priceUsd: '49.99', requireSender: false, memo, notBefore: 0, minConfirmations: 1 })
  assert.equal(r.minAmountUnits, '49990000'); assert.equal(r.amount, '49990000'); assert.equal(asked, 'finalized')
  await assert.rejects(v(SIG(), { token: SOL_MINT, receiver: SOL_RECEIVER, priceUsd: '50.00', requireSender: false, memo, notBefore: 0, minConfirmations: 1 }),
    e => e.message === 'insufficient_amount')
})
test('M5 a transaction not yet finalized stays retryable (never a verdict)', async () => {
  const v = createSolanaVerifier({ rpc: async () => null })
  await assert.rejects(v(SIG(), { token: SOL_MINT, tokenDecimals: 6, receiver: SOL_RECEIVER, priceUsd: '49', notBefore: 0, minConfirmations: 1 }),
    e => e.message === 'tx_not_final' && e.retryable === true)
})
test('M6 EVM decimals: 6-decimal and 18-decimal stablecoins get exact base units', () => {
  assert.equal(toUnits('49.99', 6), '49990000')
  assert.equal(toUnits('49.99', 18), '49990000000000000000')
  assert.throws(() => toUnits('49.999', 2), /price_precision/)
})

/* ---------------------------------------------------------------- N --- */
async function fixture() {
  const wallet = rnd()
  const { rows: [user] } = await pool.query(`INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id`, [wallet])
  const { rows: [plan] } = await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ('mp-test','MP Test',$1)
     ON CONFLICT (slug) DO UPDATE SET configuration = EXCLUDED.configuration RETURNING id`,
    [JSON.stringify({ accountSizesUsd: [5000], priceUsd: { 5000: 49 }, phases: 1 })])
  const order = async () => (await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, expires_at)
     VALUES ($1,$2,5000,49,'pending',now() + interval '1 hour') RETURNING id, price_usd, created_at`, [user.id, plan.id])).rows[0]
  return { wallet, userId: user.id, order }
}
const verdict = (chainId, receiver, token) => async (txHash, expect) => ({
  txHash, chainId, blockNumber: 1, fromAddress: expect.from || PAYER, toAddress: receiver, amount: '49000000', tokenAddress: token,
  blockTimestamp: new Date().toISOString(), overpaymentUnits: '0', route: 'direct',
})
const count = async (t, id) => (await pool.query(`SELECT count(*)::int n FROM ${t} WHERE purchase_order_id=$1`, [id])).rows[0].n

test('N1 manual Solana: the verifier is asked for the order memo, not the EVM sign-in wallet', async () => {
  const f = await fixture(); const o = await f.order(); let seen = null
  const v = async (tx, expect) => { seen = expect; return verdict(SOLANA_CHAIN_ID, SOL_RECEIVER, SOL_MINT)(tx, expect) }
  await verifyAndConfirm({ pool, verifier: v, order: o, userId: f.userId, walletAddress: f.wallet, txHash: SIG(), source: 'test', chainId: SOLANA_CHAIN_ID })
  assert.equal(seen.requireSender, false); assert.equal(seen.memo, o.id); assert.equal(seen.receiver, SOL_RECEIVER); assert.equal(seen.token, SOL_MINT)
  assert.equal(seen.priceUsd, '49.00')   /* the server order price, never a client value */
})
test('N2 manual EVM: the transaction must be signed by the sign-in wallet; DePay-attested payments are not memo-bound', async () => {
  const f = await fixture(); let seen = null
  const v = async (tx, expect) => { seen = expect; return verdict(42161, EVM_RECEIVER, EVM_TOKEN)(tx, expect) }
  await verifyAndConfirm({ pool, verifier: v, order: await f.order(), userId: f.userId, walletAddress: f.wallet, txHash: hash(), source: 'test', chainId: 42161 })
  assert.equal(seen.requireSender, true); assert.equal(seen.from, f.wallet); assert.equal(seen.memo, null)
  await verifyAndConfirm({ pool, verifier: v, order: await f.order(), userId: f.userId, walletAddress: f.wallet, txHash: SIG(), source: 'depay_callback', chainId: SOLANA_CHAIN_ID, attested: true })
  assert.equal(seen.requireSender, false); assert.equal(seen.memo, null)
})
test('N3 two orders racing to claim one transaction: exactly one is paid, the other gets tx_already_used', async () => {
  const f = await fixture(); const o1 = await f.order(); const o2 = await f.order(); const tx = hash()
  const v = verdict(42161, EVM_RECEIVER, EVM_TOKEN)
  const results = await Promise.allSettled([o1, o2].map(o => verifyAndConfirm({ pool, verifier: v, order: o, userId: f.userId, walletAddress: f.wallet, txHash: tx, source: 'test', chainId: 42161 })))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const rejected = results.find(r => r.status === 'rejected')
  assert.equal(rejected.reason.message, 'tx_already_used')
  assert.equal((await pool.query('SELECT count(*)::int n FROM payments WHERE chain_id=42161 AND tx_hash=$1', [tx])).rows[0].n, 1)
  assert.equal(await count('openfund_challenges', o1.id) + await count('openfund_challenges', o2.id), 1)
})
test('N4 a DePay callback and a manual submission of the same payment provision once', async () => {
  const f = await fixture(); const o = await f.order(); const tx = hash()
  const v = verdict(42161, EVM_RECEIVER, EVM_TOKEN)
  const a = await verifyAndConfirm({ pool, verifier: v, order: o, userId: f.userId, walletAddress: f.wallet, txHash: tx, source: 'depay_callback', chainId: 42161, attested: true })
  const b = await verifyAndConfirm({ pool, verifier: v, order: o, userId: f.userId, walletAddress: f.wallet, txHash: tx, source: 'onchain', chainId: 42161 })
  assert.equal(a.replayed, false); assert.equal(b.replayed, true); assert.equal(b.challengeId, a.challengeId)
  assert.deepEqual([await count('payments', o.id), await count('invoices', o.id), await count('openfund_challenges', o.id)], [1, 1, 1])
})

/* ---------------------------------------------------------------- P --- */
async function server(verifier) {
  const app = express()
  app.use(express.json())
  const hits = new Map()
  const limit = max => (req, res, next) => { const k = req.path; const n = (hits.get(k) || 0) + 1; hits.set(k, n); return n > max ? res.status(429).json({ error: 'rate_limited' }) : next() }
  let user = null
  const requireAuth = (req, res, next) => { req.user = user; next() }
  app.use(purchaseRoutes({ pool, requireAuth, audit: async () => {}, verifier, limit }))
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }))
  const s = app.listen(0)
  await new Promise(r => s.once('listening', r))
  const base = `http://127.0.0.1:${s.address().port}`
  return {
    as: f => { user = { user_id: f.userId, wallet_address: f.wallet } },
    post: async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() } },
    get: async path => { const r = await fetch(base + path); return { status: r.status, data: await r.json() } },
    close: () => new Promise(r => s.close(r)),
    reset: () => hits.clear(),
  }
}

test('P1 manual instructions come from the settlement configuration (treasury receiver per chain, token, memo)', async () => {
  const srv = await server(async () => { throw new Error('unused') })
  try {
    const f = await fixture(); srv.as(f); const o = await f.order()
    const r = await srv.get(`/purchases/orders/${o.id}`)
    const m = r.data.payment.manual
    assert.equal(m.amount, '49.00'); assert.equal(m.memo, o.id)
    assert.deepEqual(m.chains.map(c => [c.blockchain, c.receiver, c.correlation]), [['arbitrum', EVM_RECEIVER, 'sender'], ['solana', SOL_RECEIVER, 'memo']])
    assert.match(m.chains[0].receiverExplorerUrl, /arbiscan\.io\/address\//)
    assert.match(m.chains[1].receiverExplorerUrl, /solscan\.io\/account\//)
    assert.ok(!JSON.stringify(r.data).includes('rpc'))   /* no RPC endpoint leaks */
  } finally { await srv.close() }
})

test('P2 the manual route validates input, never provisions on its own and reports each outcome', async () => {
  let next = null
  const srv = await server(async (tx, expect) => next(tx, expect))
  try {
    const f = await fixture(); srv.as(f)
    const o = await f.order()
    /* malformed hash / unsupported chain / wrong network format */
    assert.equal((await srv.post('/purchases/verify', { orderId: o.id, chainId: 42161, txHash: '0x1234' })).data.error, 'invalid_request')
    assert.equal((await srv.post('/purchases/verify', { orderId: o.id, chainId: 1, txHash: hash() })).data.error, 'unsupported_chain')
    assert.equal((await srv.post('/purchases/verify', { orderId: o.id, chainId: SOLANA_CHAIN_ID, txHash: hash() })).data.error, 'invalid_request')
    /* pending → Verification Pending (payment_detected), retryable, nothing provisioned */
    next = async () => { throw Object.assign(new Error('tx_pending'), { status: 409, retryable: true }) }
    const pending = await srv.post('/purchases/verify', { orderId: o.id, chainId: 42161, txHash: hash() })
    assert.equal(pending.status, 409); assert.equal(pending.data.retryable, true)
    assert.equal((await pool.query('SELECT lifecycle_state FROM purchase_orders WHERE id=$1', [o.id])).rows[0].lifecycle_state, 'payment_detected')
    assert.equal(await count('openfund_challenges', o.id), 0)
    /* each chain verdict is passed through with its code; still nothing provisioned */
    for (const reason of ['wrong_token', 'wrong_receiver', 'insufficient_amount', 'tx_not_successful', 'wrong_sender', 'memo_missing']) {
      next = async () => { throw Object.assign(new Error(reason), { status: 400, isPaymentError: true }) }
      const r = await srv.post('/purchases/verify', { orderId: o.id, chainId: 42161, txHash: hash() })
      assert.equal(r.status, 400); assert.equal(r.data.error, reason)
    }
    assert.equal(await count('openfund_challenges', o.id), 0)
    srv.reset()
    /* valid → paid, receipt and challenge exactly once; same tx again is idempotent */
    const tx = hash()
    next = verdict(42161, EVM_RECEIVER, EVM_TOKEN)
    const paid = await srv.post('/purchases/verify', { orderId: o.id, chainId: 42161, txHash: tx })
    assert.equal(paid.status, 200); assert.ok(paid.data.challengeId)
    const again = await srv.post('/purchases/verify', { orderId: o.id, chainId: 42161, txHash: tx.toUpperCase().replace('0X', '0x') })
    assert.equal(again.data.replayed, true); assert.equal(again.data.challengeId, paid.data.challengeId)
    /* another transaction for a paid order is not silently "accepted" */
    assert.equal((await srv.post('/purchases/verify', { orderId: o.id, chainId: 42161, txHash: hash() })).data.error, 'order_already_paid')
    assert.deepEqual([await count('payments', o.id), await count('invoices', o.id), await count('openfund_challenges', o.id)], [1, 1, 1])
    const receipt = await srv.get(`/purchases/orders/${o.id}/receipt`)
    assert.equal(receipt.data.receipt.payment.txHash, tx); assert.equal(receipt.data.receipt.payment.settlement.amount, '49')
  } finally { await srv.close() }
})

test('P3 the manual route is rate limited', async () => {
  const srv = await server(async () => { throw Object.assign(new Error('tx_pending'), { status: 409, retryable: true }) })
  try {
    const f = await fixture(); srv.as(f); const o = await f.order()
    const codes = []
    for (let i = 0; i < 12; i++) codes.push((await srv.post('/purchases/verify', { orderId: o.id, chainId: 42161, txHash: hash() })).status)
    assert.ok(codes.includes(429)); assert.equal(codes.filter(c => c !== 429).length, 10)
  } finally { await srv.close() }
})

test('P4 another customer can not verify or read this order', async () => {
  const srv = await server(verdict(42161, EVM_RECEIVER, EVM_TOKEN))
  try {
    const owner = await fixture(); const other = await fixture(); const o = await owner.order()
    srv.as(other)
    assert.equal((await srv.post('/purchases/verify', { orderId: o.id, chainId: 42161, txHash: hash() })).status, 404)
    assert.equal((await srv.get(`/purchases/orders/${o.id}`)).status, 404)
    assert.equal(await count('openfund_challenges', o.id), 0)
  } finally { await srv.close() }
})
