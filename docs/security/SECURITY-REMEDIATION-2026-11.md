# Security remediation report — November 2026

This report is the follow-up to the
[November 2026 assessment](SECURITY-AUDIT-2026-11.md). It covers all
non-payment remediation work. Payment, checkout, refund, payout, treasury,
coupon pricing and money movement are handled separately by the owner and
are out of scope.

The report is written by the project's coding agent. It is not an
independent audit. Every result below comes from a command or CI run on
2026-11-19 against disposable local runtimes or GitHub Actions. **No deployed
environment was changed or tested.**

## Status vocabulary

| State | Meaning |
| --- | --- |
| Fixed in code | The change exists on a branch with a regression test |
| Tested in isolation | Verified against disposable local databases or containers, or in CI |
| Merged | In `main` through a pull request with all required checks green |
| Released | In a published GitHub Release. **None of this work is released yet**: the latest release predates it |
| Deployed / verified in production | Running and verified on GLOBAL or IRAN. **Nothing here is deployed** |
| Blocked | Needs an owner decision or an external entitlement |
| Accepted | Residual risk documented with evidence |

## Baseline

- Starting point: `main` at `3a57a3cb` (#147 merged at 2026-11-19 16:13 UTC;
  #148 merged at 15:31 UTC as `ac74a975`). CI, CodeQL and the release
  package were green.
- Remediation pull requests, each merged with all required checks green:

  | PR | Scope | Merge commit |
  | --- | --- | --- |
  | [#149](https://github.com/algomanlife/openfund/pull/149) | Database roles | `31fb3847` |
  | [#151](https://github.com/algomanlife/openfund/pull/151) | Directus controls | `93ebaec5` |
  | [#150](https://github.com/algomanlife/openfund/pull/150) | Edge image | `38900196` |
  | [#152](https://github.com/algomanlife/openfund/pull/152) | Dependencies | `c7aede77` |
  | [#153](https://github.com/algomanlife/openfund/pull/153) | Client IP and rate limits | `1784a9dc` |
  | [#154](https://github.com/algomanlife/openfund/pull/154) | Security automation | `62dde9ca` |
  | [#155](https://github.com/algomanlife/openfund/pull/155) | This report | — |

## Findings

| ID | Severity | Fix | Code | Isolation | Merged | Released | Deployed | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OF-2026-11-12 | High | Directus gets its own least-privilege PostgreSQL role ([database roles](DATABASE_ROLES.md)) | Yes | Yes (12/12, CI `CMS security`) | #149 | No | **No**: owner steps pending | Directus can append (not change) `coupon_audit` rows; plan catalog stays editable by design |
| OF-2026-11-11 | High | Verified 11.x compensating controls; 12.x upgrade blocked by licence | Mitigation | Yes (7/7, plus a negative control) | #151 | No | No | **Open (High), blocked by licence** |
| OF-2026-11-20 | High | Edge on nginx 1.31.7 mainline slim, pinned by digest, plus a Trivy gate | Yes | Yes (image 0 Critical/High/Medium; contract and edge-auth CI green) | #150 | No | No (edge never deployed) | None known |
| OF-2026-11-04 | Medium | `uuid` override to 11.1.1 | Partial | Yes (wallet 32/32, browser security 12/12) | #152 | No | No | `zod` and `decode-uri-component`: no compatible fix, and not in the shipped first-party bundle |
| OF-2026-11-09 | Medium | Activation block enforced by CI | Guard | Yes (with a mutation test) | #152 | n/a | n/a (dormant) | Advisories remain in the dormant package |
| OF-2026-11-06 | Low | `minimatch` override to 11.0.9 under electron-builder 26.18.0 | Yes | Yes (Linux, Windows and macOS desktop CI green) | #152 | No | No | None (audit 0) |
| OF-2026-11-08 / -19 | Info / Low | Visitor IP behind Cloudflare for limits and audit; autoscaling guard | Yes | Yes (27/27, pentest 15/15) | #153 | No | No | Single-instance limiter (by design); CodeQL alerts stay accepted |
| OF-2026-11-07 follow-up | Low | `secrets: inherit` removed; credential persistence reviewed; shellcheck clean | Yes | Yes (actionlint 0, zizmor 0 at medium) | #154 | n/a | n/a | Two reviewed persistence exceptions |
| OF-2026-11-16 | Info | Re-reviewed, not changed | — | — | — | — | — | Accepted (see below) |
| OF-2026-11-18 | Info | Re-reviewed | — | Yes | — | — | — | Accepted (see below) |
| OF-2026-11-21 | Info | Re-reviewed | — | Yes | — | — | — | Accepted (see below) |

The fixes and mitigations from #147 (OF-2026-11-01, -02, -03, -05, -10, -13,
-14, -15, -17 and part of -04) and #148 (OF-2026-11-07) are **merged**. They
are not yet released or deployed.

## High findings

### OF-2026-11-12: Directus database privileges

- **Root cause:** Directus and the API shared the owner credential.
  **Reproduced** on this work's isolated stack before the fix: a Directus
  administrator could pass a challenge.
- **Fix:**
  - `infra/postgres/cms-privileges.json` classifies all 123 backend tables:
    105 no access, 12 read-only, and 6 with narrow (mostly column-level)
    writes for the plan catalog, coupons and their junctions, and the support
    queue.
  - `scripts/ops/db-roles.mjs plan|apply|verify` creates `openfund_directus`,
    `openfund_readonly` and the optional `openfund_runtime` role. It moves
    Directus-owned tables to the Directus role and applies explicit grants
    and owner default privileges.
  - `migrate.js` refuses foreign-owned backend tables (squatting).
  - `render.yaml` gives `openfund-cms` its own `sync: false` connection
    secret, and the Blueprint validator rejects the owner credential.
- **Evidence:**
  - On a Render-like `CREATEROLE` owner with Directus 11.17.4, the original
    `PATCH` and the direct SQL writes are refused.
  - Escalation attempts fail: `ALTER ROLE`, `SET ROLE`, `DISABLE TRIGGER`,
    function replacement, `CREATE SCHEMA` and `COPY TO PROGRAM`.
  - Editorial CRUD, translations, draft isolation, public reads, coupon
    administration and catalog editing still work.
  - The CMS bootstrap regression survives a Directus restart.
  - The full backend suite was run with the API on the runtime role: the
    server logged 0 privilege errors. The only failures were test-harness DDL,
    so the runtime role stays optional.
- **Deployment:** the owner follows the ordered steps in
  [database roles](DATABASE_ROLES.md): backup, `apply`, switch the Directus
  secret, verify, then sync the Blueprint.

### OF-2026-11-11: Directus advisories

- GHSA-c6w9-5g5j-jh2p and GHSA-j5h6-vqc3-phqh are fixed only in 12.0.0.
  GHSA-7h45-q5jx-7r87 (Medium, shares) was published on 2026-11-16.
- Directus 12.7.0 was re-measured: unlicensed Core allows 25 collections and
  no custom permission rules. Openfund needs 43+ collections and
  status-filtered public reads, so the upgrade would hide public content.
  **No licence was assumed or added.**
- **SSRF reproduced** on 11.17.4 with the default deny list: an import of
  `http://0.0.0.0:8055` succeeded. **Controls, verified at runtime with the
  literal `render.yaml` environment:**
  - `CACHE_ENABLED=false`;
  - an explicit `IMPORT_IP_DENY_LIST` that covers `0.0.0.0`, `::`,
    loopback, link-local and private ranges (a public import still works);
  - an image- and PDF-only upload list (HTML and SVG refused);
  - no non-admin share writes;
  - WebSockets off.

  The Blueprint validator enforces them while the image is 11.x.
- **Minimum owner decision:** a Directus licence or eligible grant that
  covers 43+ collections and custom permission rules. Then run the 12.x
  staging procedure in the
  [Directus 12 assessment](../backstage/DIRECTUS_12_ASSESSMENT.md).

### OF-2026-11-20: IRAN edge image

The base images were scanned with Trivy 0.76.2, counting Critical/High:

| Image | Critical | High |
| --- | --- | --- |
| 1.28.0-alpine (previous base) | 3 | 56 |
| 1.30.6-alpine | 4 | 15 |
| 1.30.6-alpine-slim | 3 | 6 |
| 1.31.7-alpine-slim | 0 | 3 |
| **Built image** (after `apk upgrade`) | **0** | **0** (0 Medium) |

- The base is pinned by its multi-arch OCI index digest; it is non-root
  (uid 101), and `nginx -t` passes.
- The unsafe-configuration refusals, the contract tests and the wallet
  sign-in, cookie, CSRF and client-IP suite through the edge all pass in CI.
- The edge workflow now blocks on fixable Critical/High in the built image
  and uploads the scan and SBOM.
- **Rollback:** dispatch the edge workflow with the previous edge commit.

## Dependency remediation

| Scope | Before | After | Class |
| --- | --- | --- | --- |
| `apps/web-react` | 27 (19 high, 8 moderate) | 20 high, 0 moderate | Runtime packages, but the remaining advisories are not in the shipped first-party bundle. The only bundled copies are inside the vendored DePay widget, which is payment scope, off by default and unchanged |
| `apps/open-trade` | 6 moderate | 0 | Build time |
| `apps/backend`, `apps/backstage` (production) | 0 | 0 | Runtime |
| `packages/openfund-protocol` | 85 vulnerable packages (OSV) | unchanged | Dormant, blocked by CI |
| `vendor/*` lockfiles | advisories | unchanged | Never installed (OF-2026-11-18) |

## Infrastructure

- **PostgreSQL:** owner/migration, runtime (optional), Directus and
  read-only roles; drift check; table-squatting guard.
- **Directus:** compensating controls as above.
- **Render:** `numInstances: 1` and no autoscaling, both enforced; the CMS has
  its own connection secret.
- **Liara:** hardened edge image and gate. The edge and the IRAN runtime are
  still not deployed.
- **Rate limiting:** limits and audit now key on the visitor IP behind
  Cloudflare. **Before the fix** every visitor on one Cloudflare edge shared a
  bucket (reproduced). `CF-Connecting-IP` is trusted only from Cloudflare's
  published ranges.
- **Regional sync:** the existing two-region CI suites (`test:region`,
  `test:regional-sync`) ran in the `Backend` job of the code PRs in this
  series. No change was made to sync or settlement logic.
- **Backup and restore:** `scripts/ops/backup-drill.mjs` exists. The drill
  against production must be run by the owner with a read-only source URL;
  it was not run here.

## Security automation

See [security automation](SECURITY-AUTOMATION.md) for each scanner, its
gate, its baseline and its rollout. Blocking:

- actionlint and zizmor;
- Semgrep on new ERRORs;
- Trivy on shipping lockfiles, configuration and the edge image;
- ZAP baseline on promoted rules;
- the CMS security job;
- the protocol guard;
- gitleaks and the production audit;
- a required release SBOM.

Report-only: OSV-Scanner and the full Semgrep scan.

## Accepted and informational findings, re-reviewed

- **OF-2026-11-16 (CSP):** `script-src 'unsafe-eval'` is applied only to the
  HTML pages and the Pine worker that run the licensed Vela/Pine engine, which
  compiles scripts at runtime. Nonces or hashes cannot cover evaluated code.
  Removing it means isolating the engine in a separate origin or iframe
  sandbox, which is an architecture change to licensed upstream code.
  `style-src 'unsafe-inline'` comes from runtime chart styling. Status:
  accepted, unchanged. ZAP still reports only the wildcard-directive warning.
- **OF-2026-11-18 (vendored lockfiles):** confirmed outside every shipping
  path. They are not in any install, the release test excludes the dormant
  package, and OSV keeps reporting them.
- **OF-2026-11-21 (secret-scanner false positives):** the configuration has
  path allowlists for committed build output and a checksum manifest only.
  `.gitleaksignore` contains exact commit fingerprints with reasons. One was
  added in #153 for a test fixture, now generated per run. No rule is
  disabled.

## Test reliability found during the merges

Two browser suites in the `Backend` CI job failed intermittently. Both also
failed on `main` (for example at `1784a9dc`), independently of these
changes. The assertions were not weakened. The failed jobs were rerun and
passed, and the root causes are recorded here:

| Suite | Failure | Root cause | Current status |
| --- | --- | --- | --- |
| `e2e/test-heatmap-radar.cjs` | Waiting for a searched tile timed out | The test picks its market from **live** Hyperliquid data, polled every 30 s. The search walk ends when that market drops out of the filtered list or the layout changes | **Fixed in code, pending review** (branch `agent/claude/deterministic-ci`). Every `/radar/*` response comes from fixed fixtures, and the page clock starts at a fixed instant. The search target is the fixture's smallest market, and empty and unavailable states are now asserted. The real feed moved to `e2e/test-heatmap-radar-live.cjs`, a non-blocking CI step |
| `e2e/test-controlled-challenges.cjs` | `holding_window_closing` (400) when opening a trade | The test uses the **wall clock**. Funded rules correctly refuse new trades in the window before the daily close (22:00 UTC in winter), and the job ran at about 21:50 UTC. The same suite will also hit the weekend rule from the Friday close | **Fixed in code, pending review** (same branch). A test-mode conduct clock (`apps/backend/test-clock.js`, `POST /internal/test-clock`, `SIM_TEST_CLOCK`) is built only with `SIM_TEST_MODE=1` and a test database. Production keeps `Date.now`, and its rules are unchanged. The suite runs its lifecycle at a fixed open-market time and asserts 21 boundary cases: open, pre-close window, exact close, closed, weekend, reopen and the summer/winter close-hour change. CI starts that server inside the close window |

Local verification for the fix ran on Node 26.13.0 and PostgreSQL with a
fresh disposable database per run. Both suites passed twice at each of five
server clocks: inside the winter pre-close window, at the exact Friday close,
on Saturday, inside the summer pre-close window, and on the unpinned real
clock. The previous controlled suite, run against the same pinned server,
failed with the original `holding_window_closing` error. Other suites with
similar time or live-data dependence are listed in the pull request.

## Outstanding blockers

| Item | Why it is blocked | Done so far | Owner action | Risk if left |
| --- | --- | --- | --- | --- |
| OF-2026-11-12 in production | Changes production database grants and Render secrets | Code, CI proof and runbook | Run the [database roles](DATABASE_ROLES.md) deployment steps | A Directus admin session can still write financial rows in production |
| OF-2026-11-11 | Directus 12 requires a licence for Openfund's model | Controls verified; upgrade procedure ready | Obtain a licence or eligible grant, or accept 11.x in writing | Two High advisories stay present in 11.17.4 (exposure reduced) |
| Test reliability | Fix awaits review and merge | Fixtures, a test-mode clock and boundary cases on `agent/claude/deterministic-ci`, verified locally | Review and merge the pull request | Until merged, intermittent red CI on `main` (close window and Friday close to Sunday open for the controlled-challenge suite) |
| Release and deployment | Releases and production deploys are owner actions | All fixes in `main` with green CI | Run the Unified release, then the production deploy with approval | None of these fixes protects production yet |
| IRAN edge | Never deployed (ADR 0042) | Image and gate ready | Dispatch staging, then production | — |
| Backup drill | Needs a production read-only URL | Script exists | Run `backup-drill.mjs` before the database role change | Unverified restore path |

## Readiness

| Area | Conclusion |
| --- | --- |
| Repository security remediation | **SECURITY CODE COMPLETE** for every in-scope finding, except OF-2026-11-11 (**EXTERNAL APPROVAL REQUIRED**: licence) |
| CMS security | Fixed in code and verified in isolation. **RESIDUAL RISK OPEN** (High) until Directus 12 is licensed |
| Infrastructure security | **STAGING VERIFIED** only in the sense of isolated CI and local runtimes. No staging or production environment was touched |
| Deployment readiness | Ready for an owner-run release. **NOT PRODUCTION DEPLOYED**, **NOT PRODUCTION VERIFIED** |
| Overall non-payment security readiness | **NOT READY** for production sign-off until the database role is deployed and verified, and the Directus licence decision is made. Payment acceptance is outside this assessment |
