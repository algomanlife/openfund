/**
 * Prop trading engine audit suite (DB-backed, no HTTP server).
 *
 * Drives the real Engine against an isolated PostgreSQL database with a
 * deterministic in-memory market feed. Every expected value is computed by
 * hand (or by the independent oracle below) from the documented simulation
 * policy, never by calling the production calculation functions.
 *
 * Policy constants used by the hand calculations (trading-math.js):
 *   XSOL/USD, XAVAX/USD (crypto, non BTC/ETH): fee 0.05% per side, spread 0%
 *   XBTC/USD (base BTC): fee 0.035% per side, spread 0.005%
 *
 * Run: DATABASE_URL=<isolated test db> node --test test/engine-audit.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import Decimal from 'decimal.js'
import { randomUUID } from 'node:crypto'
import { Engine } from '../engine.js'
import { ChallengeService } from '../evaluation.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const D = v => new Decimal(v)

/** Deterministic market feed implementing the MarketData surface the engine uses. */
class FakeMarket {
  constructor() {
    this.prices = new Map()
    this.meta = new Map([
      ['XSOL/USD', { symbol: 'XSOL/USD', group: 'crypto', base: 'SOL', quote: 'USD', maxLeverage: 100, isOpen: true }],
      ['XAVAX/USD', { symbol: 'XAVAX/USD', group: 'crypto', base: 'AVAX', quote: 'USD', maxLeverage: 100, isOpen: true }],
      ['XBTC/USD', { symbol: 'XBTC/USD', group: 'crypto', base: 'BTC', quote: 'USD', maxLeverage: 100, isOpen: true }],
    ])
  }
  set(symbol, price) { this.prices.set(symbol, String(price)) }
  setOpen(symbol, open) { this.meta.get(symbol).isOpen = open }
  marketMeta(symbol) { return this.meta.get(symbol) || null }
  mark(symbol) {
    const p = this.prices.get(symbol)
    return p == null ? null : { mark: p, at: Date.now(), injected: true }
  }
  tradeable(symbol) {
    const meta = this.meta.get(symbol)
    if (!meta) return { ok: false, reason: 'unknown_market' }
    if (meta.isOpen === false) return { ok: false, reason: 'market_closed' }
    const m = this.mark(symbol)
    if (!m) return { ok: false, reason: 'stale_price' }
    return { ok: true, meta, mark: m.mark }
  }
}

/* ---------- fixtures ---------- */
const created = { users: [], plans: [] }

async function makeUser() {
  const { rows: [u] } = await pool.query(
    'INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id',
    ['0xaudit' + randomUUID().replace(/-/g, '').slice(0, 34)])
  created.users.push(u.id)
  return u.id
}

async function makeChallengeAccount(userId, cfg = {}, size = 5000) {
  const configuration = {
    accountSizesUsd: [size], phases: 1, phase1TargetPct: 10, phase2TargetPct: null,
    dailyLossPct: 50, maxTotalLossPct: 50, drawdownMode: 'static',
    minTradingDays: 0, referenceLeverageX: 10, timeLimitDays: null, ...cfg,
  }
  const slug = 'engine-audit-' + randomUUID().slice(0, 12)
  const { rows: [plan] } = await pool.query(
    'INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) RETURNING id',
    [slug, 'Engine audit ' + slug, JSON.stringify(configuration)])
  created.plans.push(plan.id)
  const { rows: [ch] } = await pool.query(
    `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd)
     VALUES ($1,$2,'created',$3) RETURNING *`, [userId, plan.id, size])
  const svc = new ChallengeService(pool)
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    await svc.provisionTx(c, { ...ch, plan_configuration: configuration })
    await svc.startTx(c, ch)
    await c.query('COMMIT')
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
  const row = (await pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [ch.id])).rows[0]
  return { challengeId: ch.id, accountId: row.demo_account_id }
}

const challengeRow = id => pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [id]).then(r => r.rows[0])
const accountRow = id => pool.query('SELECT * FROM demo_accounts WHERE id=$1', [id]).then(r => r.rows[0])
const openPositions = id => pool.query("SELECT * FROM trading_positions WHERE account_id=$1 AND status='open' ORDER BY opened_at", [id]).then(r => r.rows)

const open = (engine, userId, accountId, body) =>
  engine.submitOrder(userId, { order_type: 'market', ...body }, randomUUID(), accountId)

