# Openfund security assessment — November 2026

This is Openfund's first published security assessment. It is a
**self-assessment by the project's own coding agent**, not an independent
third-party audit, certification or regulatory approval.

| | |
| --- | --- |
| Assessment date | 2026-11-19 |
| Evaluated commit | `293b3868` (`main`, after pull request 146) |
| Remediation branch | `agent/claude/security-audit-2026-11` |
| Assessor | Claude Code (AI coding agent), working for the repository owner |
| Report status | Draft for owner review. The fixes are unmerged until the pull request is approved |

## What kind of testing this was

| Activity | Done? | Notes |
| --- | --- | --- |
| Source-code review | Yes, targeted | Backend authentication, sessions, authorization middleware, payment verification, DePay callbacks, withdrawals, admin authentication, regional sync, error handling, chart workspaces, CI workflows |
| Isolated security testing | Yes, limited | A disposable PostgreSQL database and a local backend on a test port. Regression tests and the existing suites ran against it |
| Production penetration testing | **No** | No request was sent to any deployed Openfund host. No production data, wallets or funds were touched |
| Third-party testing | **No** | DePay, Gains Network, Hyperliquid, RPC providers, Render and Liara were not tested |

## Scope

In scope, all reviewed in source:

- `apps/backend`: SIWE wallet sign-in, sessions, trading and portfolio
  ownership checks, purchases and payment verification, DePay callbacks and
  events, withdrawals and rewards, admin token authentication, regional sync
  signing, the global error handler and security headers.
- `.github/workflows`: permissions, triggers, action pinning and secret use.
- Dependency advisories for `apps/backend`, `apps/web-react`,
  `apps/backstage` and `apps/open-trade`.
- Git history secret scanning.

Reviewed only in part, or not reviewed:

- The engine's evaluation rules, PnL arithmetic and liquidation logic. Only
  the order-entry ownership checks were read. The existing engine suites are
  the evidence for these rules, and this pass did not add to them.
- Directus permissions, roles and extensions. The Directus version was not
  checked against current advisories.
- Frontend rendering of CMS content. The existing controls listed in the
  [security architecture](SECURITY.md) were not tested again.
- Container images, Render and Liara runtime settings, TLS and backups.
- IRAN-region ingress and live regional-sync deployments.

## Methodology

1. Recorded a baseline: `main` SHA, latest tag (`v0.7.0`), open worktrees and
   listening ports. The work ran in an isolated git worktree.
2. Traced trust boundaries from each HTTP entry point to the database or
   chain verifier, reading the code rather than relying on comments.
3. Checked each finding against the code and, where possible, reproduced it
   with a failing test before fixing it.
4. Fixed root causes, added regression tests, and re-ran the relevant
   existing suites against an isolated database.

## Tools actually used

