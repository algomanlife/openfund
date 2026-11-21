# Release 0.6.5 checklist

Every task of the release mission with its status and evidence
(branch `agent/claude/release-0.6.5`, 2026-11-17). `Blocked (owner)` means
only an owner action remains; the exact step is in the
[runbook](../../../deployment/LAUNCH_PARITY_RUNBOOK.md).

## Build and deploy root cause

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Pagination-safe candidate derivation | Done | `scripts/release/candidate-source.mjs`; test with a mocked 261-commit / 250-listed compare; live read-only derivation for `main` `ae69b92` succeeds |
| Official vs candidate Render paths tested | Done | `scripts/release/render-source.mjs` (extracted, behavior unchanged); `test/render-source.test.mjs` |
| Official path available | Pending publication | Publishing v0.6.5 creates the first official tag since v0.5.0 (runbook §6) |

## Loose ends

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Purchase-test readiness probe + CI boot test + DePay checklist + purchase procedure | Done | `scripts/release/purchase-readiness.mjs`, `e2e/test-purchase-readiness.mjs` (CI), runbook §12–§13 |
| Flaky equity-sampling test | Done | Guard mirrors `SAMPLE_MINUTE_MARGIN_MS`; 20/20 runs and 3/3 started at second 55; `engine.js` unchanged |
| Iran notice policy blind spot | Blocked (owner decision) | Conflicting tested requirements; options in [findings](OUT_OF_SCOPE_FINDINGS.md) #1 |
| ADR numbering | Done | `0039-certificate-event-attestations.md`; links updated; `docs:check` green |
| Notifications: purchase_paid, challenge passed/failed | Done | Relay maps the paid order's `account_provisioned` event to `purchase_paid`; passed/failed already emitted; backend test N2; Inbox and Backstage labels |
| Security acceptance | Done | [SECURITY_ACCEPTANCE.md](SECURITY_ACCEPTANCE.md); framing boot test in CI |
| Observability minimum | Done | `apps/backend/observability.js`; `/admin/operations/metrics`; `test/observability.test.mjs`; runbook §15 alerts |
| Engine load report | Done | [LOAD_REPORT.md](LOAD_REPORT.md) |
| Backup/rollback drill | Done | `scripts/ops/backup-drill.mjs` verified locally twice; runbook §14 |

## Documentation

| Task | Status | Evidence |
| :--- | :--- | :--- |
| README, CHANGELOG, release notes | Done | `README.md`, `CHANGELOG.md`, `docs/releases/openfund-0.6.5.md` |
| FEATURE_STATUS, MILESTONES, RELEASES, runbook | Done | Synced to post-merge reality; no deployment claims |
| Inventories | Done (registry); Blocked (owner) for `source.json` | Content registry regenerated; `source.json` regeneration waits for finding #1 |

## Publication and deployment

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Merge this PR | Blocked (owner) | Human review and merge |
| Publish v0.6.5 | Next after merge | `gh workflow run release.yml --ref main -f publish=true -f release_version=0.6.5`, dispatched by the agent once `main` contains this work |
| Production deployment approval | Blocked (owner) | Runbook §7 |
| Live verification | After deployment | Runbook §8–§9; `purchase-readiness.mjs` against production |
| CMS upgrade, secrets, real settlement, purchase test, translations review | Blocked (owner) | Runbook §2–§4, §10–§13 |

## Test results

Recorded in the pull request description.
