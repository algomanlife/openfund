/**
 * Model conduct rules (rules snapshot v3) — pure, deterministic checks of
 * every time window, threshold and grouping used by conduct.js / rewards.js.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSummerPeriod, closeHourUtc, autoCloseWindow, inAutoCloseWindow, inWeekend, tradingDay, nextTradingDayStart,
  marketCurrencies, newsWindow, activeNews, newsDeductions, tradeIdeas, tradeIdeaLimitPct, openLoss, inactivity,
  profitableDays, profitableDayPeriods, strikeAdjustedSplit, normalizeModelPolicy, appliesTo,
} from '../model-rules.js'
import { normalizeRules } from '../evaluation.js'
import { PLAN_SEEDS } from '../plan-catalog.js'

const T = s => Date.parse(s)
const MIN = 60_000, DAY = 86_400_000

test('M1 summer/winter periods switch on the first Sunday of March and of November', () => {
  assert.equal(isSummerPeriod(T('2026-02-28T23:59:00Z')), false)
  assert.equal(isSummerPeriod(T('2026-03-01T00:00:00Z')), true)  /* 1 Mar 2026 is a Sunday */
  assert.equal(isSummerPeriod(T('2026-10-31T12:00:00Z')), true)
  assert.equal(isSummerPeriod(T('2026-11-01T00:00:00Z')), false) /* 1 Nov 2026 is a Sunday */
  assert.equal(closeHourUtc(T('2026-07-01T00:00:00Z')), 21)
  assert.equal(closeHourUtc(T('2026-12-01T00:00:00Z')), 22)
})

test('M2 funded daily auto-close runs in the 15 minutes before the close', () => {
  const w = autoCloseWindow(T('2026-07-08T12:00:00Z'))
  assert.equal(new Date(w.start).toISOString(), '2026-07-08T20:45:00.000Z')
  assert.equal(new Date(w.end).toISOString(), '2026-07-08T21:00:00.000Z')
  assert.equal(inAutoCloseWindow(T('2026-07-08T20:44:59Z')), false)
  assert.equal(inAutoCloseWindow(T('2026-07-08T20:45:00Z')), true)
  assert.equal(inAutoCloseWindow(T('2026-07-08T21:00:00Z')), false)
  assert.equal(inAutoCloseWindow(T('2026-12-09T21:50:00Z')), true)
})

test('M3 the weekend runs from Friday close to Sunday open', () => {
  assert.equal(inWeekend(T('2026-07-10T20:59:59Z')), false) /* Friday, summer */
  assert.equal(inWeekend(T('2026-07-10T21:00:00Z')), true)
  assert.equal(inWeekend(T('2026-07-11T12:00:00Z')), true)  /* Saturday */
  assert.equal(inWeekend(T('2026-07-12T20:59:00Z')), true)  /* Sunday before open */
  assert.equal(inWeekend(T('2026-07-12T21:00:00Z')), false)
  assert.equal(inWeekend(T('2026-12-11T21:30:00Z')), false) /* Friday, winter: close at 22:00 */
  assert.equal(inWeekend(T('2026-12-11T22:00:00Z')), true)
})

test('M4 trading days are UTC+3 calendar days', () => {
  assert.equal(tradingDay(T('2026-07-08T20:59:00Z')), '2026-07-08')
  assert.equal(tradingDay(T('2026-07-08T21:00:00Z')), '2026-07-09')
  assert.equal(new Date(nextTradingDayStart(T('2026-07-08T10:00:00Z'))).toISOString(), '2026-07-08T21:00:00.000Z')
})

test('M5 news exposure: fiat legs of the symbol; window includes speech duration', () => {
  assert.deepEqual(marketCurrencies('EUR/USD'), ['EUR', 'USD'])
  assert.deepEqual(marketCurrencies('BTC/USD'), ['USD'])
  assert.deepEqual(marketCurrencies('XAU/USD'), ['USD'])
  assert.deepEqual(marketCurrencies('BTC/ETH'), [])
  const speech = { currency: 'USD', starts_at: '2026-07-08T14:00:00Z', ends_at: '2026-07-08T15:00:00Z', restricted: true }
  const w = newsWindow(speech, 10)
  assert.equal(new Date(w.from).toISOString(), '2026-07-08T13:50:00.000Z')
  assert.equal(new Date(w.to).toISOString(), '2026-07-08T15:10:00.000Z')
  assert.equal(activeNews([speech], 'EUR/USD', T('2026-07-08T15:05:00Z'), 10).length, 1)
  assert.equal(activeNews([speech], 'EUR/GBP', T('2026-07-08T15:05:00Z'), 10).length, 0)
  assert.equal(activeNews([{ ...speech, restricted: false }], 'EUR/USD', T('2026-07-08T14:30:00Z'), 10).length, 0)
})

