# Security assessment — 27 November 2026 (v0.9.0)

A dedicated internal assessment written before the v0.9.0 release. It
follows the [November 2026 self-assessment](SECURITY-AUDIT-2026-11.md) and
its [penetration test](PENETRATION-TEST-2026-11.md) and records only what
changed since then. **It is not an independent audit.** No third party has
audited Openfund, and nothing here is a certification.

## Scope and method

- Code review of the admin API and the Backstage operations console, the
  rate limiter, the Open Oracle public API, payment verification after the
  2026-11-18 incident, licensing of integrated components, and the
  repository's dependency advisories.
- A read-only agent review of the backend, payments, payouts and the new
  operator model; its findings are in [Code review](#code-review).
- Evidence: unit and integration tests named per finding, the CI run of the
  pull request that carries each fix, Dependabot and the GitHub check runs.
- Not in scope: a deployed penetration test, Directus 12, the IRAN runtime
  on Liara, and wallet/device acceptance. These stay as in the earlier
  assessment.

## Findings

| ID | Severity | Area | Finding | Status | Evidence |
|---|---|---|---|---|---|
| OF-2026-11-22 | High | Admin API, Backstage | Every person used one shared `ADMIN_API_TOKEN`, and the operator named themselves in `X-Admin-Actor`. Anyone holding the token could act under any name, and every operator had every permission. | Fixed in v0.9.0: named operators (`admin_operators`, scrypt verifiers), roles `owner`/`finance`/`support`/`content`/`viewer` checked per path, unknown or disabled operators refused, the token is a Backstage service credential only | `apps/backend/test/admin-operators.test.mjs`, `apps/backstage/operations/test/server.test.js` |
| OF-2026-11-23 | Medium | Payments | The 2026-11-18 DePay purchase settled 1.5 % below the order total (10.638 of 10.80 USDC); the order showed "Verification Pending" with no path to complete it ([incident](../payments/INCIDENT_2026-11-18.md)). | Code fixed in v0.8.0 (Openfund Pay partial payments, status precedence, DePay off for new payments). **Open operationally:** the owner still has to reconcile the order in Backstage, and the manual ~$10 transfer (Test B) is unidentified | `openfund-pay.test.mjs` P03, P04, P23 |
| OF-2026-11-24 | Low | Backstage | Failed sign-ins were counted in one window for everybody: ten wrong passwords for any name locked every operator out for five minutes. | Fixed: per-account-name buckets under an overall ceiling | `apps/backstage/operations/test/server.test.js` |
| OF-2026-11-25 | Low | Open Oracle | `GET /api/oracle/stream` capped total streams (2,000) but not streams per visitor, so one address could hold the shared capacity. | Fixed: six concurrent streams per visitor (`429 too_many_streams`) | `apps/backend/open-oracle.js` |
| OF-2026-11-08 | Info | Backend | The rate limiter was in memory and per process. | Fixed (v0.9.0): counters shared and persistent in PostgreSQL | `test/rate-limit-store.test.mjs` |
| OF-2026-11-04 | Medium | Web wallet SDK | `npm audit` reports 20 high in `apps/web-react`. They are two advisories counted once per dependent package: `zod` 3.x (through `abitype`, `@coinbase/cdp-sdk` and `@reown/appkit-wallet`) and `decode-uri-component` 0.2.2 (through `query-string` 7 in `@walletconnect/utils`). Both sit inside the wallet SDK and process data in the visitor's browser only. | Open: the `dependency-candidate` audit-fix run (45998219801) found no compatible fix — npm's only proposal is a breaking downgrade to wagmi 2.15.0, and forcing `zod` 4 or `decode-uri-component` 0.5 (ESM-only) under `query-string` 7 would break the SDK. Fixed by the wagmi 3 / RainbowKit upgrade, planned after v0.9.0 | `npm audit`, Dependabot, run 45998219801 |
| OF-2026-11-09 | Medium | Dormant protocol package | 1 critical and 6 high development-tool advisories (`form-data`, `elliptic`, `undici`, `ws`, `tmp`, `serialize-javascript`, `secp256k1`) in `packages/openfund-protocol`. | Open: the package is dormant, never installed or built by the app, and CI blocks its activation | Dependabot, `protocol-dormant.test.mjs` |
| OF-2026-11-26 | Info | Licensing | The repository had no single open-source licence for Openfund's own code; integrated AGPL components (Pine/PineTS) and other third-party code needed explicit notices. | Fixed in v0.9.0: Apache-2.0 with an attribution `NOTICE` naming Openfund; third-party licences and notices kept with their components | `LICENSE`, `NOTICE` |
| OF-2026-11-27 | Info | Repository | A tracked `dist/` snapshot duplicated built output. | Fixed in v0.9.0: `dist/` retired and recorded in `docs/development/RETIRED.json`. The investor pack stays public by owner decision | `check-retired.mjs` |

Open items from the earlier assessment that this one does not change:
OF-2026-11-11 (Directus 11 advisories, blocked on licence), OF-2026-11-12
(shared Directus/API database credential: fixed in code, deployment pending)
and OF-2026-11-20 (IRAN edge base image).

## Code review

Verified by reading the code; fixed items carry tests where the behaviour is
testable without a deployed stack.

| # | Severity | Finding | Status |
|---|---|---|---|
| R1 | High | The `content` role could configure tournament prizes and issue them (funded accounts, coupons), a back door to owner-only entitlements | Fixed: tournaments are owner-only |
| R2 | Medium | Role checks were case-sensitive while Express routes are not (`/ADMIN/OPERATORS` skipped the owner-only check for reads) | Fixed: paths are lower-cased before the role check |
| R3 | Medium | A payment proven on chain whose migration pass, controlled order or entitlement became invalid before provisioning rolled back without opening a review | Open: needs a review outcome for these codes and a reservation of the migration pass; tracked for the next release |
| R4 | Medium | `finance` could change payment settings and associate an unmatched deposit with any order | Fixed: both are owner-only |
| R5 | Medium | Closing a live allocation checked for open trades outside a transaction, racing a new live order | Fixed: one transaction with the allocation locked |
| R6 | Medium | Bootstrap mode (no operators yet) trusts the actor name | Accepted until the owner creates the first operator; an owner action in this report |
| R7 | Low | Changing an operator named with other letter case returned a 500 | Fixed: case-insensitive match |
| R8 | Low | Two owners could remove each other at the same moment, leaving no owner | Fixed: changes are serialized with an advisory lock |
| R9 | Low | Fee-refund "paid" accepts any payout reference | Open: to use the payout verifier and claims like reward payouts |
| R10 | Low | A payout RPC check runs while row locks are held | Open (performance; bounded by the RPC timeout) |
| R11 | Low | Non-reward withdrawal decisions recorded no operator | Fixed: the verified operator is recorded and audited |
| R12 | Low | A malformed user id, an out-of-range chain id and an unbounded discrepancy id reached database casts (500) | Fixed: validated as 400/404 |
| R13 | Low | Attaching the same payout transaction to two migration requests at once could race | Open: an index would break the reuse that the product allows after a withdrawn request |
| R14 | Info | `support` could issue migration passes (funded starts) | Fixed: migration decisions are owner-only |
| R15 | Info | Large modules (`engine.js` 1,424 lines, `purchases.js` 1,414, `server.js` 1,194 with 30 inline routes), helpers duplicated across modules, and two payment ledgers side by side | Open: maintainability backlog; ESLint for the backend follows in its own pull request |

## Admin access model (v0.9.0)

- `ADMIN_API_TOKEN` is held only by the backend and Backstage
  (`BACKSTAGE_BACKEND_TOKEN`). No person needs it.
- People sign in to Backstage as named operators. `BACKSTAGE_OWNER` remains a
  break-glass owner with its own verifier; once operators exist, it must also
  exist as an `owner` operator for the backend to accept it.
- The backend checks, on every admin request: the service token (constant
  time), the operator named in `X-Admin-Actor` (active in `admin_operators`)
  and the operator's role for the method and path. Reads are allowed for every
  role except owner-only areas (operators, runtime and regional controls).
- Every change still needs password re-entry in Backstage, CSRF and the
  GLOBAL-region check. Audit rows carry the verified operator name and role.
- Residual risk: whoever obtains the service token itself can still name any
  active operator. The token stays a server secret (`sync: false`), and
  rotating it is the response to a suspected leak.

## Readiness

The v0.9.0 decision for **real customer funds stays NOT READY**, for the
reasons in the [earlier assessment](SECURITY-AUDIT-2026-11.md#readiness-decision):
no independent audit, the open High Directus finding, and the pending
deployment of the database-role separation. v0.9.0 closes the admin
attribution finding and the in-memory rate limiter.

## Owner actions

1. Create your owner operator, then one operator per person, before the next
   Backstage change (see the [operations guide](../backstage/OPERATIONS_GUIDE.md#add-operators-and-access-levels)).
2. Reconcile the 2026-11-18 DePay order and identify the manual transfer
   ([incident](../payments/INCIDENT_2026-11-18.md)).
3. Commission an independent audit before accepting real customer funds.