/** Reconciliation invariants checked independently of the engine. */
async function assertReconciled(accountId, funding) {
  const acc = await accountRow(accountId)
  const ledger = (await pool.query('SELECT coalesce(sum(amount),0) AS s FROM trading_ledger WHERE account_id=$1', [accountId])).rows[0].s
  assert.equal(D(acc.balance).toFixed(8), D(ledger).toFixed(8), 'balance equals the sum of ledger amounts')
  const pos = (await pool.query('SELECT * FROM trading_positions WHERE account_id=$1', [accountId])).rows
  const openMargin = pos.filter(p => p.status === 'open').reduce((s, p) => s.plus(p.margin), D(0))
  assert.equal(D(acc.used_margin).toFixed(8), openMargin.toFixed(8), 'used margin equals open-position margin')
  const closedNet = pos.filter(p => p.status !== 'open').reduce((s, p) => s.plus(p.realized_pnl), D(0))
  const fees = pos.reduce((s, p) => s.plus(p.open_fee), D(0))
  assert.equal(D(acc.balance).toFixed(8), D(funding).plus(closedNet).minus(fees).toFixed(8),
    'balance = funding + closed settlements - opening fees')
  for (const p of pos) assert.ok(D(p.quantity).gt(0), 'no position has a non-positive quantity')
}

test.after(async () => {
  for (const u of created.users) {
    await pool.query('DELETE FROM position_close_requests WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM trading_ledger WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_positions WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_orders WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_events WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM challenge_equity_days WHERE challenge_id IN (SELECT id FROM openfund_challenges WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM challenge_trailing WHERE challenge_id IN (SELECT id FROM openfund_challenges WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM challenge_events WHERE challenge_id IN (SELECT id FROM openfund_challenges WHERE user_id=$1)', [u])
    await pool.query('UPDATE openfund_challenges SET demo_account_id=NULL WHERE user_id=$1', [u])
    await pool.query('DELETE FROM account_equity_risk WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u]).catch(() => {})
    await pool.query('DELETE FROM account_equity_samples WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u]).catch(() => {})
    await pool.query('DELETE FROM demo_accounts WHERE user_id=$1', [u])
    await pool.query('DELETE FROM openfund_challenges WHERE user_id=$1', [u])
    await pool.query('DELETE FROM openfund_users WHERE id=$1', [u])
  }
  for (const p of created.plans) await pool.query('DELETE FROM challenge_plans WHERE id=$1', [p])
  await pool.end()
})

/* =================================================================
 * Position accounting — hand-computed LONG/SHORT, fees, spread
 * ================================================================= */

test('long open/close: balance, used margin, equity and realized PnL match hand values', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 90 })
  md.set('XSOL/USD', 100)
  const r = await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  assert.equal(r.ok, true)
  /* notional 5000, qty 5000/100 = 50, open fee 5000 × 0.05% = 2.5 */
  let acc = await accountRow(accountId)
  assert.equal(D(acc.balance).toFixed(4), '4997.5000')
  assert.equal(D(acc.used_margin).toFixed(4), '1000.0000')
  const [p] = await openPositions(accountId)
  assert.equal(D(p.quantity).toFixed(4), '50.0000')
  md.set('XSOL/USD', 110)
  const st = await engine.state(uid, accountId)
  /* equity = 4997.5 + 50 × (110 − 100) = 5497.5; free = 5497.5 − 1000 */
  assert.equal(st.account.equity, '5497.50')
  assert.equal(st.account.unrealized_pnl, '500.00')
  assert.equal(st.account.free_margin, '4497.50')
  await engine.closePosition(uid, p.id)
  acc = await accountRow(accountId)
  /* close net = 500 − 2.5 = 497.5 → balance 5495, margin released */
  assert.equal(D(acc.balance).toFixed(4), '5495.0000')
  assert.equal(D(acc.used_margin).toFixed(4), '0.0000')
  assert.equal(D(acc.realized_pnl).toFixed(4), '497.5000')
  await assertReconciled(accountId, 5000)
})

