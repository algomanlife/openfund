<div align="center">

<img src="docs/assets/graphics/hero.svg" alt="Openfund — A clearer way forward. Trading technology for market insight, disciplined practice and account intelligence." width="100%" />

**A connected trading ecosystem. Built with clear financial boundaries.**

[Product](docs/product/OVERVIEW.md) · [Documentation](docs/README.md) · [Architecture](docs/architecture/ARCHITECTURE.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

[![CI](https://github.com/algomanlife/openfund/actions/workflows/ci.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/ci.yml)
![Stage: active development](https://img.shields.io/badge/stage-active_development-82e7bd?labelColor=101914)
![Prop: simulated](https://img.shields.io/badge/Prop-simulated-C6FF52?labelColor=101914)
![Perpetual: read only](https://img.shields.io/badge/Perpetual-read_only-82e7bd?labelColor=101914)

</div>

## Trading technology with a coherent direction

Openfund is a FinTech and Web3 startup building an integrated environment for market discovery, trading, account intelligence and trader development. Prop Trading and Perpetual Trading share a consistent workspace while retaining distinct accounts, data sources and execution policies.

The repository contains an actively developed application: React product views, a Node.js backend, persistent simulated Prop execution, Gains Network market and wallet reads, SIWE sessions, portfolios and private trading journals. The next stages extend product workflows, operational readiness and execution capabilities through explicit acceptance gates.

**Current scope:** Prop execution uses virtual DAI. Perpetual integrates Gains read data on Arbitrum One with on-chain execution disabled. Commercial challenge activation, funded capital, payouts and Protocol routing are future capabilities. See the [capability register](docs/product/FEATURE_STATUS.md) for evidence and limits.

## Vision and mission

**Vision:** a coherent trading ecosystem in which traders can move from market insight to account review with trustworthy information and clear product boundaries.

**Mission:** give traders a connected environment to study markets, develop execution discipline and understand account performance.

Openfund addresses fragmented workflows across charts, market feeds, account portals and personal records. Its strategy centers on consistent tools, explicit financial authority and inspectable progress. [Business overview](docs/product/OVERVIEW.md) · [Vision](docs/product/VISION.md) · [Mission](docs/product/MISSION.md) · [Strategy](docs/product/STRATEGY.md)

## The Openfund ecosystem

![Openfund ecosystem showing public discovery, current Prop simulation and Perpetual reads, shared tools and planned Protocol](docs/assets/graphics/ecosystem.svg)

| Product | Purpose | Current delivery |
| --- | --- | --- |
| **Prop Trading** | Practice execution and review account risk/performance | Server-side simulation, persistent orders/positions/ledger and observed risk telemetry |
| **Perpetual Trading** | Connect market insight to wallet-native account review | Gains market data and wallet-scoped Arbitrum One records; read-only |
| **Shared Terminal** | One consistent charting and trading interface | Vela workspace with separate product adapters and account contexts |
| **Wallet, Portfolio and Journal** | Identity, financial review and private decision records | SIWE sessions, product-specific data, analytics, notes and exports |
| **Openfund Protocol** | Future aggregation and execution-path selection | Planned for the final release; no operational routing |

[Explore the ecosystem](docs/product/ECOSYSTEM.md) · [Capability guide](docs/product/CAPABILITIES.md)

### Prop Trading

The current Prop account is a persistent practice environment with **100,000 virtual DAI**, funded once per authenticated user. A server-authoritative engine handles market/limit/stop orders, SL/TP, cancellation, partial closes and liquidation monitoring on real market marks.

Decimal valuation, fee-aware margin checks, owned idempotency and PostgreSQL transactions protect the simulated ledger. The Portfolio shows positions, history and net performance; the Journal records decisions in the same product context. Challenge catalog and account records exist; paid activation and evaluation enforcement remain planned.

[Prop product and calculations](docs/trading/PROP.md) · [Trading lifecycle](docs/architecture/FLOWS.md#trading-lifecycle)

### Perpetual Trading

Perpetual uses Gains Network market data and official wallet-scoped positions, pending orders, history and statistics on **Arbitrum One**. Product views retain native collateral units and source provenance. Missing balances or fee-adjusted PnL remain unknown; upstream failures stay visible.

Wallet authentication supports private product views. Transaction execution, approvals and collateral transfers are disabled pending separate integration and security gates.

[Perpetual product](docs/trading/PERPETUAL.md) · [Gains integration](docs/integrations/GAINS.md)

### Openfund Protocol

> Openfund Protocol is designed to aggregate liquidity across Gains Network, Hyperliquid, and dYdX, enabling intelligent trade routing and improved execution-path selection. (Available in the final release.)

**Planned:** this describes the intended final-release product. Aggregation and routing are not operational capabilities. Protocol source integration is reserved for Task 2; this transformation imports no MUX Protocol source.

[Protocol roadmap](docs/roadmap/PROTOCOL.md)

### Shared Trading Terminal

One Vela-based workspace serves both products: charting, market selection, theme/language controls and a consistent trading interface. React owns wallet/session/product context; established chart and market adapters remain integrated through the shared terminal bridge.

Prop receives authoritative state through the backend and SSE. Perpetual uses a separate read adapter. Sharing presentation never merges financial balances or execution rules. The catalog starts with Open Algo V5, Price Action Concepts and Smart Money Concepts, calculated from original Pine sources with repository-local libraries in a shared worker. Required linked Vela attribution remains in terminal status; upstream notices remain intact. [Indicator usage and limits](docs/trading/INDICATORS.md) · [Pine architecture](docs/trading/PINE_SCRIPT.md).

[Terminal guide](docs/trading/TERMINAL.md) · [Product architecture](docs/architecture/PRODUCT_TERMINALS.md)

### Wallet, Portfolio and Journal

Wallet connection and **Sign-In with Ethereum** are distinct steps. SIWE verifies identity; first-party HttpOnly sessions authorize private account views. Prop uses Ethereum Sepolia for its sign-in context and Perpetual uses Arbitrum One. Neither sign-in path submits a blockchain transaction.

Portfolios provide product-specific records and supported analytics. Private journals add notes, tags, search, classifications, calendar/statistics and version-aware metadata export/restore. Imports cannot create trades or financial balances.

[Identity and security model](docs/wallet/IDENTITY.md) · [Portfolio and Journal](docs/trading/PORTFOLIO_JOURNAL.md)

## Product gallery

Genuine captures from the current source build at baseline `2f5cf93`. Market information comes from live Gains reads; CMS content comes from the existing local Directus instance. Public pages, anonymous terminals and disposable authenticated account states are labelled in the [capture manifest and limitations](docs/assets/screenshots/README.md). No personal wallet information or invented trading records is shown.

| Home | Market discovery |
| --- | --- |
| ![English Openfund Home product gateway](docs/assets/screenshots/home.jpg) | ![English Markets page with live Gains market information](docs/assets/screenshots/markets.jpg) |
| **Prop Terminal — anonymous, execution unavailable** | **Perpetual Terminal — read-only** |
| ![Current shared Prop terminal without an authenticated account](docs/assets/screenshots/prop-terminal.jpg) | ![Current shared Perpetual terminal with live chart data](docs/assets/screenshots/perpetual-terminal.jpg) |
| **Challenges — catalog, purchase not operational** | **Portfolio — new virtual account** |
| ![English challenge catalog and published product content](docs/assets/screenshots/challenges.jpg) | ![Actual new Prop virtual account with no trading history](docs/assets/screenshots/prop-portfolio.jpg) |
| **Journal — empty private notebook** | **Dashboard — new-account analytics** |
| ![Actual private Journal with no seeded notes](docs/assets/screenshots/journal.jpg) | ![Actual fresh-account dashboard without fabricated performance history](docs/assets/screenshots/analytics.jpg) |
| **Account / Profile — disposable documentation wallet** | **Wallet connection — anonymous** |
| ![Actual local profile for a generated documentation identity](docs/assets/screenshots/account-profile.jpg) | ![Actual unconnected wallet modal](docs/assets/screenshots/wallet-connection.jpg) |

[Full gallery, Perpetual Portfolio and capture limitations](docs/assets/screenshots/README.md)

## Architecture

```mermaid
flowchart LR
  React[React at /react/] -->|same-origin API| API[Node.js API]
  React -->|published content| CMS[Directus 11.9.1]
  React -->|Vela chart and market feeds| Gains[Gains Network data]
  API --> Auth[SIWE and product ownership]
  API --> Engine[Prop simulation and SSE]
  API --> Read[Perpetual wallet reads]
  Read --> Gains
  Engine --> DB[(PostgreSQL 17)]
  Auth --> DB
  API -->|portfolio and private journal| DB
  CMS --> DB
```

Financial state is product-specific. Directus is editorial/catalog administration; the backend enforces account ownership and financial mutations. The API process also hosts the simulation monitor and SSE, so it remains single-instance until coordination is designed.

[System architecture](docs/architecture/ARCHITECTURE.md) · [Authentication, trading, market-data and deployment flows](docs/architecture/FLOWS.md) · [Architecture decisions](docs/decisions/README.md)

## Technology

| Layer | Foundation |
| --- | --- |
| Interface | React 19, TypeScript, Vite, React Router; English/Persian UI with RTL support |
| Wallet and identity | RainbowKit, wagmi, viem, SIWE and first-party sessions |
| Charts and market data | Vela workspace, Gains REST/WebSocket adapters |
| Application | Node.js 22, Express, Decimal arithmetic, SSE |
| Persistence and content | PostgreSQL 17, Directus 11.9.1 |
| Delivery | Render Blueprint, GitHub Actions, per-app npm lockfiles, browser/integration checks |

[Detailed technology registry](docs/architecture/TECH_STACK.md) · [Technology graphic](docs/assets/graphics/technology.svg) · [Upstream provenance](docs/integrations/UPSTREAM.md)

## Development status

The current foundation includes working product navigation, market/chart integrations, backend identity, persistent Prop simulation, isolated Portfolio/Journal views, CMS content and CI/Render configuration.

Remaining gates include real wallet/device acceptance, deployed Render/HTTPS/recovery verification, commercial challenge activation/evaluation, advanced execution and production reporting. Transparency metrics are labelled sample data. A configured service, visible placeholder or vendored SDK is not proof of an operational capability.

[Feature Status](docs/product/FEATURE_STATUS.md) is the maintained source of truth. [Delivery evidence](docs/reviews/repository-transformation/DELIVERY.md) records checks actually run for this branch.

## Roadmap

![Seven-phase roadmap, with current foundations and remaining acceptance gates](docs/assets/graphics/roadmap.svg)

1. **Platform Foundation:** repository, frontend/backend, charting and market data.
2. **Trading Core:** Prop simulation, calculations, risk controls and persistent state.
3. **Product Experience:** wallet, Portfolio, Journal, challenges, markets and multilingual UI.
4. **Production Infrastructure:** Render, PostgreSQL, Directus, CI/CD, security and observability.
5. **Advanced Trading:** extended order workflows, analytics and execution improvements.
6. **Openfund Protocol:** venue adapters, liquidity aggregation and intelligent routing.
7. **Ecosystem Expansion:** integrations, developer services and coordinated scalability.

[Roadmap](ROADMAP.md) · [Milestones, dependencies and acceptance criteria](docs/roadmap/MILESTONES.md)

## Local development

Prerequisites: Node.js 22, npm and PostgreSQL 17. Use a dedicated local database and your own connection credentials. Python 3 is used by optional Directus utilities.

```bash
npm ci
npm ci --include=dev --prefix apps/web-react
npm ci --prefix apps/backend
createdb openfund_dev
export DATABASE_URL=postgresql://localhost:5432/openfund_dev
npm run migrate --prefix apps/backend
npm run seed-plans --prefix apps/backend
npm run dev:backend
```

In a second terminal run `npm run dev:web`, then open [English Home](http://localhost:5173/react/#/en/home). Optional `VITE_BACKEND_URL`, `VITE_DIRECTUS_URL` and WalletConnect configuration are documented in [Local Development](docs/development/LOCAL_DEVELOPMENT.md) and [Environment](docs/deployment/ENVIRONMENT.md).

Build with `npm run build:web`; the backend serves the result at `/react/`. Keep source-critical `dist/` compatibility assets. Review generated `react/` changes before committing.

## Testing and CI

```bash
npm run docs:check
npm run typecheck
npm run test:web
npm run test:charts
npm run build:web
npm run validate:blueprint
```

Backend and browser integration suites require an **isolated test database and running test backend**. Follow [Testing](docs/development/TESTING.md) before `npm run test:backend` or `npm run test:browser:audit`. Price injection is local-test-only and must remain disabled in production.

GitHub Actions covers documentation, frontend checks/build, PostgreSQL-backed backend/browser tests, Blueprint structure, secret scanning and dependency reports. Local outcomes and any unexecuted external checks are recorded in the delivery report.

## Render deployment

The root [Blueprint](render.yaml) preserves three resources:

- **`openfund`** — Node API, simulation monitor and SSE, serving React same-origin at `/react/`.
- **`openfund-db`** — managed PostgreSQL 17 for application and CMS tables.
- **`openfund-cms`** — Directus 11.9.1 with persistent uploads.

There is no separate frontend service or worker. Review/apply and deployed acceptance are separate from a local build or schema check. [Render runbook](docs/deployment/RENDER.md) · [Database](docs/deployment/DATABASE.md) · [Rollback](docs/deployment/ROLLBACK.md)

## Security

Keep secrets server-side, preserve product/account ownership and require explicit wallet approval for any future transaction. On-chain execution remains disabled. Generated-signature tests do not certify real extensions, hardware wallets or remote sessions. The repository does not claim an independent security audit or regulatory approval.

[Security reporting](SECURITY.md) · [Security architecture and release gates](docs/security/SECURITY.md)

## Documentation and contributing

[Documentation index](docs/README.md) organizes product/business, architecture, trading, identity, integrations, deployment, development, security, roadmap and decisions. Repository prose is English; application localization and RTL support are preserved.

Read the latest contracts before coding. Keep feature status, roadmap gates and screenshots aligned with implementation. Open focused pull requests from the latest `main`, preserve working code/Render architecture and retain upstream licensing. [Contributing](CONTRIBUTING.md) · [Agent instructions](AGENTS.md) · [Changelog](CHANGELOG.md)

---

<div align="center"><sub>OPENFUND · A CLEARER WAY FORWARD</sub></div>
