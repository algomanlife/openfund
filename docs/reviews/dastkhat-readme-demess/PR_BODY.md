## Objective

Make Dastkhat the only Persian face across the whole project, remove every retired font, restructure the README to a short enforced contract, de-mess the docs, and add permanent CI gates (README structure, retired registry, fonts) so the result stays true. Prepares release v0.9.0.

## Problem

Retired faces were still present: the `dist/` snapshot used Irancell and preloaded the renamed "Openfund Persian" files, and the certificate used `OpenfundCertificateFa`. 54 retired binaries were tracked, one of them an unresolved "All rights reserved" license blocker. Vazirmatn remained in the brandbook and the Persian investor documents. Five Persian `@font-face` copies had drifted apart. The README had grown to 1,045 lines with an orphan section, four dated galleries and stale versions, because `check-required.mjs` only checked that sections existed.

## Scope

Included: W1 Dastkhat migration (code, `dist/`, assets, manifests, content registry, legal docs, regenerated brandbook and investor documents); W2 retired registry, archive of dated galleries and superseded reviews, single-source docs; W3 README rewrite; W4 three gates wired into `docs:check` with 24 tests, contract doc, AGENTS.md reference. Not included: application or business logic, trading engine, payments, wallet auth, schema, deployment configuration; Latin typography (Ubuntu unchanged); the release itself (owner).

## Files and modules

`apps/web-react/public/assets/fonts/dastkhat/` (new `dastkhat.css`, FaNum, FONTLOG), `apps/web-react/public/legacy/{style,terminal}.css`, `apps/web-react/{index.html,src/styles/design-system.css,src/features/certificates/export.ts,test/typography.test.mjs}`, `apps/backstage/operations/{server.js,public/style.css}`, `apps/open-trade/{index.html,src/style.css}`, `dist/**`, `brand/**`, `docs/business/Openfund-Prop-Investor-Pack/**`, `scripts/docs/{check-readme,check-retired,check-fonts}.mjs`, `scripts/docs/lib/`, `scripts/docs/test/gates.test.mjs`, `README.md`, `docs/development/{RETIRED.json,RETIRED.md,README_STRUCTURE.md}`, `docs/product/PLATFORM_TOUR.md`, `docs/economy/BUSINESS_DETAIL.md`, `docs/architecture/PLATFORM_REFERENCE.md`, `docs/reviews/_archive/**`, `docs/assets/gallery/**`, `.github/workflows/ci.yml` (step name only), `package.json` (docs scripts), `AGENTS.md`. Full list and the old→new map: `docs/reviews/dastkhat-readme-demess/REPORT.md`.

## Behavior impact

User-visible: the legacy `dist/` pages and the certificate canvas now render Persian in Dastkhat instead of Irancell. All surfaces load one shared `dastkhat.css` (one extra small CSS request) instead of inline rules. Retired font URLs return 404. Other Persian surfaces were already on Dastkhat (#161); Dastkhat is metric-compatible with Vazirmatn, so layout is unchanged.

## Schema and migration

N/A — no schema or migration change.

## Security

The CSP is unchanged: every font and the CSS are same-origin (`font-src 'self'`, `style-src 'self'`). Backstage serves three more static files from the pinned font directory through the existing allow-listed static map. Heightened-review areas touched: none (no auth, money movement or secrets). Removing the unlicensed Irancell files reduces legal exposure.

## Dependencies

No package changes. Font: Dastkhat v1.210 (SIL OFL 1.1), unmodified, pinned at upstream `ac5b015`; the Dastkhat and FaNum files are byte-identical to tag `v1.210`; SHA-256 values are in `SOURCE.json`. The new gates use Node built-ins only.

## Tests and results

Passed locally:

- `node scripts/docs/status.mjs --check`, `check-readme.mjs`, `check-retired.mjs`, `check-fonts.mjs`
- `node --test scripts/docs/test/gates.test.mjs` (24/24)
- `docs:links`, markdownlint (0 issues), `docs:language`, `docs:required`, `legal:licenses`, `deps:check`
- `apps/web-react` `test:typography` 10/10, `test:content-registry`, `test:governance`
- Backstage tests 16/16
- Content registry regenerated with its own generator: byte-identical

Render evidence (`evidence/render-fonts.mjs`, `results.json`) passed 7/7 surfaces with zero retired-font requests. On original `main` the font gate reports 433 problems.

Not run here (no network or `npm ci`): Vite build/typecheck, `docs:mermaid` (needs jsdom), backend suites and browser e2e. CI covers them. The React/Open Trade `<link>` to a public-dir stylesheet needs the Vite build to confirm.

## Screenshots

`docs/reviews/dastkhat-readme-demess/evidence/*.png`: legacy site fa/ar, terminal iframe, React shell, certificate canvas, `dist/` landing and terminal, and Backstage in Persian. These are local renders of the real files, not production captures.

## Deployment

Merging does not deploy. After merge: `gh workflow run release.yml --ref main -f publish=true -f release_version=0.9.0` (the planner allocates 0.9.0 for this range), then approve the `production` environment. Verify with `node docs/reviews/dastkhat-readme-demess/evidence/verify-live.mjs --version 0.9.0`. No environment variables change.

## Rollback

Redeploy v0.8.0 (additive, no migrations). Reverting this PR restores the old files from history; Irancell remains license-blocked, so do not re-ship it.

## Related PRs

Follows #161 (Dastkhat UI font) and #174 (README restore). The status source is from #142. No merge-order dependency.

## Documentation

README (13-section contract), `README_STRUCTURE.md`, `RETIRED.json`/`.md`, `DESIGN_SYSTEM.md` typography policy, `TECH_STACK.md`, `THIRD_PARTY_NOTICES.md`, `LICENSING.md`, `LICENSE_DECISION.md`, `FEATURE_STATUS.md`, `status.json` (next = v0.9.0), CHANGELOG, `docs/README.md`, `AGENTS.md`, `DOCUMENTATION.md`.

## Production-enabled?

No. Production runs v0.8.0 until the owner publishes v0.9.0 and approves the deployment; nothing here claims deployment.

## Evidence checklist

- [x] Required checks executed; outcomes, warnings and external limits recorded
- [x] Product documentation and Feature Status aligned with implementation (README sections, ENVIRONMENT.md, CHANGELOG; `npm run docs:check` green)
- [x] Roadmap milestones/dependencies/acceptance criteria updated (no milestone change)
- [x] Genuine screenshots/provenance refreshed after significant UI changes
- [x] English documentation; Persian application/RTL fixtures preserved
- [x] Render three-resource architecture and same-origin app hosting preserved
- [x] No unsupported business claims, secrets or unlicensed assets; upstream notices retained
- [x] Verified results are separated from assumptions and anything not run or not verified is named
- [x] Out-of-scope areas untouched (trading engine, evaluation, payments, wallet auth, schema, contracts, deployment config) unless listed under Scope
- [x] Only files belonging to this change are included; staged diff reviewed for secrets
- [x] Heightened-review areas touched are named under Security (see docs/development/REPOSITORY_GOVERNANCE.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01KKnEpg8GMtTmoHrn411Qc9