test('short with spread (BTC): entry/exit spread and losing close match hand values', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 90 })
  md.set('XBTC/USD', 50000)
  await open(engine, uid, accountId, { market: 'XBTC/USD', side: 'short', margin: '1000', leverage: 2 })
  const [p] = await openPositions(accountId)
  /* short opens selling below mark: 50000 × (1 − 0.00005) = 49997.5
     qty = 2000 / 49997.5 = 0.0400020001 (10 dp, round down); fee 2000 × 0.035% = 0.7 */
  assert.equal(D(p.entry_price).toFixed(4), '49997.5000')
  assert.equal(D(p.quantity).toFixed(10), '0.0400020001')
  assert.equal(D(p.open_fee).toFixed(4), '0.7000')
  md.set('XBTC/USD', 51000)
  await engine.closePosition(uid, p.id)
  const closed = (await pool.query('SELECT * FROM trading_positions WHERE id=$1', [p.id])).rows[0]
  /* short closes buying above mark: 51000 × 1.00005 = 51002.55
     gross = 0.0400020001 × (49997.5 − 51002.55) × 1 = −40.2040101... ; net = gross − 0.7 */
  const gross = D('0.0400020001').times(D('49997.5').minus('51002.55'))
  assert.equal(D(closed.exit_price).toFixed(4), '51002.5500')
  assert.equal(D(closed.realized_pnl).toFixed(8), gross.minus('0.7').toFixed(8))
  assert.equal(closed.exit_reason, 'manual')
  await assertReconciled(accountId, 5000)
})

test('partial close realizes only the closed slice and preserves cost basis', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 90 })
  md.set('XSOL/USD', 100)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  const [p] = await openPositions(accountId)
  md.set('XSOL/USD', 104)
  const key = randomUUID()
  await engine.closePosition(uid, p.id, { fraction: '0.25', idempotencyKey: key })
  const again = await engine.closePosition(uid, p.id, { fraction: '0.25', idempotencyKey: key })
  assert.equal(again.duplicate, true, 'replayed partial close is idempotent')
  const rest = (await pool.query('SELECT * FROM trading_positions WHERE id=$1', [p.id])).rows[0]
  const slice = (await pool.query('SELECT * FROM trading_positions WHERE parent_position_id=$1', [p.id])).rows
  assert.equal(slice.length, 1, 'exactly one closed slice')
  /* slice: qty 12.5, margin 250, open fee 0.625; close fee 250×5×0.05% = 0.625
     gross 12.5 × 4 = 50 → net 49.375; remaining qty 37.5, margin 750, entry 100 */
  assert.equal(D(slice[0].quantity).toFixed(4), '12.5000')
  assert.equal(D(slice[0].realized_pnl).toFixed(4), '49.3750')
  assert.equal(D(rest.quantity).toFixed(4), '37.5000')
  assert.equal(D(rest.margin).toFixed(4), '750.0000')
  assert.equal(D(rest.entry_price).toFixed(4), '100.0000')
  assert.equal(D(rest.open_fee).toFixed(4), '1.8750')
  const acc = await accountRow(accountId)
  assert.equal(D(acc.balance).toFixed(4), '5046.8750') /* 4997.5 + 49.375 */
  assert.equal(D(acc.used_margin).toFixed(4), '750.0000')
  await assertReconciled(accountId, 5000)
})

test('concurrent duplicate closes realize PnL exactly once', async () => {
  const md = new FakeMarket(); const a = new Engine(pool, md); const b = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 90 })
  md.set('XSOL/USD', 100)
  await open(a, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  const [p] = await openPositions(accountId)
  md.set('XSOL/USD', 101)
  await Promise.allSettled([1, 2, 3, 4, 5, 6].map(i => (i % 2 ? a : b).closePosition(uid, p.id)))
  const ledger = (await pool.query("SELECT count(*)::int AS n FROM trading_ledger WHERE position_id=$1 AND event='close'", [p.id])).rows[0].n
  assert.equal(ledger, 1, 'one close ledger row')
  await assertReconciled(accountId, 5000)
})

test('concurrent orders from two engine instances cannot over-spend margin', async () => {
  const md = new FakeMarket(); const a = new Engine(pool, md); const b = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 90 })
  md.set('XSOL/USD', 100)
  const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
    open(i % 2 ? a : b, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })))
  /* each fill needs 1000 margin + 2.5 fee; after 4 fills free = 4990 − 4000 = 990 */
  const filled = results.filter(r => r.status === 'fulfilled' && r.value.ok && !r.value.pending).length
  assert.equal(filled, 4)
  assert.equal((await openPositions(accountId)).length, 4)
  await assertReconciled(accountId, 5000)
})

