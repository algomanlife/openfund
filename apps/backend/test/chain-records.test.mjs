/**
 * On-chain records (ADR 0063): encoding of certificates, statuses and
 * trades; the schema.sql outbox triggers on real PostgreSQL; and the worker
 * against fake chain clients (ordering, retry with backoff, idempotent
 * re-send, receipts). Runs in its own disposable database.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { keccak256, stringToBytes } from 'viem'
import {
  fixedPoint, uuidBytes16, recordId, tokenIdOf, certificateArgs, statusArgs, tradeArgs,
  chainRecordsConfig, ChainRecorder, CERTIFICATE_KINDS, TRADE_ACTIONS,
} from '../chain-records.js'

/* ---------------------------------------------------------------- pure */

test('R1 fixed point, uuid and ids', () => {
  assert.equal(fixedPoint('60000'), 600000000000000n)
  assert.equal(fixedPoint('1.5'), 15000000000n)
  assert.equal(fixedPoint('-12.3456789012345'), -123456789012n, 'truncated to 10 decimals')
  assert.equal(fixedPoint(null), 0n)
  assert.equal(fixedPoint('25000.00', 2), 2500000n)
  assert.throws(() => fixedPoint('1e5'))
  assert.equal(uuidBytes16('44444444-4444-4444-4444-444444444444'), '0x44444444444444444444444444444444')
  assert.equal(uuidBytes16(null), '0x00000000000000000000000000000000')
  assert.throws(() => uuidBytes16('nope'))
  assert.equal(recordId('trade:open:x'), keccak256(stringToBytes('trade:open:x')))
  assert.equal(tokenIdOf('cert:trial:x'), BigInt(keccak256(stringToBytes('cert:trial:x'))))
})

test('R2 certificate, status and trade arguments', () => {
  const holder = '0xabc0000000000000000000000000000000000001'
  const cert = certificateArgs({ record_key: 'cert:trial:44444444-4444-4444-4444-444444444444',
    payload: { certificateKind: 'trial', holder, challengeId: '44444444-4444-4444-4444-444444444444', amountUsd: '25000.0000000000', eventAt: '2026-11-27T10:00:00Z' } })
  assert.deepEqual(cert, [holder, tokenIdOf('cert:trial:44444444-4444-4444-4444-444444444444'), CERTIFICATE_KINDS.trial,
    '0x44444444444444444444444444444444', 2500000n, BigInt(Date.parse('2026-11-27T10:00:00Z') / 1000)])
  assert.deepEqual(statusArgs({ payload: { certificateKey: 'cert:trial:a', status: 'failed' } }), [tokenIdOf('cert:trial:a'), 2])
  assert.throws(() => statusArgs({ payload: { certificateKey: 'k', status: 'won' } }))
  const [trade] = tradeArgs({ record_key: 'trade:close:66666666-6666-6666-6666-666666666666', payload: {
    action: 'close', challengeId: '44444444-4444-4444-4444-444444444444', positionId: '66666666-6666-6666-6666-666666666666',
    parentPositionId: null, market: 'BTC/USD', side: 'short', leverage: 20, quantity: '0.0300000000', entryPrice: '60000.0000000000',
    exitPrice: '59000.0000000000', stopLoss: null, takeProfit: '58000', realizedPnl: '29.9', exitReason: 'manual', at: '2026-11-27T10:00:00Z' } })
  assert.equal(trade.action, TRADE_ACTIONS.close)
  assert.equal(trade.long, false)
  assert.equal(trade.quantity, 300000000n)
  assert.equal(trade.stopLoss, 0n)
  assert.equal(trade.takeProfit, 580000000000000n)
  assert.equal(trade.realizedPnl, 299000000000n)
  assert.equal(trade.recordId, recordId('trade:close:66666666-6666-6666-6666-666666666666'))
  assert.equal(trade.parentPositionId, '0x00000000000000000000000000000000')
})

