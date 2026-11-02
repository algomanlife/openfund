import type { ToolError, ToolOutcome, ToolSuccess } from '../cms/contentTypes'
import { planBySlug, type ChallengePlan } from './challengePlans'

/**
 * The Tools Center calculation engine.
 *
 * Pure, deterministic and locale-free: every function takes parsed numbers and
 * returns either a result map or a list of coded validation errors, so the same
 * maths is testable from Node, renders in Persian or English, and never depends
 * on the DOM, the network or the trading engine. Nothing here places an order.
 *
 * Conventions
 *  - percentages are passed as plain percent numbers (1 means 1%)
 *  - money values are unitless USD figures supplied by the user
 *  - `direction` is 'long' | 'short'; everything else is a number
 */
export type ToolInput = Record<string, number | string | undefined>

const PCT = 100

const asNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') return parseUserNumber(raw)
  return null
}

class Reader {
  errors: ToolError[] = []
  constructor(private values: ToolInput) {}

  /** required numeric field with a validity envelope */
  number(key: string, opts: { min?: number; max?: number; positive?: boolean; integer?: boolean } = {}): number | null {
    const raw = this.values[key]
    if (raw === undefined || raw === null || raw === '') {
      this.errors.push({ field: key, code: 'required' })
      return null
    }
    const n = asNumber(raw)
    if (n === null) {
      this.errors.push({ field: key, code: 'invalid' })
      return null
    }
    if (opts.integer && !Number.isInteger(n)) {
      this.errors.push({ field: key, code: 'invalid' })
      return null
    }
    if (opts.positive && n <= 0) {
      this.errors.push({ field: key, code: 'positive' })
      return null
    }
    if (opts.min !== undefined && n < opts.min) {
      this.errors.push({ field: key, code: 'min', params: { min: opts.min } })
      return null
    }
    if (opts.max !== undefined && n > opts.max) {
      this.errors.push({ field: key, code: 'max', params: { max: opts.max } })
      return null
    }
    return n
  }

  /** optional numeric field: empty or missing yields the fallback, invalid is an error */
  optionalNumber(key: string, fallback: number, opts: { min?: number; max?: number; positive?: boolean } = {}): number {
    const raw = this.values[key]
    if (raw === undefined || raw === null || raw === '') return fallback
    const n = asNumber(raw)
    if (n === null) {
      this.errors.push({ field: key, code: 'invalid' })
      return fallback
    }
    if (opts.positive && n <= 0) {
      this.errors.push({ field: key, code: 'positive' })
      return fallback
    }
    if (opts.min !== undefined && n < opts.min) {
      this.errors.push({ field: key, code: 'min', params: { min: opts.min } })
      return fallback
    }
    if (opts.max !== undefined && n > opts.max) {
      this.errors.push({ field: key, code: 'max', params: { max: opts.max } })
      return fallback
    }
    return n
  }

  direction(key = 'direction'): 1 | -1 {
    const raw = String(this.values[key] ?? 'long').toLowerCase()
    if (raw !== 'long' && raw !== 'short') {
      this.errors.push({ field: key, code: 'invalid' })
      return 1
    }
    return raw === 'long' ? 1 : -1
  }

  /** split a comma / space / newline separated numeric list */
  list(key: string, minItems = 1): number[] {
    const raw = this.values[key]
    if (typeof raw !== 'string' || !raw.trim()) {
      this.errors.push({ field: key, code: 'required' })
      return []
    }
    /* Persian comma and thousands marks become list separators first */
    const normalized = raw.replace(/[،٬]/g, ',')
    const parts = normalized.split(/[,;\n\t ]+/).map(x => x.trim()).filter(Boolean)
    const nums: number[] = []
    for (const part of parts) {
      const n = parseUserNumber(part)
      if (n === null) {
        this.errors.push({ field: key, code: 'invalid' })
        return []
      }
      nums.push(n)
    }
    if (nums.length < minItems) {
      this.errors.push({ field: key, code: 'empty' })
      return []
    }
    return nums
  }

  fail(): ToolOutcome {
    return { ok: false, errors: this.errors }
  }

