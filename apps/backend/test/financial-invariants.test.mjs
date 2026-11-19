/**
 * Financial invariant suite (security audit 2026-11).
 *
 * Property-based checks of the pure evaluation and valuation functions the
 * prop engine relies on (evaluation.js evaluateRules / normalizeRules and
 * trading-math.js). A seeded PRNG generates thousands of rule sets, balances
 * and price paths; every case must hold the invariants below. No database,
 * network or engine process is involved, so a failure is always reproducible
 * from the printed seed and case.
 *
 *  E1  stale marks (equity unknown) never pass and never fail
 *  E2  a pass never coexists with a violation
 *  E3  a pass needs closed profit AND post-settlement profit >= target,
 *      and the minimum trading days
 *  E4  monotonic loss: if equity e fails a loss limit, every lower equity fails
 *  E5  trailing floor: never above the peak, never below the static floor,
 *      never decreasing as the peak rises; the breakeven lock holds
 *  E6  exact boundaries: equity exactly AT a threshold is a breach (<=)
 *  E7  funded / stage-0 accounts never pass; plans without loss limits are inert
 *  E8  an expired challenge always fails (time_limit)
 *  T1  pnl is antisymmetric in side and zero at entry
 *  T2  spread always works against the trader (open and close)
 *  T3  liquidation price is on the losing side of entry and never negative
 *  T4  stale or invalid marks are rejected (freshMark)
 *  T5  account equity is unknown (null) whenever any position is unpriced
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRules, normalizeRules } from '../evaluation.js'
import { D, SIM, pnl, withSpread, positionMetrics, accountMetrics, freshMark } from '../trading-math.js'

const SEED = Number(process.env.INVARIANT_SEED || 20261119)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) }
const rand = rng(SEED)
const pick = a => a[Math.floor(rand() * a.length)]
const between = (lo, hi, dp = 2) => (lo + rand() * (hi - lo)).toFixed(dp)
const CASES = Number(process.env.INVARIANT_CASES || 4000)

function randomRules(overrides = {}) {
  return normalizeRules({
    phases: pick([0, 1, 2]), phase1TargetPct: pick([6, 8, 10]), phase2TargetPct: pick([4, 5]),
    dailyLossPct: pick([2, 3, 4, 5]), maxTotalLossPct: pick([5, 6, 8, 10]), drawdownMode: pick(['static', 'trailing']),
    trailingLockAtProfitPct: pick([0, 0, 4, 6]), minTradingDays: pick([0, 3, 5]), ...overrides,
  })
}
function randomState(rules) {
  const startingBalance = pick(['5000', '10000', '25000', '100000'])
  const s = Number(startingBalance)
  const balance = between(s * 0.8, s * 1.25)
  const equity = between(s * 0.8, s * 1.25)
  return {
    rules, stage: pick([0, 1, 2]), startingBalance, balance, equity,
    settlementBalance: pick([undefined, null, between(s * 0.8, s * 1.25, 10)]),
    dayBasis: pick([null, between(s * 0.9, s * 1.2)]),
    trailing: { peakEquity: between(s, s * 1.3) }, tradingDays: Math.floor(rand() * 8),
  }
}

test('E1–E3, E7: pass/fail decisions respect stale marks, violations, targets and trading days', () => {
  for (let i = 0; i < CASES; i++) {
    const rules = randomRules(), st = randomState(rules)
    const r = evaluateRules(st)
    const tag = `seed=${SEED} case=${i} ${JSON.stringify(st)}`
    if (r.status === 'pass') {
      assert.equal(r.violations.length, 0, `E2 ${tag}`)
      const target = D(st.startingBalance).times(st.stage === 2 ? (rules.phase2TargetPct ?? rules.phase1TargetPct) : rules.phase1TargetPct).div(100)
      assert.ok(D(st.balance).minus(st.startingBalance).gte(target), `E3 closed profit ${tag}`)
      assert.notEqual(st.settlementBalance, null, `E3 unsettleable ${tag}`)
      const settled = st.settlementBalance === undefined ? D(st.balance) : D(st.settlementBalance)
      assert.ok(settled.minus(st.startingBalance).gte(target), `E3 settlement ${tag}`)
      assert.ok(st.tradingDays >= (rules.minTradingDays ?? 0), `E3 trading days ${tag}`)
      assert.ok(st.stage >= 1 && rules.phases >= 1 && !rules.funded, `E7 ${tag}`)
    }
    const stale = evaluateRules({ ...st, equity: null })
    assert.equal(stale.status, 'deferred', `E1 ${tag}`)
  }
})

test('E4: lowering equity never clears a loss breach', () => {
  for (let i = 0; i < CASES; i++) {
    const rules = randomRules({ phases: 0 }), st = randomState(rules)
    const r = evaluateRules(st)
    if (r.status !== 'fail') continue
    const losses = r.violations.filter(v => v.rule !== 'time_limit').map(v => v.rule)
    if (!losses.length) continue
    const lower = evaluateRules({ ...st, equity: D(st.equity).minus(between(0.01, 500)).toFixed(2) })
    for (const rule of losses) assert.ok(lower.violations.some(v => v.rule === rule), `E4 seed=${SEED} case=${i} ${rule}`)
  }
})

test('E5: the trailing floor is bounded, monotonic in the peak and locks at breakeven', () => {
  for (let i = 0; i < CASES; i++) {
    const rules = randomRules({ drawdownMode: 'trailing', phases: 0 })
    const s = D(pick(['5000', '10000', '100000']))
    const peaks = Array.from({ length: 6 }, () => s.times(between(0.95, 1.3, 4))).sort((a, b) => a.cmp(b))
    let prev = null
    for (const peak of peaks) {
      const r = evaluateRules({ rules, stage: 0, startingBalance: s.toFixed(2), balance: s.toFixed(2), equity: s.times(2).toFixed(2), dayBasis: null, trailing: { peakEquity: peak.toFixed(2) } })
      const floor = D(r.metrics.trailing.floor)
      const staticFloor = s.times(D(1).minus(D(rules.maxTotalLossPct).div(100)))
      assert.ok(floor.gte(staticFloor), `E5 floor >= static, case ${i}`)
      assert.ok(floor.lte(Decimal_max(peak, s)), `E5 floor <= max(peak, starting), case ${i}`)
      if (prev) assert.ok(floor.gte(prev), `E5 floor monotonic, case ${i}`)
      if (rules.trailingLockAtProfitPct > 0 && peak.gte(s.times(D(1).plus(D(rules.trailingLockAtProfitPct).div(100))))) assert.ok(floor.gte(s), `E5 lock, case ${i}`)
      prev = floor
    }
  }
})
const Decimal_max = (a, b) => (a.gte(b) ? a : b)

test('E6: equity exactly at a threshold is a breach, one cent above is not', () => {
  const rules = normalizeRules({ phases: 1, phase1TargetPct: 10, dailyLossPct: 5, maxTotalLossPct: 10, drawdownMode: 'static' })
  const base = { rules, stage: 1, startingBalance: '100000', balance: '100000', dayBasis: '100000', trailing: null }
  assert.ok(evaluateRules({ ...base, equity: '95000.00' }).violations.some(v => v.rule === 'daily_loss_breach'))
  assert.ok(!evaluateRules({ ...base, equity: '95000.01' }).violations.some(v => v.rule === 'daily_loss_breach'))
  assert.ok(evaluateRules({ ...base, dayBasis: null, equity: '90000.00' }).violations.some(v => v.rule === 'maximum_loss_breach'))
  assert.ok(!evaluateRules({ ...base, dayBasis: null, equity: '90000.01' }).violations.some(v => v.rule === 'maximum_loss_breach'))
  /* 0.1 + 0.2 style float traps: exact decimal arithmetic */
  const odd = normalizeRules({ phases: 1, phase1TargetPct: 10, dailyLossPct: 3, maxTotalLossPct: 7, drawdownMode: 'static' })
  const r = evaluateRules({ rules: odd, stage: 1, startingBalance: '33333.33', balance: '33333.33', equity: '30999.9969', dayBasis: null })
  assert.ok(r.violations.some(v => v.rule === 'maximum_loss_breach'), 'threshold 30999.9969 is reached exactly')
})

