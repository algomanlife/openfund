/** Revenue Model scenario arithmetic — illustrative only, never company data. */
export const SIZES = ['10000', '25000', '50000', '100000'] as const
export type Inputs = { challengesSold: number; mix: Record<string, number>; prices: Record<string, number>; passRatePct: number; firstPayoutRatePct: number; avgTotalPayoutUsd: number; ambassadorSharePct: number; operatingCostsUsd: number; reservePct: number; refundRatePct: number; activationRatePct: number; attributedIbPct: number; averageTraderSplitPct: number; existingPayoutLiabilitiesUsd: number }

/** Planning model using net sales as an explicit illustrative allocation base. */
export function runScenario(i: Inputs) {
  const mixTotal = SIZES.reduce((s, k) => s + (i.mix[k] || 0), 0)
  const gross = mixTotal > 0 ? SIZES.reduce((s, k) => s + i.challengesSold * (i.mix[k] || 0) / mixTotal * (i.prices[k] || 0), 0) : 0
  const net = gross * (1 - i.refundRatePct / 100)
  const funded = i.challengesSold * i.passRatePct / 100 * (i.activationRatePct ?? 100) / 100
  const recipients = funded * i.firstPayoutRatePct / 100
  const payouts = recipients * i.avgTotalPayoutUsd
  const traderSplit = Math.min(100, Math.max(75, i.averageTraderSplitPct ?? 100))
  const ibPayouts = payouts * (i.attributedIbPct ?? 0) / 100 * (100 - traderSplit) / traderSplit
  const payoutLiabilities = payouts + ibPayouts + (i.existingPayoutLiabilitiesUsd ?? 0)
  const estimatedTreasuryAllocation = net * 0.59
  const estimatedOperationsAllocation = net - estimatedTreasuryAllocation
  const payoutCoverage = payoutLiabilities > 0 ? estimatedTreasuryAllocation / payoutLiabilities : null
  const commissions = net * i.ambassadorSharePct / 100 * 0.10
  const remaining = net - payoutLiabilities - commissions - i.operatingCostsUsd
  const reserves = Math.max(0, remaining) * i.reservePct / 100
  return { gross, net, funded, recipients, payouts, ibPayouts, payoutLiabilities, payoutCoverage, estimatedTreasuryAllocation, estimatedOperationsAllocation, commissions, opex: i.operatingCostsUsd, remaining, reserves, available: remaining - reserves }
}

