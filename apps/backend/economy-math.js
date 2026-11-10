/**
 * Openfund economy policy arithmetic (pure, no I/O).
 *
 * Every financial rule used by the ambassador, coach, treasury and Live
 * Market Access modules is computed here with decimal.js so it can be
 * tested deterministically without a database. Amounts are USD strings
 * rounded to cents (ROUND_HALF_UP) at the boundary of each rule.
 */
import Decimal from 'decimal.js'

const Dx = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })
export const D = v => new Dx(v ?? 0)
export const cents = v => D(v).toDecimalPlaces(2, Dx.ROUND_HALF_UP)
export const usd = v => cents(v).toFixed(2)

/* ------------------------------------------------------------------ */
/* Ambassador referral commission                                      */
/* ------------------------------------------------------------------ */
export const AMBASSADOR_COMMISSION_RATE = '0.10'

/** Commission on the confirmed net purchase amount (after discounts). */
export function commissionFor(netPurchaseUsd, rate = AMBASSADOR_COMMISSION_RATE) {
  const base = cents(netPurchaseUsd)
  if (!base.isFinite() || base.lte(0)) return null
  return { base: base.toFixed(2), rate: D(rate).toFixed(4), amount: usd(base.mul(rate)) }
}

/**
 * Proportional reversal for a refund/chargeback of `adjustmentUsd` against
 * a purchase whose earned commission was `earnedUsd` on `baseUsd`. Never
 * reverses more than what remains un-reversed.
 */
export function commissionReversal({ earnedUsd, baseUsd, adjustmentUsd, alreadyReversedUsd = '0' }) {
  const earned = cents(earnedUsd), base = cents(baseUsd), remaining = earned.minus(D(alreadyReversedUsd).abs())
  if (remaining.lte(0) || base.lte(0)) return '0.00'
  const share = Dx.min(D(adjustmentUsd), base).div(base)
  return usd(Dx.min(remaining, cents(earned.mul(share))))
}

/* ------------------------------------------------------------------ */
/* Live profit sharing                                                 */
/* ------------------------------------------------------------------ */
export const COACH_SHARE_PCT = 10
/** Candidate tiers — NOT policy: an administrator must explicitly select one. */
export const PROFIT_SHARE_TIERS = Object.freeze({
  standard: { trader: 70, coach: 10, openfund: 20 },
  advanced: { trader: 80, coach: 10, openfund: 10 },
  elite: { trader: 85, coach: 10, openfund: 5 },
})

/** Validates an explicit split; coach is fixed at 10 and the sum must be 100. */
export function validateSplit({ trader, coach, openfund }) {
  const parts = [trader, coach, openfund].map(Number)
  if (parts.some(v => !Number.isFinite(v) || v < 0 || v > 100)) return 'invalid_split'
  if (Number(coach) !== COACH_SHARE_PCT) return 'coach_share_must_be_10'
  if (!D(trader).plus(coach).plus(openfund).eq(100)) return 'split_must_total_100'
  return null
}

/**
 * Distributable profit = verified realized PnL − eligible trading costs.
 * Returns null when there is nothing to distribute (loss or break-even).
 * Rounding residue goes to Openfund so the parts always sum exactly.
 */
export function distributeProfit({ realizedPnlUsd, tradingFeesUsd = '0', executionCostsUsd = '0', split }) {
  const err = validateSplit(split)
  if (err) throw Object.assign(new Error(err), { status: 400 })
  const costs = cents(D(tradingFeesUsd).abs().plus(D(executionCostsUsd).abs()))
  const distributable = cents(D(realizedPnlUsd).minus(costs))
  if (distributable.lte(0)) return { distributable: usd(Dx.max(distributable, 0)), costs: costs.toFixed(2), shares: null }
  const coach = cents(distributable.mul(split.coach).div(100))
  const trader = cents(distributable.mul(split.trader).div(100))
  const openfund = distributable.minus(coach).minus(trader)
  return {
    distributable: distributable.toFixed(2), costs: costs.toFixed(2),
    shares: { trader: trader.toFixed(2), coach: coach.toFixed(2), openfund: openfund.toFixed(2) },
  }
}

/* ------------------------------------------------------------------ */
/* Financial position                                                  */
/* ------------------------------------------------------------------ */
export const LIVE_PROGRAM_THRESHOLD_USD = '500000.00'

/**
 * Gross treasury, obligations and allocatable capital are kept separate.
 * Each obligation category comes from exactly ONE source table (see
 * docs/economy/TREASURY.md), so no amount is subtracted twice. Open-trade
 * margin is part of the allocation it is drawn from and is only counted
 * on top when it exceeds that allocation.
 *
 * `verified` is true only when every input is known: a fresh snapshot,
 * every treasury asset priced, and both reserve kinds explicitly set.
 */
