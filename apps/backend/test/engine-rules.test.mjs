/**
 * Pure (no database) boundary tests for the challenge rule evaluator and the
 * simulation valuation primitives. Expected values are hand-computed
 * constants; the production functions are never used as their own oracle.
 *
 * Run: node --test test/engine-rules.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRules, normalizeRules, challengeDay } from '../evaluation.js'
import { pnl, withSpread, feePct, freshMark, positionMetrics, accountMetrics } from '../trading-math.js'

const rules = (cfg = {}) => normalizeRules({ phases: 1, phase1TargetPct: 10, dailyLossPct: 5, maxTotalLossPct: 10, minTradingDays: 0, ...cfg })
const ev = (r, o) => evaluateRules({ rules: r, startingBalance: '100000', balance: '100000', dayBasis: '100000', tradingDays: 0, ...o })
const ruleNames = e => e.violations.map(v => v.rule).sort()

test('daily loss boundary: above / exactly at / below the 95,000 floor', () => {
  const r = rules({ maxTotalLossPct: 50 })
  assert.equal(ev(r, { equity: '95000.01' }).status, 'none')
  assert.deepEqual(ruleNames(ev(r, { equity: '95000' })), ['daily_loss_breach'], 'touching the floor is a breach')
  assert.deepEqual(ruleNames(ev(r, { equity: '94999.99' })), ['daily_loss_breach'])
  assert.equal(ev(r, { equity: '95000' }).metrics.daily.threshold, '95000.00')
})

test('daily loss is a share of the day basis, not of the starting size', () => {
  const r = rules({ maxTotalLossPct: 50, phase1TargetPct: 90 })
  /* basis 120,000 → limit 6,000 → floor 114,000 */
  const e = ev(r, { dayBasis: '120000', balance: '120000', equity: '114000' })
  assert.equal(e.metrics.daily.limit, '6000.00')
  assert.deepEqual(ruleNames(e), ['daily_loss_breach'])
  assert.equal(ev(r, { dayBasis: '120000', balance: '120000', equity: '114000.01' }).status, 'none')
})

test('static maximum loss boundary: above / exactly at / below the 90,000 floor', () => {
  const r = rules({ dailyLossPct: 99 })
  assert.equal(ev(r, { equity: '90000.01' }).status, 'none')
  assert.deepEqual(ruleNames(ev(r, { equity: '90000' })), ['maximum_loss_breach'])
  assert.deepEqual(ruleNames(ev(r, { equity: '89999.99' })), ['maximum_loss_breach'])
})

test('both limits breached simultaneously are both recorded; status fail', () => {
  const e = ev(rules(), { equity: '89000' })
  assert.equal(e.status, 'fail')
  assert.deepEqual(ruleNames(e), ['daily_loss_breach', 'maximum_loss_breach'])
})

test('profit target: exact, exceeded, floating-only, settlement and rule interactions', () => {
  const r = rules()
  assert.equal(ev(r, { balance: '110000', equity: '110000' }).status, 'pass', 'exactly 10% closed profit passes')
  assert.equal(ev(r, { balance: '110000.01', equity: '110000.01' }).status, 'pass')
  assert.equal(ev(r, { balance: '109999.99', equity: '109999.99' }).status, 'none')
  assert.equal(ev(r, { balance: '100000', equity: '115000', settlementBalance: '114900' }).status, 'none', 'floating profit does not count')
  assert.equal(ev(r, { balance: '111000', equity: '110500', settlementBalance: '109990' }).status, 'none', 'settlement would end below target')
  assert.equal(ev(r, { balance: '111000', equity: '110500', settlementBalance: '110000' }).status, 'pass')
  assert.equal(ev(r, { balance: '111000', equity: '111000', settlementBalance: null }).status, 'none', 'unsettleable positions defer the pass')
  /* target reached but daily basis 120,000 → floor 114,000 breached */
  const v = ev(r, { balance: '111000', equity: '111000', dayBasis: '120000' })
  assert.equal(v.status, 'fail', 'a violation overrides the target')
  assert.equal(ev(rules({ minTradingDays: 3 }), { balance: '111000', equity: '111000', tradingDays: 2 }).status, 'none')
  assert.equal(ev(rules({ minTradingDays: 3 }), { balance: '111000', equity: '111000', tradingDays: 3 }).status, 'pass')
})

test('stage 2 uses the phase-2 target; Instant (phases 0) never passes', () => {
  const two = rules({ phases: 2, phase1TargetPct: 8, phase2TargetPct: 5 })
  assert.equal(ev(two, { stage: 2, balance: '105000', equity: '105000' }).status, 'pass')
  assert.equal(ev(two, { stage: 1, balance: '105000', equity: '105000' }).status, 'none')
  const instant = rules({ phases: 0, phase1TargetPct: null, drawdownMode: 'trailing', maxTotalLossPct: 5, dailyLossPct: 3 })
  assert.equal(ev(instant, { balance: '150000', equity: '150000', dayBasis: '150000', trailing: { peakEquity: '150000' } }).status, 'none')
})

