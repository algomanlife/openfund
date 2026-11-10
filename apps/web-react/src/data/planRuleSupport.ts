/* ============================================================
   Challenge plan rule support register
   ------------------------------------------------------------
   Every field of the plan catalog (challengePlans.ts) is classified by
   how the running product honours it today. The product-rules
   consistency check (test/product-rules.test.mjs) fails when:
   - a catalog field is not classified here;
   - an 'enforced' field is missing from the evaluation engine's
     normalized rules snapshot (apps/backend/evaluation.js);
   - the backend plan mirror (apps/backend/plan-catalog.js) disagrees
     with the catalog.

   Anything a published plan advertises that is not 'enforced' is a
   LAUNCH BLOCKER. It is resolved by implementing support in the backend,
   never by silently changing the published rule to fit the code.
   Nothing in this file is shown on the public website.
   ============================================================ */
import type { ChallengePlan } from './challengePlans'

export type RuleSupport =
  /** identity / presentation only — not a trading rule */
  | 'presentation'
  /** server-priced at order creation (apps/backend/purchases.js) */
  | 'purchase'
  /** frozen into the rules snapshot and enforced by the evaluation engine */
  | 'enforced'
  /** snapshotted and reported as a metric, not enforced as a condition */
  | 'metric-only'
  /** advertised but not implemented by the backend */
  | 'not-implemented'

export interface RuleSupportEntry {
  support: RuleSupport
  /** launch blocker identifier when the rule is advertised but not enforced */
  blocker?: string
  note: string
}

export const planRuleSupport: Record<keyof ChallengePlan, RuleSupportEntry> = {
  slug: { support: 'presentation', note: 'Catalog key shared by the frontend, the backend plan rows and Directus.' },
  name: { support: 'presentation', note: 'Localized display name.' },
  tagline: { support: 'presentation', note: 'Localized preset tagline.' },
  status: { support: 'presentation', note: 'Publication gate: only published plans render.' },
  accountSizesUsd: { support: 'purchase', note: 'Order creation rejects sizes outside the configured list.' },
  priceUsd: { support: 'purchase', note: 'Orders are priced on the server from the configuration.' },
  phases: { support: 'enforced', note: 'Stage progression and pass transitions.' },
  phase1TargetPct: { support: 'enforced', note: 'Pass condition on closed net profit.' },
  phase2TargetPct: { support: 'enforced', note: 'Stage-2 pass condition.' },
  dailyLossPct: { support: 'enforced', note: 'Equity breach against the higher of day-start balance or equity (00:00 UTC+3).' },
  dailyLossPctAlt: { support: 'not-implemented', blocker: 'PLAN-DAILY-LOSS-VARIANT', note: 'The cheaper daily-loss option is displayed, but orders carry only plan and size and the engine enforces dailyLossPct only. No price exists for the variant.' },
  maxTotalLossPct: { support: 'enforced', note: 'Static or trailing maximum-loss breach.' },
  drawdownMode: { support: 'enforced', note: 'Static versus trailing maximum loss.' },
  trailingLockAtProfitPct: { support: 'enforced', note: 'Trailing floor locks at breakeven.' },
  minTradingDays: { support: 'enforced', note: 'Distinct UTC+3 fill days required for a pass.' },
  profitableDaysPer30: { support: 'metric-only', blocker: 'PLAN-PAYOUT-CONDITIONS', note: 'A payout condition; withdrawals are manual requests and do not evaluate it.' },
  consistencyPct: { support: 'metric-only', blocker: 'PLAN-PAYOUT-CONDITIONS', note: 'A payout condition; withdrawals are manual requests and do not evaluate it.' },
  profitSplitPct: { support: 'metric-only', blocker: 'PLAN-PAYOUT-CONDITIONS', note: 'Snapshotted only; no reward calculation enforces the split.' },
  profitSplitMonthlyPct: { support: 'not-implemented', blocker: 'PLAN-PAYOUT-CONDITIONS', note: 'No reward-cycle selection exists in the backend.' },
  payoutCapPct: { support: 'not-implemented', blocker: 'PLAN-PAYOUT-CONDITIONS', note: 'No payout cap logic (all published plans currently state no cap).' },
  firstPayoutDays: { support: 'not-implemented', blocker: 'PLAN-PAYOUT-CONDITIONS', note: 'Withdrawal requests are accepted without the 14-day waiting period check.' },
  minPayoutPct: { support: 'not-implemented', blocker: 'PLAN-PAYOUT-CONDITIONS', note: 'Withdrawal requests are accepted without the minimum request check.' },
  timeLimitDays: { support: 'enforced', note: 'Challenge expiry at start time.' },
  trialDaysPerPhase: { support: 'enforced', note: 'Free Trial expiry per phase.' },
  refundPolicy: { support: 'not-implemented', blocker: 'PLAN-FEE-REFUND', note: 'The Standard fee refund with the fourth reward is not automated.' },
  referenceLeverageX: { support: 'enforced', note: 'Order leverage above the plan reference is rejected by the engine.' },
  free: { support: 'enforced', note: 'Free Trial flag (no fee, no reward).' },
}

/** Rules published plans advertise that the backend does not enforce. */
export function launchBlockers(plans: ChallengePlan[]): Array<{ blocker: string; field: string; plans: string[]; note: string }> {
  const out = new Map<string, { blocker: string; field: string; plans: string[]; note: string }>()
  for (const [field, entry] of Object.entries(planRuleSupport) as Array<[keyof ChallengePlan, RuleSupportEntry]>) {
    if (!entry.blocker) continue
    const advertised = plans.filter(p => {
      const value = p[field]
      if (value == null || value === false) return false
      if (field === 'refundPolicy') return value !== 'none'
      if (field === 'payoutCapPct') return false /* 0 = no cap: nothing to enforce */
      return typeof value === 'number' ? value > 0 : true
    })
    if (advertised.length) out.set(`${entry.blocker}:${field}`, { blocker: entry.blocker, field, plans: advertised.map(p => p.slug), note: entry.note })
  }
  return [...out.values()]
}
