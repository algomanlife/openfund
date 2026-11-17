# Launch parity checklist

Status of every launch-completion task (branch `agent/claude/launch-completion`).
`Done` means implemented and verified locally with the evidence shown;
`Blocked (owner)` means only an owner action remains, described in the
[runbook](LAUNCH_PARITY_RUNBOOK.md). Nothing here is deployed.

## Phase 1 — Repository truth and release integrity

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Release manifest runtime derived from `render.yaml` and `engines.node` | Done | `scripts/release/manifest.mjs` `runtimePins()`; `scripts/release/test/runtime-pins.test.mjs` |
| `engine-strict=true` | Done | `.npmrc`; `npm ci` green on Node 26 for root, backend, web-react, backstage |
| Stale status docs corrected | Done | `docs/product/FEATURE_STATUS.md`, `docs/backstage/UNIVERSAL_VISUAL_EDITING.md`, ADR 0038 |
| ADR numbering collision | Reported only | [Out-of-scope findings](../reviews/launch-completion/OUT_OF_SCOPE_FINDINGS.md) #1 |
| Next release version allocated | Done | `node scripts/release/plan.mjs` → `0.6.0` |

## Phase 2 — CMS 11.17.4 rehearsal and content

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Disposable 11.17.4 + PostgreSQL 17, schema and seeds twice, idempotent | Done | [CMS rehearsal](../reviews/launch-completion/CMS_REHEARSAL.md) |
| Public fa/en reads; whitepaper from CMS | Done | CMS rehearsal |
| `CHILD_SRC` value determined | Done | CMS rehearsal; `docs/deployment/ENVIRONMENT.md` |
| Visual-editing protocol on 11.17.4 | Done | `apps/backstage/upgrade/visual-editing-check.mjs` 10/10 |
| Production CMS upgrade and content application | Blocked (owner) | Runbook, *CMS upgrade and content application* |
