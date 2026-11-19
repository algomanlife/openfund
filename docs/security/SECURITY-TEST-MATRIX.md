# Security test matrix — November 2026

These results come from the [November 2026 assessment](SECURITY-AUDIT-2026-11.md).
Every row records a command that was actually run on 2026-11-19. They ran
against a disposable PostgreSQL database and a local backend on a test port
(`SIM_TEST_MODE=1`, generated test admin token). No deployed environment was
contacted.

Result values: PASS, FAIL, NOT RUN, BLOCKED, NOT APPLICABLE.

## Security regression tests added in this pass

| Test | Covers | Result |
| --- | --- | --- |
| `apps/backend/test/auth-hygiene.test.mjs`: internal token guard | A token of the wrong length or a missing token gives 401, never 500. Both header forms work | PASS |
| `apps/backend/test/auth-hygiene.test.mjs`: unset token | Keeps the documented test-mode behaviour | PASS |
| `apps/backend/test/auth-hygiene.test.mjs`: expiry sweep (PostgreSQL) | Expired nonces and sessions are deleted, live rows are kept | PASS |
| `apps/backend/test/chart-workspaces.test.mjs`: malformed scope | Gives 400 `invalid_scope`, not 500. It failed on the unpatched code (500) | PASS |

## Existing suites re-run on the remediation branch

| Command (in `apps/backend`) | Area | Result |
| --- | --- | --- |
| `node test/siwe.test.mjs` | SIWE nonce, domain, chain, replay, sessions, ownership | PASS (24/24) |
| `node test/admin.test.mjs` | Admin token gating, operator actions | PASS (26/26) |
| `npm run test:payments` | Chain verification, manual payments, Openfund Pay ledger, payments admin | PASS (92 + payments-admin) |
| `npm run test:purchases` | Order pricing, coupons, idempotency | PASS (32). One HTTP lifecycle case skipped because no payment receiver was configured on the test server |
| `npm run test:commerce` | Commerce flows | PASS (34) |
| `npm run test:rewards` | Withdrawals, payout settlement evidence | PASS (19) |
| `npm run test:referral` | Referral attribution, self-referral | PASS (18) |
| `npm run test:static` | Static cache, SEO, geo | PASS (25) |
| `npm run test:edge` | Edge client IP key | PASS (5) |
| `npm run test:stream` | Trading stream session revocation | PASS (13) |
| `npm run test:chart-workspaces` | Wallet isolation of chart state | PASS (7) |

## Scanners

| Command | Result |
| --- | --- |
| `gitleaks git --config gitleaks.toml --redact` (full history) | PASS: no leaks in 563 commits |
| `npm audit --package-lock-only`, `apps/backend` | PASS: 0 advisories |
| `npm audit --package-lock-only`, `apps/backstage` | PASS: 0 advisories |
| `npm audit --omit=dev --audit-level=high`, backend and Backstage (the new CI gate) | PASS |
| `npm audit --package-lock-only`, `apps/web-react` | FAIL: 16 high and 12 moderate (OF-2026-11-04, open) |
| `npm audit --package-lock-only`, `apps/open-trade` | FAIL: 6 moderate, build tooling (OF-2026-11-06, open) |
| GitHub Dependabot alerts, `packages/openfund-protocol` | FAIL: 11 critical (development) plus high, including OpenZeppelin runtime (OF-2026-11-09, open) |
| `actionlint` (all workflows) | PASS: shellcheck style warnings only |
| `npm run docs:check` | PASS |
| `npm run validate:blueprint` | PASS: 3 services, 1 database |

## Not run

| Check | Status | Reason |
| --- | --- | --- |
| Full `npm run test:backend` (`test:all`) | NOT RUN | Only the suites in the security scope ran. CI runs the full suite on the pull request |
| Engine, evaluation, governance, region and regional-sync suites | NOT RUN | Outside the code changed in this pass. CI runs them |
| Frontend typecheck, unit tests and build | NOT RUN locally | No frontend code changed. CI runs them |
| Browser end-to-end journeys | NOT RUN | No UI changed |
| CodeQL, Semgrep, Trivy, OSV-Scanner, OWASP ZAP, SBOM | NOT RUN | Not installed. See the remediation plan |
| Container image scanning | NOT RUN | No scanner available |
| Load, fuzz and concurrency stress testing | NOT RUN | Out of scope for this pass |
| Any test against a deployed environment | NOT APPLICABLE | Not authorized, and not attempted |