test('M6 funded news deduction: profit opened/closed in the window, unless opened ≥ 5 h before', () => {
  const ev = [{ id: 1, currency: 'USD', starts_at: '2026-07-08T12:30:00Z', restricted: true }]
  const pos = [
    { id: 'a', market: 'EUR/USD', opened_at: '2026-07-08T12:27:00Z', closed_at: '2026-07-08T13:00:00Z', net: '150' },  /* opened in window */
    { id: 'b', market: 'EUR/USD', opened_at: '2026-07-08T11:00:00Z', closed_at: '2026-07-08T12:33:00Z', net: '90' },   /* closed in window */
    { id: 'c', market: 'EUR/USD', opened_at: '2026-07-08T07:00:00Z', closed_at: '2026-07-08T12:31:00Z', net: '400' },  /* opened 5.5 h before: exempt */
    { id: 'd', market: 'EUR/USD', opened_at: '2026-07-08T12:28:00Z', closed_at: '2026-07-08T12:32:00Z', net: '-40' },  /* a loss is not "profit" */
    { id: 'e', market: 'EUR/GBP', opened_at: '2026-07-08T12:29:00Z', closed_at: '2026-07-08T12:31:00Z', net: '70' },   /* unaffected currency */
    { id: 'f', market: 'EUR/USD', opened_at: '2026-07-08T12:36:00Z', closed_at: '2026-07-08T13:00:00Z', net: '60' },   /* after the window */
  ]
  assert.deepEqual(newsDeductions(pos, ev, { windowMin: 5, exemptHours: 5 }).map(d => [d.positionId, d.amount]), [['a', '150.00'], ['b', '90.00']])
})

test('M7 trade ideas: concurrent same-direction trades and 10-minute re-entry after a loss', () => {
  const p = (id, market, side, o, c, net) => ({ id, market, side, opened_at: `2026-07-08T${o}:00Z`, closed_at: c && `2026-07-08T${c}:00Z`, net })
  const ideas = tradeIdeas([
    p('1', 'EUR/USD', 'long', '10:00', '10:30', '-300'),
    p('2', 'EUR/USD', 'long', '10:10', '10:40', '-200'),  /* overlaps 1 */
    p('3', 'EUR/USD', 'long', '10:45', '11:00', '-250'),  /* re-entry 5 min after a losing close */
    p('4', 'EUR/USD', 'long', '11:20', '11:30', '-100'),  /* 20 min later: new idea */
    p('5', 'EUR/USD', 'short', '10:15', '10:20', '-90'),  /* other direction: own idea */
    p('6', 'GBP/USD', 'long', '10:05', null, '-50'),      /* open */
  ])
  const byKey = Object.fromEntries(ideas.map(i => [i.key, i]))
  assert.deepEqual(byKey['1'].members, ['1', '2', '3']); assert.equal(byKey['1'].loss.toString(), '750')
  assert.deepEqual(byKey['4'].members, ['4']); assert.deepEqual(byKey['5'].members, ['5'])
  assert.equal(byKey['6'].open, true)
  const winners = tradeIdeas([p('a', 'EUR/USD', 'long', '10:00', '10:30', '-300'), p('b', 'EUR/USD', 'long', '10:05', '10:20', '500')])
  assert.equal(winners[0].loss.toString(), '300', 'a winning trade never offsets a losing one')
})

test('M8 Instant trade-idea limit: 3% below $50,000, 2% from $50,000', () => {
  const rule = { thresholdUsd: 50000, belowPct: 3, atOrAbovePct: 2 }
  assert.equal(tradeIdeaLimitPct(rule, 25000), 3)
  assert.equal(tradeIdeaLimitPct(rule, 50000), 2)
  assert.equal(tradeIdeaLimitPct(null, 50000), null)
})

test('M9 max open risk sums floating losses only', () => {
  assert.equal(openLoss([{ net: '-400' }, { net: '-350' }, { net: '-250' }, { net: '900' }]).toString(), '1000')
})

