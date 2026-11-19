# Openfund security assessment — November 2026

This is Openfund's first published security assessment. It is a
**self-assessment by the project's own coding agent**, working for the
repository owner. It is not an independent third-party audit, a
certification or a regulatory approval.

| | |
| --- | --- |
| Assessment dates | 2026-11-19 (first pass and the expanded pass requested after review) |
| Base commit | `293b3868` (`main`, after pull request 146) |
| Remediation pull requests | [#147](https://github.com/algomanlife/openfund/pull/147) (application, payments, tests, documentation) and [#148](https://github.com/algomanlife/openfund/pull/148) (GitHub Actions supply chain) |
| Released and deployed versions | Not tested. The latest official release is v0.7.0. No deployed host was contacted |
| Report status | For owner review. The fixes ship only after review, merge and release |

## Kinds of testing

| Activity | Done? | Where the results are |
| --- | --- | --- |
| Source-code review | Yes: authentication, sessions, authorization, payments (released DePay path and the unreleased Openfund Pay ledger), withdrawals and payouts, rewards and referrals, admin API, Backstage, regional sync, CMS registration scripts, error handling, CI | This report |
| Isolated penetration testing | Yes: the running backend and SPA, PostgreSQL, Directus 11.17.4 and a browser, all local and disposable | [Penetration test](PENETRATION-TEST-2026-11.md) |
| Automated scanning | CodeQL, Semgrep, OSV-Scanner, Trivy (fs, config, image), gitleaks, actionlint, zizmor, OWASP ZAP (baseline and active), Syft SBOM | [Test matrix](SECURITY-TEST-MATRIX.md) |
| Financial invariant testing | Yes: property-based tests of evaluation and valuation, plus the full payment, commerce, rewards and engine suites | [Test matrix](SECURITY-TEST-MATRIX.md) |
| Production penetration testing | **No** | — |
| Third-party testing (DePay, Gains, Hyperliquid, RPC, Render, Liara) | **No** | — |

## Coverage by component

| Component | Status | Notes |
| --- | --- | --- |
| Backend authentication and sessions | Reviewed and pentested | SIWE replay, chain and domain binding, session replay and logout, cookie flags |
| Backend authorization (users, accounts, orders, positions, withdrawals) | Reviewed and pentested | Cross-user reads and writes across 15+ object routes |
| Admin API and Backstage | Reviewed and tested | Token gate, actor attribution, the Backstage owner session (scrypt, attempt limits, CSRF, `SameSite=Strict`) and its test suite |
| Payments: released (DePay, manual) | Reviewed and tested | OF-2026-11-05 fixed fail-closed |
| Payments: Openfund Pay (not released) | Reviewed and tested | Ledger, partial payments, refunds and exactly-once activation are covered by the existing suites, which pass |
| Coupons | Tested | Existing concurrency suites (redemption limits, idempotency) pass; Directus commerce role scope reviewed |
| Challenge issuance | Tested | Exactly one challenge per paid order under parallel confirmation (PT-13) |
| Prop engine and evaluation | Invariant-tested and suites re-run | Property tests over pass, fail, loss limits, trailing drawdown, staleness, spread and liquidation; engine, split-process and equity-sampling suites pass |
| Withdrawals, payouts, IB and referrals | Suites re-run, routes reviewed | Row locks, eligibility on the server, on-chain payout evidence; referral attribution is first-sign-in only |
| Treasury reconciliation | Suites re-run | No change |
| Regional sync | Reviewed | HMAC, skew window, nonce replay store. The live two-region deployment was not tested |
| Directus CMS | Isolated runtime probed; version checked against advisories | OF-2026-11-11 and OF-2026-11-12 |
| Frontend and terminal | Browser-tested; CodeQL triaged | OF-2026-11-13 fixed; CSP reviewed |
| Containers | Dockerfiles and base images scanned | OF-2026-11-20 |
| Render and Liara configuration | Configuration inspected only | Runtime settings, TLS, backups and Liara ingress were not verified |
| GitHub Actions | actionlint and zizmor; fixes in #148 | OF-2026-11-07 |
| Dependencies | npm audit, OSV, Trivy, Syft SBOM | See the dependency section |
| Dormant protocol package | Scanned only | Not built or deployed; must not be activated before OF-2026-11-09 is resolved |

## Findings

Severity follows the brief: Critical (P0), High (P1), Medium (P2), Low (P3),
Informational. "Fixed" means fixed on a remediation branch with a regression
test. It is not live until merged, released and deployed.

| Severity | Found | Fixed or mitigated (branch) | Open | Accepted |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 3 | 0 | 3 | 0 |
| Medium | 3 | 1 | 2 | 0 |
| Low | 11 | 9 | 1 | 1 |
| Informational | 4 | 0 | 0 | 4 |

| ID | Severity | Component | Finding | Status | Fix reference | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| OF-2026-11-11 | High | Directus | Directus 11.17.4 is affected by two high advisories (GHSA-c6w9-5g5j-jh2p, GHSA-j5h6-vqc3-phqh) that are fixed only in 12.x. The 12.x upgrade is blocked on a licensing decision ([assessment](../backstage/DIRECTUS_12_ASSESSMENT.md)) | Open: owner decision | Remediation plan | OSV advisory data. The cache advisory needs `CACHE_ENABLED`, which `render.yaml` does not set (configuration only, not runtime-verified). The SSRF advisory needs an authenticated user who can import files |
| OF-2026-11-12 | High | Directus / database | Directus and the API share one database credential (`render.yaml`), so any Directus administrator, or anyone who takes over a Directus admin session, can write financial tables directly and skip the engine and the audit trail | Open: infrastructure change | Remediation plan (separate database role) | Reproduced on the isolated stack: an admin `PATCH` set a challenge to `passed` (HTTP 200) |
| OF-2026-11-20 | High | IRAN edge container | `infra/liara-iran/Dockerfile` pins `nginx-unprivileged:1.28.0-alpine` (January 2026; the 1.28 line is no longer updated). Trivy reports 3 critical (OpenSSL `libssl3`/`libcrypto3`, brotli) and 56 high | Open: needs an edge test run | Remediation plan | Trivy image scan. `1.30.6-alpine` reduces this to 4 critical and 15 high |
| OF-2026-11-05 | Medium | Payments | A provider-attested payment did not need to be signed by the order owner's wallet, so the order binding rested on provider checks that are not publicly documented | Mitigated: fail-closed; the owner decided on 2026-11-19 to keep the hold | #147 (`purchases.js`, `DEPAY_ATTESTED_ANY_PAYER`) | P23b, D3 and the payment suites |
| OF-2026-11-04 | Medium | Web wallet SDK | Transitive advisories through wagmi 2 and RainbowKit 2 | Partly fixed (`ws`). `zod`, `uuid` and `decode-uri-component` stay open | #147 (`overrides`) | npm audit, typecheck, `test:web`, build |
| OF-2026-11-09 | Medium | Dormant protocol package | Dependabot and OSV report critical development-tool advisories and high OpenZeppelin runtime advisories in `packages/openfund-protocol` | Open: activation gate | Remediation plan | OSV, Dependabot |
| OF-2026-11-01 | Low | Auth | Expired nonces and sessions were never deleted | Fixed | #147 `auth-hygiene.js` | `test:security` |
| OF-2026-11-02 | Low | Test seams | The internal token check threw a RangeError (500) on a token of a different length | Fixed | #147 | `test:security`, PT-10 |
| OF-2026-11-03 | Low | Chart workspaces | A malformed percent sequence gave a 500 | Fixed | #147 | `test:chart-workspaces` (failed before the fix) |
| OF-2026-11-10 | Low | API | Malformed ids, NUL bytes and negative paging reached PostgreSQL casts and gave a 500 | Fixed | #147 (`uuidParam`, paging clamp, class-22 mapping) | PT-08 (failed before the fix) |
| OF-2026-11-13 | Low | Terminal | Exception text was inserted as HTML in the chart overlay (CodeQL) | Fixed | #147 (`esc()`) | `test:web` |
| OF-2026-11-14 | Low | Referrals | Code generation used modulo over random bytes (CodeQL); referral codes are public | Fixed | #147 (`crypto.randomInt`) | `test:referral` |
| OF-2026-11-15 | Low | HTTP headers | No `Permissions-Policy` header (ZAP) | Fixed | #147 | PT-09, ZAP |
| OF-2026-11-07 | Low | CI | GitHub-owned actions were pinned by tag; checkout credentials persisted; one template expansion in a shell script (zizmor) | Fixed | #148 | zizmor re-run |
| OF-2026-11-17 | Low | Test seams | CodeQL flagged a SHA-256 digest of the internal token as a weak password hash | Fixed | #147 | CodeQL check on the pull request |
| OF-2026-11-06 | Low | Desktop build | A `minimatch` advisory through `electron-builder`; build time only | Open | Major upgrade needed | npm audit |
| OF-2026-11-19 | Low | API | CodeQL `missing-rate-limiting` (44 alerts): authenticated reads without a per-route limit; the custom in-memory limiter is not recognized | Accepted with OF-2026-11-08 | — | Triage |
| OF-2026-11-08 | Info | Backend | The rate limiter is in memory and per process | Accepted, documented | [Security architecture](SECURITY.md) | — |
| OF-2026-11-16 | Info | HTTP headers | CSP has `unsafe-eval` (Pine/Vela engine on HTML pages only) and `style-src 'unsafe-inline'` | Accepted, documented in `server.js` | — | ZAP |
| OF-2026-11-18 | Info | Vendored code | `vendor/gains-sdk` and `vendor/vela` lockfiles carry advisories (7 critical in `gains-sdk`). These lockfiles are never installed or built; the app resolves its own dependencies | Accepted | — | OSV |
| OF-2026-11-21 | Info | Secret scanning | gitleaks in working-tree mode flags 49 public contract addresses and locale strings in vendored and dormant code | Accepted (false positives) | — | gitleaks |

### Root causes of the fixed findings

- **OF-2026-11-05:** a design assumption that a provider-signed delivery
  binds the transaction to the order. The provider's documentation could
  not confirm that guarantee. The code now trusts only what it can verify
  on-chain: the signer must be the order owner's wallet, or an operator
  must associate the payment.
- **OF-2026-11-10 and OF-2026-11-03:** request values reached PostgreSQL
  casts or `decodeURIComponent` without validation, and the generic error
  path mapped the resulting errors to 500. Path ids are now validated at
  the route, and the error handler maps every PostgreSQL class 22 data
  exception to 400 without echoing the query.
- **OF-2026-11-01 and OF-2026-11-02:** missing lifecycle hygiene, and a
  constant-time comparison that throws on a length mismatch.

## Financial security assessment

| Area | Assessment | Evidence |
| --- | --- | --- |
| Wallet authentication | Sound in the tested scope. Arbitrum-only sign-in is separate from the payment networks | PT-03, `siwe.test.mjs` (24/24), M6 |
| DePay verification | The chain verifier decides; deliveries are signed hints only. The payer binding is fixed fail-closed (OF-2026-11-05). DePay is off for new payments by default and the provider reports that it is retiring | `test:payments`, `test:commerce` |
| Openfund Pay (unreleased) | Partial, duplicate and excess payments become ledger evidence or refund liabilities; activation happens exactly once | `openfund-pay.test.mjs` (33/33) |
| Coupons | Server-priced; redemption limits hold under concurrency. Commerce administrators can create discounts, which is a business authority with an append-only audit log | `test:commerce` |
| Challenge issuance | Exactly one challenge per order under parallel confirmation | PT-13 and the existing suites |
| Trading engine | Server marks only; stale marks block valuation and evaluation; idempotent order entry; a single close under concurrency | PT-11, PT-12, PT-14, the invariants, `test:engine` |
| PnL and evaluation | The invariants hold over 4,000+ seeded cases per property (rerun with more seeds) | `financial-invariants.test.mjs` |
| Withdrawals and payouts | Eligibility is computed on the server under row locks; the recipient is the session wallet; payout evidence must be an exact on-chain transfer after approval | `test:rewards` |
| IB and referral rewards | Attribution only on a first sign-in; self-referral is blocked | `test:referral`, `test:economy` |
| Ledger consistency | Append-only triggers on the financial audit log and on order, coupon, deposit and certificate events; the regional ownership fence | Schema review. OF-2026-11-12 shows that a direct database writer can still change mutable financial rows |

## CMS and infrastructure assessment

- **Directus:** anonymous access is limited to published editorial
  collections, the active plan catalog and one public file folder (all 166
  collections were probed). The editor, support and commerce roles have no
  write access to financial records, and the commerce role reads only
  selected order and user fields. Open: OF-2026-11-11 and OF-2026-11-12.
- **Backstage:** one owner account; scrypt password verifier; 10 attempts per
  window; `SameSite=Strict` session; CSRF token; exact-origin check;
  absolute and idle expiry; and the backend token is kept server-side.
  Tests: 16/16.
- **Containers:** all three Dockerfiles run as non-root and have health
  checks; Trivy config reports 0 misconfigurations. Open: OF-2026-11-20.
- **Render (configuration only):** `NODE_ENV=production`, `SIM_TEST_MODE`
  empty, secrets `sync: false`, automatic deploy off, health checks set. TLS,
  backups and the runtime environment were not verified.
- **Liara (configuration only):** the edge image and runtime manifest were
  reviewed and the edge base image scanned. Live ingress was not tested.

## Dependency summary

Results from 2026-11-19, after the remediation:

| Scope | Result | Disposition |
| --- | --- | --- |
| `apps/backend` (production) | 0 advisories | Blocking CI gate (`audit-production`) |
| `apps/backstage` (production) | 0 advisories | Blocking CI gate |
| `apps/web-react` | `ws` fixed by override. `zod` (<4.6.6), `uuid` (<11.1.1) and `decode-uri-component` (≤0.5.0) remain through the wallet SDKs; npm counts 19 high and 8 moderate packages from these 3 root advisories | OF-2026-11-04. RainbowKit 2.2.11 (latest) still needs wagmi 2; the fixed `decode-uri-component` is ESM-only and the `zod` fix is a new major |
| `apps/open-trade` | 6 moderate (build tooling) | OF-2026-11-06 |
| `packages/openfund-protocol` | Critical and high (dormant) | OF-2026-11-09 |
| `vendor/*` lockfiles | Not installed | OF-2026-11-18 |
| SBOM | CycloneDX from Syft 1.57.1 | Kept with the private evidence; generate again with `syft dir:. -o cyclonedx-json` |

## Readiness decision

**NOT READY for accepting real customer funds**, based on this evidence:

1. Two confirmed High findings affect the integrity of financial records:
   - OF-2026-11-12, where a Directus administrator can write financial
     tables;
   - OF-2026-11-11, where Directus is affected by unpatched high advisories.

   Both need owner decisions or infrastructure changes.
2. OF-2026-11-20 (High) affects the IRAN edge image.
3. The payment path is not owner-accepted: the 2026-11-18 real purchases
   failed ([incident](../payments/INCIDENT_2026-11-18.md)), and no
   real-network or production verification was part of this assessment.
4. Every fix in this assessment is on unmerged branches.

The assessment itself is complete for the scope above. Every component has
a coverage status, every confirmed High finding has a disposition, and the
full backend suite passes on a fresh database. It is not a statement that
the system is free of vulnerabilities.

### Exact criteria for a READY decision

- OF-2026-11-12 fixed: a separate least-privilege database role for
  Directus, with read-only (or no) access to financial tables, verified on
  staging.
- OF-2026-11-11 fixed by the Directus 12 upgrade, or accepted in writing
  with compensating controls (cache off, file import restricted to the
  owner, network egress limits) that are verified on the deployed service.
- OF-2026-11-20 fixed: the edge base image updated and the edge test
  workflow green.
- #147 and #148 merged, released and deployed, with `/version` evidence.
- The real-network payment acceptance in [ACTIVATION](../payments/ACTIVATION.md)
  completed by the owner.
- The Medium items fixed or accepted in writing.

## Remediation

See the [remediation plan](SECURITY-REMEDIATION-PLAN.md).

## Private record

Reproduction details, scanner outputs (ZAP, Semgrep, OSV, Trivy, zizmor,
CodeQL export), the Directus permission probe, the SBOM and the full test
logs are kept outside the public repository by the owner. They are not
published, because some of them concern findings that are still open.

## Reporting a vulnerability

Follow the [security policy](../../SECURITY.md) and report privately through
GitHub Security Advisories.