| Tool | Version | Use | Result |
| --- | --- | --- | --- |
| gitleaks | 8.30.1 | Full git history (563 commits) with the repository `gitleaks.toml` | No leaks found |
| npm audit | npm bundled with Node 26.13.0 | `--package-lock-only` on four app lockfiles | See [dependency summary](#dependency-summary) |
| actionlint | 1.7.12 | All workflows | Only shellcheck style warnings, no workflow errors |
| node:test and the existing suites | Node 26.13.0 | Regression tests and existing backend suites | See the [test matrix](SECURITY-TEST-MATRIX.md) |

These tools were **not** run: CodeQL, Semgrep, Trivy, OSV-Scanner,
OWASP ZAP, container scanners and SBOM generators. None was installed on the
assessment machine, and none was installed for this pass. Adding them is on
the [remediation plan](SECURITY-REMEDIATION-PLAN.md).

## Findings summary

| Severity | Found | Fixed and verified | Open |
| --- | --- | --- | --- |
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 2 | 0 | 2 |
| Low | 5 | 3 | 2 |
| Informational | 1 | 0 | 1 |

"Fixed" means fixed on the remediation branch. A fix ships only after the
branch is merged and released.

| ID | Severity | Component | Finding | Status | Fix reference | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| OF-2026-11-01 | Low | Backend auth | Expired SIWE nonces and sessions were never deleted. The unauthenticated nonce endpoint could grow a table without bound, and expired sessions kept IP and user-agent data indefinitely | Fixed | `apps/backend/auth-hygiene.js` hourly sweep | `test/auth-hygiene.test.mjs` on PostgreSQL |
| OF-2026-11-02 | Low | Backend test seams | The optional internal-seam token check threw on a token of a different length, which gave a 500 instead of a 401. It also read a different header than one test harness sends. The seams only mount in test mode | Fixed | `internalTokenGuard` in `auth-hygiene.js` | `test/auth-hygiene.test.mjs` |
| OF-2026-11-03 | Low | Chart workspaces | A malformed percent sequence in the workspace scope caused an unhandled `URIError` (500) | Fixed | `apps/backend/chart-workspaces.js` | `test/chart-workspaces.test.mjs`. It failed before the fix and passes after |
| OF-2026-11-04 | Medium | Web frontend dependencies | Transitive advisories (`ws`, `zod`, `decode-uri-component`, `uuid`) reach the build through the current wallet SDK major versions | Open | Needs a major wallet-SDK upgrade | Not started |
| OF-2026-11-05 | Medium | Payment verification | One payment-attestation trust boundary depends on behaviour of an external provider that this pass could not verify. The details are held privately | Open: under review | Private finding | Not started |
| OF-2026-11-06 | Low | Desktop build tooling | A `minimatch` advisory reaches `apps/open-trade` through `electron-builder`. It affects build time only | Open | Major `electron-builder` upgrade | Not started |
| OF-2026-11-07 | Low | CI/CD | Most first-party GitHub Actions (`checkout`, `setup-node`, `upload-artifact`, `cache`) are pinned by version tag, not by commit SHA. The gitleaks and dependency-review actions are already pinned by SHA | Open | Remediation plan | Not started |
| OF-2026-11-08 | Info | Backend | The request rate limiter is in memory and per process, so it is not shared across instances. This was already documented | Accepted, documented | [Security architecture](SECURITY.md) | Not applicable |

## Controls checked, with no finding

These are recorded so that a later reviewer knows they were examined.
"No finding" does not mean "proven secure."

- **Wallet sign-in:** the SIWE domain allowlist, URI host binding, HTTPS in
  production, the time window, chain restricted to Arbitrum One (42161),
  nonce bound to the address, atomic single-use nonce consumption, and EOA
  recovery with an EIP-1271 fallback.
- **Arbitrum and checkout:** the Arbitrum-only rule applies to
  authentication alone (`AUTH_CHAINS`). Purchase chains are configured
  separately (`PURCHASE_*`), so DePay checkout is not limited to Arbitrum.
- **Sessions:** a random 256-bit id, stored hashed, in an HttpOnly,
  `SameSite=Lax` cookie that is `Secure` in production. Suspension is
  checked on every request, and logout revokes open streams.
- **Cross-site requests:** state-changing requests with a foreign `Origin`
  are refused, and CORS credentials are allowlisted.
- **Admin API:** disabled (404) unless a token is configured. The token is
  compared in constant time, and financial decisions need a named actor.
- **Regional sync:** HMAC over method, path, time, nonce and body hash, with a
  skew window and nonce replay storage.
- **DePay deliveries:** RSA-PSS signature over the raw body. A delivery is
  only a hint. The on-chain verifier decides the token, receiver, amount,
  finality and reorg safety, and a transaction is single-use.
- **Withdrawals:** the account and challenge rows are locked, eligibility is
  computed on the server, the recipient is the signed-in wallet, and a
  duplicate open request is refused by a unique constraint.
- **Errors and headers:** internal errors return a generic `internal`.
  The backend sets CSP, `X-Frame-Options` (or `frame-ancestors`) and HSTS in
  production.
- **Workflows:** every workflow declares `permissions`, none uses
  `pull_request_target`, and secrets are only referenced by the deploy and
  release workflows.

## Dependency summary

`npm audit --package-lock-only` on 2026-11-19:

| App | Critical | High | Moderate | Notes |
| --- | --- | --- | --- | --- |
| `apps/backend` | 0 | 0 | 0 | Clean |
| `apps/backstage` | 0 | 0 | 0 | Clean |
| `apps/web-react` | 0 | 16 | 12 | All reach the build through the current wallet SDK majors. The fix needs a major upgrade (OF-2026-11-04) |
| `apps/open-trade` | 0 | 0 | 6 | Build tooling only (OF-2026-11-06) |

No dependency was upgraded in this pass. Major upgrades need their own
compatibility testing.

## CI/CD changes in this pass

- New blocking `audit-production` job in `ci.yml`. It runs on every pull
  request, on push to `main` and nightly, and fails on a high or critical
  advisory in the **production** dependencies of `apps/backend` or
  `apps/backstage`. The existing report-only `audit` job still covers
  `apps/web-react` and repository tooling until OF-2026-11-04 is resolved.
- New backend script, `npm run test:security`, which is also part of
  `npm run test:all`.

## Known limitations

- This was a single, time-boxed pass, not an exhaustive audit. Large parts of
  the engine, the Directus configuration and the frontend were not reviewed
  again (see [Scope](#scope)).
- No dynamic scanner, fuzzer or concurrency stress test was run. The
  existing suites cover several race conditions; this pass added none.
- No claim is made about any deployed environment.

## Roadmap

See the [remediation plan](SECURITY-REMEDIATION-PLAN.md).

## Reporting a vulnerability

Follow the [security policy](../../SECURITY.md) and report privately through
GitHub Security Advisories. Do not open public issues.