  success(values: Record<string, number | string | null>, notes?: string[]): ToolOutcome {
    if (this.errors.length) return { ok: false, errors: this.errors }
    const out: ToolSuccess = { ok: true, values }
    if (notes?.length) out.notes = notes
    return out
  }
}

/** Persian (U+06F0–06F9) and Arabic-Indic (U+0660–0669) digits → Latin */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
    .replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
    .replace(/[٫]/g, '.')
    .replace(/[،]/g, ',')
    .replace(/[,٬\s]/g, '')
}

/** parse one user-typed number in Latin, Persian or Arabic-Indic digits */
export function parseUserNumber(raw: string): number | null {
  const cleaned = normalizeDigits(String(raw)).replace(/[$%,]/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/* 1 — position size from a fixed money risk -------------------------------- */
export function positionSize(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const equity = r.number('equity', { positive: true })
  const riskPct = r.number('riskPct', { positive: true, max: 100 })
  const entry = r.number('entry', { positive: true })
  const stop = r.number('stop', { positive: true })
  const feePct = r.optionalNumber('feePct', 0, { min: 0, max: 100 })
  const contractSize = r.optionalNumber('contractSize', 1, { positive: true })
  const leverage = r.optionalNumber('leverage', 1, { min: 1, max: 1000 })
  const sign = r.direction()
  if (r.errors.length) return r.fail()

  const distance = Math.abs((entry as number) - (stop as number))
  if (distance === 0) return { ok: false, errors: [{ field: 'stop', code: 'order' }] }
  const expectedSide = sign > 0 ? (stop as number) < (entry as number) : (stop as number) > (entry as number)
  if (!expectedSide) return { ok: false, errors: [{ field: 'stop', code: 'order' }] }

  const feeAllowance = (entry as number) * (feePct / PCT) * 2
  const perUnitRisk = distance + feeAllowance
  const riskAmount = (equity as number) * (riskPct as number) / PCT
  const units = riskAmount / (perUnitRisk * contractSize)
  const notional = units * contractSize * (entry as number)

  return r.success({
    units,
    riskAmount,
    notional,
    marginRequired: notional / leverage,
    stopDistance: distance,
    stopDistancePct: distance / (entry as number) * PCT,
  })
}

/* 2 — leverage and margin -------------------------------------------------- */
export function leverageMargin(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const notional = r.number('notional', { positive: true })
  const leverage = r.number('leverage', { min: 1, max: 1000 })
  const equity = r.number('equity', { positive: true })
  const maintenancePct = r.optionalNumber('maintenancePct', 0, { min: 0, max: 100 })
  if (r.errors.length) return r.fail()

  const requiredMargin = (notional as number) / (leverage as number)
  const maintenanceRequirement = (notional as number) * (maintenancePct / PCT)
  const free = (equity as number) - requiredMargin
  const notes: string[] = []
  if (free < 0) notes.push('margin-exceeds-equity')
  if (requiredMargin <= maintenanceRequirement) notes.push('below-maintenance-floor')

  return r.success({
    requiredMargin,
    freeMargin: free,
    marginUsagePct: requiredMargin / (equity as number) * PCT,
    effectiveLeverage: (notional as number) / (equity as number),
    maintenanceRequirement,
    bufferPct: requiredMargin > 0 ? (requiredMargin - maintenanceRequirement) / requiredMargin * PCT : 0,
  }, notes)
}

/* 3 — liquidation estimate ------------------------------------------------- */
export function liquidationPrice(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const entry = r.number('entry', { positive: true })
  const qty = r.number('qty', { positive: true })
  const contractSize = r.optionalNumber('contractSize', 1, { positive: true })
  const leverage = r.optionalNumber('leverage', 10, { min: 1, max: 1000 })
  const maintenancePct = r.optionalNumber('maintenancePct', 0.5, { min: 0, max: 99 })
  const typedMargin = r.optionalNumber('margin', 0, { min: 0 })
  const sign = r.direction()
  if (r.errors.length) return r.fail()

  const size = (qty as number) * (contractSize as number)
  const notional = size * (entry as number)
  const margin = typedMargin > 0 ? typedMargin : notional / leverage
  const m = (maintenancePct as number) / PCT

  const liq = sign > 0
    ? (notional - margin) / (size * (1 - m))
    : (notional + margin) / (size * (1 + m))
  if (!Number.isFinite(liq) || liq <= 0) return { ok: false, errors: [{ field: 'margin', code: 'unbalanced' }] }

  return r.success({
    liquidationPrice: liq,
    distancePct: Math.abs(liq - (entry as number)) / (entry as number) * PCT,
    notional,
    marginPosted: margin,
    maintenanceRequirement: liq * size * m,
  })
}

/* 4 — perpetual futures PnL ------------------------------------------------ */
function netOf(exit: number, p: { sign: number, entry: number, size: number, openFeePct: number, closeFeePct: number, fundingPct: number }) {
  const gross = p.sign * (exit - p.entry) * p.size
  const fees = (p.entry + exit) * p.size / 2 * ((p.openFeePct + p.closeFeePct) / PCT)
  const funding = (p.entry + exit) / 2 * p.size * (p.fundingPct / PCT)
  return { gross, fees, funding, net: gross - fees - funding }
}

export function perpPnl(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const entry = r.number('entry', { positive: true })
  const exit = r.number('exit', { positive: true })
  const qty = r.number('qty', { positive: true })
  const contractSize = r.optionalNumber('contractSize', 1, { positive: true })
  const leverage = r.optionalNumber('leverage', 10, { min: 1, max: 1000 })
  const openFeePct = r.optionalNumber('openFeePct', 0, { min: 0, max: 100 })
  const closeFeePct = r.optionalNumber('closeFeePct', 0, { min: 0, max: 100 })
  const fundingPct = r.optionalNumber('fundingPct', 0, { min: -100, max: 100 })
  const sign = r.direction()
  if (r.errors.length) return r.fail()

  const size = (qty as number) * (contractSize as number)
  const params = { sign, entry: entry as number, size, openFeePct, closeFeePct, fundingPct }
  const parts = netOf(exit as number, params)
  const margin = (entry as number) * size / leverage

  /* break-even exit: net(X) is monotone in X (increasing for a long, decreasing
     for a short), so bisect between zero and a price well above the entry. */
  const netAt = (price: number) => netOf(price, params).net
  let a = 0
  let b = (entry as number) * 4
  let breakEven: number | null = null
  if (netAt(a) !== netAt(b) && netAt(a) * netAt(b) < 0) {
    for (let i = 0; i < 100; i++) {
      const mid = (a + b) / 2
      const value = netAt(mid)
      if (value === 0) { a = mid; b = mid; break }
      if (netAt(a) * value < 0) b = mid; else a = mid
      if (Math.abs(b - a) < 1e-9) break
    }
    breakEven = (a + b) / 2
  }

  return r.success({
    netPnl: parts.net,
    roiPct: parts.net / margin * PCT,
    grossPnl: parts.gross,
    fees: parts.fees,
    funding: parts.funding,
    breakEvenExit: Number.isFinite(breakEven) ? breakEven : null,
  })
}

/* 5 — funding cost --------------------------------------------------------- */
export function fundingRate(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const qty = r.number('qty', { positive: true })
  const markPrice = r.number('markPrice', { positive: true })
  const rate = r.number('rate', { min: -100, max: 100 })
  const intervalsPerDay = r.optionalNumber('intervalsPerDay', 3, { min: 1, max: 24 })
  const holdingHours = r.optionalNumber('holdingHours', 24, { min: 0 })
  const leverage = r.optionalNumber('leverage', 10, { min: 1, max: 1000 })
  const sign = r.direction()
  if (r.errors.length) return r.fail()

  const notional = (qty as number) * (markPrice as number)
  const perInterval = notional * (rate as number) / PCT
  const intervals = (holdingHours as number) / 24 * intervalsPerDay
  const cost = perInterval * intervals
  /* a positive rate is paid by longs and received by shorts */
  const payment = sign > 0 ? cost : -cost

  return r.success({
    totalPayment: payment,
    annualisedPct: (rate as number) * intervalsPerDay * 365,
    notional,
    perInterval: sign > 0 ? perInterval : -perInterval,
    intervals,
    pctOfMargin: payment / (notional / leverage) * PCT,
  })
}

/* 6 — risk / reward -------------------------------------------------------- */
export function riskReward(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const entry = r.number('entry', { positive: true })
  const stop = r.number('stop', { positive: true })
  const target = r.number('target', { positive: true })
  const equity = r.number('equity', { positive: true })
  const riskPct = r.number('riskPct', { positive: true, max: 100 })
  const feePct = r.optionalNumber('feePct', 0, { min: 0, max: 100 })
  const winRatePct = r.optionalNumber('winRatePct', 0, { min: 0, max: 100 })
  const sign = r.direction()
  if (r.errors.length) return r.fail()

  const riskPerUnit = Math.abs((entry as number) - (stop as number))
  const rewardPerUnit = Math.abs((target as number) - (entry as number))
  if (riskPerUnit === 0) return { ok: false, errors: [{ field: 'stop', code: 'order' }] }
  if (rewardPerUnit === 0) return { ok: false, errors: [{ field: 'target', code: 'order' }] }
  const sidesOk = sign > 0
    ? (stop as number) < (entry as number) && (target as number) > (entry as number)
    : (stop as number) > (entry as number) && (target as number) < (entry as number)
  if (!sidesOk) return { ok: false, errors: [{ field: sign > 0 ? 'stop' : 'target', code: 'order' }] }

  const feePerUnit = (entry as number) * (feePct / PCT)
  const rr = rewardPerUnit / riskPerUnit
  const feeAdjusted = (rewardPerUnit - feePerUnit) / (riskPerUnit + feePerUnit)
  const plannedRisk = (equity as number) * (riskPct as number) / PCT
  const p = (winRatePct as number) / PCT
  const expectancy = p * plannedRisk * rr - (1 - p) * plannedRisk

  return r.success({
    rrRatio: rr,
    feeAdjustedRR: feeAdjusted,
    plannedRisk,
    plannedReward: plannedRisk * rr,
    breakEvenWinPct: riskPerUnit / (riskPerUnit + rewardPerUnit) * PCT,
    expectancy,
    expectancyR: plannedRisk > 0 ? expectancy / plannedRisk : 0,
  })
}

/* 7 — risk of ruin --------------------------------------------------------- */
export function riskOfRuin(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const winRatePct = r.number('winRatePct', { min: 0, max: 100 })
  const avgWin = r.number('avgWin', { positive: true })
  const avgLoss = r.number('avgLoss', { positive: true })
  const riskPct = r.number('riskPct', { positive: true, max: 100 })
  const capital = r.number('capital', { positive: true })
  const stopOut = r.number('stopOut', { positive: true })
  if (r.errors.length) return r.fail()
  if ((stopOut as number) >= (capital as number)) return { ok: false, errors: [{ field: 'stopOut', code: 'range' }] }

  const p = (winRatePct as number) / PCT
  const q = 1 - p
  const b = (avgWin as number) / (avgLoss as number)
  /* per-trade payoff in risk units: win = +b, loss = -1 */
  const mean = p * b - q
  const variance = p * b * b + q - mean * mean
  const f = (riskPct as number) / PCT
  const logDistance = Math.log((capital as number) / (stopOut as number))
  const kelly = p - q / b

  const ruinPct = mean <= 0 || variance <= 0
    ? PCT
    : Math.exp(-2 * mean * logDistance / (f * variance)) * PCT
  const maxRiskForFive = mean <= 0 || variance <= 0
    ? 0
    : -2 * mean * logDistance / (variance * Math.log(0.05)) * PCT

  return r.success({
    ruinPct,
    maxRiskPct: maxRiskForFive,
    edgePerTrade: mean,
    kellyPct: Math.max(0, kelly) * PCT,
    payoff: b,
    logDistance,
  }, mean <= 0 ? ['no-edge'] : [])
}

/* 8 — prop drawdown -------------------------------------------------------- */
export function propDrawdown(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const planSlug = String(values.plan || '')
  const plan = planBySlug(planSlug) as ChallengePlan | undefined
  if (!plan) return { ok: false, errors: [{ field: 'plan', code: 'invalid' }] }
  const accountSize = r.number('accountSize', { positive: true })
  const dayStartBalance = r.number('dayStartBalance', { positive: true })
  const dayStartEquity = r.number('dayStartEquity', { positive: true })
  const currentBalance = r.number('currentBalance', { positive: true })
  const currentEquity = r.number('currentEquity', { positive: true })
  const typedHighWater = r.optionalNumber('highWater', 0, { min: 0 })
  const openRiskPct = r.optionalNumber('openRiskPct', 0, { min: 0, max: 100 })
  if (r.errors.length) return r.fail()

  const size = accountSize as number
  const baseline = Math.max(dayStartBalance as number, dayStartEquity as number)
  const dailyLimit = baseline * (plan.dailyLossPct / PCT)
  const dailyUsed = Math.max(0, baseline - (currentEquity as number))
  const dailyRemaining = dailyLimit - dailyUsed

  const highWater = Math.max(typedHighWater, size, baseline, currentBalance as number, currentEquity as number)
  let floor: number
  let totalLimit: number
  if (plan.drawdownMode === 'trailing') {
    floor = highWater * (1 - plan.maxTotalLossPct / PCT)
    /* the published Instant rule locks the trailing floor at breakeven once the
       account is 5% in profit */
    if (plan.trailingLockAtProfitPct && highWater >= size * (1 + plan.trailingLockAtProfitPct / PCT)) {
      floor = Math.max(floor, size)
    }
    totalLimit = highWater - floor
  } else {
    floor = size * (1 - plan.maxTotalLossPct / PCT)
    totalLimit = size * (plan.maxTotalLossPct / PCT)
  }
  const totalRemaining = (currentEquity as number) - floor
  const openRisk = size * (openRiskPct / PCT)
  const afterRisk = Math.min(dailyRemaining, totalRemaining) - openRisk

  const status = afterRisk < 0 ? 'breach'
    : Math.min(dailyRemaining, totalRemaining) < dailyLimit * 0.15 ? 'critical'
      : Math.min(dailyRemaining, totalRemaining) < dailyLimit * 0.4 ? 'caution'
        : 'ok'

  return r.success({
    dailyLimit,
    dailyRemaining,
    totalLimit,
    totalRemaining,
    dailyUsed,
    status,
  }, plan.drawdownMode === 'trailing' ? ['trailing-mode'] : [])
}

/* 9 — consistency ---------------------------------------------------------- */
export function consistencyRule(values: ToolInput): ToolOutcome {
  const r = new Reader(values)
  const limit = r.number('consistencyPct', { min: 1, max: 100 })
  const profits = r.list('dailyProfits', 2)
  const plannedDay = r.optionalNumber('plannedDay', 0, { min: 0 })
  if (r.errors.length) return r.fail()

  const total = profits.reduce((sum, x) => sum + x, 0)
  if (total <= 0) return { ok: false, errors: [{ field: 'dailyProfits', code: 'unbalanced' }] }

  const largest = Math.max(0, ...profits)
  const sharePct = largest / total * PCT
  const c = (limit as number) / PCT
  const maxAllowedDay = c * total
  /* the biggest single day x that can still be added while
     max(largest, x) / (total + x) <= c, i.e. x <= (c·total − largest) / (1 − c) */
  const alreadyCompliant = sharePct <= (limit as number)
  let futureRoom: number | null = null
  if (c >= 1) futureRoom = null /* a 100% limit imposes no constraint */
  else if (!alreadyCompliant) futureRoom = 0
  else futureRoom = Math.max(0, (c * total - largest) / (1 - c))

  const plannedTotal = total + plannedDay
  const plannedShare = plannedDay > 0 ? Math.max(largest, plannedDay) / plannedTotal * PCT : sharePct
  const verdict = plannedShare <= (limit as number) ? 'compliant' : 'exceeded'

  return r.success({
    sharePct,
    verdict,
    totalProfit: total,
    largestDay: largest,
    maxAllowedDay,
    futureRoom,
  }, plannedDay > 0 ? ['includes-planned-day'] : [])
}

/* registry ---------------------------------------------------------------- */
export const calculators: Record<string, (values: ToolInput) => ToolOutcome> = {
  'position-size': positionSize,
  'leverage-margin': leverageMargin,
  'liquidation-price': liquidationPrice,
  'perp-pnl': perpPnl,
  'funding-rate': fundingRate,
  'risk-reward': riskReward,
  'risk-of-ruin': riskOfRuin,
  'prop-drawdown': propDrawdown,
  'consistency-rule': consistencyRule,
}