test('E7/E8: inert plans, funded stages and expired challenges', () => {
  const inert = normalizeRules({ phases: 1, phase1TargetPct: 8, dailyLossPct: 0, maxTotalLossPct: 10 })
  assert.equal(inert.evaluationCapable, false)
  assert.equal(evaluateRules({ rules: inert, stage: 1, startingBalance: '10000', balance: '20000', equity: '20000', dayBasis: null }).status, 'none')
  const funded = normalizeRules({ phases: 2, phase1TargetPct: 8, phase2TargetPct: 5, dailyLossPct: 5, maxTotalLossPct: 10 })
  assert.notEqual(evaluateRules({ rules: funded, stage: 0, startingBalance: '10000', balance: '20000', equity: '20000', dayBasis: null }).status, 'pass')
  const exp = evaluateRules({ rules: funded, stage: 1, startingBalance: '10000', balance: '20000', equity: '20000', dayBasis: null, tradingDays: 10, expiresAt: new Date(Date.now() - 1000).toISOString() })
  assert.equal(exp.status, 'fail'); assert.ok(exp.violations.some(v => v.rule === 'time_limit'))
  /* an open losing position that would settle below the target blocks the pass */
  const open = evaluateRules({ rules: funded, stage: 1, startingBalance: '10000', balance: '11000', equity: '10500', settlementBalance: '10700', dayBasis: null, tradingDays: 10 })
  assert.notEqual(open.status, 'pass')
  assert.notEqual(evaluateRules({ rules: funded, stage: 1, startingBalance: '10000', balance: '11000', equity: '11000', settlementBalance: null, dayBasis: null, tradingDays: 10 }).status, 'pass')
})

