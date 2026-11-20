# Security test matrix — November 2026

These results come from the [November 2026 assessment](SECURITY-AUDIT-2026-11.md) and the
[penetration test](PENETRATION-TEST-2026-11.md). Every row records a command
that was actually run on 2026-11-19, against disposable local runtimes only.

Result values: PASS, FAIL, NOT RUN, BLOCKED, NOT APPLICABLE.

## Full backend suite on a fresh database

`npm run test:all` (in `apps/backend`) ran on a newly created test database
against the test server (`SIM_TEST_MODE=1`, test admin token, CI placeholder
receiver). Exit code 0.

| Suite | Result |
| --- | --- |
| static, SEO, geo, stream, edge IP, auth hygiene, invariants (`node --test` group) | PASS (54) |
| SIWE | PASS (24/24) |
| trading | PASS (55) |
| portfolio | PASS (31) |
| products | PASS (58) |
| Gains portfolio | PASS (5) |
| audit | PASS (11) |
| unified | PASS (26) |
| referral | PASS (18) |
| evaluation | PASS (48) |
| engine (rules, audit, leverage, equity sampling, split process) | PASS (45 + 5) |
| admin | PASS (26) |
| purchases | PASS (53, 0 skipped) |
| economy | PASS (45) |
| governance | PASS (82) |
| payments (verification, manual, Openfund Pay, payments admin) | PASS (93 + 14) |
| commerce | PASS (34) |
| chart workspaces | PASS (7) |
| footprint | PASS (25) |
| support | PASS (9) |
| Backstage operations | PASS (12) |
| rewards and payout settlement | PASS (19) |
| conduct | PASS (27) |
| certificates | PASS (11) |
| CMS snapshot | PASS (6) |
| radar | PASS (9) |
| campaigns | PASS (4) |
| **penetration suite** | PASS (15) |

Note: the controlled-challenge commerce test issues the one controlled coupon
per profile that a database allows, so it passes only on a fresh database.
Running it again on a reused database fails with
`controlled_profile_already_issued`, both on `main` and on this branch.

`openfund-pay.test.mjs` P14/P15 failed once in about five runs on timing,
and passed on the reruns and in the fresh-database run.

## Security tests added

| Test | Covers | Before fix | After fix |
| --- | --- | --- | --- |
| `test/auth-hygiene.test.mjs` | Token guard (wrong length is 401), expired auth rows swept | RangeError and 500 reproduced | PASS |
| `test/chart-workspaces.test.mjs` malformed scope | 400, not 500 | FAIL (500) | PASS |
| `test/security-pentest.test.mjs` PT-01 to PT-15 | See the [penetration test](PENETRATION-TEST-2026-11.md) | PT-08 FAIL (500s) | PASS |
| `test/financial-invariants.test.mjs` | Evaluation and valuation invariants, 4,000 cases per property; seeds 1, 2, 3 and 20261119 with 20,000 cases also run | — | PASS |
| `openfund-pay.test.mjs` P23b, `commerce.test.mjs` D3 | Attested payment from a non-owner wallet is held; operator settles; owner opt-in | Auto-provisioned | PASS |
| `e2e/test-security-browser.cjs` B1 to B5 | Cookie and storage isolation, wallet switch, logout, CORS, framing | — | PASS (12/12) |

