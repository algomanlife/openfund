# Security remediation plan

This plan tracks the open items from the
[November 2026 assessment](SECURITY-AUDIT-2026-11.md). The work done on
2026-11-19, with evidence and per-finding status (merged, released, deployed),
is in the [remediation report](SECURITY-REMEDIATION-2026-11.md); the table
below is the remaining work. Priorities: P0
Critical, P1 High, P2 Medium, P3 Low.

## Open items

| ID | Priority | Remaining task | Owner action |
| --- | --- | --- | --- |
| OF-2026-11-12 | P1 | Deploy the merged role isolation (#149): backup and restore drill, `db-roles.mjs apply`, switch `openfund-cms` `DB_CONNECTION_STRING` to the `openfund_directus` role, verify, then sync the Blueprint ([database roles](DATABASE_ROLES.md)) | Run the steps; record the evidence in `docs/status/status.json` |
| OF-2026-11-11 | P1 | Upgrade Directus to 12.x with an entitlement for 43+ collections and custom permission rules. Until then, the verified 11.x controls from #151 apply once they are deployed | Decide the licence (or accept 11.x in writing) |
| OF-2026-11-20 | P1 | Deploy the hardened edge (#150) when the IRAN edge is activated: staging first, then production | Dispatch the edge workflow |
| OF-2026-11-04 | P2 | `zod` and `decode-uri-component` clear when RainbowKit supports wagmi 3, or after a connector migration with the full wallet browser suite | — |
| OF-2026-11-09 | P2 | Before any protocol activation: compilable contracts, an OpenZeppelin upgrade, an audit and an owner decision. CI blocks activation meanwhile (#152) | Activation decision |
| CI reliability | P2 | Fixed in code, pending review: fixed radar fixtures and a test-mode conduct clock on `agent/claude/deterministic-ci` ([remediation report](SECURITY-REMEDIATION-2026-11.md#test-reliability-found-during-the-merges)) | Review and merge |
| All | — | Release the merged fixes and deploy them with `/version` evidence | Run the Unified release and the production deploy |

## Security testing now in the repository

| Check | Where | Runs |
| --- | --- | --- |
| Auth hygiene and financial invariants | `npm --prefix apps/backend run test:security` | `test:all` (CI backend job) |
| HTTP penetration suite (15 checks) | `npm --prefix apps/backend run test:pentest` | `test:all` (CI backend job) |
| Browser session isolation | `npm run test:browser:security` | Manual or release candidate. Needs a running test server with `CSP_EXTRA_CONNECT` set when a local Directus is used |
| Server production dependency gate | `ci.yml` `audit-production` | Every pull request, push to `main`, nightly (blocking) |
| Secret scan | `ci.yml` gitleaks | Every pull request (blocking) |
| Workflow pinning and credential persistence | #148 | Dependabot keeps the SHA pins current |

## Scanners in CI

Semgrep, OSV-Scanner, Trivy, zizmor, actionlint, the ZAP baseline and Syft
SBOMs run in `security.yml`, and the release attaches a CycloneDX SBOM (#154).
Gates and rollout: [security automation](SECURITY-AUTOMATION.md).

## Merged into `main`, not yet released or deployed

- #147 (`3a57a3cb`): OF-2026-11-01, -02, -03, -05 (mitigated; the owner
  decided on 2026-11-19 to keep the hold, so `DEPAY_ATTESTED_ANY_PAYER` stays
  `false`), -10, -13, -14, -15, -17, and part of -04 (`ws`).
- #148 (`ac74a975`): OF-2026-11-07.
- The 2026-11-19 follow-up series (#149 `31fb3847`, #151 `93ebaec5`, #150
  `38900196`, #152 `c7aede77`, #153 `1784a9dc`, #154 `62dde9ca`): see the
  [remediation report](SECURITY-REMEDIATION-2026-11.md).
