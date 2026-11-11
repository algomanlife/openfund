<!-- Required by CI (scripts/pr/check-pr-description.mjs): keep every "##" heading below and answer each
     one. Write "N/A — <reason>" where a section does not apply. The PR title must be a Conventional Commit,
     e.g. "feat(payments): finish DePay checkout". See docs/development/PULL_REQUESTS.md. -->

## Objective
<!-- What this PR is for, in one or two sentences. -->

## Problem
<!-- The concrete trigger and resulting behavior, including product/account scope. -->

## Scope
<!-- What is included — and what is deliberately not. -->

## Files and modules
<!-- Main files/directories/modules touched. -->

## Behavior impact
<!-- User-visible or operator-visible change. "None" needs a reason. -->

## Schema and migration
<!-- apps/backend/schema.sql / migrate.js changes; additive-first? N/A — reason otherwise. -->

## Security
<!-- Auth, secrets, permissions, money movement, external input. -->

## Dependencies
<!-- New/updated packages, vendored code, services; registry entry updated? -->

## Tests and results
<!-- Exact commands and outcomes, including failures and skipped suites. -->

## Screenshots
<!-- Genuine screenshots for UI changes. N/A — reason otherwise. -->

## Deployment
<!-- Env vars (render.yaml, ENVIRONMENT.md), migrations, order of operations. "Merging does not deploy." -->

## Rollback
<!-- How to undo safely (revert, flag, restore). -->

## Related PRs
<!-- Related issue ("Closes #123") and base/stack position, PRs this depends on or conflicts with, merge order. -->

## Documentation
<!-- Docs, FEATURE_STATUS, roadmap, ADR, CHANGELOG updated. -->

## Production-enabled?
<!-- Is the capability live or disabled pending activation? Never claim deployed without /version evidence. -->

## Evidence checklist

- [ ] Required checks executed; outcomes, warnings and external limits recorded
- [ ] Product documentation and Feature Status aligned with implementation (README sections, ENVIRONMENT.md, CHANGELOG; `npm run docs:check` green)
- [ ] Roadmap milestones/dependencies/acceptance criteria updated
- [ ] Genuine screenshots/provenance refreshed after significant UI changes
- [ ] English documentation; Persian application/RTL fixtures preserved
- [ ] Render three-resource architecture and same-origin `/react/` preserved
- [ ] No unsupported business claims, secrets or unlicensed assets; upstream notices retained
- [ ] Verified results are separated from assumptions and anything not run or not verified is named
- [ ] Out-of-scope areas untouched (trading engine, evaluation, payments, wallet auth, schema, contracts, deployment config) unless listed under Scope
- [ ] Only files belonging to this change are included; staged diff reviewed for secrets
- [ ] Heightened-review areas touched are named under Security (see docs/development/REPOSITORY_GOVERNANCE.md)
