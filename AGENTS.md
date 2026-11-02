# Openfund — Shared Instructions for Coding Agents

Applies to Codex, QwenWork, ChatGPT Work and any other development agent.

## Source of truth

- Canonical repository: `https://github.com/algomanlife/openfund`.
- Inspect the working tree, branch, remotes, package scripts, existing files and current docs before changing anything.
- Never create a separate disconnected Openfund repository or overwrite the current application.
- `dist/` is currently a source-critical deliverable, not disposable generated output.

## Git collaboration

1. Fetch and branch from latest `main`: `codex/<topic>`, `qwen/<topic>` or `docs/<topic>`.
2. Do not force-push, rewrite history or push directly to `main`.
3. Keep commits scoped and descriptive (Conventional Commits preferred).
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
- Do not import or integrate MUX Protocol or Openfund Protocol source during Task 1; protocol integration is reserved for Task 2.


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
