/**
 * Split web/worker engine (ADR 0043 §Iran pricing): on Liara the web app
 * executes user orders and closes (roles http + market-data) while the worker
 * runs the monitoring loop (engine role) against the SAME database. Their
 * in-memory account locks are separate, so only PostgreSQL row locks keep a
 * position from being closed twice. This suite runs the second engine in a
 * worker thread (separate module instances) and races them.
 *
 * Run: DATABASE_URL=<isolated test db> node --test test/split-process-engine.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import Decimal from 'decimal.js'
import { Engine } from '../engine.js'
import { FakeMarket } from './fixtures/fake-market.mjs'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6 })
const D = v => new Decimal(v)
const MARKET = 'XSOL/USD'

/* the "web" engine (this thread) and the "worker" engine (another thread) */
const md = new FakeMarket()
const web = new Engine(pool, md)
web.running = true
const thread = new Worker(new URL('./fixtures/engine-thread.mjs', import.meta.url), { workerData: { databaseUrl: process.env.DATABASE_URL } })
let seq = 0
const pending = new Map()
thread.on('message', m => { const p = pending.get(m.id); pending.delete(m.id); m.ok ? p.resolve(m.result) : p.reject(new Error(m.error)) })
const worker = (cmd, args = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); thread.postMessage({ id, cmd, args }) })
const price = async p => { md.set(MARKET, p); await worker('price', { market: MARKET, price: p }) }

const users = []
async function freeDemo() {
  const { rows: [u] } = await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', ['0xsplit' + randomUUID().replace(/-/g, '').slice(0, 34)])
  users.push(u.id)
  const account = await web.ensureDemoAccount(u.id)
  /* free-demo orders address the account by user (accountId null); the id is for assertions */
  return { userId: u.id, accountId: account.id, funding: D(account.balance) }
}

async function assertReconciled(accountId, funding) {
  const acc = (await pool.query('SELECT * FROM demo_accounts WHERE id=$1', [accountId])).rows[0]
  const ledger = (await pool.query('SELECT coalesce(sum(amount),0) AS s FROM trading_ledger WHERE account_id=$1', [accountId])).rows[0].s
  assert.equal(D(acc.balance).toFixed(8), D(ledger).toFixed(8), 'balance equals the sum of ledger amounts')
  const pos = (await pool.query('SELECT * FROM trading_positions WHERE account_id=$1', [accountId])).rows
  const openMargin = pos.filter(p => p.status === 'open').reduce((s, p) => s.plus(p.margin), D(0))
  assert.equal(D(acc.used_margin).toFixed(8), openMargin.toFixed(8), 'used margin equals open-position margin')
  const closedNet = pos.filter(p => p.status !== 'open').reduce((s, p) => s.plus(p.realized_pnl), D(0))
  const fees = pos.reduce((s, p) => s.plus(p.open_fee), D(0))
  assert.equal(D(acc.balance).toFixed(8), funding.plus(closedNet).minus(fees).toFixed(8), 'balance = funding + closed settlements - opening fees')
}
test.after(async () => {
  await worker('end').catch(() => {})
  await thread.terminate()
  if (users.length) {
    await pool.query('DELETE FROM trading_ledger WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id = ANY($1))', [users]).catch(() => {})
  }
  await pool.end()
})

test('a user close racing the worker stop-loss closes the position exactly once', async () => {
  for (let round = 0; round < 8; round++) {
    const { userId, accountId, funding } = await freeDemo()
    await price(100)
    const order = await web.submitOrder(userId, { market: MARKET, side: 'long', order_type: 'market', margin: '100', leverage: 5, sl: '95' }, randomUUID(), null)
    const positionId = order.position.id
    await price(94) /* below the stop: the worker loop wants to close it, the user does too */
    const [user, loop] = await Promise.allSettled([web.closePosition(userId, positionId), worker('loop')])
    assert.equal(loop.status, 'fulfilled', String(loop.reason))
    assert.equal(user.status, 'fulfilled', String(user.reason))
    const rows = (await pool.query('SELECT status, exit_reason FROM trading_positions WHERE id=$1', [positionId])).rows
    assert.equal(rows.length, 1)
    assert.notEqual(rows[0].status, 'open', 'closed')
    assert.ok(['manual', 'stop_loss', 'user', 'sl'].some(r => String(rows[0].exit_reason).includes(r)) || rows[0].exit_reason, 'one exit reason recorded')
    await assertReconciled(accountId, funding)
  }
})

test('the same idempotency key submitted to both engines opens one position', async () => {
  const { userId, accountId, funding } = await freeDemo()
  await price(100)
  const key = randomUUID()
  const body = { market: MARKET, side: 'short', order_type: 'market', margin: '50', leverage: 3 }
  const results = await Promise.allSettled([
    web.submitOrder(userId, body, key, null),
    worker('submit', { userId, body, key, accountId: null }),
    web.submitOrder(userId, body, key, null),
  ])
  for (const r of results) assert.ok(r.status === 'fulfilled' || /idempotency|in_progress|duplicate/.test(String(r.reason)), String(r.reason))
  const open = (await pool.query("SELECT count(*)::int AS n FROM trading_positions WHERE account_id=$1", [accountId])).rows[0].n
  assert.equal(open, 1, 'exactly one position for one idempotency key')
  await assertReconciled(accountId, funding)
})

test('closing from both engines at once settles once', async () => {
  const { userId, accountId, funding } = await freeDemo()
  await price(100)
  const order = await web.submitOrder(userId, { market: MARKET, side: 'long', order_type: 'market', margin: '80', leverage: 2 }, randomUUID(), null)
  await price(103)
  const rs = await Promise.allSettled([web.closePosition(userId, order.position.id), worker('close', { userId, positionId: order.position.id })])
  for (const r of rs) assert.equal(r.status, 'fulfilled', String(r.reason))
  assert.equal(rs.filter(r => r.value?.duplicate).length, 1, 'one of the two closes is reported as a duplicate')
  await assertReconciled(accountId, funding)
})

test('stale prices refuse execution in either engine', async () => {
  const { userId, accountId } = await freeDemo()
  await price(null)
  const body = { market: MARKET, side: 'long', order_type: 'market', margin: '10', leverage: 1 }
  /* the engine records a rejected order and opens nothing */
  for (const r of [await web.submitOrder(userId, body, randomUUID(), null), await worker('submit', { userId, body, key: randomUUID(), accountId: null })]) {
    assert.equal(r.ok, false)
    assert.equal(r.reason, 'stale_price')
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM trading_positions WHERE account_id=$1', [accountId])).rows[0].n, 0)
})

test('take-profit by the worker after a web restart (new engine instance) closes once', async () => {
  const { userId, accountId, funding } = await freeDemo()
  await price(100)
  const order = await web.submitOrder(userId, { market: MARKET, side: 'long', order_type: 'market', margin: '60', leverage: 4, tp: '104' }, randomUUID(), null)
  const restarted = new Engine(pool, md) /* the web process restarted: no in-memory state survives */
  restarted.running = true
  await price(105)
  await Promise.all([worker('loop'), worker('loop')])
  const pos = (await pool.query('SELECT status FROM trading_positions WHERE id=$1', [order.position.id])).rows[0]
  assert.notEqual(pos.status, 'open')
  const again = await restarted.closePosition(userId, order.position.id)
  assert.equal(again.duplicate, true, 'a late user close after TP is a no-op')
  await assertReconciled(accountId, funding)
})
