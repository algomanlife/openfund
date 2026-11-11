# Contributing to Openfund

Thanks for your interest in Openfund. This guide takes you from a fork to a
merged pull request. Coding agents additionally follow [AGENTS.md](AGENTS.md);
roles and review authority are in [Repository governance](docs/development/REPOSITORY_GOVERNANCE.md).
By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

> **Licensing notice.** No first-party license has been selected yet, so the
> repository is public but not open-source licensed (see [License](README.md#license)).
> The terms under which contributions are accepted are an open owner decision
> ([Licensing](docs/legal/LICENSING.md)). Until it is made, the maintainer may
> ask contributors to confirm they have the right to submit their work.

> **Security issues are never contributed through public issues or pull
> requests.** Follow [SECURITY.md](SECURITY.md).

## 1. Understand the project

Read the [README](README.md), the [documentation index](docs/README.md),
[Feature Status](docs/product/FEATURE_STATUS.md), the relevant product and
architecture contracts and the [milestone register](docs/roadmap/MILESTONES.md).
Many capabilities are simulated, read-only or planned; Feature Status says which.

## 2. Fork and clone

Outside contributors work from a fork:

```bash
gh repo fork algomanlife/openfund --clone
cd openfund
git remote -v   # origin = your fork, upstream = algomanlife/openfund
```

Maintainers and their coding agents may branch in the main repository instead.

## 3. Set up a local environment

Requirements: Node.js 22, npm, PostgreSQL (for the backend and its tests) and,
optionally, Docker for a local Directus. No production credentials are needed
or provided for local development.

```bash
npm ci
npm ci --include=dev --prefix apps/web-react
npm ci --prefix apps/backend
```

The backend reads its settings from environment variables (for example
`DATABASE_URL`); [.env.example](.env.example) lists the local defaults. If you
keep them in a local `.env` file, it is git-ignored. Then follow [Local development](docs/development/LOCAL_DEVELOPMENT.md) to create
a development database and start the backend and frontend.

## 4. Pick an issue

Look for [`good first issue`](https://github.com/algomanlife/openfund/labels/good%20first%20issue)
or [`help wanted`](https://github.com/algomanlife/openfund/labels/help%20wanted).
Comment on the issue before starting so work is not duplicated. For anything
larger than a small fix, open or discuss an issue first: changes that depend on
pricing, payouts, treasury or other commercial policy need an owner decision
([ECONOMY.md](ECONOMY.md)).

## 5. Create a branch

```bash
git fetch upstream            # or origin, inside the main repository
git switch -c fix/short-description upstream/main
```

Prefixes: `feat/`, `fix/`, `ui/`, `security/`, `docs/`, `chore/`, `ci/`.
Coding agents use `agent/<agent>/<task>`. One logical change per branch.
See [Branch naming](docs/development/REPOSITORY_GOVERNANCE.md#branch-naming).

## 6. Commit

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): description`,
for example `fix(terminal): keep order panel visible at 390 px`. Types and
scopes are listed in [Pull requests](docs/development/PULL_REQUESTS.md).
Messages such as "update", "changes" or "final fixes" are not accepted.

- Stage files by path and review `git diff --staged` before every commit.
- Keep your real Git identity. Add `Co-authored-by:` trailers only for people
  or agents who actually contributed to that commit.
- Never commit secrets, `.env` files, keys, wallet seed phrases, personal data
  or production data. CI runs gitleaks on every pull request.

## 7. Run the checks

Run what your change touches; record real results, including failures.

| Change | Commands |
| --- | --- |
| Any | `npm run docs:check` |
| Frontend | `npm run typecheck`, `npm run test:web`, `npm run build:web` |
| Backend | `npm run test:backend` (against an **isolated** test database, never your own data) |
| Render Blueprint / deployment config | `npm run validate:blueprint` |
| Charts / upstream code | `npm run test:charts`, `npm run check:upstream`, `npm run test:upstream` |

Details: [Testing](docs/development/TESTING.md). New validation requirements go
into `.github/workflows/ci.yml` in the same pull request.

## 8. Open a pull request

Push to your fork and open a pull request against `main`. Use the
[template](.github/pull_request_template.md): every section is checked by CI
(`PR description`), the title must be a Conventional Commit, and the description
must separate what you verified from what you assume. See
[Pull requests](docs/development/PULL_REQUESTS.md) for stacking and update rules.

## 9. Review

- CI runs automatically. Pull requests from forks run without repository secrets.
- The maintainer reviews the diff; changes to authentication, payments, the
  trading engine, migrations, CI or deployment get heightened review
  ([Repository governance](docs/development/REPOSITORY_GOVERNANCE.md#review-authority)).
- Address feedback with new commits; keep your branch current with
  `git merge upstream/main` (do not force-push once review has started).
- Resolve every review conversation.

## 10. Merge and release

The maintainer merges with a merge commit once checks pass and review is
complete. **Merging does not deploy**: production changes only through an
owner-approved release ([Releases](docs/deployment/RELEASES.md)).

## Attribution

Your commits keep your Git authorship, and merged pull requests appear in the
release summary generated from merge commits. Notable contributions are named
in the [changelog](CHANGELOG.md) entry for the change.

## Documentation contract

- Keep first-party documentation, explanatory comments, test descriptions and
  templates in English (CI enforces this); preserve Persian application
  localization, RTL and required fixture assertions. Questions and discussion in
  other languages are welcome in issues and discussions.
- Update product docs and Feature Status whenever capabilities change. Update related roadmap dependencies/acceptance criteria and architecture/integration contracts in the same PR.
- Refresh genuine screenshots and their provenance after significant UI changes. Do not invent account records or reveal personal wallet data.
- Record material changes in the changelog. Preserve approved logos, third-party licenses and attribution.
- Distinguish simulated execution, read-only integration, configuration, local verification and deployment. Never infer investors, partnerships, revenue, adoption, approvals or production readiness.

## Architecture contract

Preserve the three Render resources (`openfund`, `openfund-db`, `openfund-cms`) and same-origin React at `/react/`. Keep the shared terminal presentation and product financial state isolated. PostgreSQL/Decimal own Prop simulation; Gains owns Perpetual read records; Directus owns published content/catalog administration. `dist/` remains source-critical. The integrated Protocol source is dormant; operational venue routing remains planned.

## Validation

Follow [Local Development](docs/development/LOCAL_DEVELOPMENT.md) and [Testing](docs/development/TESTING.md). Required gates include `npm run docs:check`, TypeScript, relevant frontend/backend/browser suites, production build, Blueprint validation and security checks. Backend tests require an isolated database; test-only mark injection must stay disabled in production. Add new validation requirements to CI in the same PR. Report blockers and warnings accurately; do not mark unexecuted tests passed.

## PR checklist

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
