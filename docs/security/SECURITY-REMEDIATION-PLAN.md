# Security remediation plan

This plan tracks the open items from the
[November 2026 assessment](SECURITY-AUDIT-2026-11.md). Priorities follow
that assessment: P0 Critical, P1 High, P2 Medium, P3 Low.

## Open findings

| ID | Priority | Item | Dependency or risk | Status |
| --- | --- | --- | --- | --- |
| OF-2026-11-05 | P2 | Confirm the payment-attestation trust boundary (details held privately) and, if needed, bind attested payments more tightly to the order | Needs the payment provider's documented guarantees. A change touches payment acceptance, so it needs owner review and payment-suite coverage | Planned |
| OF-2026-11-09 | P2 | Clear the advisories in the dormant `packages/openfund-protocol` lockfile, including the pinned OpenZeppelin contracts | Must happen before any protocol contract is deployed or enabled. Upgrading vendored protocol code needs its own reviewed task that preserves provenance | Planned |
| OF-2026-11-04 | P2 | Upgrade the wallet SDK stack in `apps/web-react` (wagmi and RainbowKit majors) to clear the transitive advisories | Major upgrade: wallet connection, SIWE and checkout journeys must be re-verified in the browser | Planned |
| OF-2026-11-06 | P3 | Upgrade `electron-builder` in `apps/open-trade` | Major upgrade of desktop build tooling | Planned |
| OF-2026-11-07 | P3 | Pin first-party GitHub Actions to commit SHAs, with Dependabot updates | Touches every workflow. Do it in its own pull request | Planned |
| OF-2026-11-08 | Info | Shared, distributed rate limiting before running more than one API instance | Already a documented single-instance limit | Accepted |

## Tooling to add

| Capability | Proposal | Status |
| --- | --- | --- |
| SAST | CodeQL (JavaScript/TypeScript) via GitHub code scanning, if the owner enables it in repository settings | Planned, owner decision |
| Rule-based SAST | Semgrep with a pinned version and a reviewed rule set, report-only at first | Planned |
| SCA and SBOM | OSV-Scanner on the lockfiles, plus a CycloneDX SBOM attached to releases | Planned |
| Container | Trivy scan of the release image in `package-image.yml` | Planned |
| DAST | OWASP ZAP baseline against a local candidate build only, never production | Planned |
| Workflow audit | `zizmor` or an equivalent workflow linter, alongside `actionlint` | Planned |

## Review areas not yet covered

These areas were outside the November 2026 pass and should get a dedicated
review before real customer funds are accepted:

1. Evaluation engine invariants: daily and maximum loss, trailing drawdown,
   liquidation, SL/TP ordering and restart recovery, under concurrent
   requests.
2. Directus: version against current advisories, role permissions,
   extensions, uploads and webhooks.
3. Frontend: CMS-rendered content, `postMessage` handlers and multi-tab
   account switching.
4. Infrastructure: Render and Liara runtime settings, TLS, backups and
   restore, log retention.
5. An independent third-party assessment.

## Done in November 2026 (on the remediation branch, pending merge)

| ID | Item |
| --- | --- |
| OF-2026-11-01 | Hourly sweep of expired SIWE nonces and sessions |
| OF-2026-11-02 | Internal-seam token guard fails closed with a 401 for every supplied value |
| OF-2026-11-03 | A malformed chart scope is a 400 |
| CI | Blocking production-dependency gate for the backend and Backstage |
