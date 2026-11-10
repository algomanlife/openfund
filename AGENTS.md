# Openfund — Shared Instructions for Coding Agents

Applies to Codex, QwenWork, ChatGPT Work and any other development agent.

## Source of truth

- Canonical repository: `https://github.com/algomanlife/openfund`.
- Inspect the working tree, branch, remotes, package scripts, existing files and current docs before changing anything.
- Never create a separate disconnected Openfund repository or overwrite the current application.
- `dist/` is currently a source-critical deliverable, not disposable generated output.

## Git collaboration

1. Fetch and branch from latest `main`: `codex/<topic>`, `qwen/<topic>` or `docs/<topic>`. When explicitly assigned an existing staged branch, continue it without replacing its index or other contributors' work; agree file ownership before parallel edits.
2. Do not force-push, rewrite history or push directly to `main`.
3. Keep commits scoped and descriptive (Conventional Commits preferred).
   For commits actually created with Codex participation, retain the project's
   original Git author and append exactly one final trailer after a blank line:
   `Co-authored-by: Codex <codex@openai.com>`. Add
   `Co-authored-by: Claude <noreply@anthropic.com>` immediately before it only
   when Claude also contributed to that commit. Do not duplicate trailers or
   rewrite published history or official tags, including v0.4.0.
4. Open a Pull Request with summary, files changed, tests, risks and screenshots when UI changes.
5. Resolve conflicts rather than replacing others' changes; obtain review before merge.
6. Never delete or rename files outside the approved task scope.

## Documentation contract

- Before coding, read `docs/README.md`, current product/architecture contracts, `docs/product/FEATURE_STATUS.md` and `docs/roadmap/MILESTONES.md`.
- Keep product docs, feature status and roadmap dependencies/acceptance criteria aligned with every capability change.
- Refresh genuine screenshots and `docs/assets/screenshots/manifest.json` after significant UI changes; no fabricated financial UI or personal-wallet captures.
- Keep all repository documentation, explanatory comments/test descriptions and GitHub templates English-only. Preserve application Persian localization, RTL, dictionaries, seeds and required localization assertions.
- Run `npm run docs:check`; update CI whenever validation requirements change.
- Preserve approved logo geometry and asset provenance. Never invent partnerships, investors, revenue, user counts, volumes, approvals or production adoption.
- Preserve the already-integrated dormant `packages/openfund-protocol/` source, provenance and notices. Do not add protocol integrations or enable venue routing in a website/documentation task.


- Update the root README when setup, architecture, capabilities or project status changes.
- Update `docs/product/FEATURE_STATUS.md` for any feature status transition.
- Update the relevant integration or architecture specification when interfaces change.
- Add a concise entry to `CHANGELOG.md` for user-visible or architectural changes.
- Use `Completed`, `In Progress`, `Planned` and `Blocked` in the capability/milestone registers, qualified by scope and evidence. Distinguish configuration, local verification and deployed acceptance; never claim an API or network address is verified without evidence.
- Record architectural decisions in `docs/decisions/` as ADRs.

## Engineering and security

- Keep third-party upstream licensing and required attribution intact.
- Never commit private keys, seed phrases, API secrets, tokens or user data.
- Gains transaction execution must remain disabled by default until supported testnet contracts, transaction simulation and validation are established.
- Do not infer order-book depth or footprint data from oracle price feeds.
- Validate dependencies and tests before marking work complete. Report blocked tests and reasons.
- Preserve Openfund's visual identity and accessibility standards.

## Render deployment architecture (mandatory)

The repository deploys through the Render Blueprint at the repo root. Every change must keep it valid:

1. Inspect the current repository state and branches before editing; never work from an outdated base.
2. Follow the established workspace structure: root package.json is orchestration only; apps install their own dependencies with per-app lockfiles; `packages/` holds shared sources.
3. Reuse existing packages and modules before introducing duplicates.
4. Preserve `render.yaml` compatibility — every PR must keep `npm run validate:blueprint` green; run it before submitting.
5. When introducing a new environment variable: add it to `render.yaml` (owning service, `sync: false` for secrets), document it in `docs/deployment/ENVIRONMENT.md`, and add it to `.env.example` when it has a local default.
6. When introducing a new service: extend `render.yaml` (typed service, health check, env references), update CI, and document the boundary in `docs/deployment/RENDER.md` — do not create artificial microservices.
7. When introducing new build/test requirements: extend `.github/workflows/ci.yml` in the same PR.
8. Schema changes go through `apps/backend/schema.sql` + `migrate.js` (idempotent, additive-first). Never hand-ALTER live databases; never hide migrations in frontend builds.
9. Preserve the Directus content architecture (collections in `apps/backstage/scripts/apply_schema.py`; content = Directus, market data = Gains — never mix).
10. Preserve Prop/Perpetual product data isolation (`apps/backend/products.js` scoping).
11. Preserve the shared terminal UI — one terminal implementation, product contexts separate.
12. No hardcoded production URLs: use env vars (`VITE_*` for public build-time values only).
13. Never commit secrets (gitleaks runs in CI; `sync: false` / `generateValue` in the blueprint).
14. Run the relevant checks before submitting: `npm run validate:blueprint`, `npm run typecheck`, app unit tests, `npm run test:backend` (needs local Postgres).
15. Document new runtime dependencies in `docs/deployment/ENVIRONMENT.md`.
16. Use isolated branches/worktrees for parallel work; never force-push or reset shared branches.

## Definition of done

Code/config changes (if any), documentation, test results, change log, accurate feature status, and a reviewable Pull Request. A placeholder folder or npm dependency is **not** a completed integration.

## Unified release acceptance (mandatory)

- `main` is the integration authority; publish official SemVer releases after reviewed batches, not after every individual commit.
- An implemented feature, merged PR, passing unit test or worktree screenshot is not official delivery. Verify its actual active React route, data source and interactions in the unified application.
- Use `npm run release:build -- --candidate` with Node 22 and an isolated local PostgreSQL test database for complete candidate validation. Candidates must remain explicitly unofficial.
- After accepted integration, dispatch the main batch release workflow with `publish=true`. Failed package or exact-commit security checks must prevent publication; never bypass required checks.
- An official delivery needs its immutable tag, GitHub Release, verified archive, exact source SHA and matching frontend/backend manifests. Verify local startup from the downloaded release before reporting completion.
- Run official local versions through `npm run release:local -- --version current --migrate` (or an explicit historical tag), with the intended local `DATABASE_URL`. Check `/version` and the displayed version/SHA. `react/` is generated by `npm run build:web` and is not tracked; never silently serve a stale local `react/` build or an unrelated worktree as the official app.
- Inspect existing Openfund server ports and working directories before startup. Preserve the user database and other work; distinguish development servers, test servers and the single intended official runtime.
- Record implemented/unmerged, candidate, official/local and future deployed status separately. Preserve older official releases for rollback. Render credentials/deployment are optional until production is explicitly configured.
- Follow [the release runbook](docs/deployment/RELEASES.md). The user's accepted scope and authorization take precedence over this workflow.

## Safe shared-machine acceptance

Before editing, fetch references and record local status, main SHA, latest official
tag/release/manifest, open PRs and occupied server ports. Use an isolated worktree
with its own build output; preserve tracked `dist/` and existing agent work.
Reuse public footer/locale components and keep marketing actions outside trading
workspaces. Check the current release manifest before calling a candidate official.
Keep one intended official application at port 8080; use a separate test port and
new disposable database for development checks. Never run test suites against the
user database. Follow the existing unified release runbook for reviewed batches
and retain the previous immutable release and compatible database backup for rollback.
