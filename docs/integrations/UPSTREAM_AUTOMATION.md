# Upstream update automation

Lightweight governance for upstream dependencies: a registry file, a weekly read-only watcher and a manually dispatched candidate workflow. There is no new infrastructure, no database and no bot service; only GitHub Actions and the scripts in `scripts/upstream/`.

**Automation never merges and never deploys.** It records what changed upstream, classifies the risk, runs the offline checks and opens draft pull requests labelled `needs-human-approval`. Majors and high-risk updates need an explicit owner decision.

## Pieces

| Piece | Trigger | What it does | What it never does |
| :--- | :--- | :--- | :--- |
| [`infra/upstream/registry.json`](../../infra/upstream/registry.json) | edited by reviewed PRs | Records installed version, pinned ref, watch source, policy, tests, rollback limits per provider | Auto-updated except `latest_observed` |
| `upstream-guard.yml` | pull requests touching upstream areas | Runs `check:upstream`, `test:upstream` (verification, update tool, release classification, Gains contract tests), chart bundle reproducibility, Pine conformance | Network calls to providers |
| `upstream-watch.yml` | Mondays 06:17 UTC and manual | Runs `check-releases`, the offline tests, the optional live Gains contract check and read-only update reports for vendored sources; opens or refreshes one draft PR on branch `upstream-watch/proposal` that changes only `latest_observed` | Changes pins, vendored source, lockfiles, `render.yaml`; enables auto-merge; deploys |
| `upstream-update-candidate.yml` | manual dispatch (provider and optional target) | Runs `update-vendor --apply`, regenerates the manifest, rebuilds derived assets, runs the offline tests and opens a draft PR with report and results | Runs if a registered patch conflicts (it stops with nothing changed); marks the update reviewed; merges |

Local equivalents: `npm run watch:upstream`, `npm run update:vendor -- --provider <id>`, `npm run check:upstream`, `npm run test:upstream`.

## Classification policy

Risk follows each provider's real versioning policy, recorded as `policy.scheme` in the registry. Release notes of every release newer than the installed one are read; declared breaking changes, runtime requirement changes and licence changes raise the risk regardless of the version number.

| Scheme | Providers | Patch | Minor | Major |
| :--- | :--- | :--- | :--- | :--- |
| `semver-0x` | Vela, Vela Pine addon, PineTS | medium | **high** (0.x can break) | high |
| `directus` | Directus | low | medium, **high if the notes carry "Potential Breaking Changes", a runtime requirement or licence change** | **blocked, owner decision** |
| `semver` | React, Vite, Express, pg, ws, viem, wagmi | low | medium | **blocked, owner decision** |
| `source-head` | Gains SDK, Trade Journal core (no releases published) | any new commit on the default branch: medium, manual review | | |
| `hosted-contract` | Gains API | not versioned; protected by contract tests and the optional live check | | |

Actions: `none`, `proposal` (low or medium), `manual-review` (high), `blocked-owner-decision` (majors). Why Directus is special: its minor releases do carry breaking changes. Directus 12.6.0 raised the minimum Node.js to 26 and Directus 12.0.0 introduced licence tiers, so semver alone would under-report the risk. The tests pin both behaviours using the real release notes.

## Approval flow

1. The watcher opens or refreshes the proposal PR. Merging it only records observations.
2. A maintainer reads the release notes for a provider they want, then starts the matching procedure:
   - vendored sources: dispatch `Upstream update candidate`, or run `npm run update:vendor` locally ([Vela](VELA_UPGRADE.md), [source procedure](UPSTREAM_DEPENDENCIES.md#vendored-source-update-procedure));
   - Directus: [migration runbook](../deployment/DIRECTUS_MIGRATION_RUNBOOK.md), after the licence decision;
   - npm libraries: one dependency per PR with its lockfile and the suites named in the registry;
   - Gains: [contract upgrade protection](GAINS_UPGRADE.md).
3. The candidate PR carries the report, test output and a checklist of what the workflow could not run (browser regressions, `react/` build refresh, screenshots, legal review). A human completes and approves it.
4. After approval, the registry's `compatibility`, `last_upgrade` and `reviewed` fields are updated in the same PR and `CHANGELOG.md` records the version change.

Every upgrade therefore leaves four records: the version change (registry and lockfile or vendor diff), the compatibility result, regression evidence (PR body and CI) and the rollback note.

## Limits

- The watcher needs outbound access to GitHub and the npm registry; a failing source is reported per provider and never hides the others.
- `GITHUB_TOKEN` is used only to raise GitHub API limits and to open the PR. The "Allow GitHub Actions to create and approve pull requests" repository setting must be on; otherwise the report remains available as the job summary and an artifact.
- npm releases carry no release notes in the registry, so npm-based classification relies on the version class only. Read the provider's changelog before adopting.
- These workflows were written and unit-tested locally but **have not been executed on GitHub Actions**. Run `Upstream watch` once manually and read the first proposal before relying on the schedule.

Relation to Dependabot: `.github/dependabot.yml` (see [Dependency governance](../development/DEPENDENCY_GOVERNANCE.md)) proposes grouped npm minor/patch updates and deliberately excludes the exact-pinned upstream families. This watcher covers what Dependabot does not (vendored sources, the Directus image, hosted contracts, majors) and only refreshes observed versions; neither merges or deploys.

[Upstream dependency registry](UPSTREAM_REGISTRY.md) · [Patch registry](UPSTREAM_DEPENDENCIES.md) · [Dependency governance](../development/DEPENDENCY_GOVERNANCE.md) · [ADR 0021](../decisions/0021-upstream-governance-automation.md)
