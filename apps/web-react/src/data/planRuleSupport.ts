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
  /** frozen into the rules snapshot and enforced by the reward
   *  eligibility engine (apps/backend/rewards.js) on funded accounts */
  | 'reward'
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
  profitableDaysPer30: { support: 'reward', note: 'Profitable UTC+3 days required for a reward request (Instant: every request; monthly cycle: 7).' },
  consistencyPct: { support: 'reward', note: 'Best profitable day ≤ this share of cycle profit (Instant: every request; Standard/One-phase: monthly cycle).' },
  profitSplitPct: { support: 'reward', note: 'Bi-weekly reward share computed by the server from realized net profit.' },
  profitSplitMonthlyPct: { support: 'reward', note: 'Monthly (30-day) cycle share, chosen per request; requires consistency and 7 profitable days.' },
  payoutCapPct: { support: 'reward', note: 'Reward cap as % of account size; 0 = no cap.' },
  firstPayoutDays: { support: 'reward', note: 'First reward request opens this many days after the first funded fill.' },
  minPayoutPct: { support: 'reward', note: 'Realized profit must reach this % of account size.' },
  timeLimitDays: { support: 'enforced', note: 'Challenge expiry at start time.' },
  trialDaysPerPhase: { support: 'enforced', note: 'Free Trial expiry per phase.' },
  refundPolicy: { support: 'reward', note: "'fourth-reward': the fee paid on the originating order is added to the fourth reward request." },
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
