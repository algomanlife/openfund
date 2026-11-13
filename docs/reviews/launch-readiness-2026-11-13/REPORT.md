# Launch readiness — 2026-11-13

Branch `agent/claude/launch-readiness`, based on `main` at `7f95433` (latest on
2026-11-13). **Not merged, not deployed.** No production system, secret or
financial record was touched. All results below come from an isolated local
PostgreSQL 17.11 cluster, a local Directus 11.17.4 and the production build of
this branch.

**Recommendation: No-Go for public challenge sales until the P0 owner items
in §6 are closed** (decisions D1–D8 are implemented; a calendar source and
legal review remain). The engineering P0 gaps found in this review are fixed on
this branch. What still blocks sales is legal text and product decisions the
repository cannot make.

## 1. Implementation matrix

| Requirement | State before | Gap found | Priority | Done on this branch | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Reward / withdrawal requests | `POST /withdrawals` accepted any amount (≤ $1M) from any wallet, no rule checked | Critical: unbounded, rule-free payout requests | P0 | Server-computed rewards on funded accounts only; all published payout terms enforced (`rewards.js`) | `test:rewards` 11/11; purchase E2E 18/18 |
| Passed challenge → review → funded demo | Final pass ended as `passed`; no review state, no funded stage | Standard/One-phase buyers could never reach a reward account | P0 | Operator review API; exactly one funded-demo account per approval (DB-enforced) | `test:rewards` E9 (concurrent approvals: one wins) |
| `PLAN-PAYOUT-CONDITIONS`, `PLAN-FEE-REFUND` | Advertised, not enforced | Launch blockers | P0 | Enforced; `RULES_VERSION` 2 freezes payout terms | `check:product-rules` green; blockers table updated |
| `PLAN-DAILY-LOSS-VARIANT` | Advertised, not sellable | No price exists | P0 | **Not changed** (needs owner price) | Still reported by `check:product-rules` |
| Rules snapshot immutability | v1 snapshots | Payout terms absent from v1 | P0 | v1 never rewritten; terms read from plan row and flagged per request | `test:rewards` E7 |
| Contact Us + support queue | None | No public support channel | P1 | Page, validated form, `support_messages`, Directus role | `test:support` 9/9; Scenario C 10/10 on Directus 11.17.4 |
| About Us | None | — | P1 | 12-section page, catalog-driven rule numbers | Screenshots, i18n check |
| Navigation, footer, sitemap | — | — | P1 | Resources menu, drawer, footer, `/sitemap.xml`, client SEO | `test:web` (11 suites) |
| Terminal support link | `mailto:support@openfund.dev` | Unverified mailbox on a non-production domain | P1 | Links to the Contact page | Diff |
| Purchase → provisioning → invoice | Implemented (PR #103/#110) | None found | P0 | Unchanged | Backend suite, purchase E2E 18/18, DePay E2E 40/40 |

## 2. Changes

Backend: `support.js` (public write-only endpoint and operator API),
`rewards.js` (eligibility, requests, reviews, funded-demo provisioning),
`evaluation.js` (rules v2, funded stage never passes), `engine.js` (stage-2
lineage), `admin.js` (rejection re-credits a reward and requires a reason),
`purchases.js` (old free-amount endpoint removed), `schema.sql` (additive:
`support_messages`, `support_message_events`, `challenge_reviews`, lineage
columns, reward columns, partial unique indexes), `seo.js`.

CMS: `register_support_tables.py` (bootstrap step 9): Support Agent role and
policy (2FA enforced; read; update status, assignment and notes only), contact
mailbox fields in `site_settings`, public-access probes.

Frontend: `features/company/*` (About, Contact, branded map), Prop
Withdrawals page rewritten to show reviews, rule-by-rule eligibility and
history; 193 new strings translated into Arabic, Russian and Chinese.

Bug found and fixed during verification: the form honeypot used
`left:-10000px`, which made Persian and Arabic mobile pages scroll sideways
(10,390 px wide). Replaced with a direction-neutral clip.

## 3. Evidence

| Scenario | Evidence | Result |
| :--- | :--- | :--- |
| A — visitor to paid challenge | `e2e/test-purchase-flow.cjs` (browser, disposable signer, `SIM_TEST_MODE` confirmation seam) and `e2e/test-depay-checkout.cjs` | 18/18 and 40/40 pass |
| B — wallet session | `test/siwe.test.mjs` including `openfi.cloud` / `openfund.cloud` origins (refresh, logout, expired session) | pass |
| C — support request | Backend → `support_messages` → Directus Support Agent: read, update status/notes, cannot edit message, cannot delete, no financial access; anonymous read/write refused | 10/10 pass |
| D — evaluation | `evaluation`, `engine-rules`, `engine-audit`, `prop-leverage` suites | pass |
| E — review and reward | `test/rewards.test.mjs` E9–E11 | pass |
| F — payment recovery | `purchases.test.mjs`: replay idempotent, one order/payment/invoice/challenge, same tx cannot pay a second order, grace-window payment; `payment-verification` A1–A9 | pass |
| G — rule consistency | `check:product-rules`: catalog = backend seed = normalized engine snapshot | pass |

Full backend suite (`npm run test:all`, CI-equivalent environment, server on a
test port): **exit 0, 698 passing checks, 0 failures in every suite**. Frontend:
`npm run typecheck` clean; `npm run test:web` 11 suites, 0 failures;
`node scripts/i18n-sources.mjs --check` clean for ar, ru, zh-CN.

The owner-reported real payment on production is **reported evidence only**.
No real payment was made or replayed here.

Screenshots: [`docs/assets/screenshots/launch-readiness/`](../../assets/screenshots/launch-readiness/)
(16 captures, desktop 1440 and mobile 390, dark and light, all five locales
represented, none with horizontal overflow; listed in the manifest).

## 4. Rule matrix and owner decisions

The owner decided D1–D8 on 2026-11-13: the current reference models are the
baseline, with Openfund's own leverage ceilings as the only approved
exception. They are implemented as **rules snapshot v3 / catalog v3**
(`apps/backend/model-rules.js`, `conduct.js`, `rewards.js`); snapshots sold
before v3 keep their recorded terms.

| # | Decision | Implemented as | Evidence |
| :--- | :--- | :--- | :--- |
| D1 | Reward cycles per model, chosen once | Standard weekly 60 / bi-weekly 80 / on-demand 100; One-step bi-weekly 80 / on-demand 100; Instant bi-weekly 95. Funded-demo account waits in `created` until the trader picks; `reward_cycle` is immutable (DB trigger). No monthly cycle. | `test:rewards` R1–R3, R6, R9 |
| D2 | Model-specific profitable days | On-demand: 7 days ≥ 0.5% of size; Instant: 7 days ≥ 0.25% per rolling 30-day period from the first trade (reset by a paid reward), from ledger records. | `test:conduct` M11, C6; R3 |
| D3 | 30-day inactivity | Evaluation and funded accounts; clock from account start or the day after the last fully closed trade; open positions do not count; idle accounts swept once a minute. | M10, C7 |
| D4 | Instant risk rules at engine level | 1% combined floating loss; 3% / 2% trade idea (below / from $50,000; same instrument and direction, 10-minute re-entry); news and weekend hard breaches; on-demand strike system (1% idea loss: 2 → half split, 3 → 20%, 4 → breach; struck profit not paid). | C3–C5, C8, C10, R4 |
| D5 | Fourth-reward fee refund | Created exactly once when the 4th Standard reward is **paid** (`fee_refunds`, unique per order and per withdrawal), paid manually with its own reference. | R10, R11 |
| D6 | Openfund leverage ceilings | New snapshots carry no plan-wide cap: BTC/ETH 20×, other crypto 15×, forex/stocks/commodities/indices 50×, or a lower market limit. Displayed values have a parity test with the engine. Older snapshots keep 5×. | C12, product-rules |
| D7 | Daily-loss variants | Order field `dailyLossVariant`, frozen in the snapshot (Standard 3% also removes minimum trading days). **Not sold**: no approved price; hidden from the landing. | M13, challenge-plans |
| D8 | News, overnight, weekend | Funded Standard/One-step: daily auto-close 15 minutes before the 21:00/22:00 UTC close; news profit deduction (±5 min, 5-hour exemption). Instant: news (±10 min) and weekend hard breaches. Evaluations unrestricted. Calendar = operator-imported licensed source with verified coverage; **plans that depend on it are not sold without coverage**. Swing add-on not offered (not priced). | M2–M6, C9, C11, R5 |

Open decision **D9**: the reference states the Instant trailing limit does
not reset after a reward. Applied literally, a breakeven-locked floor equals
the post-reward balance and the account would breach at once. Until decided,
trailing restarts from the post-reward balance (`rewards.js`).

Defect found and fixed while implementing: a challenge started without a
frozen snapshot was provisioned from an empty configuration instead of its
plan (it silently lost its plan rules; only the old 5× default had masked it).
Regression test C14.

## 5. CMS and support workflow

Directus stays on 11.17.4 (no upgrade). `bootstrap-cms.sh` ran end to end
against Directus 11.17.4 with the new step 9. The public policy has no access
to `support_messages`/`support_message_events`; the submitted message is
immutable at the database level; no email notification is sent (no verified
mail infrastructure). Department mailboxes are empty `site_settings` fields:
the page shows each department without an address until the owner enters a
verified mailbox.

## 6. Outstanding blockers (owner)

P0, required before public sales:

1. **Licensed economic-calendar source.** Every paid plan depends on news
   rules (D8), so with no verified coverage the server refuses to sell
   Standard, One-step and Instant (by design). Choose and license a source,
   then import events through `POST /admin/calendar/import` at least 7 days
   ahead, continuously.
2. **Legal review** of the drafts in
   [`docs/legal/drafts/`](../../legal/drafts/README.md) (Terms of Service,
   Privacy Policy, Refund Policy). Nothing is published until approved.
3. Decision D9 (Instant trailing after a reward).
4. Human review and merge of this PR, then an approved deploy with, in
   order: backend migration; `npm --prefix apps/backend run seed-plans`
   (catalog v3 replaces older plan rows by version); CMS bootstrap with the
   support step and a `--refresh` of `trading_rules` for the rewritten
   Rulebook sections (overwrites editorial edits of those rows).
5. Production acceptance of one paid purchase → challenge → dashboard on the
   deployed build.

P1:

6. Prices for the daily-loss variants (D7) and the Swing add-on, if they are
   to be sold.
7. Verified mailboxes for support, legal, technical and community.
8. Exact office pin (Alley 13 is not in OpenStreetMap).
9. Confirm ownership of `t.me/communitybuopenfund`.

Not re-audited in this pass: licensing, terminal chart SL/TP creation, lot
sizing and production capacity (demonstrated locally: 500 chart users +
1,000 visitors).

## 7. Production risks

- Removing the free-amount withdrawal form changes customer behaviour:
  customers without a funded account can no longer submit a request (intended).
- Reward reservation changes the funded account balance; it is covered by
  ledger rows and tests, but it is new financial code. Review before merge.
- Rollback after the first funded-demo approval needs care (see ADR 0029).
- Several new `PLAN` terms are enforced from catalog values that differ from
  the current reference (D1, D5). Publishing before the decisions risks
  advertising terms that later change for existing customers. Snapshots
  protect accounts already sold.
