/* ============================================================
   Openfund challenge plan catalog — SINGLE SOURCE OF TRUTH
   ------------------------------------------------------------
   One typed definition per public challenge program. Every number
   on the landing builder, the challenge comparison, the FAQ and
   the Rulebook derives from here, so the same value can never
   disagree across pages (both locales share the canonical values;
   only formatting is localized).

   Commercial specification — provenance (retrieved 2026-11-01):
   the program structure, prices, targets, drawdown rules, trading
   day requirements, reward splits and payout conditions follow the
   published terms researched in docs/research/FUNDINGPIPS_PROGRAMS.md
   (2-Step Standard, 1-Step Flex, "Zero" instant model, Free Trial),
   adapted and rebranded for Openfund. All figures below come from
   that verified research; nothing is invented here.
   NOT adopted (unverifiable or platform-specific): 2-Step Pro /
   2-Step Flex pricing (blocked sources — see the research matrix),
   per-platform lot caps, and platform restrictions.

   Status contract (publication discipline):
   - 'published'  → shown on the landing and in the Rulebook. The
                    commercial terms are the product's published
                    specification. Purchase activation itself is a
                    separate not-yet-active feature (stated plainly
                    in the checkout dialog and the Rulebook).
   - 'draft'      → internal candidate only; never rendered.
   An incomplete plan fails assertPlansValid() at module load and
   cannot appear as a purchasable product: the landing renders
   publishedPlans() only.

   The legacy landing runtime (app.js / features.js) consumes the
   serialized form through window.__ofPlans, injected by the Landing
   page BEFORE the legacy scripts boot. The backend seeds the same
   structure (challenge_plans, see apps/backend/seed-plans.js).
   ============================================================ */
import { text, type Localized } from '../features/information/content'

export type PlanStatus = 'published' | 'draft'
export type DrawdownMode = 'static' | 'trailing'
export type PlanModel = 'standard' | 'one-step' | 'instant' | 'trial'
export interface RewardCycle {
  key: 'weekly' | 'biweekly' | 'on_demand'
  /** trader share of realized net profit (%) */
  splitPct: number
  /** days after the first funded trade before the first request; null = on demand */
  firstAfterDays: number | null
  /** days between requests; null = on demand */
  everyDays: number | null
  /** best profitable day ≤ this share of cycle profit; null = none */
  consistencyPct: number | null
  /** profitable days required in the cycle; null = none */
  profitableDays: number | null
  /** a profitable day needs net realized profit ≥ this % of the account size */
  profitableDayPct: number | null
  /** trade-idea loss (% of size) that records a strike; null = no strike system */
  strikeLossPct: number | null
}
export interface ConductRules {
  /** combined floating loss of losing positions ≥ this % of size = breach */
  maxOpenRiskPct?: number | null
  /** trade-idea loss limit: belowPct under thresholdUsd, atOrAbovePct from it */
  tradeIdea?: { thresholdUsd: number; belowPct: number; atOrAbovePct: number; reentryMin: number } | null
  /** rolling requirement of qualifying profitable days (breach when missed) */
  profitableDayRule?: { days: number; windowDays: number; minPct: number } | null
  /** high-impact news: 'deduct' profit (funded) or 'prohibit' (breach) */
  news?: { mode: 'deduct' | 'prohibit'; stage: 'funded' | 'all'; windowMin: number; exemptHours?: number | null } | null
  /** holding: daily auto-close on funded accounts, or no weekend holding (breach) */
  holding?: { mode: 'auto_close_daily' | 'prohibit_weekend'; stage: 'funded' | 'all' } | null
}