test('duplicate idempotency key creates one order; conflicting payload is rejected', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 90 })
  md.set('XSOL/USD', 100)
  const key = randomUUID()
  const body = { market: 'XSOL/USD', side: 'long', margin: '100', leverage: 2, order_type: 'market' }
  const rs = await Promise.allSettled([1, 2, 3].map(() => engine.submitOrder(uid, body, key, accountId)))
  assert.ok(rs.every(r => r.status === 'fulfilled'))
  assert.equal((await openPositions(accountId)).length, 1)
  await assert.rejects(engine.submitOrder(uid, { ...body, margin: '200' }, key, accountId), /idempotency_conflict/)
})

test('invalid orders are rejected without changing balances', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 90 })
  md.set('XSOL/USD', 100)
  const base = { market: 'XSOL/USD', side: 'long', margin: '100', leverage: 2 }
  await assert.rejects(open(engine, uid, accountId, { ...base, margin: '0' }), /invalid_numeric_input/)
  await assert.rejects(open(engine, uid, accountId, { ...base, leverage: 2.5 }), /invalid_numeric_input/)
  assert.equal((await open(engine, uid, accountId, { ...base, leverage: 11 })).reason, 'leverage_exceeded')
  assert.equal((await open(engine, uid, accountId, { ...base, margin: '6000' })).reason, 'insufficient_margin')
  assert.equal((await open(engine, uid, accountId, { ...base, sl: '101' })).reason, 'sl_above_mark')
  assert.equal((await open(engine, uid, accountId, { ...base, market: 'NOPE/USD' })).reason, 'unknown_market')
  md.prices.delete('XSOL/USD')
  assert.equal((await open(engine, uid, accountId, base)).reason, 'stale_price')
  const acc = await accountRow(accountId)
  assert.equal(D(acc.balance).toFixed(4), '5000.0000')
  assert.equal(D(acc.used_margin).toFixed(4), '0.0000')
})

/* =================================================================
 * Challenge evaluation defects (regressions)
 * ================================================================= */

test('profit target is not passed while settlement would realize the target away', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  /* target 10% of 5000 = 500 */
  const { challengeId, accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 10 })
  md.set('XSOL/USD', 100); md.set('XAVAX/USD', 10)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })   // fee 2.5, qty 50
  await open(engine, uid, accountId, { market: 'XAVAX/USD', side: 'long', margin: '1000', leverage: 5 })  // fee 2.5, qty 500
  const [sol] = (await openPositions(accountId)).filter(p => p.market === 'XSOL/USD')
  md.set('XSOL/USD', 111); md.set('XAVAX/USD', 9.6)
  /* closing SOL: net 550 − 2.5 = 547.5 → balance 5542.5, closed profit 542.5 ≥ 500,
     but the open AVAX loss would settle at −200 − 2.5 → final balance 5340 (< 5500) */
  await engine.closePosition(uid, sol.id)
  let ch = await challengeRow(challengeId)
  assert.equal(ch.status, 'started', 'challenge must not pass while settlement would end below target')
  assert.equal((await openPositions(accountId)).length, 1)
  /* AVAX recovers to 10.2: settlement 5542.5 + 100 − 2.5 = 5640 ≥ 5500 → pass */
  md.set('XAVAX/USD', 10.2)
  assert.equal(await engine.enforceChallengeRisk(accountId), 'passed')
  ch = await challengeRow(challengeId)
  assert.equal(ch.status, 'passed')
  const acc = await accountRow(accountId)
  assert.equal(D(acc.balance).toFixed(4), '5640.0000')
  assert.ok(D(acc.balance).minus(5000).gte(500), 'final closed profit meets the target')
  await assertReconciled(accountId, 5000)
})