export function financialPosition({ treasury, obligations, reserves, allocations }) {
  const missing = []
  if (!treasury || treasury.status !== 'ok') missing.push('treasury_snapshot')
  else {
    if (treasury.stale) missing.push('treasury_snapshot_fresh')
    if (!treasury.fullyPriced) missing.push('treasury_asset_prices')
  }
  if (reserves?.operational == null) missing.push('operational_reserve')
  if (reserves?.risk == null) missing.push('risk_reserve')
  const gross = treasury?.totalUsd != null ? cents(treasury.totalUsd) : null
  const o = obligations || {}
  const obligationParts = {
    traderRewardsApprovedUnpaid: usd(o.traderRewardsApprovedUnpaid),
    ambassadorCommissionsUnpaid: usd(o.ambassadorCommissionsUnpaid),
    liveProfitSharesUnsettled: usd(o.liveProfitSharesUnsettled),
    expensesPayable: usd(o.expensesPayable),
    otherLiabilities: usd(o.otherLiabilities),
  }
  const obligationTotal = Object.values(obligationParts).reduce((s, v) => s.plus(v), D(0))
  const reserveParts = { operational: usd(reserves?.operational), risk: usd(reserves?.risk), other: usd(reserves?.other) }
  const reserveTotal = Object.values(reserveParts).reduce((s, v) => s.plus(v), D(0))
  const allocated = cents(allocations?.allocatedUsd)
  const marginExcess = Dx.max(D(0), cents(allocations?.openMarginUsd).minus(allocated))
  const committed = allocated.plus(marginExcess)
  const available = gross == null ? null : gross.minus(obligationTotal).minus(reserveTotal).minus(committed)
  const verified = missing.length === 0
  return {
    grossTreasuryUsd: gross == null ? null : gross.toFixed(2),
    outstandingObligationsUsd: obligationTotal.toFixed(2),
    obligations: obligationParts,
    reservesUsd: reserveTotal.toFixed(2),
    reserves: reserveParts,
    allocatedCapitalUsd: committed.toFixed(2),
    availableAllocatableUsd: available == null ? null : available.toFixed(2),
    status: verified ? 'verified' : 'unknown',
    missing,
    formula: 'available = gross_treasury − (trader_rewards_unpaid + ambassador_commissions_unpaid + live_shares_unsettled + expenses_payable + other_liabilities) − (operational + risk + other reserves) − max(allocated_capital, open_margin)',
  }
}

/** Program capacity: Active only on a verified position at/above the threshold. */
export function programCapacity(position, threshold = LIVE_PROGRAM_THRESHOLD_USD) {
  if (position.status !== 'verified' || position.availableAllocatableUsd == null)
    return { state: 'unknown', reason: 'capital_not_verified', thresholdUsd: usd(threshold) }
  const ok = D(position.availableAllocatableUsd).gte(threshold)
  return { state: ok ? 'capacity_available' : 'below_threshold', thresholdUsd: usd(threshold), availableUsd: position.availableAllocatableUsd }
}

/* ------------------------------------------------------------------ */
/* Live trader eligibility                                             */
/* ------------------------------------------------------------------ */
export const LIVE_ELIGIBILITY = Object.freeze({ firstAccountPaidWithdrawals: 10, secondAccountPaidWithdrawals: 5, secondAccountSizeMultiple: 2 })

/**
 * @param accounts chronological purchased-account lineages:
 *   [{ orderId, sizeUsd, phases, evaluationPassed, fundedChallengeId, paidWithdrawals }]
 * @param coach { linkActive, qualificationVerified, coachActive } | null
 */
export function evaluateLiveEligibility({ accounts = [], coach = null }) {
  const first = accounts[0] || null
  const second = first ? accounts.slice(1).find(a => D(a.sizeUsd).eq(D(first.sizeUsd).mul(LIVE_ELIGIBILITY.secondAccountSizeMultiple))) || null : null
  const checks = [
    { key: 'first_account_purchased', ok: !!first },
    { key: 'first_account_evaluation_passed', ok: !!first?.evaluationPassed },
    { key: 'first_account_funded', ok: !!first?.fundedChallengeId },
    { key: 'first_account_paid_withdrawals', ok: (first?.paidWithdrawals ?? 0) >= LIVE_ELIGIBILITY.firstAccountPaidWithdrawals, value: first?.paidWithdrawals ?? 0, required: LIVE_ELIGIBILITY.firstAccountPaidWithdrawals },
    { key: 'second_account_double_size', ok: !!second, required: first ? usd(D(first.sizeUsd).mul(2)) : null, value: second?.sizeUsd ?? null },
    { key: 'second_account_evaluation_passed', ok: !!second?.evaluationPassed },
    { key: 'second_account_paid_withdrawals', ok: (second?.paidWithdrawals ?? 0) >= LIVE_ELIGIBILITY.secondAccountPaidWithdrawals, value: second?.paidWithdrawals ?? 0, required: LIVE_ELIGIBILITY.secondAccountPaidWithdrawals },
    { key: 'coach_link_active', ok: !!(coach?.linkActive && coach?.coachActive) },
    { key: 'coach_verified_trader', ok: !!coach?.qualificationVerified },
  ]
  return { eligible: checks.every(c => c.ok), checks, firstAccount: first, secondAccount: second }
}