## Other suites

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run test:web` | PASS |
| `npm run build:web` | PASS |
| `npm --prefix apps/backstage test` | PASS (16) |
| `npm run docs:check` | PASS |
| `npm run validate:blueprint` | PASS |

## Scanners

| Tool and version | Scope | Result |
| --- | --- | --- |
| CodeQL (GitHub default setup) | Repository | 67 open alerts triaged; 2 fixed (OF-2026-11-13, -14), the rest false positives, vendored code or accepted (OF-2026-11-19) |
| Semgrep 1.185.0 | First-party code, 6 rule packs | 221 results; no true positive in first-party code |
| OSV-Scanner 2.7.1 | All lockfiles | See the dependency summary in the report |
| Trivy 0.76.2 fs, config and image | Lockfiles, Dockerfiles, base images, Directus image | Dockerfiles: 0 misconfigurations. Images: OF-2026-11-20 |
| gitleaks 8.30.1 | History (563 commits) and working tree | History clean; 49 working-tree false positives |
| actionlint 1.7.12 | Workflows | No errors |
| zizmor 1.32.0 | Workflows | 106 findings before #148; 3 after (accepted) |
| OWASP ZAP 2.16.1 baseline | Test server | 0 FAIL, 8 WARN, 59 PASS |
| OWASP ZAP 2.16.1 full (active, 30-minute limit) | Test server | 0 FAIL, 5 WARN, 135 PASS. The `Bypassing 403` warning (`X-Original-URL: /admin`) is a false positive: the response is byte-identical to `GET /` (the SPA index), Express ignores the header, and `/admin/*` stays 403. The other warnings are CSP (accepted, OF-2026-11-16), timestamps in bundles, Spectre-isolation headers (informational) and the ZAP version notice |
| Syft 1.57.1 | Repository SBOM (CycloneDX) | Generated, kept privately |
| npm audit | Four apps | Backend and Backstage production: 0. Web: OF-2026-11-04. Desktop: OF-2026-11-06 |

## Follow-up remediation checks (2026-11-19)

Run for the [remediation report](SECURITY-REMEDIATION-2026-11.md) on
disposable local runtimes (Docker PostgreSQL 17 with a non-superuser
`CREATEROLE` owner, Directus 11.17.4) and in each pull request's CI.

| Check | Command or job | Result |
| --- | --- | --- |
| Original OF-2026-11-12 finding before the fix | `db-roles.test.mjs` HTTP test on the shared credential | FAIL as expected (admin could pass a challenge) |
| Directus role isolation | `node --test scripts/ops/test/db-roles.test.mjs`; CI `CMS security` | PASS (12/12) |
| Role policy apply twice and drift check | `node scripts/ops/db-roles.mjs apply` / `verify` | PASS (`ok: true`) |
| CMS bootstrap across a restart on the Directus role | `scripts/release/test-cms-bootstrap.mjs before`/`after` | PASS |
| Backend on the runtime role | `npm run test:all` suites with the server on `openfund_runtime` | Server: 0 privilege errors. Harness DDL tests (governance fixtures, `unified` schema, 3 fault-injection triggers) need the owner role |
| Directus SSRF before the controls | `POST /files/import` `http://0.0.0.0:8055` | Reproduced (200) |
| Directus 11.x controls | `node --test scripts/ops/test/directus-hardening.test.mjs` | PASS (7/7). Negative control on the default configuration: FAIL as expected |
| Directus 12.7.0 licence entitlements | `GET /license` on a fresh instance | Core: 25 collections, no custom permission rules |
| Edge image | `trivy image` on the built image | 0 Critical, 0 High, 0 Medium |
| Edge contract and wallet auth through the edge | CI `Build and contract-test the edge image`, `Wallet sign-in, cookies, CSRF and client IP through the edge` | PASS |
| Web after the `uuid` override | `typecheck`, `test:web` (299), `build:web`, `test-wallet-connect.cjs` (32/32), `test-security-browser.cjs` (12/12) | PASS |
| Desktop after the `minimatch` override | `npm test` (4/4), `build`, `electron-builder --dir`, `test:desktop`; CI Linux, Windows and macOS | PASS |
| Protocol activation block | `node --test scripts/ci/protocol-dormant.test.mjs` | PASS (4/4); a mutation fails it |
| Client IP behind Cloudflare | `client-ip.test.mjs`, `geo.test.mjs`, `edge-client-ip.test.mjs` | PASS (27/27). Before the fix, a second visitor on one edge got 429 |
| Auth and pentest on the rate-limit branch | SIWE 44/44, `test:security` 11/11, `test:pentest` 15/15, `test:admin` 26/26 | PASS |
| Security automation gates | `security.yml` jobs run locally from the pinned images | Clean on `main`; each blocking gate fails on a seeded violation ([security automation](SECURITY-AUTOMATION.md)) |

## Not run

| Check | Status | Reason |
| --- | --- | --- |
| Any test against a deployed environment | NOT APPLICABLE | Not authorized |
| Region and regional-sync suites (`test:region`, `test:regional-sync`) | NOT RUN locally | They need two region databases; CI runs them on the pull request |
| Browser journeys besides the security check | NOT RUN locally | CI runs them on the pull request |
| Liara edge deployment | NOT RUN | The pull-request jobs (build, scan, contract, edge auth) passed on #150; deployment is dispatch-only and not authorized |
| Real-network payment acceptance | NOT APPLICABLE | No real transactions were authorized |
| Load and stress testing | NOT RUN | Excluded by the rules of engagement |

## Perpetual Gains readiness (2026-11-20, branch `agent/claude/gains-readiness`)

Local runs against an isolated server and a disposable database. Full table and threat model: [Gains integration readiness](../reviews/gains-integration/READINESS.md#6-test-evidence-pass--fail--blocked--not-tested).

| Check | Result |
| --- | --- |
| Gains adapter scenarios, product-isolation import graph, record provenance (24 tests) | PASS |
| Wallet/session across products, wallet change, disconnect, refresh (browser) | PASS |
| Perpetual write attempts in the simulation suite (chain, Gains write API, Openfund trading) | PASS (none made) |
| axe on signed-in Perpetual pages | PASS (3 known pre-existing shared-component findings) |
| OSV dependency scan | FAIL (pre-existing OF-2026-11-04 only; lockfiles unchanged) |
| Semgrep on new code | PASS |
| CodeQL | NOT RUN locally (default setup on the PR) |
| Execution path security (signing, allowances, contract pinning) | NOT APPLICABLE (not built) |
