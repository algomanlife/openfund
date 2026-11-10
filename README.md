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

**Current version: v0.4.3.** The release authority is the
[GitHub Release](https://github.com/algomanlife/openfund/releases) and the
running service's `/version` endpoint. This README is not live status. Since
v0.4.1 the line adds the Prop engine audit corrections, the system-default
theme, the Persian RTL/mobile terminal fixes, release-driven deployment and a
GHCR image per release. v0.4.2 is published but could not be deployed (see
below); v0.4.3 carries the same application with the deploy fix.
Production serves one application on `openfi.cloud` and `openfund.cloud`. See
[Current version and changelog](#current-version-and-changelog).

### Product areas

| Area | Implemented scope | Boundaries |
| --- | --- | --- |
| **Prop** | Persistent server-side simulation; market, limit and stop orders; SL/TP, partial close, cancellation and liquidation; challenge evaluation; account performance and journals | New Free Trial accounts receive 100,000 virtual USD; legacy virtual-DAI histories remain intact. Challenge purchases are disabled in production (`paymentsEnabled: false`); funded capital and payouts are not active. |
| **Perpetual** | Gains Network market data and wallet-scoped Arbitrum One positions, orders, history and statistics | Read-only. Transactions, approvals and collateral transfers remain disabled. Missing balances or unsupported PnL stay unknown. |

The current [router](apps/web-react/src/main.tsx) exposes both products in Persian and Prop in English; English Perpetual routes redirect to Prop. Language availability does not determine residency eligibility. [Prop guide](docs/trading/PROP.md) · [Perpetual guide](docs/trading/PERPETUAL.md)

## Current capabilities

- **Market discovery and charting:** Gains REST/WebSocket feeds, shared Vela workspace and a Pine indicator catalog. Source freshness and upstream failures remain visible; reference-platform indicator conformance is still open.
- **Identity and accounts:** wallet connection, Sign-In with Ethereum (SIWE), first-party sessions and an owned account directory. Signing in is not a blockchain transaction.
- **Portfolio and Journal:** product-scoped records, supported analytics, private notes, tags, filters and exports. Journal imports cannot create trades or balances.
- **Prop evaluation engine:** challenge accounts trade through the same server-authoritative simulation engine while the Rulebook rules are enforced: profit targets on closed net profit (also after settling open positions), daily and maximum loss limits (static or trailing) at the 00:00 UTC+3 day boundary, minimum trading days counted by fill day, and time limits. Breaches settle into an immutable event history; two-phase challenges progress with a frozen rules snapshot. A pass establishes eligibility, never a payout. See [Prop Trading Engine](#prop-trading-engine).
- **Governance (built, not in production use):** Hybrid Governance v1.0 — an off-chain, auditable framework in which a ten-seat Community Council holds binding authority over delegated non-financial domains while company management keeps treasury and all financial decisions. Proposals (OFP), voting records, council membership rules, an election architecture and a public Governance page exist and are tested; no council is seated and no election is scheduled. [GOVERNANCE.md](GOVERNANCE.md) · [ECONOMY.md](ECONOMY.md) · [Governance docs](docs/governance/README.md). Not a DAO; no token.
- **Public website:** English/Persian content, RTL support, FAQ, browser-side calculators, learning resources and pre-launch referral information; Directus content with supported bundled fallbacks.
- **Official Whitepaper v1.0:** a bilingual, CMS-managed single-page publication at `/{locale}/whitepaper`, linked from the footer, that describes the ecosystem, architecture, business model, economics and roadmap with verified status labels. See [Whitepaper](docs/website/WHITEPAPER.md).
- **Economy and partner programs:** a public Economy menu (Transparency, Revenue Model, Live Market Access) computed from operational records; scheduled on-chain treasury snapshots once a public treasury address is configured; reviewed Brand Ambassador (10% first-purchase commission ledger) and Verified Trading Coach roles; and a Live Market Access control plane gated by verified allocatable capital ≥ $500,000. Real live execution and transfers are disabled. See [Economy](docs/economy/README.md).
- **Gated commerce and operations:** server-priced challenge orders, receipt verification with a finality policy and late-payment grace, invoices, withdrawal requests and the token-gated `/admin` operational API (user directory, withdrawal review). A confirmed payment provisions exactly one challenge; a withdrawal approval records a decision, never a fund transfer.

[Capability guide](docs/product/CAPABILITIES.md) · [Terminal](docs/trading/TERMINAL.md) · [Identity](docs/wallet/IDENTITY.md) · [Portfolio and Journal](docs/trading/PORTFOLIO_JOURNAL.md)

### Delivery status

| Delivery boundary | Status | What it means |
| --- | --- | --- |
| **v0.4.3** | Current release (see the [GitHub Release](https://github.com/algomanlife/openfund/releases) for publication and `/version` for deployment) | v0.4.2 plus the release-asset download fix and the GHCR image |
| **v0.4.2** at `fc4df52` | Published 2026-11-08; not deployed | Prop engine corrections, theme and terminal fixes, release-driven deployment. Its Render build cannot download the manifest (see the changelog) |
| **v0.4.1** at `b8389ca` | Released and deployed 2026-11-07 | Runtime public configuration, CMS bootstrap hardening; rollback target |
| Desktop installers, mobile applications, funded-stage payouts, rewards, operational Protocol routing | Planned | Platform cards remain Coming Soon; dormant Protocol source is not an active venue. |
| Live payment activation and Perpetual execution | Blocked | Approved destinations/contracts, real-chain acceptance and security gates remain required. `PURCHASE_PAYMENT_RECEIVER` unset keeps purchases disabled. |

Real wallet/device acceptance, official release review, external chart conformance and operational recovery remain open. Transparency figures come from operational records; treasury balance and allocatable capital stay `Not configured`/`Unknown` until management configures the treasury and reserves. The [feature register](docs/product/FEATURE_STATUS.md) qualifies every capability; dated [reviews](docs/reviews/README.md) retain their original provenance.

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

| Component | Implementation |
| --- | --- |
| Frontend | React 19 + Vite SPA under `apps/web-react/`, built into `react/` and served by the API at `/react/` (hash routing, same origin). Public settings come from the no-store `/react/runtime-config.js`, not the bundle ([ADR 0010](docs/decisions/0010-runtime-public-configuration.md)). |
| Backend | Express API in `apps/backend/server.js`: SIWE sign-in and host-only HttpOnly sessions, product-scoped accounts, purchases, portfolio/journal and the token-gated `/admin` API. |
| Trading engine | `apps/backend/engine.js` with `trading-math.js` (decimal.js valuation) and `instruments.js`. Server-authoritative fills at server marks; an in-process loop (about 1 s) runs pending orders, SL/TP, liquidation and challenge enforcement; SSE at `/trading/stream`. |
| Challenge evaluation | `apps/backend/evaluation.js`: a pure `evaluateRules()` over a frozen rules snapshot plus persisted day and trailing state. |
| Market data | `apps/backend/market-data.js` consumes Gains Network price feeds. Stale or future marks are rejected; no order-book depth is inferred from oracle prices. |
| Database | PostgreSQL 17. `apps/backend/schema.sql` + `migrate.js` (additive, idempotent) run on every start. |
| CMS | Directus 11.9.1 (`openfund-cms`) for editorial content and the plan catalog; market data never flows through it. |
| Infrastructure | Render Blueprint (`render.yaml`): `openfund`, `openfund-cms`, `openfund-db` in Frankfurt. |
| CI/CD | GitHub Actions: `ci.yml` (required checks), `release.yml` (candidate on every PR/main push, publication on dispatch), `deploy-release.yml` (deploy and rollback). |

The API also hosts the simulation monitor and SSE; scaling requires coordinated mutation ownership. [System architecture](docs/architecture/ARCHITECTURE.md) · [Flows](docs/architecture/FLOWS.md) · [Product contracts](docs/architecture/PRODUCT_TERMINALS.md)

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

`test:backend` includes the challenge evaluation (48 checks), Prop engine (`test:engine`, 31 checks) and admin (25 checks) suites, and the browser gates add `npm run test:browser:challenge` (full purchase → start → trade → evaluate journey through the SIM seam) and `npm run test:browser:auto-dark` (theme paint regression). Set `ADMIN_API_TOKEN` on the test backend for the admin suite.

The existing unified candidate command is `npm run release:build -- --candidate`; it installs all three lockfiles and runs integrated package gates. It is not an official release, and does not replace real-wallet, live-payment, deployed or manual visual acceptance. [Release runbook](docs/deployment/RELEASES.md) defines database/port restrictions and verification stages.

## Production infrastructure

The [Render Blueprint](render.yaml) defines three resources, all in Frankfurt:

| Resource | Type | Build / start | Health check |
| --- | --- | --- | --- |
| `openfund` | Node 22 web service, one instance | `node scripts/release/render-build.mjs` / `npm run migrate --prefix apps/backend && npm start --prefix apps/backend` | `/health` |
| `openfund-cms` | Directus 11.9.1 image with a 5 GB uploads disk | official image | `/server/health` |
| `openfund-db` | PostgreSQL 17 | managed | managed |

Both services have commit auto-deploy turned off. `render-build.mjs` builds
only a commit that has a published, non-prerelease GitHub Release and stops if
the rebuilt frontend, backend or schema hash differs from the release
manifest. Migrations are additive and run at start. Secrets are Render
environment values (`sync: false` or `generateValue`), never Git; see the
[environment reference](docs/deployment/ENVIRONMENT.md). There is no separate
frontend service or worker. [Render runbook](docs/deployment/RENDER.md) ·
[Database operations](docs/deployment/DATABASE.md)

## GitHub Releases and packages

- **Version tags:** `vMAJOR.MINOR.PATCH`, annotated, immutable, allocated by
  `scripts/release/plan.mjs` from Conventional Commits since the previous tag
  (`feat` → minor, `fix` and others → patch, `!` → major).
- **GitHub Release:** `Openfund vX.Y.Z`, stable (never a prerelease), with
  generated notes and these assets:
  `openfund-vX.Y.Z.tar.gz` (the versioned deployable package),
  `SHA256SUMS`, `release-manifest.json`, `verification.json` and
  `release-status.md`.
- **Provenance:** the manifest records the exact source SHA, frontend and
  backend content hashes, schema hash, toolchain and every CI verification
  stage. The same manifest is served at `/react/release-manifest.json`, and
  `/version` reports `matched` only when frontend and backend agree.
- **GitHub Package (GHCR):** `ghcr.io/algomanlife/openfund:X.Y.Z` (also
  `vX.Y.Z`, no `latest`), built only from the verified release archive,
  smoke-tested, then pushed once. The digest is attached to the release as
  `image-digest.txt` with a build-provenance attestation
  ([ADR 0014](docs/decisions/0014-ghcr-release-image.md)). Render does not
  run the image; it rebuilds the same commit from source.

  ```bash
  docker run -p 8080:8080 -e DATABASE_URL=... -e CMS_PUBLIC_URL=https://... \
    -e ALLOWED_DOMAINS=your.host ghcr.io/algomanlife/openfund:0.4.3
  ```

- `package.json` `version` fields stay `0.1.0`: they are component
  provenance, not the application version.

## Automated deployment

```
Reviewed merge to main → Unified release (publish=true) → gates → tag + GitHub Release
  → production approval → Render deploy of the exact commit → live identity check
```

- **Trigger:** a maintainer dispatches **Unified release** on `main` with
  `publish=true`. Pushes and pull requests only build unofficial candidates.
- **CI requirements:** package gates (lockfile installs, Blueprint, docs,
  typecheck, unit suites, two reproducible frontend builds, double migration,
  backend and browser suites), exact-commit secret scan, disposable Directus
  bootstrap and a live public CMS check.
- **Deployment:** the chained `deploy` job waits for the `production`
  environment reviewer, then calls Render with the manifest's `commitId`.
- **Validation:** `/version` and `/react/release-manifest.json` on
  `RELEASE_PUBLIC_URL` must match the release; the CMS must be healthy.
- **Failure:** the job fails as `blocked` or `failed_or_partial` and uploads
  `output/deployment-status.json`; Render keeps the previous deploy live when
  a build or health check fails.
- **Safety:** prereleases and drafts are refused; a tag older than the latest
  release needs `rollback=true`; a retry on an already-live release does not
  redeploy.

[Release runbook](docs/deployment/RELEASES.md) · [Rollback](docs/deployment/ROLLBACK.md)

## Production domains

| Hostname | Behavior |
| --- | --- |
| `https://openfi.cloud` | Existing production domain; serves the application |
| `https://openfund.cloud` | Second production domain; the same `openfund` service |
| `https://www.openfi.cloud`, `https://www.openfund.cloud` | `301` to the matching root domain, path preserved |

DNS is on Cloudflare (proxied) with Render custom domains on the one
`openfund` service; HTTPS uses edge certificates with HSTS, and HTTP redirects
to HTTPS. Neither root domain redirects to the other. Sessions are host-only
cookies, so each domain signs in separately against the same accounts. Wallet
sign-in requires every serving hostname in `ALLOWED_DOMAINS`.
[Production domains](docs/deployment/RENDER.md#production-domains)

## Prop Trading Engine

- **Orders:** market, limit and stop orders with idempotency keys,
  pre-trade validation (market, size, leverage and plan caps, SL/TP side) and
  a free-margin check that includes the opening fee.
- **Positions:** linear virtual-USD contracts; partial closes are slices of a
  root position. Spread and fee tiers come from `trading-math.js`.
- **PnL:** unrealized `qty × (mark − entry) × direction`; realized PnL books
  exit spread and the closing fee. Every balance change has a ledger row.
- **Daily drawdown:** floor `basis × (1 − daily %)`, with basis the higher of
  the day-opening balance and equity at 00:00 UTC+3. Touching the floor is a
  breach.
- **Overall drawdown:** static `start × (1 − max %)` or trailing (Instant
  plans) from peak equity.
- **Evaluation:** target on closed net profit, which must also hold after
  settling every open position at the current mark; minimum trading days by
  fill day; time limits; two-phase progression.
- **Risk enforcement:** on every fill and close and on each loop pass. A
  breach closes positions at the mark; positions in closed markets settle
  once tradeable.
- **v0.4.2 corrections:** five defects fixed (P0 pass while settlement
  realized the target away; post-fill fee blind spot; trading days by order
  date; orphan positions after breach; misreported daily limit) with 31 new
  checks in `npm run test:engine --prefix apps/backend`.
- **Open policy decision:** the Rulebook's Instant trailing limit "locks at
  breakeven", but with the published 5%/5% values the floor keeps trailing
  above breakeven. The behavior is unchanged from v0.4.1, deterministic and
  pinned by tests; a product decision is still required before it can be
  treated as matching the Rulebook.

[Engine audit](docs/audits/PROP_ENGINE_AUDIT.md) ·
[ADR 0012](docs/decisions/0012-challenge-pass-settlement-and-trading-days.md) ·
[Prop guide](docs/trading/PROP.md)

## Current version and changelog

**v0.4.3** is the current release. Since v0.4.1 the line contains:

- Prop engine audit corrections (PR #52) and the audit report.
- System-default light/dark theme until the user chooses (PR #51).
- Persian terminal RTL, phone header and wallet-menu fixes (PR #50).
- Release-driven deployment and the dual-domain runbook (PR #53, v0.4.2).
- GHCR image per release and the release-asset download fix (PR #54, v0.4.3).

[GitHub Release v0.4.3](https://github.com/algomanlife/openfund/releases/tag/v0.4.3) ·
[v0.4.2](https://github.com/algomanlife/openfund/releases/tag/v0.4.2) ·
[Changelog](CHANGELOG.md) · [Engine audit](docs/audits/PROP_ENGINE_AUDIT.md) ·
[ADR 0012](docs/decisions/0012-challenge-pass-settlement-and-trading-days.md) ·
[ADR 0013](docs/decisions/0013-release-driven-production-deployment.md)

## Operational maintenance

- **Release:** merge reviewed PRs into `main`, wait for green required
  checks, dispatch **Unified release** with `publish=true`, then approve the
  `production` deployment when it is requested.
- **Verify health and version:**
  `curl https://openfund.cloud/health` and
  `curl https://openfund.cloud/version`. Expect `"status":"matched"` and the
  release commit; repeat on `openfi.cloud`.
- **Failed deployment:** download the `deployment-status-*` artifact, check
  the Render deploy log for the `commitId`, fix forward through a new release
  or roll back. Do not move tags or re-upload assets.
- **Rollback:** dispatch **Deploy or roll back official release** with the
  previous tag and `rollback=true`.
- **Local run of an official version:**
  `npm run release:local -- --version current --migrate` with a dedicated
  local `DATABASE_URL`; check `/version`.
- **Database:** take a Render backup before deploying a release that changes
  `schema.sql`; migrations are additive only.

## Roadmap

The [seven-phase roadmap](ROADMAP.md) covers platform foundation, trading core, product experience, production infrastructure, advanced trading, Protocol and ecosystem expansion. Current priorities are addendum verification, coordinated release versioning, real-wallet/device acceptance and operational recovery; live payments and execution retain their explicit gates.

[Milestones and acceptance criteria](docs/roadmap/MILESTONES.md) distinguish implemented foundations from unfinished delivery. [Product](docs/roadmap/PRODUCT.md) · [Engineering](docs/roadmap/ENGINEERING.md) · [Protocol](docs/roadmap/PROTOCOL.md). No speculative release dates or future version allocations are promised.

## Documentation index

The [full documentation index](docs/README.md) groups maintained contracts and historical evidence.

| Start here | Reference |
| --- | --- |
| Product intent and maturity | [Overview](docs/product/OVERVIEW.md), [Feature status](docs/product/FEATURE_STATUS.md) |
| System and integration contracts | [Architecture](docs/architecture/ARCHITECTURE.md), [ADRs](docs/decisions/README.md), [Gains](docs/integrations/GAINS.md), [Vela](docs/integrations/VELA.md) |
| Governance and economy | [GOVERNANCE.md](GOVERNANCE.md), [ECONOMY.md](ECONOMY.md), [Governance documentation](docs/governance/README.md) |
| Development and operations | [Local setup](docs/development/LOCAL_DEVELOPMENT.md), [Testing](docs/development/TESTING.md), [Environment](docs/deployment/ENVIRONMENT.md), [Releases](docs/deployment/RELEASES.md) |
| Design and evidence | [Design system](docs/design/DESIGN_SYSTEM.md), [Screenshots](docs/assets/screenshots/README.md), [Reviews](docs/reviews/README.md) |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), current product/architecture contracts and acceptance gates before changing code. Branch from current main, preserve others' work, use focused Conventional Commits and submit a reviewed PR with relevant tests, screenshots and limitations.

Keep first-party documentation in English while preserving Persian application localization and RTL. Update feature status, roadmap dependencies and affected contracts together. Preserve source-critical assets, financial isolation, disabled execution defaults and upstream notices. [Changelog](CHANGELOG.md)

## Security and responsible disclosure

Report suspected vulnerabilities privately through the repository's GitHub security advisory channel, as described in [SECURITY.md](SECURITY.md); do not file public vulnerability issues. Keep secrets, private keys and user data out of Git. SIWE verifies identity; the backend enforces product/account ownership and first-party sessions.

The repository does not claim an independent security audit, regulatory approval or production readiness. Generated-signature tests do not certify real wallet devices. [Security architecture and release gates](docs/security/SECURITY.md)

## Upstream dependencies

External code is kept apart from Openfund's own work in three layers: upstream (vendored or pinned), integration (adapters, normalisation, error handling) and Openfund custom (branding, UI, indicators, trading logic). Vela, its Pine addon, the Gains API and SDK, the LuxAlgo journal core, Directus and the significant libraries are recorded with installed version, source, customisations, tests and rollback limits in the [upstream dependency registry](docs/integrations/UPSTREAM_DEPENDENCIES.md). Direct edits to upstream source are limited to a registered patch list. `npm run check:upstream` and `npm run test:upstream` verify the isolation, and upgrades follow the [Vela](docs/integrations/VELA_UPGRADE.md) and [Gains](docs/integrations/GAINS_UPGRADE.md) procedures; no upstream is upgraded automatically.

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
