/** Backend mirror of the challenge plan catalog (configuration JSONB rows).
 *
 * AUTHORITY: apps/web-react/src/data/challengePlans.ts is the single source of
 * truth for every public plan rule; docs/research/FUNDINGPIPS_PROGRAMS.md holds
 * the provenance. This module only mirrors it for `npm run seed-plans`.
 * apps/web-react/test/product-rules.test.mjs fails whenever a value here, the
 * frontend catalog and the evaluation engine's normalized rules disagree.
 * Pure data: importing this module has no side effects. */
export const PLAN_SEEDS = [
  { slug: 'standard', name: 'استاندارد — Standard', configuration: { accountSizesUsd: [5000, 10000, 25000, 50000, 100000], priceUsd: { 5000: 44, 10000: 80, 25000: 216, 50000: 349, 100000: 652 }, phases: 2, phase1TargetPct: 8, phase2TargetPct: 5, dailyLossPct: 5, dailyLossPctAlt: 3, maxTotalLossPct: 10, drawdownMode: 'static', minTradingDays: 3, consistencyPct: 35, profitSplitPct: 80, profitSplitMonthlyPct: 100, payoutCapPct: 0, firstPayoutDays: 14, minPayoutPct: 1, timeLimitDays: null, referenceLeverageX: 5, refundPolicy: 'fourth-reward' } },
  { slug: 'one-phase', name: 'تک‌مرحله‌ای — One-phase', configuration: { accountSizesUsd: [5000, 10000, 25000, 50000, 100000], priceUsd: { 5000: 74, 10000: 111, 25000: 255, 50000: 353, 100000: 666 }, phases: 1, phase1TargetPct: 12, dailyLossPct: 3, dailyLossPctAlt: 2, maxTotalLossPct: 12, drawdownMode: 'static', minTradingDays: 0, consistencyPct: 35, profitSplitPct: 80, profitSplitMonthlyPct: 100, payoutCapPct: 0, firstPayoutDays: 14, minPayoutPct: 1, timeLimitDays: null, referenceLeverageX: 5, refundPolicy: 'none' } },
  { slug: 'instant', name: 'آنی — Instant', configuration: { accountSizesUsd: [5000, 10000, 25000, 50000, 100000, 200000], priceUsd: { 5000: 60, 10000: 88, 25000: 188, 50000: 244, 100000: 444, 200000: 888 }, phases: 0, dailyLossPct: 3, maxTotalLossPct: 5, drawdownMode: 'trailing', trailingLockAtProfitPct: 5, minTradingDays: 0, profitableDaysPer30: 7, consistencyPct: 15, profitSplitPct: 95, payoutCapPct: 0, firstPayoutDays: 14, minPayoutPct: 1, timeLimitDays: null, referenceLeverageX: 5, refundPolicy: 'none' } },
  { slug: 'free-trial', name: 'تست رایگان — Free Trial', configuration: { accountSizesUsd: [5000, 10000, 25000, 50000, 100000], priceUsd: { 5000: 0, 10000: 0, 25000: 0, 50000: 0, 100000: 0 }, phases: 2, phase1TargetPct: 8, phase2TargetPct: 5, dailyLossPct: 5, maxTotalLossPct: 10, drawdownMode: 'static', minTradingDays: 3, trialDaysPerPhase: 14, timeLimitDays: 14, profitSplitPct: 0, payoutCapPct: 0, referenceLeverageX: 5, refundPolicy: 'none', free: true } }
]