export interface ChallengePlan {
  slug: string
  name: Localized
  /** preset-button tagline shown above the plan name */
  tagline: Localized
  status: PlanStatus
  /** nominal evaluation account sizes, USD */
  accountSizesUsd: number[]
  /** one-time evaluation fee per size, USD; 0 for the free trial */
  priceUsd: Record<number, number>
  /** 0 = instant funding (no evaluation), 1 | 2 = evaluation phases */
  phases: 0 | 1 | 2
  /** profit target of phase 1 / phase 2; null when not applicable */
  phase1TargetPct: number | null
  phase2TargetPct: number | null
  /** daily loss limit (%; higher-of day-start balance/equity, reset 00:00 UTC+3) */
  dailyLossPct: number
  /** cheaper daily-loss configuration where offered (3% vs 5%, 2% vs 3%) */
  dailyLossPctAlt?: number | null
  /** maximum loss limit (%) and its mode */
  maxTotalLossPct: number
  drawdownMode: DrawdownMode
  /** trailing drawdown locks at breakeven once this far in profit (instant model) */
  trailingLockAtProfitPct?: number | null
  /** minimum trading days per phase; 0 = none */
  minTradingDays: number
  /** profitable days required per rolling 30d (instant model); null = n/a */
  profitableDaysPer30?: number | null
  /** largest winning day must not exceed this share of total profit; null = none */
  consistencyPct?: number | null
  /** trader reward share (%) on the funded account (bi-weekly cycle) */
  profitSplitPct: number
  /** monthly-cycle share with 7 profitable days + consistency; null = n/a */
  profitSplitMonthlyPct?: number | null
  /** lifetime payout cap as % of account size; 0 = no cap */
  payoutCapPct: number
  /** days after the first funded trade before the first payout; null = n/a */
  firstPayoutDays?: number | null
  /** minimum payout request as % of account size; null = n/a */
  minPayoutPct?: number | null
  /** evaluation time limit in days; null = unlimited */
  timeLimitDays: number | null
  /** trial duration per phase (free trial only) */
  trialDaysPerPhase?: number | null
  /** fee refund policy */
  refundPolicy: 'none' | 'fourth-reward'
  /** plan leverage cap; null = Openfund leverage ceilings only (D6) */
  referenceLeverageX: number | null
  /** catalog version of these terms (rules snapshot v3 = owner decisions D1–D8) */
  catalogVersion: number
  /** reference model the plan follows */
  model: PlanModel
  /** reward cycles offered on the funded account; the trader picks one, once (D1) */
  rewardCycles: RewardCycle[]
  /** breach after this many calendar days without a fully closed trade; null = none (D3) */
  inactivityDays: number | null
  /** model conduct rules enforced by the engine (D2, D4, D8) */
  conduct: ConductRules
  /** approved prices for the lower daily-loss variant; null = not sold (D7) */
  dailyLossVariantPriceUsd: Record<number, number> | null
  /** true for the free trial: no fee, no reward, no conversion */
  free: boolean
}