test('post-fill evaluation includes the opening fee (fee-caused breach fails immediately)', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  /* daily 0.04% of 5000 → threshold 4998; opening fee 2.5 → equity 4997.5 */
  const { challengeId, accountId } = await makeChallengeAccount(uid, { dailyLossPct: 0.04 })
  md.set('XSOL/USD', 100)
  const r = await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  assert.equal(r.ok, true)
  const ch = await challengeRow(challengeId)
  assert.equal(ch.status, 'failed', 'breach is detected inside the order transaction')
  assert.equal(r.challenge_transition, 'failed')
  const ev = (await pool.query("SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='violation'", [challengeId])).rows
  assert.equal(ev.length, 1)
  assert.equal(ev[0].detail.violations[0].rule, 'daily_loss_breach')
  assert.equal(ev[0].detail.violations[0].detail.equity, '4997.50')
  assert.equal((await openPositions(accountId)).length, 0, 'breach settlement closed the new position')
  await assertReconciled(accountId, 5000)
})

test('minimum trading days count fill days, not order creation days', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  engine.running = true
  const uid = await makeUser()
  const { challengeId, accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 1, minTradingDays: 2 })
  md.set('XSOL/USD', 100)
  const lim = await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '500', leverage: 5, order_type: 'limit', target_price: '95' })
  assert.equal(lim.pending, true)
  /* the limit order was created two days ago and fills today */
  await pool.query("UPDATE trading_orders SET created_at = now() - interval '2 days' WHERE id=$1", [lim.order.id])
  md.set('XSOL/USD', 94)
  await engine.loop()
  assert.equal((await openPositions(accountId)).length, 1, 'limit order filled')
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '10', leverage: 1 })
  md.set('XSOL/USD', 120)
  const p = (await openPositions(accountId)).find(x => D(x.margin).eq(500))
  await engine.closePosition(uid, p.id)
  /* both fills happened today: one distinct fill day → minTradingDays (2) not met → no pass */
  const ch = await challengeRow(challengeId)
  assert.equal(ch.status, 'started')
})

test('breach with an untradeable market records the failure and settles the orphan later', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  engine.running = true
  const uid = await makeUser()
  /* maxTotal 5% of 5000 → floor 4750 */
  const { challengeId, accountId } = await makeChallengeAccount(uid, { maxTotalLossPct: 5 })
  md.set('XSOL/USD', 100)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  md.set('XSOL/USD', 94)          /* equity 4997.5 − 300 = 4697.5 ≤ 4750 */
  md.setOpen('XSOL/USD', false)   /* fresh mark, market closed */
  assert.equal(await engine.enforceChallengeRisk(accountId), 'failed')
  assert.equal((await challengeRow(challengeId)).status, 'failed')
  assert.equal((await openPositions(accountId)).length, 1, 'cannot settle while the market is closed')
  await assert.rejects(open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '10', leverage: 1 }), /challenge_failed/)
  md.setOpen('XSOL/USD', true)
  md.set('XSOL/USD', 93)
  await engine.loop()
  const pos = (await pool.query('SELECT * FROM trading_positions WHERE account_id=$1', [accountId])).rows
  assert.equal(pos.filter(p => p.status === 'open').length, 0)
  assert.equal(pos[0].exit_reason, 'challenge_settlement')
  /* gross 50 × (93 − 100) = −350, net −352.5 → balance 4997.5 − 352.5 = 4645 */
  assert.equal(D((await accountRow(accountId)).balance).toFixed(4), '4645.0000')
  await assertReconciled(accountId, 5000)
})

test('state risk view reports the enforced daily limit (day basis × pct)', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { challengeId, accountId } = await makeChallengeAccount(uid, { dailyLossPct: 5 })
  md.set('XSOL/USD', 100)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '100', leverage: 1 })
  /* simulate a day that opened at a higher basis than the starting size */
  await pool.query('UPDATE challenge_equity_days SET basis=6000 WHERE challenge_id=$1', [challengeId])
  const st = await engine.state(uid, accountId)
  assert.equal(st.account.risk.day_basis, '6000.00')
  assert.equal(st.account.risk.daily_limit, '300.00')       /* 6000 × 5% */
  assert.equal(st.account.risk.daily_threshold, '5700.00')
})

/* =================================================================
 * Randomized reconciliation (seeded, deterministic)
 * ================================================================= */

