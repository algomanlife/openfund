# Release and deployment checklists

Use these with the [release runbook](RELEASES.md), [Render runbook](RENDER.md)
and [rollback](ROLLBACK.md). Each item is a gate: write down the evidence (a
command and its result) in the PR, the release notes or the deployment record.

## Traceability chain

| Link | Authority | How to check |
| --- | --- | --- |
| Git commit | Full SHA on `main` | `git rev-parse origin/main` |
| Build artifact | Release archive or candidate built from that SHA | `scripts/release/build.mjs` manifest (`commit`, `official`) |
| Package version | Release manifest `version` (not `package.json` `0.1.0`) | `node scripts/release/version.mjs` |
| Git tag | `vMAJOR.MINOR.PATCH`, immutable, created by the Unified release workflow | `git rev-list -n1 vX.Y.Z` = SHA |
| GitHub Release | Same tag, verified archive attached | `gh release view vX.Y.Z` |
| Render deployment | Deploy of that exact commit | `render deploys list srv-dbnfjajrjlhs738m4020` |
| Production version endpoint | `/version` `status: matched`, `commit` = SHA, `manifest.official` | `curl https://openfund.cloud/version` |

Never create a version number only to satisfy this table. At the 2026-11-10
audit, production served commit `0c45594` with manifest `version 0.4.4`,
`official: false` (a gated current-`main` build), while the latest official
tag `v0.4.4` points to `c1cb707`.

## Release checklist (reviewed batch on `main`)

- [ ] All batch PRs merged after review; required checks green on the merge commit
- [ ] `npm run release:build -- --candidate` passes with Node 22 and an isolated test database
- [ ] CHANGELOG "Unreleased" section describes the batch; Feature Status and milestones aligned
- [ ] `npm run docs:check` passes (links, required documents, README sections)
- [ ] Migrations are additive and idempotent (`npm run migrate` twice on a copy)
- [ ] Owner approval to publish recorded; dispatch Unified release with `publish=true`
- [ ] Tag, GitHub Release, archive and manifest SHA verified; local start of the downloaded release checked with `npm run release:local`

## Deployment checklist (production)

- [ ] Explicit owner approval for this deployment (commit and version named)
- [ ] Current production `/version` recorded (the rollback target)
- [ ] Database backup confirmed available (Render PostgreSQL backups / manual dump, see [Database](DATABASE.md)) before any schema change
- [ ] Environment changes listed and applied first (names only, never values in records)
- [ ] Exactly one deployment path used (release workflow with `production` environment approval). Auto-deploy stays off, and no parallel manual deploy runs
- [ ] After deploy: `/version` matched on `openfund.cloud` and `openfi.cloud`; `/health` OK; Render logs free of start-up errors
- [ ] Smoke checks: home page in both locales, wallet sign-in on Arbitrum One, Prop terminal, `/purchases/plans` reflects the intended `paymentsEnabled`
- [ ] For payment activation: follow [Payment activation](../payments/ACTIVATION.md) and the [DePay report](../payments/DEPAY.md), then one supervised real payment, recorded with redactions
- [ ] Rollback trigger defined (any failed check above) and the previous release kept available
