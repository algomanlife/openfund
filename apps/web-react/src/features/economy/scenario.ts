/** Revenue Model scenario arithmetic — illustrative only, never company data. */
export const SIZES = ['10000', '25000', '50000', '100000'] as const
export type Inputs = { challengesSold: number; mix: Record<string, number>; prices: Record<string, number>; passRatePct: number; firstPayoutRatePct: number; avgTotalPayoutUsd: number; ambassadorSharePct: number; operatingCostsUsd: number; reservePct: number; refundRatePct: number }

/** Same arithmetic as apps/backend/economy-math.js scenario() (illustrative only). */
export function runScenario(i: Inputs) {
  const mixTotal = SIZES.reduce((s, k) => s + (i.mix[k] || 0), 0)
  const gross = mixTotal > 0 ? SIZES.reduce((s, k) => s + i.challengesSold * (i.mix[k] || 0) / mixTotal * (i.prices[k] || 0), 0) : 0
  const net = gross * (1 - i.refundRatePct / 100)
  const payouts = i.challengesSold * i.passRatePct / 100 * i.firstPayoutRatePct / 100 * i.avgTotalPayoutUsd
  const commissions = net * i.ambassadorSharePct / 100 * 0.10
  const remaining = net - payouts - commissions - i.operatingCostsUsd
  const reserves = Math.max(0, remaining) * i.reservePct / 100
  return { gross, net, payouts, commissions, opex: i.operatingCostsUsd, remaining, reserves, available: remaining - reserves }
}