test('randomized open/partial/close sequences keep the books reconciled', async () => {
  let seed = 20261108
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 900, dailyLossPct: 99, maxTotalLossPct: 99 }, 100000)
  const markets = ['XSOL/USD', 'XAVAX/USD', 'XBTC/USD']
  const px = { 'XSOL/USD': 100, 'XAVAX/USD': 10, 'XBTC/USD': 50000 }
  for (const m of markets) md.set(m, px[m])
  for (let step = 0; step < 60; step++) {
    const m = markets[Math.floor(rnd() * 3)]
    px[m] = +(px[m] * (1 + (rnd() - 0.5) * 0.02)).toFixed(6)
    md.set(m, px[m])
    const op = rnd()
    const positions = await openPositions(accountId)
    if (op < 0.45 || !positions.length) {
      await open(engine, uid, accountId, { market: m, side: rnd() < 0.5 ? 'long' : 'short', margin: (50 + Math.floor(rnd() * 2000)).toString(), leverage: 1 + Math.floor(rnd() * 10) })
    } else {
      const p = positions[Math.floor(rnd() * positions.length)]
      const fraction = op < 0.75 ? '1' : (0.1 + rnd() * 0.8).toFixed(4)
      await engine.closePosition(uid, p.id, { fraction, idempotencyKey: randomUUID() }).catch(e => {
        if (e.message !== 'partial_close_too_small') throw e
      })
    }
    await assertReconciled(accountId, 100000)
    /* equity oracle: balance + Σ qty × (mark − entry) × direction */
    const acc = await accountRow(accountId)
    const expected = (await openPositions(accountId)).reduce((s, p) =>
      s.plus(D(p.quantity).times(D(px[p.market]).minus(p.entry_price)).times(p.side === 'long' ? 1 : -1)), D(acc.balance))
    const st = await engine.state(uid, accountId)
    assert.equal(st.account.equity, expected.toFixed(2), `equity reconciles at step ${step}`)
  }
})

/* =================================================================
 * Risk boundaries through real positions, SL/TP, daily reset
 * ================================================================= */

test('static maximum floor through an open position: 1 cent above holds, exactly at fails', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  /* floor 4500; equity = 4997.5 + 50 × (m − 100) → m = 90.05 is exactly 4500 */
  const { challengeId, accountId } = await makeChallengeAccount(uid, { maxTotalLossPct: 10, dailyLossPct: 50 })
  md.set('XSOL/USD', 100)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  md.set('XSOL/USD', '90.0502')   /* equity 4500.01 */
  assert.equal(await engine.enforceChallengeRisk(accountId), null)
  assert.equal((await challengeRow(challengeId)).status, 'started', 'floating loss alone, above floor')
  md.set('XSOL/USD', '90.05')     /* equity exactly 4500.00 */
  assert.equal(await engine.enforceChallengeRisk(accountId), 'failed', 'floating loss breaches without closing')
  const ev = (await pool.query("SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='violation'", [challengeId])).rows[0]
  assert.equal(ev.detail.violations[0].rule, 'maximum_loss_breach')
  assert.equal(ev.detail.violations[0].detail.equity, '4500.00')
  /* repeated evaluation after the terminal transition is a no-op */
  assert.equal(await engine.enforceChallengeRisk(accountId), null)
  assert.equal((await pool.query("SELECT count(*)::int n FROM challenge_events WHERE challenge_id=$1 AND kind='violation'", [challengeId])).rows[0].n, 1)
  await assertReconciled(accountId, 5000)
})

test('aggregated losses across positions breach the daily floor', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  /* daily 5% of 5000 → floor 4750 */
  const { challengeId, accountId } = await makeChallengeAccount(uid, { dailyLossPct: 5 })
  md.set('XSOL/USD', 100); md.set('XAVAX/USD', 10)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  await open(engine, uid, accountId, { market: 'XAVAX/USD', side: 'short', margin: '1000', leverage: 5 })
  /* balance 4995; SOL −120 (50 × −2.4), AVAX −125 (500 × −0.25) → 4750 exactly */
  md.set('XSOL/USD', '97.6'); md.set('XAVAX/USD', '10.25')
  assert.equal(await engine.enforceChallengeRisk(accountId), 'failed')
  const ev = (await pool.query("SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='violation'", [challengeId])).rows[0]
  assert.equal(ev.detail.violations[0].rule, 'daily_loss_breach')
  assert.equal((await openPositions(accountId)).length, 0)
  await assertReconciled(accountId, 5000)
})

