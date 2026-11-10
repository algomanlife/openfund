<div align="center">

<img src="docs/assets/brand/mark-mint.svg" alt="Official Openfund mark" width="64" />

# Openfund

**OPENFUND — A CLEARER WAY FORWARD**

Trading software for market discovery, simulated Prop trading and wallet-scoped Perpetual account review.

[Documentation](docs/README.md) · [Feature status](docs/product/FEATURE_STATUS.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

[![CI](https://github.com/algomanlife/openfund/actions/workflows/ci.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/ci.yml)

</div>

## Status at a glance

> This README is not live status. The authority order is: GitHub Release/tag, then
> commit SHA, then the running service's `/version`, then the frontend manifest, then
> pull requests, then this file and the changelog
> ([version authority](docs/deployment/RELEASES.md#version-authority-hierarchy)).

**Read-only production snapshot (2026-11-10):**

| Source | Result |
| --- | --- |
| `https://openfund.cloud/version` | `status: matched`, version **0.4.4**, commit `0c45594`, manifest `official: false` (a gated current-`main` build) |
| GitHub Release `v0.4.4` (latest official) | Tag points to `c1cb707` |
| `https://openfund.cloud/purchases/plans` | `paymentsEnabled: false`: challenge purchases are not active in production |
| Render service `openfund` | Commit auto-deploy off. `PURCHASE_PAYMENT_CHAIN=11155111`, no payment receiver, token, RPC or DePay keys configured |

Check live status with `curl https://openfund.cloud/version` and `gh release list`.
A merged pull request is **not** deployed until `/version` says so.

| State | What it covers |
| --- | --- |
| **Live** | Prop and Perpetual terminals, wallet sign-in, bilingual website, Prop engine |
| **Implemented in source, disabled in production** | Challenge purchases with DePay and coupons (owner configuration required), admin APIs (`ADMIN_API_TOKEN` unset) |
| **Implemented, not production-active** | Economy, Ambassador (IB), Governance (off-chain), Live Market Access control plane |
| **Planned** | Desktop and mobile apps, rewards, operational Protocol routing |

## Project overview

Openfund is an early-stage trading-technology project maintained in a public
repository: a bilingual website, a shared trading terminal, wallet identity,
portfolios and private journals. Prop and Perpetual share presentation, not
financial balances or execution authority. Source availability is not a claim
of production readiness, audited security or an active funded-trading service.

| Area | Implemented scope | Boundaries |
| --- | --- | --- |
| **Prop** | Server-side simulation; market, limit and stop orders; SL/TP, partial close, liquidation; challenge evaluation; journals | Free Trial accounts get 100,000 virtual USD. Purchases, funded capital and payouts are not active |
| **Perpetual** | Gains Network market data; wallet-scoped Arbitrum One positions, orders, history | Read-only. Transactions, approvals and collateral transfers are disabled |

## Product architecture

One origin serves the React application and the API. The API owns
authentication, accounts, simulation, purchases and economy records in
PostgreSQL. Directus owns editorial content and the plan catalog. Gains
Network supplies market data. See [System architecture](docs/architecture/ARCHITECTURE.md),
[Flows](docs/architecture/FLOWS.md) and [Product contracts](docs/architecture/PRODUCT_TERMINALS.md).

## Core features

The [feature register](docs/product/FEATURE_STATUS.md) is canonical.

| Capability | Where it stands |
| --- | --- |
| Wallet authentication | Live. Arbitrum-only sign-in is implemented, not deployed ([Wallet integration](#wallet-integration)) |
| Charting (Vela, Pine indicators) | Live. Vela workspace with the Openfund bridge and Pine runtime ([Vela](docs/integrations/VELA.md)) |
| Gains Network | Live, read-only. No order-book depth is inferred from oracle prices; execution is disabled ([Gains](docs/integrations/GAINS.md)) |
| Prop engine and evaluation | Live. Server-authoritative simulation and challenge evaluation ([Engine audit](docs/audits/PROP_ENGINE_AUDIT.md)) |
| Challenge purchases, DePay, coupons | Implemented, **disabled in production** ([Payment architecture](#payment-architecture)) |
| Funded accounts and payouts | Not active. A withdrawal approval records a decision, never a fund transfer |
| Economy, Ambassador (IB), Live Market Access | Implemented, not production-active ([Economy](#economy)) |
| Governance | Implemented off-chain, not in production use ([Governance](#governance)) |
| Portfolio and Trade Journal | Live. Uses the vendored LuxAlgo `journal-core` only |
| Localization | Persian and English with RTL live; Arabic, Russian, Simplified Chinese on `main` |

### Screenshots

<a id="product-gallery"></a>

Genuine captures from the canonical runtime. Their provenance is in the
[gallery](docs/assets/screenshots/README.md) and the
[manifest](docs/assets/screenshots/manifest.json). They predate the Economy
and checkout changes on this branch.

| Persian Home — dark | English Prop Terminal — dark |
| --- | --- |
| ![Actual Persian Home dark](docs/assets/screenshots/p0-dark-fa-public-dark.png) | ![Actual Prop terminal dark](docs/assets/screenshots/p0-dark-en-terminal-dark.png) |

## Technology stack

| Layer | Technology |
| --- | --- |
| Web interface | React 19, TypeScript, Vite 6, React Router 7; Persian/English and RTL |
| Wallet and identity | RainbowKit, wagmi, viem, SIWE and HttpOnly sessions |
| Charting and market data | Vela 0.9.3, Vela Pine addon 0.3.2, PineTS 0.13.1, Gains adapters |
| API and simulation | Node.js 22, Express, Decimal arithmetic, WebSocket feeds and SSE |
| Persistence and content | PostgreSQL 17; Directus 11.9.1 |
| Quality and delivery | Per-app npm lockfiles, Playwright, GitHub Actions, Render Blueprint |

[Technology registry](docs/architecture/TECH_STACK.md) · [Upstream provenance](docs/integrations/UPSTREAM.md)

## Repository structure

| Path | Responsibility |
| --- | --- |
| `apps/web-react/` | React app, product routes, wallet/session context, checkout |
| `apps/backend/` | API, engine, purchases, coupons, economy, governance, additive migrations |
| `apps/backstage/scripts/` | Directus schema, content seeding and administration |
| `packages/` | Chart/Gains/CMS contracts; dormant Protocol source |
| `vendor/`, `third_party/` | Upstream source, licenses and notices ([registry](docs/integrations/UPSTREAM_REGISTRY.md)) |
| `dist/` | Source-critical classic compatibility deliverable; not disposable output |
| `react/` | **Generated** by `npm run build:web`; not tracked |
| `scripts/`, `infra/render/`, `e2e/` | Release/docs/CI tooling, Blueprint validation, browser checks |
| `docs/`, `brand/` | Contracts, evidence, approved brand assets |

The root package orchestrates commands; applications install from their own lockfiles.

## System components

| Component | Implementation |
| --- | --- |
| Web service `openfund` | `apps/backend/server.js` serving the API and the built `react/` SPA |
| Trading engine | `engine.js`, `trading-math.js`, `instruments.js`; in-process loop (about 1 s), SSE at `/trading/stream` |
| Challenge evaluation | `evaluation.js`: pure `evaluateRules()` over a frozen rules snapshot |
| Purchases and payments | `purchases.js`, `payment-verification.js`, `coupons.js`, `payments-admin.js` |
| Economy and partners | `economy.js`, `partners.js`, `treasury.js`, `live-funding.js` |
| Governance | `governance.js`, `governance-routes.js`, `governance-rules.js` |
| Database `openfund-db` | PostgreSQL 17 |
| CMS `openfund-cms` | Directus 11.9.1 |

## Development environment

Prerequisites: Node.js 22, npm, PostgreSQL 17 (Python 3 only for optional
Directus utilities). Check port ownership first, and keep 8080 for an official
local runtime. See [Local development](docs/development/LOCAL_DEVELOPMENT.md).

## Installation

```bash
npm ci
npm ci --include=dev --prefix apps/web-react
npm ci --prefix apps/backend
createdb openfund_dev
export DATABASE_URL=postgresql://localhost:5432/openfund_dev
npm run migrate --prefix apps/backend
npm run seed-plans --prefix apps/backend
PORT=8180 npm run dev:backend
```

In a second terminal run `VITE_BACKEND_URL=http://localhost:8180 npm run dev:web`.
For a same-origin build run `npm run build:web` first (the API reads
`react/index.html` at start-up), then `PORT=8180 npm start --prefix apps/backend`.
Run an official version with `npm run release:local -- --version current --migrate`.

## Environment variables

[.env.example](.env.example) is a reference, not a credential file. The
complete list, with owner service and secret classification, is
[docs/deployment/ENVIRONMENT.md](docs/deployment/ENVIRONMENT.md). CI checks
that every `render.yaml` variable is documented there. Every `VITE_*` value is
public. Never use one for a secret. Secrets are `sync: false` in the Blueprint
and never committed.

## Database setup

PostgreSQL 17. Use an isolated database per environment. Test databases must
contain `test`, `audit` or `ci` in the name (the test seams refuse anything
else). See [Database](docs/deployment/DATABASE.md).

## Database migrations

`apps/backend/schema.sql` is applied by `migrate.js` on every start. It is
additive and idempotent, and CI runs it twice. Never hand-alter a live
database. The 2026-11 additions (coupons, `lifecycle_state`,
`purchase_order_events`, `depay_events`) are additive, backfill existing rows
and keep the legacy `status` column.

## Backend services

The Express API (`apps/backend/`) provides SIWE sessions, product-scoped
accounts, the trading engine, purchases, invoices, the economy, partner and
governance routes, and the token-gated `/admin/*` API (disabled without
`ADMIN_API_TOKEN`). [Backend README](apps/backend/README.md)

## Frontend applications

`apps/web-react/` is a React 19 + Vite SPA built into the untracked `react/`
directory and served same-origin. Public runtime settings come from the
no-store `runtime-config.js` ([ADR 0010](docs/decisions/0010-runtime-public-configuration.md)).
`dist/` is the classic compatibility deliverable.

## Directus CMS

Directus (`openfund-cms`) holds editorial content and the plan catalog.
Market data and payments never flow through it. Collections are defined in
`apps/backstage/scripts/apply_schema.py`. [Backstage docs](docs/backstage/README.md)

## Wallet integration

Wallet connection (RainbowKit/wagmi, EIP-6963, optional WalletConnect) and
authenticated login (SIWE) are distinct states. A signature over a fresh,
single-use, address-bound nonce creates a server session (HttpOnly cookie,
hashed at rest). One wallet address is exactly one user (unique constraint).
A wallet change logs the session out, and sessions never follow another
wallet. [Identity](docs/wallet/IDENTITY.md) · [Authentication reference](docs/architecture/WALLET_AUTHENTICATION.md)

## Arbitrum configuration

Arbitrum One (chain `42161`) is the only network for wallet connection, SIWE
and checkout. It is implemented on branch `codex/production-readiness`, which
is not deployed. Other chain ids are rejected server-side (`invalid_chain`), and
wallets are asked to switch. `PURCHASE_PAYMENT_CHAIN` must be `42161`, or
purchases stay disabled. `AUTH_RPC_URL` optionally points contract-wallet
signature checks at a dedicated Arbitrum RPC. The Gains market-data
integration is unchanged. [ADR 0022](docs/decisions/0022-arbitrum-checkout-coupons-order-lifecycle.md)

## Payment architecture

Server-priced orders, one approved USD stablecoin on Arbitrum One, and an
on-chain verifier as the only authority. The verifier checks receipt status,
sender (the signed-in wallet), receiver, token, amount, block time and
finality. Each transaction is usable once. Provisioning is atomic and
recoverable. [Verification](docs/payments/VERIFICATION.md) · [Activation checklist](docs/payments/ACTIVATION.md)

## DePay integration

The official DePay button with `blockchains='["arbitrum"]'` carries only the
order id. DePay fetches a server-signed dynamic configuration. Configuration
requests, callbacks and events are all verified by DePay `x-signature` and
remain hints. Endpoints: `/purchases/depay/configuration`,
`/purchases/depay/callback`, `/purchases/depay/events`. The integration ID,
keys, token, receiver and RPC are **not configured** in production.
[DePay reference and dashboard report](docs/payments/DEPAY.md)

## Challenge purchase lifecycle

Explicit, database-enforced states: `awaiting_payment → payment_detected →
paid → provisioned`, plus `manual_review`, `cancelled`, `expired`,
`partially_refunded` and `refunded`. Every transition is recorded
append-only. [Order lifecycle](docs/payments/ORDER_LIFECYCLE.md)

## Coupon management

Percentage, fixed, 100% (zero-payment flow), product-, usage-, user- and
time-restricted coupons. Coupons are validated server-side under a row lock
and administered through `/admin/coupons` with a full audit trail.
Internal test coupons are limited to two named wallets. No coupon is active in
production. [Coupons](docs/payments/COUPONS.md)

## Economy

The Economy menu groups **Governance**, **Ambassador (IB)**, Transparency,
Revenue Model and Live Market Access. Figures come only from operational
records and show "Not configured" or "Unknown" otherwise.
[Economy documentation](docs/economy/README.md) · [ECONOMY.md](ECONOMY.md)

## Ambassador (IB)

One page, `/{locale}/ambassador`, covers two **independent** roles. Each has
its own application, approval, permissions and commission calculation.
`/{locale}/coach` opens the coach section.

- **Brand Ambassador** (approved policy): at least 50,000 followers on
  Instagram or YouTube plus an active second platform; independent approval;
  10% of the referred customer's first eligible confirmed purchase only;
  recognized at confirmed payment; never repeated for the same customer.
- **Verified Trading Coach** (approved policy): independent verification; 10%
  of distributable realized net profit from eligible live trades after trading
  and execution costs; never on unrealized or simulated PnL.
- Trader and firm profit-sharing tiers are **pending business decisions**.

[Partner programs](docs/economy/PARTNER_PROGRAMS.md)

## Governance

Off-chain Hybrid Governance v1.0: a Community Council with delegated
non-financial authority, OFP proposals and voting. Company management keeps
treasury and financial decisions. No token-based or on-chain governance is
implemented. [GOVERNANCE.md](GOVERNANCE.md) · [Operating governance](docs/governance/OPERATING_GOVERNANCE.md)

## Business model summary

Revenue comes from challenge evaluation fees (implemented, disabled in
production). Costs include ambassador commissions, coach shares of real
profit (not active), refunds and infrastructure. No revenue figures are
published. [Business model](docs/economy/BUSINESS_MODEL.md)

## Testing and validation

```bash
npm run docs:check          # language, links, Markdown, Mermaid, required docs, dependency checks
npm run typecheck
npm run test:web
npm run validate:blueprint
npm run build:web
npm run test:backend        # needs an isolated test database and a running test backend
```

Backend and browser suites need an isolated test database and a test backend
on a free port; see [Testing](docs/development/TESTING.md).
`apps/backend/test/commerce.test.mjs` covers coupons, zero payment, races,
order transitions and DePay security. Its simulated chain verifier is not
evidence of a real payment.

## GitHub workflow

Issues use the templates in `.github/ISSUE_TEMPLATE/`. Vulnerabilities are
reported privately ([SECURITY.md](SECURITY.md)). Dependabot proposes updates.
A weekly read-only workflow watches upstreams ([automation](docs/integrations/UPSTREAM_AUTOMATION.md)).

## Branch and pull request conventions

Branch from current `main` (`codex/<topic>`, `qwen/<topic>`, `docs/<topic>`),
use Conventional Commits and fill in every section of the pull request template
(checked by CI). Never force-push or push directly to `main`.
[Pull requests](docs/development/PULL_REQUESTS.md) · [AGENTS.md](AGENTS.md)

## CI/CD pipeline

`ci.yml` runs the required checks: `Web (React + Vite)`, `Backend (API +
engine)`, `Render Blueprint`, `Secret scan`, `Release package gates` and
`Release secret scan`. `release.yml` and `deploy-release.yml` publish and
deploy. Branch protection on `main` requires these checks and blocks force
pushes. Required pull request reviews are **not** currently enforced by
branch protection. [CI](docs/development/CI.md)

## Versioning

Tags are `vMAJOR.MINOR.PATCH`, allocated from Conventional Commits by
`scripts/release/plan.mjs`. The `version` fields in `package.json` are
component provenance, not the application version. The release manifest and
`/version` carry the application version and exact commit.

## Release process

A maintainer dispatches **Unified release** on `main` with `publish=true`.
After the gates, the workflow creates a tag and GitHub Release. No release is
created by pull requests. [Releases](docs/deployment/RELEASES.md) · [Checklists](docs/deployment/CHECKLISTS.md)

## Render infrastructure

The Blueprint (`render.yaml`) defines `openfund` (web, API + SPA),
`openfund-cms` (Directus) and `openfund-db` (PostgreSQL) in Frankfurt. Commit
auto-deploy is off. `npm run validate:blueprint` gates every PR.
[Render runbook](docs/deployment/RENDER.md) · production domains
`openfund.cloud`, `openfi.cloud`.

## Production deployment

After the `production` environment approval, Render deploys the exact
released commit, and the workflow checks `/version` on both domains. Follow
the [deployment checklist](docs/deployment/CHECKLISTS.md#deployment-checklist-production).
A merge never deploys.

## Rollback procedures

Redeploy the previous official release. Migrations are additive, so older code
keeps working on the newer schema. [Rollback](docs/deployment/ROLLBACK.md)

## Backup and recovery

Render PostgreSQL backups and manual dumps: [Database](docs/deployment/DATABASE.md).
Directus content: [Backup and restore](docs/backstage/BACKUP_RESTORE.md).
Confirm a restorable backup before any risky schema change.

## Security

SIWE with single-use nonces; HttpOnly hashed sessions; strict CSP; origin
checks; rate limits; server-side ownership checks; signature-verified DePay
deliveries; idempotent, append-only financial records; gitleaks in CI. No
independent security audit is claimed. Report vulnerabilities privately:
[SECURITY.md](SECURITY.md) · [Security architecture](docs/security/SECURITY.md)

## Operational monitoring

`/health`, `/version`, Render logs and the payment review queue. No automated
alerting is configured yet. [Operations](docs/operations/README.md)

## License

**No root `LICENSE` is present, and no first-party license has been selected
(owner decision pending).** Do not read this public repository as an
open-source license grant. Third-party components keep their own licenses:
Vela (Apache-2.0 + NOTICE with a visible attribution requirement), the Vela
Pine addon and PineTS (AGPL-3.0-only, shipped in the web bundle), LuxAlgo
journal-core and the Gains SDK (MIT), the dormant Protocol (GPL-2.0), and
fonts and marks with per-asset notices. [Licensing report](docs/legal/LICENSING.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

## Contribution guidelines

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [documentation index](docs/README.md).
Keep documentation in English, preserve Persian localization and RTL, update
Feature Status, the changelog and the affected docs in the same pull request,
and never commit secrets or personal data.

[Canonical repository](https://github.com/algomanlife/openfund) · [Issues](https://github.com/algomanlife/openfund/issues) · [Releases](https://github.com/algomanlife/openfund/releases) · [Changelog](CHANGELOG.md)