test('trailing drawdown floor (5%, breakeven lock at +5%) never decreases', () => {
  const r = rules({ phases: 0, drawdownMode: 'trailing', maxTotalLossPct: 5, trailingLockAtProfitPct: 5, dailyLossPct: 99 })
  const floor = peak => ev(r, { equity: '200000', dayBasis: '200000', trailing: { peakEquity: peak } }).metrics.trailing.floor
  assert.equal(floor('100000'), '95000.00')
  assert.equal(floor('99000'), '95000.00', 'a peak below start never lowers the floor')
  assert.equal(floor('103000'), '98000.00')
  assert.equal(floor('105000'), '100000.00')
  /* Current implementation keeps trailing above breakeven (floor = peak − 5%·start).
     Whether "locks at breakeven" should freeze the floor at 100,000 is an
     open product decision recorded in the engine audit; this pins today's behavior. */
  assert.equal(floor('108000'), '103000.00')
  assert.deepEqual(ruleNames(ev(r, { equity: '98000', dayBasis: '200000', trailing: { peakEquity: '103000' } })), ['trailing_loss_breach'])
  assert.equal(ev(r, { equity: '98000.01', dayBasis: '200000', trailing: { peakEquity: '103000' } }).status, 'none')
})

test('expiry, stale valuation and non-evaluable plans', () => {
  const r = rules()
  const past = new Date(Date.now() - 1000).toISOString()
  assert.deepEqual(ruleNames(ev(r, { equity: '100000', expiresAt: past })), ['time_limit'])
  assert.equal(ev(r, { balance: '111000', equity: '111000', expiresAt: past }).status, 'fail', 'expiry blocks a pass')
  assert.equal(ev(r, { equity: null }).status, 'deferred', 'stale marks never settle')
  assert.equal(ev(normalizeRules({ phases: 1, phase1TargetPct: 10, dailyLossPct: 0, maxTotalLossPct: 10 }), { equity: '1' }).status, 'none')
  assert.equal(normalizeRules({ maxDailyLossPct: 4, maxTotalLossPct: 10 }).dailyLossPct, 4, 'legacy key accepted')
  assert.equal(normalizeRules({ dailyLossPct: 3, maxDailyLossPct: 4, maxTotalLossPct: 10 }).dailyLossPct, 3, 'canonical key wins')
})

test('day boundary is 00:00 UTC+3 with no DST', () => {
  assert.equal(challengeDay(Date.parse('2026-11-07T20:59:59.999Z')), '2026-11-07')
  assert.equal(challengeDay(Date.parse('2026-11-07T21:00:00.000Z')), '2026-11-08')
  assert.equal(challengeDay(Date.parse('2026-03-29T21:00:00.000Z')), '2026-03-30', 'European DST change has no effect')
})

/* ---------- valuation primitives ---------- */
const md = (price, at = Date.now(), meta = { group: 'crypto', base: 'SOL' }) => ({
  mark: () => (price == null ? null : { mark: String(price), at }),
  marketMeta: () => meta,
})

test('linear PnL for long and short, including zero and fractional moves', () => {
  assert.equal(pnl('50', '100', '110', 'long').toString(), '500')
  assert.equal(pnl('50', '100', '110', 'short').toString(), '-500')
  assert.equal(pnl('50', '100', '100', 'long').toString(), '0')
  assert.equal(pnl('0.0000000001', '100', '100.0000000001', 'long').toString(), '1e-20')
  assert.equal(pnl('3', '0.1', '0.3', 'long').toString(), '0.6', 'decimal arithmetic avoids 0.6000000000000001')
})

test('spread and fee tiers match the documented policy', () => {
  assert.equal(withSpread('50000', 'long', 'open', { group: 'crypto', base: 'BTC' }, 'BTC/USD').toString(), '50002.5')
  assert.equal(withSpread('50000', 'long', 'close', { group: 'crypto', base: 'BTC' }, 'BTC/USD').toString(), '49997.5')
  assert.equal(withSpread('50000', 'short', 'open', { group: 'crypto', base: 'BTC' }, 'BTC/USD').toString(), '49997.5')
  assert.equal(withSpread('50000', 'short', 'close', { group: 'crypto', base: 'BTC' }, 'BTC/USD').toString(), '50002.5')
  assert.equal(feePct({ group: 'crypto', base: 'ETH' }), '0.035')
  assert.equal(feePct({ group: 'crypto', base: 'SOL' }), '0.05')
  assert.equal(feePct({ group: 'forex', base: 'EUR' }), '0.012')
  assert.equal(feePct({ group: 'stocks', base: 'AAPL' }), '0.06')
})

test('fresh-mark policy rejects stale, future, zero and negative marks', () => {
  assert.ok(freshMark(md(100), 'X'))
  assert.equal(freshMark(md(100, Date.now() - 5001), 'X'), null, 'older than 5 s')
  assert.equal(freshMark(md(100, Date.now() + 5000), 'X'), null, 'future timestamp')
  assert.equal(freshMark(md(0), 'X'), null)
  assert.equal(freshMark(md(-1), 'X'), null)
  assert.equal(freshMark(md(null), 'X'), null)
})

test('position and account metrics: liquidation, settlement value and stale aggregation', () => {
  const p = { market: 'SOL/USD', side: 'long', margin: '1000', leverage: 5, quantity: '50', entry_price: '100' }
  /* maintenance 10%: (1000 × 0.9 − 2.5 close fee) / 50 = 17.95 below entry */
  assert.equal(positionMetrics(p, md(100)).liquidation, '82.0500000000')
  const acc = { balance: '4997.5', used_margin: '1000' }
  const m = accountMetrics(acc, [p], md(110))
  assert.equal(m.equity, '5497.50')
  assert.equal(m.free_margin, '4497.50')
  /* settlement: 4997.5 + 500 − 2.5 */
  assert.equal(m.settlement_balance, '5495.0000000000')
  const stale = accountMetrics(acc, [p], md(110, Date.now() - 10000))
  assert.equal(stale.equity, null)
  assert.equal(stale.settlement_balance, null)
  assert.equal(stale.valuation_status, 'stale')
  assert.equal(accountMetrics(acc, [], md(null)).settlement_balance, '4997.5000000000')
})