test('R3 configuration: disabled by default, refuses an incomplete setup', () => {
  assert.equal(chainRecordsConfig({}).enabled, false)
  const bad = chainRecordsConfig({ CHAIN_RECORDS_ENABLED: '1', CHAIN_RECORDS_PRIVATE_KEY: 'x' })
  assert.equal(bad.enabled, false)
  assert.deepEqual(bad.problems.sort(), ['CHAIN_RECORDS_CERTIFICATE_ADDRESS', 'CHAIN_RECORDS_LEDGER_ADDRESS', 'CHAIN_RECORDS_PRIVATE_KEY'])
  const ok = chainRecordsConfig({ CHAIN_RECORDS_ENABLED: '1', CHAIN_RECORDS_PRIVATE_KEY: generatePrivateKey(),
    CHAIN_RECORDS_CERTIFICATE_ADDRESS: '0x' + '1'.repeat(40), CHAIN_RECORDS_LEDGER_ADDRESS: '0x' + '2'.repeat(40) })
  assert.equal(ok.enabled, true)
  assert.equal(ok.chainId, 421614)
  assert.equal(ok.network, 'Arbitrum Sepolia')
})

/* ---------------------------------------------------------------- database */

const dbUrl = process.env.DATABASE_URL || ''
const runDb = /test|audit|_ci/.test(dbUrl)
let pool, isolatedDb
before(async () => {
  if (!runDb) return
  const baseUrl = new URL(dbUrl)
  isolatedDb = `${baseUrl.pathname.slice(1)}_chain_${process.pid}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
  const admin = new pg.Client({ connectionString: dbUrl })
  await admin.connect(); await admin.query(`CREATE DATABASE "${isolatedDb}"`); await admin.end()
  const url = new URL(baseUrl); url.pathname = `/${isolatedDb}`
  execFileSync(process.execPath, [fileURLToPath(new URL('../migrate.js', import.meta.url))],
    { env: { ...process.env, DATABASE_URL: url.href, FOOTPRINT_DATABASE_URL: url.href }, stdio: ['ignore', 'ignore', 'inherit'] })
  pool = new pg.Pool({ connectionString: url.href })
})
after(async () => {
  if (!pool) return
  await pool.end()
  const drop = new pg.Client({ connectionString: dbUrl })
  await drop.connect()
  try { await drop.query(`DROP DATABASE IF EXISTS "${isolatedDb}" WITH (FORCE)`) } finally { await drop.end() }
})

async function fixture({ free = true, controlled = false } = {}) {
  const user = (await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id, wallet_address',
    [privateKeyToAccount(generatePrivateKey()).address.toLowerCase()])).rows[0]
  const plan = (await pool.query(`INSERT INTO challenge_plans (slug, name) VALUES ($1,'chain test') RETURNING id`, [`chain-${Date.now()}-${Math.random()}`])).rows[0]
  const account = (await pool.query(`INSERT INTO demo_accounts (user_id, account_type, balance, currency) VALUES ($1,'challenge',25000,'USD') RETURNING id`, [user.id])).rows[0]
  const snapshot = { free, phases: 2, ...(controlled ? { controlledTest: true } : {}) }
  let order = null
  if (!free) order = (await pool.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, paid_at) VALUES ($1,$2,25000,216,'paid',now()) RETURNING id`, [user.id, plan.id])).rows[0].id
  const challenge = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot, demo_account_id, purchase_order_id)
    VALUES ($1,$2,'started',25000,1,$3,$4,$5) RETURNING id`, [user.id, plan.id, JSON.stringify(snapshot), account.id, order])).rows[0]
  const orderRow = (await pool.query(`INSERT INTO trading_orders (account_id, user_id, market, side, order_type, margin, leverage, status) VALUES ($1,$2,'BTC/USD','long','market',100,20,'filled') RETURNING id`, [account.id, user.id])).rows[0]
  return { user, plan, account: account.id, challenge: challenge.id, order, orderId: orderRow.id }
}
const records = async challenge => (await pool.query('SELECT * FROM chain_records WHERE challenge_id=$1 ORDER BY id', [challenge])).rows

test('R4 triggers queue every certificate and position event once', { skip: !runDb && 'needs an isolated test DATABASE_URL' }, async () => {
  const f = await fixture()
  const pos = (await pool.query(`INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity, entry_price, margin, leverage)
    VALUES ($1,$2,$3,'BTC/USD','long',0.03,60000,100,20) RETURNING id`, [f.orderId, f.account, f.user.id])).rows[0].id
  await pool.query('UPDATE trading_positions SET sl_price=59000 WHERE id=$1', [pos])
  await pool.query('UPDATE trading_positions SET tp_price=62000 WHERE id=$1', [pos])
  await pool.query('UPDATE trading_positions SET quantity=0.02 WHERE id=$1', [pos])
  const slice = (await pool.query(`INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity, entry_price, margin, leverage, parent_position_id)
    VALUES ($1,$2,$3,'BTC/USD','long',0.01,60000,33,20,$4) RETURNING id`, [f.orderId, f.account, f.user.id, pos])).rows[0].id
  await pool.query(`UPDATE trading_positions SET status='closed', exit_price=61000, realized_pnl=10, exit_reason='partial', closed_at=now() WHERE id=$1`, [slice])
  await pool.query(`UPDATE trading_positions SET status='closed', exit_price=61500, realized_pnl=30, exit_reason='tp', closed_at=now() WHERE id=$1`, [pos])
  await pool.query(`INSERT INTO challenge_events (challenge_id, kind, detail) VALUES ($1,'stage_passed','{}'),($1,'passed','{}'),($1,'passed','{}')`, [f.challenge])
  const rows = await records(f.challenge)
  assert.deepEqual(rows.map(r => r.kind === 'trade' ? r.payload.action : r.kind === 'certificate' ? r.payload.certificateKind : `status:${r.payload.status}`),
    ['trial', 'open', 'modify', 'modify', 'partial_close', 'close', 'stage_pass', 'trial_pass', 'status:passed'])
  const trial = rows[0]
  assert.equal(trial.record_key, `cert:trial:${f.challenge}`)
  assert.equal(trial.payload.holder, f.user.wallet_address)
  const close = rows.find(r => r.payload.action === 'close')
  assert.deepEqual([close.payload.stopLoss, close.payload.takeProfit, close.payload.exitReason], ['59000.0000000000', '62000.0000000000', 'tp'])
  assert.equal(rows.find(r => r.payload.action === 'partial_close').payload.parentPositionId, pos)
  assert.ok(rows.every(r => r.status === 'pending'))
})

test('R5 purchase certificates are keyed by the order; failures record the outcome', { skip: !runDb && 'needs an isolated test DATABASE_URL' }, async () => {
  const f = await fixture({ free: false })
  await pool.query(`INSERT INTO challenge_events (challenge_id, kind, detail) VALUES ($1,'violation','{}')`, [f.challenge])
  const rows = await records(f.challenge)
  assert.equal(rows[0].record_key, `cert:purchase:${f.order}`)
  assert.deepEqual(rows[1].payload, { certificateKey: `cert:purchase:${f.order}`, status: 'failed', challengeId: f.challenge })
})

test('R6 controlled acceptance challenges are never recorded', { skip: !runDb && 'needs an isolated test DATABASE_URL' }, async () => {
  const f = await fixture({ controlled: true })
  await pool.query(`INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity, entry_price, margin, leverage)
    VALUES ($1,$2,$3,'BTC/USD','long',0.03,60000,100,20)`, [f.orderId, f.account, f.user.id])
  assert.equal((await records(f.challenge)).length, 0)
})

function fakeChain({ failFirst = 0 } = {}) {
  const sent = []
  let failures = failFirst, n = 0
  return {
    sent,
    clients: {
      operator: '0x' + '9'.repeat(40),
      wallet: { writeContract: async call => { if (failures > 0) { failures--; throw new Error('rpc unavailable') } sent.push(call); return '0x' + (++n).toString(16).padStart(64, '0') } },
      public: { waitForTransactionReceipt: async ({ hash }) => ({ status: 'success', blockNumber: 1234n, transactionHash: hash }), getBalance: async () => 10n ** 17n },
    },
  }
}
const cfg = chainRecordsConfig({ CHAIN_RECORDS_ENABLED: '1', CHAIN_RECORDS_PRIVATE_KEY: generatePrivateKey(),
  CHAIN_RECORDS_CERTIFICATE_ADDRESS: '0x' + '1'.repeat(40), CHAIN_RECORDS_LEDGER_ADDRESS: '0x' + '2'.repeat(40), CHAIN_RECORDS_BATCH: '50' })

test('R7 the worker sends in order, stores hashes and token ids, and retries with backoff', { skip: !runDb && 'needs an isolated test DATABASE_URL' }, async () => {
  await pool.query(`UPDATE chain_records SET status='confirmed' WHERE status <> 'confirmed'`)
  const f = await fixture()
  await pool.query(`INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity, entry_price, margin, leverage)
    VALUES ($1,$2,$3,'ETH/USD','short',1,3000,150,20)`, [f.orderId, f.account, f.user.id])
  const failing = fakeChain({ failFirst: 1 })
  const recorder = new ChainRecorder({ pool, config: cfg, clients: failing.clients, log: { warn() {}, error() {} } })
  assert.equal(await recorder.tick(), 0, 'the first send fails and stops the pass')
  let rows = await records(f.challenge)
  assert.deepEqual(rows.map(r => r.status), ['pending', 'pending'])
  assert.match(rows[0].last_error, /rpc unavailable/)
  assert.ok(new Date(rows[0].next_attempt_at) > new Date(), 'backoff')
  await pool.query('UPDATE chain_records SET next_attempt_at=now() WHERE challenge_id=$1', [f.challenge])
  assert.equal(await recorder.tick(), 2)
  rows = await records(f.challenge)
  assert.deepEqual(rows.map(r => r.status), ['confirmed', 'confirmed'])
  assert.ok(rows.every(r => /^0x[0-9a-f]{64}$/.test(r.tx_hash) && Number(r.block_number) === 1234 && r.chain_id === 421614))
  assert.equal(rows[0].token_id, tokenIdOf(`cert:trial:${f.challenge}`).toString())
  assert.deepEqual(failing.sent.map(c => c.functionName), ['issue', 'record'], 'certificate first, then the trade')
  assert.equal(failing.sent[0].address, cfg.certificateAddress)
  assert.equal(failing.sent[1].address, cfg.ledgerAddress)
  assert.equal(await recorder.tick(), 0, 'nothing left')
  const status = await recorder.status()
  assert.equal(status.enabled, true)
  assert.equal(status.lowBalance, false)
})

test('R8 a stale sending row is re-sent (idempotent on chain) and a hopeless one is marked failed', { skip: !runDb && 'needs an isolated test DATABASE_URL' }, async () => {
  await pool.query(`UPDATE chain_records SET status='confirmed' WHERE status <> 'confirmed'`)
  const f = await fixture()
  await pool.query(`UPDATE chain_records SET status='sending', sent_at=now() - interval '11 minutes' WHERE challenge_id=$1`, [f.challenge])
  const chain = fakeChain()
  const recorder = new ChainRecorder({ pool, config: cfg, clients: chain.clients, log: { warn() {}, error() {} } })
  assert.equal(await recorder.tick(), 1)
  assert.equal((await records(f.challenge))[0].status, 'confirmed')
  const g = await fixture()
  await pool.query(`UPDATE chain_records SET payload = payload || '{"certificateKind":"unknown"}', attempts=$2 WHERE challenge_id=$1`, [g.challenge, cfg.maxAttempts])
  assert.equal(await recorder.tick(), 0)
  assert.equal((await records(g.challenge))[0].status, 'failed')
})
