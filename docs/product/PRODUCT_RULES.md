# Product Rules Authority and Launch Blockers

This document defines where challenge plan rules live, how their consistency is
checked and which advertised rules the backend does not yet enforce.

## Single source of truth

| Layer | File | Role |
| :--- | :--- | :--- |
| Catalog (authoritative) | `apps/web-react/src/data/challengePlans.ts` | Every public plan value: sizes, prices, targets, loss limits, trading days, reward terms. |
| Backend mirror | `apps/backend/plan-catalog.js` | Configuration rows that `npm run seed-plans` writes to `challenge_plans`. Pure data. |
| Directus editing surface | `apps/backstage/scripts/seed_production_content.mjs` | Seeds `challenge_plans` from the catalog file. |
| Evaluation engine | `apps/backend/evaluation.js` (`normalizeRules`) | Freezes the rules snapshot at provisioning and enforces it. |
| Support register | `apps/web-react/src/data/planRuleSupport.ts` | Classifies every catalog field as presentation, purchase, enforced, metric-only or not implemented. |
| Public copy | Rulebook, FAQ seeds, Challenges page | Derived from or checked against the catalog. |

`npm --prefix apps/web-react run check:product-rules` (also part of `test:web`
and CI) fails when:

- a published plan has no backend row, or the backend has a plan the catalog
  does not publish;
- a size, a server price or any normalized engine rule differs between the
  catalog and the backend mirror;
- a catalog field is not classified in the support register;
- the set of advertised-but-unsupported rules changes without updating the
  register below;
- public copy claims there are no minimum trading days while a published plan
  requires them.

The check runs on repository data. It cannot see rows already stored in a live
database: `seed-plans` updates only the plan `name` on conflict, so a live
`challenge_plans.configuration` row edited by hand can still drift. On
2026-11-10 the public production endpoint `/purchases/plans` returned the same
sizes and prices as the catalog and `paymentsEnabled: false`.

## Launch blockers

A rule that a published plan advertises but the backend does not enforce is a
launch blocker. It is resolved by implementing backend support, never by
changing the published rule to fit the code.

| ID | Status | Rule | Plans | Gap |
| :--- | :--- | :--- | :--- | :--- |
| `PLAN-DAILY-LOSS-VARIANT` | Implemented, not sold (no approved price) | Cheaper daily-loss option (`dailyLossPctAlt`: 3% Standard, 2% One-phase) | Standard, One-phase | Orders carry only plan and size; the engine enforces `dailyLossPct` only; no variant price exists. Needs an owner price per variant (or removal from public copy). |
| `PLAN-PAYOUT-CONDITIONS` | Implemented (local, branch `agent/claude/launch-readiness`) | Reward split, monthly 100% cycle, first payout after 14 days, 1% minimum request, consistency score, profitable days | Standard, One-phase, Instant | Enforced by `apps/backend/rewards.js` ([ADR 0028](../decisions/0028-reward-lifecycle-and-support-queue.md)). Cycle semantics still differ from the current reference model — owner decision D1 in the [launch-readiness report](../reviews/launch-readiness-2026-11-13/REPORT.md). |
| `PLAN-FEE-REFUND` | Implemented (local) | Standard fee refunded with the fourth reward | Standard | The fee paid on the originating order is added to the fourth reward request. The current reference page no longer states this term — owner decision D5. |

Production payments were enabled after 2026-11-10 (the owner reports a completed
real payment on the deployed `7f95433`); end-to-end acceptance of the deployed
purchase-to-provisioning flow is tracked in the launch-readiness report.

The register classifies payout terms as `reward`: frozen into the rules
snapshot (`RULES_VERSION` 2) and enforced by the reward eligibility engine on
funded accounts. Snapshots taken before version 2 are never rewritten; their
payout terms are read from the plan row and flagged on every request.

## Policy references

Openfund plan terms are original Openfund terms. External programs are used
only as structural references; their wording is never copied and models are
never mixed within one Openfund plan.

