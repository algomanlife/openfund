# Website and repository audit — 2026-11-03

## Current reconciliation — 2026-11-03 19:52 UTC

The baseline below is historical evidence, not current runtime authority. Fresh
GitHub queries verify official v0.2.0 at main `561e7f3`, including PR #40/#41;
publication run 41705345213 succeeded. The dirty website-refresh branch remains
excluded. No current 8080 startup is verified by this documentation update.
Earlier generic Telegram-homepage instructions below are superseded: the community
action must remain unavailable until an owner-verified URL is configured. Current
implementation uses the public build input `VITE_TELEGRAM_COMMUNITY_URL`; its
validation accepts HTTPS `t.me` community/invitation paths, not telegram.org.
Historical captures/checks do not certify the revised unavailable-state behavior.
See [release boundaries](../../deployment/RELEASES.md) and
[capture provenance](../../assets/screenshots/README.md).

## Verified baseline before implementation

- Canonical repository: https://github.com/algomanlife/openfund.
- Official GitHub release and newest tag: v0.1.1, source `ce9ddd0e4ead5da899fba512870e369820489187`, published 2026-11-03 14:18 UTC. Assets: application tar.gz, SHA256SUMS, release-manifest.json, verification.json, release-status.md. This is a Node/web payload, not a desktop installer.
- Local canonical application `/version` on port 8080 reports matching official frontend/backend v0.1.1 and that SHA; preserved during development.
- Fetched origin/main: `8b6db4ec25642e0098bb3a335d761e60e9344043`. PR #40 Persian gateway was merged after v0.1.1; this explains the difference. PR #39 was included in v0.1.1; #38 and #37 established release gates and unified packaging.
- Original local checkout: `/Users/algoman/openfund`, branch `qwen/purchase-flow`, SHA `d1b10e075c5f2d85efe3a18aa85540b63b79b457`; only untracked Finder .DS_Store files, no tracked modifications or active Git merge.
- PR #41 is mergeable, waiting for CI and unified package gates. Earlier package run timed out at 45 minutes; branch already raises the ceiling to 75. Previous full CI succeeded. Current runs: 41698342714 and 41698342597. Do not bypass gates.
- Isolated branch: `codex/website-polish-repository-refresh`, worktree `/Users/algoman/openfund-website-refresh`, initially latest main. Qwen is inactive per owner; all purchase changes must survive integration. Owner subsequently authorized merge and a new official release.
- Relevant branches: main, qwen/purchase-flow, codex/landing-persian-motion-redesign, codex/final-ui-polish, codex/batch-release-gate-fix; older remote development branches remain preserved. Existing worktrees were inventoried; none reset, removed or overwritten.

## Application and ownership map

