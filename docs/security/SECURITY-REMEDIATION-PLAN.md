# Security remediation plan

This plan tracks the open items from the
[November 2026 assessment](SECURITY-AUDIT-2026-11.md). Priorities: P0
Critical, P1 High, P2 Medium, P3 Low.

## Open items

| ID | Priority | Task | Dependency or risk | Owner action |
| --- | --- | --- | --- | --- |
| OF-2026-11-12 | P1 | Give Directus its own PostgreSQL role. It should have read and write access to the editorial and Directus system tables, read-only access to the identity, commerce and support tables it shows, and no write access to `openfund_challenges`, `demo_accounts`, `trading_*`, `payments*`, `payment_*`, `purchase_orders`, `withdrawal_requests`, `payout_*`, `treasury_*`, `financial_audit_log` or the reward tables. Then point `openfund-cms` at a `DB_CONNECTION_STRING` for that role | Changes Render configuration and database grants. Verify on a staging copy: the Directus admin probe must get a permission error, and the Backstage Content workspace and coupon administration must keep working | Approve, then create the role and secret in Render |
| OF-2026-11-11 | P1 | Upgrade Directus to 12.x, or accept 11.17.4 in writing with compensating controls: keep `CACHE_ENABLED` off, limit file import to the owner, and restrict outbound network access from `openfund-cms` | Licensing decision ([Directus 12 assessment](../backstage/DIRECTUS_12_ASSESSMENT.md)) | Decide the license |
| OF-2026-11-20 | P1 | Move `infra/liara-iran/Dockerfile` from `nginx-unprivileged:1.28.0-alpine` to a maintained, digest-pinned `1.30.x-alpine`. Run the Liara edge workflow (wallet sign-in, cookies, CSRF, client IP through the edge) before deploying | nginx 1.28 → 1.30 line change; edge templates must still pass `nginx -t` and the edge tests | Dispatch the edge workflow on the change |
| OF-2026-11-04 | P2 | Clear `zod`, `uuid` and `decode-uri-component` in `apps/web-react`. This happens when RainbowKit supports wagmi 3, or by replacing RainbowKit | A wallet-connector migration needs the full browser wallet suite (`test:browser:wallet`, `test:browser:purchase`) | — |
| OF-2026-11-09 | P2 | Before any protocol activation: upgrade the OpenZeppelin contracts and the development tooling in `packages/openfund-protocol`, then audit and test the contracts | The package is dormant; AGENTS.md keeps its source and provenance unchanged | Activation gate |
| OF-2026-11-05 | P2 (follow-up) | Decide whether gift and second-wallet DePay payments should settle automatically (`DEPAY_ATTESTED_ANY_PAYER`). Default: held for review | Product decision. DePay reports it is retiring | Decide |
| OF-2026-11-06 | P3 | Upgrade `electron-builder` in `apps/open-trade` | Major version of the desktop build tooling; installers must pass acceptance again | — |
| OF-2026-11-08 / -19 | Info | Shared (database or Redis) rate limiting before running more than one API instance; per-route limits on authenticated reads | Single-instance limit, already documented | — |

## Security testing now in the repository

| Check | Where | Runs |
| --- | --- | --- |
| Auth hygiene and financial invariants | `npm --prefix apps/backend run test:security` | `test:all` (CI backend job) |
| HTTP penetration suite (15 checks) | `npm --prefix apps/backend run test:pentest` | `test:all` (CI backend job) |
| Browser session isolation | `npm run test:browser:security` | Manual or release candidate. Needs a running test server with `CSP_EXTRA_CONNECT` set when a local Directus is used |
| Server production dependency gate | `ci.yml` `audit-production` | Every pull request, push to `main`, nightly (blocking) |
| Secret scan | `ci.yml` gitleaks | Every pull request (blocking) |
| Workflow pinning and credential persistence | #148 | Dependabot keeps the SHA pins current |

## Tooling not yet in CI

These were run by hand during the assessment. Add them when their noise
has been triaged into rules or baselines.

| Tool | Proposal |
| --- | --- |
| Semgrep | Report-only job with `p/javascript p/nodejsscan`, excluding `vendor/` |
| OSV-Scanner | Weekly report on all lockfiles |
| Trivy image | Scan the release image in `package-image.yml` before publishing; fail on fixable criticals |
| zizmor | Report-only job after #148 merges |
| ZAP baseline | Against the candidate build in the release workflow (local, never production) |
| Syft | Attach a CycloneDX SBOM to each GitHub Release |

## Fixed on the remediation branches (pending merge)

OF-2026-11-01, -02, -03, -05 (mitigated), -07 (#148), -10, -13, -14, -15,
-17, and part of -04 (`ws`).