test('daily reset: the new day basis carries the prior day closing equity of overnight positions', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { challengeId, accountId } = await makeChallengeAccount(uid, { dailyLossPct: 5 })
  md.set('XSOL/USD', 100)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  /* yesterday closed with equity 5400 (floating profit); today has no row yet */
  await pool.query('DELETE FROM challenge_equity_days WHERE challenge_id=$1', [challengeId])
  await pool.query(`INSERT INTO challenge_equity_days (challenge_id, day, day_start_balance, day_start_equity, basis, peak_equity, last_equity)
    VALUES ($1, (now() AT TIME ZONE 'UTC' + interval '3 hours')::date - 1, 4997.5, 4997.5, 4997.5, 5400, 5400)`, [challengeId])
  /* basis today = max(balance 4997.5, opening equity 5400) = 5400 → floor 5130.
     At 102.65: equity = 4997.5 + 132.5 = 5130 → breach although above the starting size */
  md.set('XSOL/USD', '102.66')
  assert.equal(await engine.enforceChallengeRisk(accountId), null)
  const today = (await pool.query('SELECT * FROM challenge_equity_days WHERE challenge_id=$1 ORDER BY day DESC LIMIT 1', [challengeId])).rows[0]
  assert.equal(Number(today.basis), 5400)
  md.set('XSOL/USD', '102.65')
  assert.equal(await engine.enforceChallengeRisk(accountId), 'failed')
})

test('SL/TP execute server-side for long and short, including price gaps', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  engine.running = true
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { phase1TargetPct: 90 })
  md.set('XSOL/USD', 100); md.set('XAVAX/USD', 10)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5, sl: '95', tp: '110' })
  await open(engine, uid, accountId, { market: 'XAVAX/USD', side: 'short', margin: '1000', leverage: 5, sl: '10.5', tp: '9.5' })
  md.set('XSOL/USD', '96'); md.set('XAVAX/USD', '9.6')
  await engine.loop()
  assert.equal((await openPositions(accountId)).length, 2, 'no trigger before the level')
  /* SOL gaps through the stop to 90; AVAX trades through TP to 9.4 */
  md.set('XSOL/USD', '90'); md.set('XAVAX/USD', '9.4')
  await engine.loop()
  await engine.loop()   /* a second pass must not execute anything twice */
  const rows = (await pool.query('SELECT * FROM trading_positions WHERE account_id=$1 ORDER BY market', [accountId])).rows
  const avax = rows.find(p => p.market === 'XAVAX/USD'), sol = rows.find(p => p.market === 'XSOL/USD')
  assert.equal(sol.exit_reason, 'sl'); assert.equal(D(sol.exit_price).toFixed(2), '90.00', 'gap fills at the mark, not the stop')
  assert.equal(D(sol.realized_pnl).toFixed(4), '-502.5000')   /* 50 × −10 − 2.5 */
  assert.equal(avax.exit_reason, 'tp'); assert.equal(D(avax.realized_pnl).toFixed(4), '297.5000') /* 500 × 0.6 − 2.5 */
  assert.equal((await pool.query("SELECT count(*)::int n FROM trading_ledger WHERE account_id=$1 AND event='close'", [accountId])).rows[0].n, 2)
  await assertReconciled(accountId, 5000)
})

test('after a breach: no new orders, pending orders cancelled, closes are idempotent', async () => {
  const md = new FakeMarket(); const engine = new Engine(pool, md)
  const uid = await makeUser()
  const { accountId } = await makeChallengeAccount(uid, { maxTotalLossPct: 5 })
  md.set('XSOL/USD', 100)
  await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '1000', leverage: 5 })
  const pend = await open(engine, uid, accountId, { market: 'XSOL/USD', side: 'long', margin: '10', leverage: 1, order_type: 'limit', target_price: '50' })
  const [p] = await openPositions(accountId)
  md.set('XSOL/USD', 94)
  assert.equal(await engine.enforceChallengeRisk(accountId), 'failed')
  const o = (await pool.query('SELECT * FROM trading_orders WHERE id=$1', [pend.order.id])).rows[0]
  assert.equal(o.status, 'cancelled'); assert.equal(o.reject_reason, 'challenge_failed')
  await assert.rejects(open(engine, uid, accountId, { market: 'XSOL/USD', side: 'short', margin: '10', leverage: 1 }), /challenge_failed/)
  const again = await engine.closePosition(uid, p.id)
  assert.equal(again.duplicate, true)
  await assertReconciled(accountId, 5000)
})