test('M10 inactivity: account start, or the trading day after the last full close; 30 calendar days', () => {
  const started = '2026-07-01T09:00:00Z'
  assert.equal(inactivity({ days: 30, startedAt: started, lastFullCloseAt: null, now: T('2026-07-31T08:59:00Z') }).breached, false)
  assert.equal(inactivity({ days: 30, startedAt: started, lastFullCloseAt: null, now: T('2026-07-31T09:00:00Z') }).breached, true)
  const r = inactivity({ days: 30, startedAt: started, lastFullCloseAt: '2026-07-05T10:00:00Z', now: T('2026-08-04T20:59:00Z') })
  assert.equal(r.anchor, '2026-07-05T21:00:00.000Z'); assert.equal(r.breached, false)
  assert.equal(inactivity({ days: 30, startedAt: started, lastFullCloseAt: '2026-07-05T10:00:00Z', now: T('2026-08-04T21:00:00Z') }).breached, true)
  assert.equal(inactivity({ days: null, startedAt: started, now: T('2027-01-01T00:00:00Z') }).breached, false)
})

test('M11 profitable days: model-specific thresholds; rolling 30-day periods from the first trade', () => {
  const days = [{ day: '2026-07-01', net: '60' }, { day: '2026-07-02', net: '49.99' }, { day: '2026-07-03', net: '25' }, { day: '2026-07-04', net: '-80' }]
  assert.equal(profitableDays(days, 10000, 0.5), 1)   /* on-demand: ≥ $50 */
  assert.equal(profitableDays(days, 10000, 0.25), 3)  /* Instant: ≥ $25 */
  const rule = { days: 7, windowDays: 30, minPct: 0.25 }
  const seven = Array.from({ length: 7 }, (_, i) => ({ day: `2026-07-${String(i + 2).padStart(2, '0')}`, net: '30' }))
  const anchorAt = '2026-07-01T10:00:00Z'
  assert.equal(profitableDayPeriods({ rule, accountSize: 10000, anchorAt, dailyNet: seven, now: T('2026-07-31T10:00:00Z') }).breached, false)
  const six = seven.slice(1)
  assert.equal(profitableDayPeriods({ rule, accountSize: 10000, anchorAt, dailyNet: six, now: T('2026-07-31T09:59:00Z') }).breached, false, 'period not complete yet')
  const r = profitableDayPeriods({ rule, accountSize: 10000, anchorAt, dailyNet: six, now: T('2026-07-31T10:00:00Z') })
  assert.equal(r.breached, true); assert.equal(r.count, 6)
})

test('M12 strike system: 2 strikes halve the split, 3 → 20%, 4 → none', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(n => strikeAdjustedSplit(100, n)), [100, 100, 50, 20, 0])
})

test('M13 rules snapshot v3 carries the approved model policy; older terms are untouched', () => {
  const std = normalizeRules(PLAN_SEEDS.find(p => p.slug === 'standard').configuration)
  assert.equal(std.rulesVersion, 3); assert.equal(std.model, 'standard'); assert.equal(std.referenceLeverageX, null)
  assert.deepEqual(std.rewardCycles.map(c => c.key), ['weekly', 'biweekly', 'on_demand'])
  assert.equal(std.dailyLossVariant, 'default'); assert.equal(std.minTradingDays, 3)
  const reduced = normalizeRules(PLAN_SEEDS.find(p => p.slug === 'standard').configuration, { dailyLossVariant: 'reduced' })
  assert.deepEqual([reduced.dailyLossPct, reduced.minTradingDays, reduced.dailyLossVariant], [3, 0, 'reduced'])
  const oneReduced = normalizeRules(PLAN_SEEDS.find(p => p.slug === 'one-phase').configuration, { dailyLossVariant: 'reduced' })
  assert.deepEqual([oneReduced.dailyLossPct, oneReduced.minTradingDays], [2, 0])
  const inst = normalizeRules(PLAN_SEEDS.find(p => p.slug === 'instant').configuration, { dailyLossVariant: 'reduced' })
  assert.equal(inst.dailyLossPct, 3, 'no variant exists for Instant')
  const policy = normalizeModelPolicy({ rewardCycles: [{ key: 'monthly', splitPct: 100 }, { key: 'biweekly', splitPct: 80 }] })
  assert.deepEqual(policy.rewardCycles.map(c => c.key), ['biweekly'], 'unknown cycles are dropped')
  assert.equal(appliesTo({ stage: 'funded' }, { funded: false }), false)
  assert.equal(appliesTo({ stage: 'all' }, { funded: false }), true)
})