export const challengePlans: ChallengePlan[] = [
  {
    slug: 'standard',
    name: text('Standard', 'استاندارد'),
    tagline: text('The classic two-phase evaluation', 'ارزیابی کلاسیک دومرحله‌ای'),
    status: 'published',
    accountSizesUsd: [5_000, 10_000, 25_000, 50_000, 100_000],
    priceUsd: { 5000: 44, 10000: 80, 25000: 216, 50000: 349, 100000: 652 },
    phases: 2,
    phase1TargetPct: 8,
    phase2TargetPct: 5,
    dailyLossPct: 5,
    dailyLossPctAlt: 3,
    maxTotalLossPct: 10,
    drawdownMode: 'static',
    minTradingDays: 3,
    profitableDaysPer30: null,
    consistencyPct: 35, /* on-demand cycle only (see rewardCycles) */
    profitSplitPct: 80, /* bi-weekly cycle (headline) */
    profitSplitMonthlyPct: null, /* D1: no monthly cycle */
    payoutCapPct: 0,
    firstPayoutDays: null, /* per cycle (see rewardCycles) */
    minPayoutPct: 1,
    timeLimitDays: null,
    trialDaysPerPhase: null,
    refundPolicy: 'fourth-reward',
    referenceLeverageX: null,
    catalogVersion: 3,
    model: 'standard',
    rewardCycles: [
      { key: 'weekly', splitPct: 60, firstAfterDays: 7, everyDays: 7, consistencyPct: null, profitableDays: null, profitableDayPct: null, strikeLossPct: null },
      { key: 'biweekly', splitPct: 80, firstAfterDays: 14, everyDays: 14, consistencyPct: null, profitableDays: null, profitableDayPct: null, strikeLossPct: null },
      { key: 'on_demand', splitPct: 100, firstAfterDays: null, everyDays: null, consistencyPct: 35, profitableDays: 7, profitableDayPct: 0.5, strikeLossPct: 1 },
    ],
    inactivityDays: 30,
    conduct: { news: { mode: 'deduct', stage: 'funded', windowMin: 5, exemptHours: 5 }, holding: { mode: 'auto_close_daily', stage: 'funded' } },
    dailyLossVariantPriceUsd: null,
    free: false,
  },
  {
    slug: 'one-phase',
    name: text('One-phase', 'تک‌مرحله‌ای'),
    tagline: text('One target, one set of rules', 'یک هدف، یک مجموعه قاعده'),
    status: 'published',
    accountSizesUsd: [5_000, 10_000, 25_000, 50_000, 100_000],
    priceUsd: { 5000: 74, 10000: 111, 25000: 255, 50000: 353, 100000: 666 },
    phases: 1,
    phase1TargetPct: 12,
    phase2TargetPct: null,
    dailyLossPct: 3,
    dailyLossPctAlt: 2,
    maxTotalLossPct: 12,
    drawdownMode: 'static',
    minTradingDays: 0,
    profitableDaysPer30: null,
    consistencyPct: 35, /* on-demand cycle only (see rewardCycles) */
    profitSplitPct: 80, /* bi-weekly cycle (headline) */
    profitSplitMonthlyPct: null, /* D1: no monthly cycle */
    payoutCapPct: 0,
    firstPayoutDays: null, /* per cycle (see rewardCycles) */
    minPayoutPct: 1,
    timeLimitDays: null,
    trialDaysPerPhase: null,
    refundPolicy: 'none',
    referenceLeverageX: null,
    catalogVersion: 3,
    model: 'one-step',
    rewardCycles: [
      { key: 'biweekly', splitPct: 80, firstAfterDays: 14, everyDays: 14, consistencyPct: null, profitableDays: null, profitableDayPct: null, strikeLossPct: null },
      { key: 'on_demand', splitPct: 100, firstAfterDays: null, everyDays: null, consistencyPct: 35, profitableDays: 7, profitableDayPct: 0.5, strikeLossPct: 1 },
    ],
    inactivityDays: 30,
    conduct: { news: { mode: 'deduct', stage: 'funded', windowMin: 5, exemptHours: 5 }, holding: { mode: 'auto_close_daily', stage: 'funded' } },
    dailyLossVariantPriceUsd: null,
    free: false,
  },
  {
    slug: 'instant',
    name: text('Instant', 'آنی'),
    tagline: text('Funded from day one — no evaluation', 'از روز اول فاندشده — بدون ارزیابی'),
    status: 'published',
    accountSizesUsd: [5_000, 10_000, 25_000, 50_000, 100_000, 200_000],
    priceUsd: { 5000: 60, 10000: 88, 25000: 188, 50000: 244, 100000: 444, 200000: 888 },
    phases: 0,
    phase1TargetPct: null,
    phase2TargetPct: null,
    dailyLossPct: 3,
    dailyLossPctAlt: null,
    maxTotalLossPct: 5,
    drawdownMode: 'trailing',
    trailingLockAtProfitPct: 5,
    minTradingDays: 0,
    profitableDaysPer30: 7,
    consistencyPct: 15,
    profitSplitPct: 95,
    profitSplitMonthlyPct: null,
    payoutCapPct: 0,
    firstPayoutDays: null, /* per cycle (see rewardCycles) */
    minPayoutPct: 1,
    timeLimitDays: null,
    trialDaysPerPhase: null,
    refundPolicy: 'none',
    referenceLeverageX: null,
    catalogVersion: 3,
    model: 'instant',
    rewardCycles: [
      { key: 'biweekly', splitPct: 95, firstAfterDays: 14, everyDays: 14, consistencyPct: 15, profitableDays: null, profitableDayPct: null, strikeLossPct: null },
    ],
    inactivityDays: 30,
    conduct: { maxOpenRiskPct: 1, tradeIdea: { thresholdUsd: 50_000, belowPct: 3, atOrAbovePct: 2, reentryMin: 10 }, profitableDayRule: { days: 7, windowDays: 30, minPct: 0.25 }, news: { mode: 'prohibit', stage: 'all', windowMin: 10 }, holding: { mode: 'prohibit_weekend', stage: 'all' } },
    dailyLossVariantPriceUsd: null,
    free: false,
  },
  {
    slug: 'free-trial',
    name: text('Free Trial', 'تست رایگان'),
    tagline: text('14 days per phase — rehearse the challenge', '۱۴ روز در هر مرحله — تمرین چلنج'),
    status: 'published',
    accountSizesUsd: [5_000, 10_000, 25_000, 50_000, 100_000],
    priceUsd: { 5000: 0, 10000: 0, 25000: 0, 50000: 0, 100000: 0 },
    phases: 2,
    phase1TargetPct: 8,
    phase2TargetPct: 5,
    dailyLossPct: 5,
    dailyLossPctAlt: null,
    maxTotalLossPct: 10,
    drawdownMode: 'static',
    minTradingDays: 3,
    profitableDaysPer30: null,
    consistencyPct: null,
    profitSplitPct: 0, /* no reward from a trial */
    profitSplitMonthlyPct: null,
    payoutCapPct: 0,
    firstPayoutDays: null,
    minPayoutPct: null,
    timeLimitDays: 14, /* per phase */
    trialDaysPerPhase: 14,
    refundPolicy: 'none',
    referenceLeverageX: null,
    catalogVersion: 3,
    model: 'trial',
    rewardCycles: [
    ],
    inactivityDays: null,
    conduct: {},
    dailyLossVariantPriceUsd: null,
    free: true,
  },
]

