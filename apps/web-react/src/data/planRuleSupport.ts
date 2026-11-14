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
  dailyLossPctAlt: { support: 'enforced', note: 'D7: the order selects the variant; the snapshot freezes the chosen daily loss (Standard 3% also removes minimum trading days). Sold only when dailyLossVariantPriceUsd has an approved price; otherwise refused at order creation and hidden from public copy.' },
  maxTotalLossPct: { support: 'enforced', note: 'Static or trailing maximum-loss breach.' },
  drawdownMode: { support: 'enforced', note: 'Static versus trailing maximum loss.' },
  trailingLockAtProfitPct: { support: 'enforced', note: 'Trailing floor locks at breakeven.' },
  minTradingDays: { support: 'enforced', note: 'Distinct UTC+3 fill days required for a pass.' },
  profitableDaysPer30: { support: 'enforced', note: 'Instant: 7 qualifying days (≥ 0.25% of size) per rolling 30-day period from the first trade; breach when missed (conduct.profitableDayRule).' },
  consistencyPct: { support: 'reward', note: 'Headline of the cycle consistency score: on-demand cycle (35%) for Standard/One-step; every Instant request (15%).' },
  profitSplitPct: { support: 'reward', note: 'Headline split = the bi-weekly cycle; the selected rewardCycles entry is applied.' },
  profitSplitMonthlyPct: { support: 'presentation', note: 'D1: no monthly cycle is offered (null on every published plan).' },
  payoutCapPct: { support: 'reward', note: 'Reward cap as % of account size; 0 = no cap.' },
  firstPayoutDays: { support: 'presentation', note: 'Superseded by rewardCycles[].firstAfterDays (null on every published plan).' },
  minPayoutPct: { support: 'reward', note: 'Realized profit must reach this % of account size.' },
  timeLimitDays: { support: 'enforced', note: 'Challenge expiry at start time.' },
  trialDaysPerPhase: { support: 'enforced', note: 'Free Trial expiry per phase.' },
  refundPolicy: { support: 'reward', note: "'fourth-reward': the fee paid on the originating order is added to the fourth reward request." },
  referenceLeverageX: { support: 'enforced', note: 'D6: null = only the Openfund leverage ceilings (BTC/ETH 20×, other crypto 15×, forex/stocks/commodities/indices 50×) and market limits apply. A number would cap every market.' },
  catalogVersion: { support: 'presentation', note: 'Version of the published terms; rules snapshot v3 = owner decisions D1–D8.' },
  model: { support: 'enforced', note: 'Reference model frozen into the snapshot.' },
  rewardCycles: { support: 'reward', note: 'D1: the trader selects one cycle once when the funded account is activated (immutable); split, timing, consistency, profitable days and strikes per cycle.' },
  inactivityDays: { support: 'enforced', note: 'D3: breach after 30 calendar days without a fully closed trade (evaluation and funded stages).' },
  conduct: { support: 'enforced', note: 'D4/D8: open-risk, trade-idea, profitable-day, news and holding rules enforced by apps/backend/conduct.js. News rules need verified calendar coverage; plans that depend on them are not sold without it.' },
  dailyLossVariantPriceUsd: { support: 'purchase', note: 'D7: approved variant prices; null = the variant is not sold.' },
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
