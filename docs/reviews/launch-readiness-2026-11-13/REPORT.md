# Launch readiness — 2026-11-13

Branch `agent/claude/launch-readiness`, based on `main` at `7f95433` (latest on
2026-11-13). **Not merged, not deployed.** No production system, secret or
financial record was touched. All results below come from an isolated local
PostgreSQL 17.11 cluster, a local Directus 11.17.4 and the production build of
this branch.

**Recommendation: No-Go for public challenge sales until the P0 owner items
in §6 are closed.** The engineering P0 gaps found in this review are fixed on
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

Reference pages were re-read on 2026-11-13 in a browser session (see
[Product rules](../../product/PRODUCT_RULES.md#reference-re-verification-2026-11-13)).
Evaluation limits match the catalog. Openfund's enforced values, and the
points where the current reference differs:

| # | Topic | Openfund (enforced on this branch) | Current reference | Decision needed |
| :--- | :--- | :--- | :--- | :--- |
| D1 | Reward cycles, Standard / One-phase | Per request: bi-weekly 80%, or monthly (30 days) 100% with 35% consistency and 7 profitable days | Chosen once at the funded stage: weekly 60% (Standard only), bi-weekly 80%, on-demand 100% with 35% consistency, 7 profitable days and a 1% open-loss strike system | Keep Openfund's monthly cycle, or adopt weekly/on-demand chosen once |
| D2 | Profitable day | Any day with positive realized net PnL | Day with ≥ 0.5% of the starting size | Threshold to publish and enforce |
| D3 | Inactivity | None | Breach after 30 days without a completed trade (all models) | Adopt or not |
| D4 | Instant (Zero) extra rules | Not enforced | 1% max open risk; news window and weekend holding are hard breaches; 7 profitable days per rolling 30 days to stay active | Adopt (needs engine work) or keep current Instant terms |
| D5 | Fee refund with the fourth reward (Standard) | Enforced (from the catalog) | Not stated on the current Standard page | Keep as an Openfund term or remove |
| D6 | Leverage | Challenge accounts: min(owner policy 20×/15×/50×, plan `referenceLeverageX` 5×) → **5× everywhere**. Free demo: 20×/15×/50× | FX 1:100, metals 1:30, indices 1:20, crypto 1:2 (1:1 funded) | Keep 5× for challenges, or raise `referenceLeverageX` |
| D7 | Daily-loss variant (3% / 2%) | Displayed, not sellable | Sold as an add-on; removes minimum trading days on Standard | Price per variant, or remove from public copy |
| D8 | Funded-stage holding and news | Not restricted | Standard funded: auto-close overnight/weekend; news window profits deducted | Adopt or state Openfund's own policy |

Also needed before sales: the Rulebook sections `funded` and `payouts` are
still marked "planned". They must be rewritten to describe the now-enforced
review and reward process once D1–D5 are decided. That text is policy and
needs owner approval.

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

1. **Terms of Service, Privacy Policy and Refund Policy do not exist** anywhere
   in the repository or CMS seeds. The Contact page lists them as "pending
   legal publication" and does not link to them. They need legal drafting and
   approval.
2. Decisions D1–D8, then the Rulebook `funded`/`payouts` text update.
3. Deploy approval for this branch, then a production run of
   `register_support_tables.py` (or the full bootstrap) and the additive
   migration.
4. Production acceptance of one complete paid purchase → challenge → dashboard
   on the deployed build (the owner's reported payment covers the payment leg
   only).

P1:

5. Verified mailboxes for support, legal, technical and community.
6. Exact office pin. OpenStreetMap does not map Alley 13; the page shows the
   verified Daneshamooz Street × Mehr Boulevard point and says so.
7. Confirm `t.me/communitybuopenfund` is the owner's group (it resolves to
   "OpenFund | Community"; ownership cannot be verified from outside).

Not re-audited in this pass, with earlier findings still open: licensing
(first-party license, AGPL-linked PineTS, vendored chart and font provenance,
MetaMask SDK terms), terminal SL/TP creation from the chart, lot sizing, and
production capacity (the demonstrated local result remains 500 chart users +
1,000 visitors; the 1,500 + 2,000 target is not demonstrated).

## 7. Production risks

- Removing the free-amount withdrawal form changes customer behaviour:
  customers without a funded account can no longer submit a request (intended).
- Reward reservation changes the funded account balance; it is covered by
  ledger rows and tests, but it is new financial code. Review before merge.
- Rollback after the first funded-demo approval needs care (see ADR 0028).
- Several new `PLAN` terms are enforced from catalog values that differ from
  the current reference (D1, D5). Publishing before the decisions risks
  advertising terms that later change for existing customers. Snapshots
  protect accounts already sold.