/* ---- integrity: a broken plan must fail loudly, never render ---- */
export function assertPlansValid(plans: ChallengePlan[]): void {
  for (const p of plans) {
    if (!p.slug || !p.name.fa || !p.name.en) throw new Error(`plan ${p.slug || '(?)'}: missing identity`)
    if (!p.accountSizesUsd.length) throw new Error(`plan ${p.slug}: no account sizes`)
    for (const size of p.accountSizesUsd) {
      if (!(p.priceUsd[size] >= 0)) throw new Error(`plan ${p.slug}: missing price for ${size}`)
    }
    if (p.phases >= 1 && p.phase1TargetPct == null) throw new Error(`plan ${p.slug}: missing phase-1 target`)
    if (p.phases === 2 && p.phase2TargetPct == null) throw new Error(`plan ${p.slug}: two phases need two targets`)
    if (p.phases === 0 && (p.phase1TargetPct != null || p.phase2TargetPct != null)) throw new Error(`plan ${p.slug}: instant plan carries targets`)
    if (!(p.dailyLossPct > 0) || !(p.maxTotalLossPct > 0)) throw new Error(`plan ${p.slug}: loss limits must be positive`)
    if (!p.free && (p.profitSplitPct <= 0 || p.profitSplitPct > 100)) throw new Error(`plan ${p.slug}: invalid profit split`)
    if (p.drawdownMode === 'trailing' && p.trailingLockAtProfitPct == null) throw new Error(`plan ${p.slug}: trailing drawdown needs a lock point`)
    if (p.free !== (p.slug === 'free-trial')) throw new Error(`plan ${p.slug}: free flag mismatch`)
    if (p.free && (p.firstPayoutDays != null || p.profitSplitPct > 0 || p.rewardCycles.length)) throw new Error(`plan ${p.slug}: trial must not promise rewards`)
    /* catalog v3 terms only: rows published before v3 (e.g. a CMS not yet re-seeded) stay valid */
    if (!p.free && p.catalogVersion >= 3 && !p.rewardCycles.length) throw new Error(`plan ${p.slug}: a paid plan needs at least one reward cycle`)
    for (const c of p.rewardCycles) {
      if (!(c.splitPct > 0 && c.splitPct <= 100)) throw new Error(`plan ${p.slug}: invalid ${c.key} split`)
      if ((c.firstAfterDays == null) !== (c.key === 'on_demand')) throw new Error(`plan ${p.slug}: ${c.key} timing mismatch`)
    }
    if (p.dailyLossVariantPriceUsd) for (const size of p.accountSizesUsd) {
      if (!(p.dailyLossVariantPriceUsd[size] > 0)) throw new Error(`plan ${p.slug}: variant price missing for ${size}`)
    }
  }
}
assertPlansValid(challengePlans)

