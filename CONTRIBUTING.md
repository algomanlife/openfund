# Contributing to Openfund

Before coding, read the [documentation index](docs/README.md), [Feature Status](docs/product/FEATURE_STATUS.md), relevant product/architecture contracts and [milestone register](docs/roadmap/MILESTONES.md). Follow [AGENTS.md](AGENTS.md) for repository and Render requirements.

## Workflow

Fetch the latest `main` and create a focused branch/worktree (`docs/`, `codex/` or `qwen/`). Inspect status/remotes/scripts first; preserve other work. Never force-push, rewrite history, push directly to main, or merge without review. Use Conventional Commit prefixes and a PR describing the concrete behavior, evidence and limitations.

## Documentation contract

- Keep first-party documentation, explanatory comments, test descriptions and templates in English; preserve Persian application localization, RTL and required fixture assertions.
- Update product docs and Feature Status whenever capabilities change. Update related roadmap dependencies/acceptance criteria and architecture/integration contracts in the same PR.
- Refresh genuine screenshots and their provenance after significant UI changes. Do not invent account records or reveal personal wallet data.
- Record material changes in the changelog. Preserve approved logos, third-party licenses and attribution.
- Distinguish simulated execution, read-only integration, configuration, local verification and deployment. Never infer investors, partnerships, revenue, adoption, approvals or production readiness.

## Architecture contract

Preserve the three Render resources (`openfund`, `openfund-db`, `openfund-cms`) and same-origin React at `/react/`. Keep the shared terminal presentation and product financial state isolated. PostgreSQL/Decimal own Prop simulation; Gains owns Perpetual read records; Directus owns published content/catalog administration. `dist/` remains source-critical. The integrated Protocol source is dormant; operational venue routing remains planned.

## Validation

Follow [Local Development](docs/development/LOCAL_DEVELOPMENT.md) and [Testing](docs/development/TESTING.md). Required gates include `npm run docs:check`, TypeScript, relevant frontend/backend/browser suites, production build, Blueprint validation and security checks. Backend tests require an isolated database; test-only mark injection must stay disabled in production. Add new validation requirements to CI in the same PR. Report blockers and warnings accurately; do not mark unexecuted tests passed.

## PR checklist

Use the pull request template (every section is checked by CI) and follow [Pull requests](docs/development/PULL_REQUESTS.md): Conventional Commit title, stacked-PR rules and the merge-readiness checklist.


- [ ] Scope and resulting behavior described for a new reviewer
- [ ] Relevant product/status/roadmap/contracts updated
- [ ] Screenshots and provenance refreshed where needed
- [ ] Required checks run, with failures and external limits recorded
- [ ] Render architecture, app localization and financial isolation preserved
- [ ] No secrets, unsupported claims, unlicensed assets or unexplained generated bundles

## Safe shared-machine acceptance

Follow the single [shared-machine acceptance contract](AGENTS.md#safe-shared-machine-acceptance)
and [release runbook](docs/deployment/RELEASES.md) for port ownership, isolated
test databases, artifact identity and rollback. Preserve the existing index and
worktree when continuing an explicitly assigned staged branch; do not rebranch
or restage unrelated work.
