/** Response shapes of the backend economy endpoints (see apps/backend/economy.js). */
export interface TreasuryAsset { symbol: string; address: string; decimals: number; balance: string; priceUsd: string | null; valueUsd: string | null; priceSource: string | null; priceUpdatedAt: string | null; priceError: string | null }
export interface TreasuryView {
  configured: boolean; configError: string | null; address: string | null; chainId: number; network: string | null; explorerUrl: string | null; refreshMinutes: number
  status: 'not_configured' | 'ok' | 'stale' | 'unavailable' | 'pending_first_read'; stale?: boolean
  lastAttempt?: { at: string; status: string } | null
  snapshot: { takenAt: string; blockNumber: number; assets: TreasuryAsset[]; totalUsd: string; fullyPriced: boolean } | null
  history: { day: string; totalUsd: string; fullyPriced: boolean }[]
}
export interface FinancialPosition {
  grossTreasuryUsd: string | null; outstandingObligationsUsd: string
  obligations: Record<'traderRewardsApprovedUnpaid' | 'ambassadorCommissionsUnpaid' | 'liveProfitSharesUnsettled' | 'expensesPayable' | 'otherLiabilities', string>
  reservesUsd: string; reserves: { operational: string; risk: string; other: string }
  allocatedCapitalUsd: string; availableAllocatableUsd: string | null; status: 'verified' | 'unknown'; missing: string[]; formula: string; calculatedAt: string
}
export interface Capacity { state: 'unknown' | 'below_threshold' | 'capacity_available'; thresholdUsd: string; availableUsd?: string; reason?: string }
type Money = { count: number; totalUsd: string }
export interface TransparencyReport {
  generatedAt: string
  sales: { source: string; challengesSold: number; uniqueCustomers: number; grossRevenueUsd: string; refundsUsd: string; chargebacksUsd: string; netRevenueUsd: string
    averageOrderUsd: string | null; paymentSuccessRate: number | null; paymentSuccessDefinition: string; byAccount: { plan: string; sizeUsd: string; orders: number; grossUsd: string }[]
    periods: Record<'d7' | 'd30' | 'd90', { orders: number; grossUsd: string }>; monthly: { month: string; orders: number; grossUsd: string }[] }
  challenges: { source: string; accountsCreated: number; active: number; failed: number; expired: number; finalEvaluationsPassed: number; fundedSimulated: number; fundedDefinition: string
    accountsWithPayout: number; paidWithdrawals: Money; phase1PassRate: number | null; phase1Completed: number; phase2PassRate: number | null; phase2Completed: number; firstPayoutRate: number | null; rateDefinitions: string }
  payouts: { source: string; paid: Money; approvedAwaitingTransfer: Money; requestedUnderReview: Money; uniqueRecipients: number; averagePerRecipientUsd: string | null; payoutToNetRevenue: number | null
    monthly: { month: string; payouts: number; totalUsd: string }[]; transactions: { at: string; amountUsd: string; explorerUrl: string | null }[] }
  treasury: TreasuryView
  flows: { inflows: { verifiedPayments: number; totalUsd: string } | null; outflows: { traderRewardsUsd: string; ambassadorCommissionsUsd: string; liveSettlementsUsd: string; expensesUsd: string; refundsUsd: string; definition: string } }
  position: FinancialPosition
  liveProgram: Capacity
  expenses: { source: string; categories: { category: string; totalUsd: string; records: number }[]; totalUsd: string; awaitingVerification: number
    records: { category: string; description: string; amount: string; currency: string; amountUsd: string; incurredOn: string; source: string; reference: string; paymentStatus: string }[] }
}
export interface EligibilityCheck { key: string; ok: boolean; value?: number | string | null; required?: number | string | null }