| Reference | Role | URL | Verified | Result |
| :--- | :--- | :--- | :--- | :--- |
| FundingPips — Compare Account Models | Primary (account models) | <https://help.fundingpips.com/hc/en-us/articles/48368490585105-Compare-Account-Models> | 2026-11-10 | Loaded in a browser session. Model lineup and core limits match the catalog mapping below. |
| FundingPips — Trading Objectives | Primary (objectives, reward cycles) | <https://fundingpips.com/trading-objectives> | 2026-11-10 | Loaded in a browser session (direct HTTP fetch is rate limited). |
| Carrot Funding — Rulebook | Secondary (policy categories) | <https://carrotfunding.io/rulebook/> | 2026-11-10 | Loaded. Used only as a checklist of policy topics. |

### Catalog mapping (FundingPips, verified 2026-11-10)

| Openfund plan | Reference model | Matches | Differences to review |
| :--- | :--- | :--- | :--- |
| Standard | 2 Step Standard | 8% / 5% targets, 3% or 5% daily loss, 10% static, 3 minimum trading days per phase (help center) | The objectives page shows "from 0 days" for configurable variants. Reference reward cycles are weekly 60%, bi-weekly 80% and on-demand 100%; the catalog publishes bi-weekly 80% and a monthly 100% cycle. |
| One-phase | 1 Step Flex | 12% target, 2% or 3% daily loss, 12% static, no minimum days | Reference rewards are bi-weekly 80% and on-demand 100%. |
| Instant | Zero | 3% daily loss, 5% trailing, 7 profitable days per 30, 95% bi-weekly, 15% consistency | The reference also has a 1% maximum open-risk limit, a news-trading breach rule and a 30-day inactivity rule; the catalog has none of these. |
| Free Trial | Free access program | 14 days per phase, Standard rules | Detailed reference terms not re-verified. |

Leverage in the reference (for example FX 1:100, or 1:50 on Zero) is not
adopted; Openfund publishes its own reference leverage of 5x per plan.

### Policy topics requiring legal review

The following topics appear in the secondary reference and are binding once
published. Openfund has no approved text for them. Each **requires legal
review** before any public statement:

- prohibited strategies (cross-account hedging, latency or platform exploits,
  very short holding-time profits);
- news trading and weekend or overnight holding;
- identity verification timing and restricted jurisdictions;
- account sharing, third-party trading and related-account treatment;
- breach finality and payout eligibility after a breach;
- fee refunds and their exceptions;
- inactivity rules.

The Rulebook and FAQ describe only the rules in the catalog. None of the
topics above is presented as an Openfund policy.

### Reference re-verification (2026-11-13)

Loaded in a browser session (direct HTTP fetches of the help center return 403):
[2 Step Standard](https://help.fundingpips.com/hc/en-us/articles/34501809112081-2-Step-Standard),
[1 Step Flex](https://help.fundingpips.com/hc/en-us/articles/34501697434385-1-Step-Flex),
[FundingPips Zero](https://help.fundingpips.com/hc/en-us/articles/34502157694865-FundingPips-Zero).
Evaluation limits still match the catalog (8% / 5%, 3% or 5% daily, 10% static;
12%, 2% or 3% daily, 12% static; Zero 3% daily, 5% trailing locking at
breakeven). Differences that need an owner decision before public sales are
listed with their exact interpretation in the
[launch-readiness report](../reviews/launch-readiness-2026-11-13/REPORT.md#4-rule-matrix-and-owner-decisions).
No reference wording is reproduced in Openfund copy.

### Owner decisions D1–D8 (2026-11-13)

Applied as catalog v3 / rules snapshot v3 — see the
[launch-readiness report](../reviews/launch-readiness-2026-11-13/REPORT.md#4-rule-matrix-and-owner-decisions).
The catalog fields `rewardCycles`, `inactivityDays`, `conduct` and
`dailyLossVariantPriceUsd` are classified in the support register;
`profitSplitMonthlyPct` and `firstPayoutDays` are null on every published
plan. `npm run seed-plans` replaces a stored plan configuration only when the
catalog version is higher.