const md = (mark, at = Date.now(), meta = { base: 'BTC', group: 'crypto' }) => ({ mark: () => (mark == null ? null : { mark, at }), marketMeta: () => meta })

test('T1/T2: pnl antisymmetry and spread always against the trader', () => {
  for (let i = 0; i < CASES; i++) {
    const qty = between(0.0001, 50, 6), entry = between(1, 100000, 4), mark = between(1, 100000, 4)
    assert.ok(pnl(qty, entry, mark, 'long').plus(pnl(qty, entry, mark, 'short')).isZero(), `T1 case ${i}`)
    assert.ok(pnl(qty, entry, entry, pick(['long', 'short'])).isZero())
    const meta = pick([{ base: 'BTC' }, { base: 'XAU', group: 'commodities' }, { base: 'EUR', group: 'forex' }, { base: 'DOGE', group: 'crypto' }])
    assert.ok(withSpread(mark, 'long', 'open', meta).gte(mark) && withSpread(mark, 'long', 'close', meta).lte(mark), `T2 long ${i}`)
    assert.ok(withSpread(mark, 'short', 'open', meta).lte(mark) && withSpread(mark, 'short', 'close', meta).gte(mark), `T2 short ${i}`)
  }
})

test('T3: liquidation price sits on the losing side of entry and is never negative', () => {
  for (let i = 0; i < CASES; i++) {
    const side = pick(['long', 'short']), entry = D(between(1, 100000, 4)), leverage = pick([1, 2, 5, 10, 25, 50, 100]), margin = D(between(1, 10000))
    const quantity = margin.times(leverage).div(entry)
    const p = { market: 'BTC/USD', side, entry_price: entry.toString(), margin: margin.toString(), leverage, quantity: quantity.toString() }
    const m = positionMetrics(p, md(entry.toString()))
    const liq = D(m.liquidation)
    assert.ok(liq.gte(0), `T3 non-negative ${i}`)
    if (side === 'long') assert.ok(liq.lt(entry), `T3 long liq < entry ${i}`)
    else assert.ok(liq.gt(entry), `T3 short liq > entry ${i}`)
  }
})

test('T4/T5: stale, future, zero and non-numeric marks are never used for valuation', () => {
  const now = Date.now()
  assert.equal(freshMark(md('100', now - SIM.STALE_MS - 1), 'BTC/USD'), null)
  assert.equal(freshMark(md('100', now + 5000), 'BTC/USD'), null)
  for (const bad of ['0', '-1', 'NaN', 'Infinity', 'abc', null]) assert.equal(freshMark(md(bad), 'BTC/USD'), null, `mark ${bad}`)
  assert.ok(freshMark(md('100'), 'BTC/USD'))
  const pos = { market: 'BTC/USD', side: 'long', entry_price: '100', margin: '10', leverage: 10, quantity: '1' }
  const acct = accountMetrics({ balance: '1000', used_margin: '10' }, [pos], md(null))
  assert.equal(acct.equity, null); assert.equal(acct.valuation_status, 'stale'); assert.equal(acct.settlement_balance, null)
  /* a stale account can never be evaluated as pass/fail */
  const rules = normalizeRules({ phases: 1, phase1TargetPct: 1, dailyLossPct: 5, maxTotalLossPct: 10 })
  assert.equal(evaluateRules({ rules, stage: 1, startingBalance: '900', balance: '1000', equity: acct.equity, dayBasis: null, tradingDays: 9 }).status, 'deferred')
})