/* ------------------------------------------------------------------ */
/* Live risk controls (independent of the simulation engine)           */
/* ------------------------------------------------------------------ */
/**
 * Worst-case loss of an isolated-margin perpetual position is its full
 * collateral plus fees — NOT the account's daily/maximum drawdown
 * percentage. An order is admitted only if that worst case fits inside
 * the remaining loss budget of BOTH limits, and exposure/leverage caps hold.
 */
export function checkLiveOrder({ allocation, limits, openTrades = [], order, feeEstimateUsd = '0' }) {
  const amount = D(allocation.amountUsd)
  const equity = amount.plus(allocation.realizedPnlUsd || 0)
  const openMargin = openTrades.reduce((s, t) => s.plus(t.collateralUsd), D(0))
  const openNotional = openTrades.reduce((s, t) => s.plus(D(t.collateralUsd).mul(t.leverage)), D(0))
  const reasons = []
  if (allocation.status !== 'active') reasons.push(`allocation_${allocation.status}`)
  const collateral = D(order.collateralUsd), lev = D(order.leverage)
  if (!collateral.isFinite() || collateral.lte(0)) reasons.push('invalid_collateral')
  if (!lev.isFinite() || lev.lte(0)) reasons.push('invalid_leverage')
  if (reasons.length) return { ok: false, reasons }
  if (lev.gt(limits.maxLeverage)) reasons.push('leverage_above_limit')
  if (limits.maxOpenPositions != null && openTrades.length + 1 > limits.maxOpenPositions) reasons.push('max_open_positions')
  if (openMargin.plus(collateral).gt(equity)) reasons.push('insufficient_allocated_capital')
  if (openNotional.plus(collateral.mul(lev)).gt(D(limits.maxExposureUsd))) reasons.push('exposure_above_limit')
  const maxFloor = amount.mul(D(1).minus(D(limits.maxDrawdownPct).div(100)))
  const dailyFloor = D(allocation.dayStartEquityUsd).mul(D(1).minus(D(limits.dailyDrawdownPct).div(100)))
  const floor = Dx.max(maxFloor, dailyFloor)
  const worstCase = openMargin.plus(collateral).plus(D(feeEstimateUsd))
  if (equity.minus(worstCase).lt(floor)) reasons.push('worst_case_loss_exceeds_drawdown_budget')
  return { ok: reasons.length === 0, reasons, equity: usd(equity), floor: usd(floor), worstCaseLossUsd: usd(worstCase) }
}

/** After a realized result: update equity markers and decide circuit breaker. */
export function applyRealized({ allocation, limits, realizedNetUsd, today }) {
  const realized = cents(D(allocation.realizedPnlUsd || 0).plus(realizedNetUsd))
  const equity = D(allocation.amountUsd).plus(realized)
  const dayRolled = today && allocation.day !== today
  const dayStart = dayRolled ? D(allocation.amountUsd).plus(allocation.realizedPnlUsd || 0) : D(allocation.dayStartEquityUsd)
  const peak = Dx.max(D(allocation.peakEquityUsd), equity)
  let halt = null
  if (equity.lte(D(allocation.amountUsd).mul(D(1).minus(D(limits.maxDrawdownPct).div(100))))) halt = 'max_drawdown_breached'
  else if (equity.lte(dayStart.mul(D(1).minus(D(limits.dailyDrawdownPct).div(100))))) halt = 'daily_drawdown_breached'
  return { realizedPnlUsd: realized.toFixed(2), peakEquityUsd: usd(peak), dayStartEquityUsd: usd(dayStart), day: today || allocation.day, halt }
}

/* ------------------------------------------------------------------ */
/* Scenario model (illustrative; never presented as company data)      */
/* ------------------------------------------------------------------ */
export function scenario(input) {
  const sizes = Object.keys(input.mix || {})
  const totalMix = sizes.reduce((s, k) => s.plus(D(input.mix[k] || 0)), D(0))
  const sold = D(input.challengesSold || 0)
  let gross = D(0)
  for (const k of sizes) {
    if (totalMix.lte(0)) break
    gross = gross.plus(sold.mul(D(input.mix[k] || 0).div(totalMix)).mul(D(input.prices?.[k] || 0)))
  }
  const refunds = gross.mul(D(input.refundRatePct || 0).div(100))
  const net = gross.minus(refunds)
  const paidTraders = sold.mul(D(input.passRatePct || 0).div(100)).mul(D(input.firstPayoutRatePct || 0).div(100))
  const payouts = paidTraders.mul(D(input.avgTotalPayoutUsd || 0))
  const commissions = net.mul(D(input.ambassadorSharePct || 0).div(100)).mul(AMBASSADOR_COMMISSION_RATE)
  const opex = D(input.operatingCostsUsd || 0)
  const remaining = net.minus(payouts).minus(commissions).minus(opex)
  const reserves = Dx.max(D(0), remaining).mul(D(input.reservePct || 0).div(100))
  return {
    grossRevenue: usd(gross), refunds: usd(refunds), netRevenue: usd(net), paidTraders: paidTraders.toFixed(1),
    traderPayouts: usd(payouts), ambassadorCommissions: usd(commissions), operatingCosts: usd(opex),
    remainingCapital: usd(remaining), reserves: usd(reserves), availableAllocatable: usd(remaining.minus(reserves)),
  }
}
