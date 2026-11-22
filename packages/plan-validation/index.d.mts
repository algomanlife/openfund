/* Types for index.mjs (shared challenge plan validation). */
export interface ValidatablePlan {
  slug: string
  name: { fa: string; en: string }
  accountSizesUsd: number[]
  priceUsd: Record<number, number>
  phases: number
  phase1TargetPct: number | null
  phase2TargetPct: number | null
  dailyLossPct: number
  maxTotalLossPct: number
  profitSplitPct: number
  drawdownMode: 'static' | 'trailing'
  trailingLockAtProfitPct?: number | null
  free: boolean
  firstPayoutDays?: number | null
  rewardCycles: { key: string; splitPct: number; firstAfterDays: number | null }[]
  catalogVersion: number
  dailyLossVariantPriceUsd?: Record<number, number> | null
}
export function planProblems(plan: ValidatablePlan): string[]
export function assertPlanValid(plan: ValidatablePlan): void
export function planFromConfiguration(slug: string, name: string, configuration?: Record<string, unknown>): ValidatablePlan
export function configurationDiff(before?: Record<string, unknown>, after?: Record<string, unknown>): { field: string; before: unknown; after: unknown }[]
