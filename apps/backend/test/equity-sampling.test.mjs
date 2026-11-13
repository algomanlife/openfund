/**
 * Free-demo equity-risk sampling (account_equity_risk / account_equity_samples)
 * after the capacity optimizations (DB-backed, no HTTP server):
 *   - both writes happen in one statement with the same values as before
 *   - for an idle account (no open position) a repeated equity in the same
 *     database minute skips the write, and the stored row and samples are
 *     exactly what the unconditional writes would have produced
 *   - any balance change, any open position or a new minute writes again
 *   - the engine loop's narrow sampling writes the same rows as state()
 * Expected values are hand-computed.
 *
 * Run: DATABASE_URL=<isolated test db> node --test test/equity-sampling.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import Decimal from 'decimal.js'
import { randomUUID } from 'node:crypto'
import { Engine } from '../engine.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const D = v => new Decimal(v)

class FakeMarket {
  constructor() { this.prices = new Map() }
  set(symbol, price) { this.prices.set(symbol, String(price)) }
  marketMeta(symbol) { return { symbol, group: 'crypto', base: 'SOL', quote: 'USD', maxLeverage: 100, isOpen: true } }
  mark(symbol) { const p = this.prices.get(symbol); return p == null ? null : { mark: p, at: Date.now(), injected: true } }
  tradeable(symbol) { const m = this.mark(symbol); return m ? { ok: true, meta: this.marketMeta(symbol), mark: m.mark } : { ok: false, reason: 'stale_price' } }
}

const users = []
async function demoUser(engine) {
  const { rows: [u] } = await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id',
    ['0xsample' + randomUUID().replace(/-/g, '').slice(0, 33)])
  users.push(u.id)
  const account = await engine.ensureDemoAccount(u.id)
  return { uid: u.id, accountId: account.id }
}
const riskRow = async id => (await pool.query('SELECT day, day_start_equity, peak_equity, maximum_drawdown, daily_drawdown, last_equity, updated_at FROM account_equity_risk WHERE account_id=$1', [id])).rows[0]
const samples = async id => (await pool.query('SELECT sampled_at, equity, balance FROM account_equity_samples WHERE account_id=$1 ORDER BY sampled_at', [id])).rows
const minuteOf = d => Math.floor(new Date(d).getTime() / 60000)
const values = r => ({ day: String(r.day), start: D(r.day_start_equity).toFixed(2), peak: D(r.peak_equity).toFixed(2), maxdd: D(r.maximum_drawdown).toFixed(2), daydd: D(r.daily_drawdown).toFixed(2), last: D(r.last_equity).toFixed(2) })

test.after(async () => {
  for (const u of users) {
    await pool.query('DELETE FROM account_equity_risk WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM account_equity_samples WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM trading_ledger WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_positions WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_orders WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_events WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM demo_accounts WHERE user_id=$1', [u])
    await pool.query('DELETE FROM openfund_users WHERE id=$1', [u])
  }
  await pool.end()
})

test('idle account: repeated state() reads keep the exact row an unconditional write would keep', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const { uid, accountId } = await demoUser(engine)
  const first = await engine.state(uid)
  const row1 = await riskRow(accountId)
  /* 100,000 virtual USD, no position: every field is the balance or zero */
  assert.deepEqual(values(row1), { day: values(row1).day, start: '100000.00', peak: '100000.00', maxdd: '0.00', daydd: '0.00', last: '100000.00' })
  const outs = []
  for (let i = 0; i < 25; i++) outs.push((await engine.state(uid)).account.risk)
  const row2 = await riskRow(accountId)
  assert.deepEqual(values(row2), values(row1), 'stored risk values unchanged')
  if (minuteOf(row1.updated_at) === minuteOf(Date.now() - 6000)) assert.equal(String(row2.updated_at), String(row1.updated_at), 'repeated no-op writes were skipped')
  for (const r of outs) assert.deepEqual(JSON.parse(JSON.stringify(r)), JSON.parse(JSON.stringify(first.account.risk)), 'state() returns the same risk view')
  const s = await samples(accountId)
  assert.equal(new Set(s.map(x => minuteOf(x.sampled_at))).size, s.length, 'one sample per minute')
  assert.ok(s.length >= 1 && s.length <= 2, 'no sample row lost or added within the minute')
  assert.equal(D(s[0].equity).toFixed(2), '100000.00')
})

test('a balance change on an idle account is written immediately with hand-computed drawdown', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const { uid, accountId } = await demoUser(engine)
  md.set('XSOL/USD', 100)
  await engine.state(uid)
  /* long 1,000 × 5 at 100 (crypto fee 0.05 % of 5,000 = 2.5), close at 90:
     gross 50 × (90 − 100) = −500, close fee 2.5 → balance 100,000 − 2.5 − 502.5 = 99,495 */
  const r = await engine.submitOrder(uid, { market: 'XSOL/USD', side: 'long', order_type: 'market', margin: '1000', leverage: 5 }, 'sample-' + randomUUID())
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200))
  await engine.state(uid)                       /* open position: equity 99,997.5 written */
  md.set('XSOL/USD', 90)
  await engine.state(uid)                       /* open position: equity 99,497.5 written */
  await engine.closePosition(uid, r.position.id)
  const st = await engine.state(uid)            /* idle again, new equity → must write */
  assert.equal(st.account.balance, '99495.00')
  const row = values(await riskRow(accountId))
  assert.equal(row.last, '99495.00')
  assert.equal(row.peak, '100000.00')
  assert.equal(row.maxdd, '505.00', 'peak 100,000 − 99,495')
  assert.equal(row.daydd, '505.00')
  for (let i = 0; i < 10; i++) await engine.state(uid)
  assert.deepEqual(values(await riskRow(accountId)), row)
})

test('accounts with an open position are written on every sample (never skipped)', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const { uid, accountId } = await demoUser(engine)
  md.set('XSOL/USD', 100)
  const r = await engine.submitOrder(uid, { market: 'XSOL/USD', side: 'long', order_type: 'market', margin: '1000', leverage: 5 }, 'sample-' + randomUUID())
  assert.equal(r.ok, true)
  await engine.state(uid)
  const t1 = (await riskRow(accountId)).updated_at
  await new Promise(res => setTimeout(res, 20))
  await engine.state(uid)
  const t2 = (await riskRow(accountId)).updated_at
  assert.ok(new Date(t2) > new Date(t1), 'same equity with an open position is still written')
})

test('engine loop sampling writes the same risk row as state()', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const { uid, accountId } = await demoUser(engine)
  md.set('XSOL/USD', 100)
  const r = await engine.submitOrder(uid, { market: 'XSOL/USD', side: 'long', order_type: 'market', margin: '1000', leverage: 5 }, 'sample-' + randomUUID())
  assert.equal(r.ok, true)
  md.set('XSOL/USD', 104)
  engine.running = true
  await engine.loop()
  engine.running = false
  /* equity = 99,997.5 + 50 × (104 − 100) = 100,197.5 */
  const row = values(await riskRow(accountId))
  assert.equal(row.last, '100197.50')
  assert.equal(row.peak, '100197.50')
  const st = await engine.state(uid)
  assert.equal(st.account.equity, '100197.50')
  assert.deepEqual(values(await riskRow(accountId)), row, 'state() at the same marks leaves the loop row unchanged')
})
