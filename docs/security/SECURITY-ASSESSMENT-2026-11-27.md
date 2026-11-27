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
| OF-2026-11-04 | Medium | Web wallet SDK | `zod` (high) and `decode-uri-component` (high, medium) through wagmi/RainbowKit. The earlier report of "20 high" counted the dormant protocol package; the web app has 2 high and 1 medium. | Open: no npm registry access from the agent environment; fixed through the `dependency-candidate` workflow when it produces a passing candidate. Not in the shipped first-party bundle | Dependabot |
| OF-2026-11-09 | Medium | Dormant protocol package | 1 critical and 6 high development-tool advisories (`form-data`, `elliptic`, `undici`, `ws`, `tmp`, `serialize-javascript`, `secp256k1`) in `packages/openfund-protocol`. | Open: the package is dormant, never installed or built by the app, and CI blocks its activation | Dependabot, `protocol-dormant.test.mjs` |
| OF-2026-11-26 | Info | Licensing | The repository had no single open-source licence for Openfund's own code; integrated AGPL components (Pine/PineTS) and other third-party code needed explicit notices. | Fixed in v0.9.0: Apache-2.0 with an attribution `NOTICE` naming Openfund; third-party licences and notices kept with their components | `LICENSE`, `NOTICE` |
| OF-2026-11-27 | Info | Repository | A tracked `dist/` snapshot duplicated built output. | Fixed in v0.9.0: `dist/` retired and recorded in `docs/development/RETIRED.json`. The investor pack stays public by owner decision | `check-retired.mjs` |

Open items from the earlier assessment that this one does not change:
OF-2026-11-11 (Directus 11 advisories, blocked on licence), OF-2026-11-12
(shared Directus/API database credential: fixed in code, deployment pending)
and OF-2026-11-20 (IRAN edge base image).

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