/** Only complete, approved-for-display plans reach public surfaces. */
export function publishedPlans(): ChallengePlan[] {
  return challengePlans.filter(p => p.status === 'published')
}

export function planBySlug(slug: string): ChallengePlan | undefined {
  return challengePlans.find(p => p.slug === slug)
}

/* ---- legacy bridge ------------------------------------------------------
   Serialized shape consumed by the classic landing scripts (app.js
   builder + features.js tables) via window.__ofPlans. Keys match the
   landing's data-preset buttons: standard | one-phase | instant. The
   free trial is not a builder preset (it renders as its own banner). */
export interface LegacyPreset {
  name: [string, string]           /* [fa, en] */
  tagline: [string, string]
  slug: string
  sizes: number[]
  prices: Record<number, number>
  split: number
  splitMonthly: number | null
  loss: number                     /* max total loss % */
  lossMode: 'static' | 'trailing'
  dailyLoss: number
  dailyLossAlt: number | null
  phases: number
  phase1Pct: number | null
  phase2Pct: number | null
  cap: number
  minDays: number
  profitableDays: number | null
  consistency: number | null
  timeLimitDays: number | null
  leverage: number
  refund: 'none' | 'fourth-reward'
}

export function serializeForLegacy(plans: ChallengePlan[]): Record<string, LegacyPreset> {
  const out: Record<string, LegacyPreset> = {}
  for (const p of plans) {
    if (p.slug === 'free-trial') continue /* rendered as a banner, not a preset */
    out[p.slug] = {
      name: [p.name.fa, p.name.en],
      tagline: [p.tagline.fa, p.tagline.en],
      slug: p.slug,
      sizes: [...p.accountSizesUsd],
      prices: { ...p.priceUsd },
      split: p.profitSplitPct,
      splitMonthly: p.profitSplitMonthlyPct ?? null,
      loss: p.maxTotalLossPct,
      lossMode: p.drawdownMode,
      dailyLoss: p.dailyLossPct,
      /* D7: the lower daily-loss variant is shown only when it is priced (purchasable) */
      dailyLossAlt: p.dailyLossVariantPriceUsd ? p.dailyLossPctAlt ?? null : null,
      phases: p.phases,
      phase1Pct: p.phase1TargetPct,
      phase2Pct: p.phase2TargetPct,
      cap: p.payoutCapPct,
      minDays: p.minTradingDays,
      profitableDays: p.profitableDaysPer30 ?? null,
      consistency: p.consistencyPct ?? null,
      timeLimitDays: p.timeLimitDays,
      leverage: p.referenceLeverageX ?? 50,
      refund: p.refundPolicy,
    }
  }
  return out
}
