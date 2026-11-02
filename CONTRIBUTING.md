# Contributing to Openfund

## Branches and reviews

Create a feature branch from the latest `main`, e.g. `qwen/terminal-layout`, `codex/vela-adapter`, or `docs/brand-strategy`. Keep each PR focused. Never force-push to `main`.

## Pull Request checklist

- [ ] Change is scoped and described clearly
- [ ] Existing landing page and terminal still render
- [ ] Relevant tests or manual verification recorded
- [ ] README and integration docs updated when applicable
- [ ] `docs/product/FEATURE_STATUS.md` accurately updated
- [ ] `CHANGELOG.md` updated for material changes
- [ ] No secrets, unsupported network addresses or unlicensed assets added
- [ ] Third-party attribution retained

## CI requirements

CI (`.github/workflows/ci.yml`) must pass before merge:
web typecheck + unit tests + production build · backend suite against a real
Postgres service container · `npm run validate:blueprint` · gitleaks. Keep
changes green locally: `npm run typecheck`, `npm run test:web`,
`npm run test:backend`, `npm run validate:blueprint`. Deployment-relevant
changes must follow the Render rules in `AGENTS.md` and update
`docs/deployment/*` when they touch services or variables.

## Commit convention

Use `feat:`, `fix:`, `docs:`, `refactor:`, `test:` or `chore:` prefixes. Do not mark a planned integration as implemented without working code and verification.