| Subsystem | Actual files and functionality | Limits, tests and recent changes |
| --- | --- | --- |
| Public website / Persian gateway | apps/web-react/src/features/home/Home.tsx and home.css; CMS home content; Persian vector motion from PR #40 | CMS unavailable state is explicit; public route and UI-polish browser tests; English Home resolves to Prop challenges |
| English Prop / hero / catalog | apps/web-react/src/pages/Landing.tsx and landing-body.html; legacy runtime under public/legacy; challengePlans.ts | Existing catalog reused; published CMS catalog; challenge-plan and browser tests |
| Shared public footer | landing-body.html extracted by InformationShell.tsx Chrome | Home previously intentionally lacked footer; terminal has its own shell |
| Downloads | desktop-section in landing-body.html | Three placeholder anchors; no platform installers or store listings in release assets/configuration; all five should say Coming Soon |
| Dashboard / accounts / Portfolio / Journal | features/terminal/{Dashboard,Accounts,Portfolio,Journal,JournalAnalytics}.tsx; products.js, portfolio.js; journal-core | SIWE ownership; Prop virtual ledger and separate Gains reads; account, engine, journal and browser suites |
| Terminal / Vela / Gains | features/terminal/TerminalShell.tsx, trading/TradingBridge.tsx, packages/openfund-charts and openfund-gains-adapter | Shared presentation, isolated finances; read-only Perpetual; original Pine sources; chart/layout tests |
| Wallet / profiles | wallet/*, session/*, backend server.js, schema.sql | SIWE and HttpOnly sessions; PR #41 adds name/avatar editing; generated signer acceptance does not certify real devices |
| Purchase / DePay / orders / payments | PR #41 features/purchase/*, backend purchases.js and schema.sql | Not on audited main or official v0.1.1; env-gated receiver and widget; exact-once provisioning; purchases test and browser lifecycle |
| Invoices / withdrawals | PR #41 invoice-pdf.js, PurchaseHistory.tsx, WithdrawalsPage.tsx | Invoices and operator-reviewed requests; no automatic payouts, challenge evaluation or production payment acceptance |
| Localization / themes | public/translations.json, legacy/locale.js, InformationShell.tsx; legacy/style.css; information.css | Persian RTL, English LTR; CMS translation overrides; of-language and of-theme contracts retained |
| Backend / DB | apps/backend/server.js, products.js, engine.js, trading-math.js, schema.sql and migrate.js | Express /auth, /accounts, /trading, /portfolio, product APIs; PostgreSQL additive idempotent migrations; no schema edits planned |
| Content | apps/backstage/scripts, cms/client.ts and seed/* | Directus editorial/catalog authority, never financial mutation authority |
| Build / deployment | root package.json; apps/web-react/vite.config.ts; render.yaml | Per-app lockfiles, Node 22, tracked react output, source-critical dist; existing three Render resources, no verified deployment |
| Release | scripts/release/*; .github/workflows/{release,deploy-release,ci}.yml | Main-only reviewed SemVer batches, immutable tags/manifests/checksums, double reproducible frontend build; explicit publish=true; isolated DB and exact-source security gates |

## Design and assets

Existing mint #82E7BD, obsidian #060808, green surfaces #0A100D/#0E1712, Ubuntu/Irancell, rounded public cards, subtle borders and responsive 700/1050px rules. Public layout uses container/hero/button/desktop-btn/credits-row; terminal remains compact and separate. Dark/light data-theme and document dir/lang are existing contracts. Preserve supplied Openfund mark geometry and Vela attribution. Motion uses CSS transitions and prefers-reduced-motion; no new library needed.

Official asset sources inspected: TradingView media kit and its official lightweight-charts repository, DePay brand page, Telegram logos page, Apple store marketing guidelines, Google Play badge resources. Third-party marks identify linked services, not endorsements. Do not display store availability badges as published apps when listings do not exist.

## Five workstreams and smallest safe changes

| Workstream | Already implemented | Missing / exact change locations | Integration risk |
| --- | --- | --- | --- |
| Footer services | Gains, Vela, TradingView, Render and descriptions | Replace official TradingView asset; add DePay SVG in public/assets and compatibility dist/assets; landing-body.html + dist/index.html; translations.json; shared scoped CSS | Preserve news URL, other descriptions and external-link security; no checkout mutation |
| Attribution | Shared footer + Shiraz wording | Replace development location in landing-body.html, dist/index.html and both translation dictionaries | CMS overrides can be stale; retain Shiraz unchanged |
| Desktop & Mobile | Three desktop options, existing styling | Five truthful platform cards, localized title and description; same markup/dictionary/CSS files | Release archive is not an installer; no fabricated URLs or availability claims |
| Repository | Professional README, architecture, roadmap, contributor docs and authentic historical gallery already exist | Refresh status/SHA, release claims, navigation, instructions and selected screenshots; README, ROADMAP, docs/product/FEATURE_STATUS, architecture, release/development guides, AGENTS, CONTRIBUTING, CHANGELOG, docs/assets/screenshots | Preserve useful docs, original evidence and active package layout; do not blanket rewrite |
| Telegram | No configured community URL found in sources/docs | Reusable React component, public copy/config module + CSS; Home, Landing portal hosts, Chrome footer | No verified destination: configure an owner URL or keep the action unavailable; never mount in TerminalShell |

## Planned validation and release compatibility

Run repository docs:check, validate:blueprint, typecheck, test:web, test:charts, test:release, production build, isolated PostgreSQL backend tests, existing browser regressions and focused bilingual/theme/responsive/footer/download/Telegram checks. Capture real candidate pages at consistent viewports; label published editorial fixtures explicitly and use disposable test identities only. Refresh manifest entries without relabelling historical captures as new. Preserve unified workflow and immutable v0.1.1 for rollback; reconcile latest main and PR #41 before final integration. No canonical 8080 restart during development. New official publication and local version switch follow the owner’s subsequent explicit release authorization.

## Integration resolution

All PR #41 checks passed on `d1b10e0`: CI 41698342714 and package 41698342597. Owner explicitly authorized merge/release. PR #41 merged without bypass or history rewrite as `561e7f3`; this worktree fast-forwarded before implementation. v0.1.1 remains the latest official release until the new unified workflow publishes. The earlier candidate temporarily used Telegram's generic homepage; that was not an Openfund invitation and is superseded by the configurable unavailable-state requirement above.
