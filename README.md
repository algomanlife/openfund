<div align="center">

<img src="docs/assets/brand/mark-mint.svg" alt="Official Openfund mark" width="64" />

# Openfund

**OPENFUND — A CLEARER WAY FORWARD**

Trading software for market discovery, simulated Prop trading and wallet-scoped Perpetual account review.

[Documentation](docs/README.md) · [Feature status](docs/product/FEATURE_STATUS.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

[![CI](https://github.com/algomanlife/openfund/actions/workflows/ci.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/ci.yml)

</div>

## Product overview

Openfund is an early-stage trading technology project maintained in a public repository. It combines a bilingual website, shared trading terminal, wallet identity, portfolios and private journals. Prop and Perpetual share presentation, not financial balances or execution authority.

This repository supports open-source collaboration, but has **no root license granting blanket reuse rights**. Component licenses and upstream notices apply separately; see [Licensing and upstream attribution](#licensing-and-upstream-attribution). Source availability is not a claim of production readiness, audited security or an active funded-trading service.

**Release status (2026-11-07):** v0.4.0 is the latest published version. The
v0.4.1 stabilization work is in progress on a review branch. The public site
currently reports v0.4.0 at `/version`; a successful health response does not
establish wallet, payment, CMS coverage or theme acceptance. See the
[v0.4.1 audit](docs/reviews/v0.4.1/AUDIT.md) and [release runbook](docs/deployment/RELEASES.md).

### Product areas

| Area | Implemented scope | Boundaries |
| --- | --- | --- |
| **Prop** | Persistent server-side simulation; market, limit and stop orders; SL/TP, partial close, cancellation and liquidation; account performance and journals | New Free Trial accounts receive 100,000 virtual USD; legacy virtual-DAI histories remain intact. Challenge purchases are gated; evaluation, funded capital and payouts are not active. |
| **Perpetual** | Gains Network market data and wallet-scoped Arbitrum One positions, orders, history and statistics | Read-only. Transactions, approvals and collateral transfers remain disabled. Missing balances or unsupported PnL stay unknown. |

The current [router](apps/web-react/src/main.tsx) exposes both products in Persian and Prop in English; English Perpetual routes redirect to Prop. Language availability does not determine residency eligibility. [Prop guide](docs/trading/PROP.md) · [Perpetual guide](docs/trading/PERPETUAL.md)

## Current capabilities

- **Market discovery and charting:** Gains REST/WebSocket feeds, shared Vela workspace and a Pine indicator catalog. Source freshness and upstream failures remain visible; reference-platform indicator conformance is still open.
- **Identity and accounts:** wallet connection, Sign-In with Ethereum (SIWE), first-party sessions and an owned account directory. Signing in is not a blockchain transaction.
- **Portfolio and Journal:** product-scoped records, supported analytics, private notes, tags, filters and exports. Journal imports cannot create trades or balances.
- **Prop evaluation engine (v0.3.1):** purchased challenge accounts trade through the same server-authoritative simulation engine while the published Rulebook rules of record are enforced live — profit targets on closed net profit, daily and maximum loss limits (static + trailing with breakeven lock) at the 00:00 UTC+3 day boundary, minimum trading days and time limits; breaches settle atomically into an immutable event history; two-phase challenges progress automatically with a frozen rules snapshot. A passing evaluation establishes eligibility, never a payout.
- **Public website:** English/Persian content, RTL support, FAQ, browser-side calculators, learning resources and pre-launch referral information; Directus content with supported bundled fallbacks.
- **Gated commerce and operations:** server-priced challenge orders, receipt verification with a finality policy and late-payment grace, invoices, withdrawal requests and the token-gated `/admin` operational API (user directory, withdrawal review). A confirmed payment provisions exactly one challenge; a withdrawal approval records a decision, never a fund transfer.

[Capability guide](docs/product/CAPABILITIES.md) · [Terminal](docs/trading/TERMINAL.md) · [Identity](docs/wallet/IDENTITY.md) · [Portfolio and Journal](docs/trading/PORTFOLIO_JOURNAL.md)

### Delivery status

| Delivery boundary | Status | What it means |
| --- | --- | --- |
| Official **v0.3.0** at `c87903c7` | Released | Website, terminal, purchases (gated) and practice trading. |
| **v0.3.1 soft-launch candidate** (`release/v0.3.1-soft-launch`) | Implemented, pending review | Challenge evaluation engine, challenge-account trading, admin API, payment lifecycle hardening, strict security headers and the terminal theme fix. Tagged release awaits explicit owner approval. |
| Desktop installers, mobile applications, funded-stage payouts, rewards, operational Protocol routing | Planned | Platform cards remain Coming Soon; dormant Protocol source is not an active venue. |
| Live payment activation and Perpetual execution | Blocked | Approved destinations/contracts, real-chain acceptance and security gates remain required. `PURCHASE_PAYMENT_RECEIVER` unset keeps purchases disabled. |

Real wallet/device acceptance, official release review, external chart conformance and operational recovery remain open. Transparency figures are labelled samples, not production evidence. The [feature register](docs/product/FEATURE_STATUS.md) qualifies every capability; dated [reviews](docs/reviews/README.md) retain their original provenance.

## Screenshots

<a id="product-gallery"></a>

Fresh P0 screenshots use real theme-button clicks, normal anonymous sessions and the actual canonical port 8080 application. The [gallery](docs/assets/screenshots/README.md) and [manifest](docs/assets/screenshots/manifest.json) identify each capture's runtime and distinguish the pre-packaging audit from final immutable-candidate evidence. No CSS injection, forced theme attributes, wallet injection or intercepted market/CMS responses are used. Prior `refinement-*` and `addendum-*` captures are historical, not evidence of the current build or owner acceptance.

| Persian Home — dark | Persian Home — light |
| --- | --- |
| ![Actual Persian Home dark](docs/assets/screenshots/p0-dark-fa-public-dark.png) | ![Actual Persian Home light](docs/assets/screenshots/p0-dark-fa-public-light.png) |
| **English Dashboard — dark** | **English Dashboard — light** |
| ![Actual anonymous Dashboard dark](docs/assets/screenshots/p0-dark-en-dashboard-dark.png) | ![Actual anonymous Dashboard light](docs/assets/screenshots/p0-dark-en-dashboard-light.png) |
| **English Prop Terminal — dark** | **English Prop Terminal — light** |
| ![Actual Prop terminal dark](docs/assets/screenshots/p0-dark-en-terminal-dark.png) | ![Actual Prop terminal light](docs/assets/screenshots/p0-dark-en-terminal-light.png) |

Charts retain live or explicit unavailable states. Anonymous Dashboard captures do not certify authenticated account contents. Chromium auto-dark emulation reproduces computed white backgrounds painted RGB(18,18,18); `color-scheme: only light` opts application-owned light surfaces out, including the nested workspace. Saved Vela cosmetics restore before the app palette. The existing polish gate runs `e2e/test-auto-dark.cjs` with real theme clicks, reloads, both OS preferences, persisted chart settings and screenshot-pixel assertions at 3360 × 1216. Owner Opera settings are not inspected; these images are not owner acceptance, an official release update or production deployment.

## Technology stack

| Layer | Technology |
| --- | --- |
| Web interface | React 19, TypeScript, Vite 6, React Router 7; Persian/English and RTL |
| Wallet and identity | RainbowKit, wagmi, viem, SIWE and HttpOnly sessions |
| Charting and market data | Vela 0.9.3, Vela Pine addon 0.3.2, PineTS 0.13.1, Gains adapters |
| API and simulation | Node.js 22, Express, Decimal arithmetic, WebSocket feeds and SSE |
| Persistence and content | PostgreSQL 17; Directus 11.9.1 for editorial/catalog administration |
| Quality and delivery | Per-app npm lockfiles, Playwright, GitHub Actions, Render Blueprint |

[Technology registry](docs/architecture/TECH_STACK.md) · [Upstream provenance](docs/integrations/UPSTREAM.md)

## Architecture

The Node API owns financial mutations and serves React at `/react/`. PostgreSQL stores product-scoped state. Directus administers published content, not wallet authorization. The API also hosts the simulation monitor and SSE; scaling requires coordinated mutation ownership. [System architecture](docs/architecture/ARCHITECTURE.md) · [Flows](docs/architecture/FLOWS.md) · [Product contracts](docs/architecture/PRODUCT_TERMINALS.md)

## Repository structure

| Path | Responsibility |
| --- | --- |
| `apps/web-react/` | Active React app, product routes, wallet/session context and public compatibility assets |
| `apps/backend/` | API, ownership checks, Prop simulation, product reads, purchases and additive migrations |
| `apps/backstage/scripts/` | Directus schema, content seeding and administration utilities |
| `packages/` | Shared chart/Gains/CMS contracts and integrations; dormant Protocol source |
| `vendor/`, `third_party/` | Upstream source, licenses, notices and analytical-core dependencies |
| `dist/` | Source-critical classic compatibility deliverable; do not delete as build output |
| `react/` | Tracked frontend output, replaced by current Vite builds |
| `scripts/`, `infra/render/`, `e2e/` | Release/docs/build tooling, Blueprint validation and browser checks |
| `docs/`, `brand/` | Product/engineering contracts, evidence and approved brand assets |

The root package orchestrates commands; applications install from their own lockfiles. `apps/web/`, `apps/terminal/` and `packages/openfund-ui/` are contract/ownership directories, not extra deployed applications.

## Quick start

Prerequisites: **Node.js 22**, npm and a running **PostgreSQL 17** service. Python 3 is needed only for optional Directus utilities. The browser application is the supported delivery surface; Windows/macOS/Linux installers and iOS/Android apps are not released. Local commands below use a POSIX shell; no native Windows setup acceptance is claimed.

From the repository root, using a new dedicated development database and your own local credentials:

```bash
npm ci
npm ci --include=dev --prefix apps/web-react
npm ci --prefix apps/backend
createdb openfund_dev
export DATABASE_URL=postgresql://localhost:5432/openfund_dev
npm run migrate --prefix apps/backend
npm run seed-plans --prefix apps/backend
# Check port ownership first. Use 8180 if it is free; preserve official port 8080.
PORT=8180 npm run dev:backend
```

In a second terminal:

```bash
VITE_BACKEND_URL=http://localhost:8180 npm run dev:web
```

Open [English Home](http://localhost:5173/react/#/en/home), [Persian Home](http://localhost:5173/react/#/fa/home), [Prop Terminal](http://localhost:5173/react/#/en/prop/trade) or [Persian Perpetual Terminal](http://localhost:5173/react/#/fa/perpetual/trade). Private views require wallet connection and SIWE. Never migrate or test against an existing user/production database.

## Development

`npm run dev:web` starts Vite on 5173; `npm run dev:backend` starts the watching API (default 8080 unless `PORT` is set). Inspect occupied ports before starting either. Directus is optional for supported fallback views; follow [CMS local setup](docs/backstage/LOCAL_SETUP.md) for published content.

To inspect a same-origin development build, stop only your own development backend and run:

```bash
npm run build:web
# Keep DATABASE_URL set to the dedicated development database.
PORT=8180 npm start --prefix apps/backend
```

Open [built Home](http://localhost:8180/react/#/en/home). This is development output, not an official installation. Builds replace tracked `react/`; review generated changes and preserve `dist/`. [Local development](docs/development/LOCAL_DEVELOPMENT.md) documents custom origins, database safety and source care.

### Environment configuration

Use [.env.example](.env.example) as a reference, not a production credential file. Supply backend values through its shell environment; optional frontend values belong in `apps/web-react/.env` for development only. Release builds reject local frontend overrides.

| Variable | Use / safety boundary |
| --- | --- |
| `DATABASE_URL`, `PORT` | API database connection and listening port; use an isolated local DB and an unoccupied port |
| `ALLOWED_DOMAINS`, `CORS_ORIGINS` | SIWE/browser origins; custom ports require matching configuration |
| `VITE_BACKEND_URL` | Public development API origin; official packages use same-origin API |
| `VITE_DIRECTUS_URL` | Public CMS origin; content availability depends on the actual service |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional public remote-wallet configuration; real-device acceptance is separate |
| `VITE_TELEGRAM_COMMUNITY_URL`, `VITE_DISCORD_COMMUNITY_URL` | Public build-time owner-verified destinations; Telegram accepts HTTPS `t.me` community/invitation paths, Discord accepts HTTPS `discord.gg` or `discord.com/invite` paths; blank/invalid keeps actions unavailable |
| `PURCHASE_PAYMENT_RECEIVER` | Unset by default: purchases stay disabled until an approved destination is configured |
| `VITE_DEPAY_WIDGET`, `VITE_DEPAY_WIDGET_URL` | Opt-in public widget configuration; both required, with independent acceptance |
| `SIM_TEST_MODE` | Isolated local tests only; never enable in production |

Every `VITE_*` value is bundled publicly: never use it for secrets. Discord configuration is part of the in-progress addendum; follow the owning implementation and [environment reference](docs/deployment/ENVIRONMENT.md) rather than inventing an invitation. New variables must stay aligned with the existing Blueprint and template.

## Testing

Run repository checks under Node 22:

```bash
npm run docs:check
npm run typecheck
npm run test:web
npm run test:charts
npm run test:release
npm run build:web
npm run validate:blueprint
```

Backend and browser suites require a **new isolated test database and running test backend**. Follow [Testing and CI](docs/development/TESTING.md) before `npm run test:backend`, `npm run test:browser:audit`, `npm run test:browser:polish`, `npm run test:browser:website` or the explicit suites. Test payment receivers and mark injection must never reach the official runtime. Playwright Chromium is required for browser gates.

The v0.3.1 additions extend the same model: `test:backend` now includes the evaluation (48 checks) and admin (25 checks) suites, and the browser gates add `npm run test:browser:challenge` (full purchase → start → trade → evaluate journey through the SIM seam) and `npm run test:browser:auto-dark` (theme paint regression). Set `ADMIN_API_TOKEN` on the test backend for the admin suite.

The existing unified candidate command is `npm run release:build -- --candidate`; it installs all three lockfiles and runs integrated package gates. It is not an official release, and does not replace real-wallet, live-payment, deployed or manual visual acceptance. [Release runbook](docs/deployment/RELEASES.md) defines database/port restrictions and verification stages.

## Deployment and releases

The latest verified official release is [v0.3.0](https://github.com/algomanlife/openfund/releases/tag/v0.3.0) at `c87903c`. The v0.3.1 soft-launch candidate lives on `release/v0.3.1-soft-launch` and awaits explicit owner review: merge approval, then the official release workflow, then Render deployment. Internal npm package versions are component provenance, not the application release number.

Complete the feature branch, obtain passing CI and review, then obtain approval before merge/publication. The existing main-branch workflow packages the approved exact commit, with manifests, verification records and checksums. No publication or merge is authorized by this documentation update. Recheck official releases and tag availability at publication time.

Official local startup uses `npm run release:local -- --version current --migrate` with the intended local `DATABASE_URL` after checking port ownership and database compatibility. The launcher downloads/verifies the official archive and pins its identity; inspect `/version` and the UI version/SHA. Preserve the previous immutable release and compatible database backup for rollback. [Release operations](docs/deployment/RELEASES.md) · [Rollback](docs/deployment/ROLLBACK.md)

### Render deployment

The existing [Render Blueprint](render.yaml) defines exactly three resources:

- **`openfund`**: Node API, simulation monitor and SSE, serving the built React app same-origin at `/react/`.
- **`openfund-db`**: PostgreSQL 17, with separate application and CMS table authority.
- **`openfund-cms`**: Directus 11.9.1 with persistent uploads.

There is no separate frontend service or worker. Production deployment remains unconfigured; a passing Blueprint check or GitHub release is not deployed acceptance. Exact-SHA deployment, HTTPS/session/CMS checks and recovery require separate authorization and evidence. [Render runbook](docs/deployment/RENDER.md) · [Database operations](docs/deployment/DATABASE.md)

## Roadmap

The [seven-phase roadmap](ROADMAP.md) covers platform foundation, trading core, product experience, production infrastructure, advanced trading, Protocol and ecosystem expansion. Current priorities are addendum verification, coordinated release versioning, real-wallet/device acceptance and operational recovery; live payments and execution retain their explicit gates.

[Milestones and acceptance criteria](docs/roadmap/MILESTONES.md) distinguish implemented foundations from unfinished delivery. [Product](docs/roadmap/PRODUCT.md) · [Engineering](docs/roadmap/ENGINEERING.md) · [Protocol](docs/roadmap/PROTOCOL.md). No speculative release dates or future version allocations are promised.

## Documentation index

The [full documentation index](docs/README.md) groups maintained contracts and historical evidence.

| Start here | Reference |
| --- | --- |
| Product intent and maturity | [Overview](docs/product/OVERVIEW.md), [Feature status](docs/product/FEATURE_STATUS.md) |
| System and integration contracts | [Architecture](docs/architecture/ARCHITECTURE.md), [ADRs](docs/decisions/README.md), [Gains](docs/integrations/GAINS.md), [Vela](docs/integrations/VELA.md) |
| Development and operations | [Local setup](docs/development/LOCAL_DEVELOPMENT.md), [Testing](docs/development/TESTING.md), [Environment](docs/deployment/ENVIRONMENT.md), [Releases](docs/deployment/RELEASES.md) |
| Design and evidence | [Design system](docs/design/DESIGN_SYSTEM.md), [Screenshots](docs/assets/screenshots/README.md), [Reviews](docs/reviews/README.md) |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), current product/architecture contracts and acceptance gates before changing code. Branch from current main, preserve others' work, use focused Conventional Commits and submit a reviewed PR with relevant tests, screenshots and limitations.

Keep first-party documentation in English while preserving Persian application localization and RTL. Update feature status, roadmap dependencies and affected contracts together. Preserve source-critical assets, financial isolation, disabled execution defaults and upstream notices. [Changelog](CHANGELOG.md)

## Security and responsible disclosure

Report suspected vulnerabilities privately through the repository's GitHub security advisory channel, as described in [SECURITY.md](SECURITY.md); do not file public vulnerability issues. Keep secrets, private keys and user data out of Git. SIWE verifies identity; the backend enforces product/account ownership and first-party sessions.

The repository does not claim an independent security audit, regulatory approval or production readiness. Generated-signature tests do not certify real wallet devices. [Security architecture and release gates](docs/security/SECURITY.md)

## Licensing and upstream attribution

**No root `LICENSE` is present.** Do not interpret this public repository or its contribution workflow as a blanket open-source license grant. Before redistribution or commercial reuse, resolve first-party licensing with the maintainers and comply with each component's terms.

| Component | Preserved license / notice |
| --- | --- |
| Vendored LuxAlgo Vela | [Apache-2.0](vendor/vela/LICENSE) and [NOTICE](vendor/vela/NOTICE); retain required linked attribution in the terminal |
| Vendored Gains SDK | [MIT](vendor/gains-sdk/LICENSE); vendoring does not enable transaction execution |
| LuxAlgo trade journal and analytical core | [MIT](third_party/luxalgo-trade-journal/LICENSE) and [core license](third_party/luxalgo-trade-journal/packages-core/LICENSE) |
| Dormant Openfund Protocol | [GPL-2.0 license file](packages/openfund-protocol/LICENSE); component-specific scope, not a root license |
| Fonts and external logo artwork | [Vazirmatn license](apps/web-react/public/assets/Vazirmatn-LICENSE.txt), [TradingView logo notice](apps/web-react/public/assets/notices/TradingView-logo-LICENSE.txt) and recorded asset provenance |

Installed dependencies retain their own licenses. Brand marks, fonts, hosted Directus and external chart/payment/network services may carry separate terms; not every asset or integration is freely reusable. Preserve package/generated notices and exact upstream provenance. Service logos indicate technology references, not partnerships or endorsement. [Upstream registry](docs/integrations/UPSTREAM.md) · [Brand inventory](brand/README.md)

## Community and project links

[Canonical repository](https://github.com/algomanlife/openfund) · [Issues](https://github.com/algomanlife/openfund/issues) · [Releases](https://github.com/algomanlife/openfund/releases) · [Documentation](docs/README.md) · [Contributing](CONTRIBUTING.md)

Official Openfund Telegram and Discord destinations have not been verified in repository configuration. Do not substitute provider homepages or invented invitations. Public controls must remain non-navigating until owner-verified destinations are configured; the addendum pairs provider-branded controls in public Heroes/Footers only, never the Trading Terminal.
