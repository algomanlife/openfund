# Engineering reference

Technical companion to the [README](../../README.md). The README introduces the
business, product and architecture; this page keeps the engineering details
for contributors and infrastructure reviewers. Paths in commands are relative
to the repository root.

## Repository structure

| Path | Responsibility |
| --- | --- |
| `apps/web-react/` | React app, product routes, wallet/session context, checkout |
| `apps/backend/` | API, engine, purchases, coupons, economy, governance, additive migrations |
| `apps/backstage/scripts/` | Directus schema, content seeding and administration |
| `packages/` | Chart/Gains/CMS contracts; dormant Protocol source |
| `vendor/`, `third_party/` | Upstream source, licenses and notices ([registry](../integrations/UPSTREAM_REGISTRY.md)) |
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

Prerequisites: Node.js 26, npm, PostgreSQL 17 (Python 3 only for optional
Directus utilities). Check port ownership first, and keep 8080 for an official
local runtime. See [Local development](../development/LOCAL_DEVELOPMENT.md).

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

[.env.example](../../.env.example) is a reference, not a credential file. The
complete list, with owner service and secret classification, is
[docs/deployment/ENVIRONMENT.md](../deployment/ENVIRONMENT.md). CI checks
that every `render.yaml` variable is documented there. Every `VITE_*` value is
public. Never use one for a secret. Secrets are `sync: false` in the Blueprint
and never committed.

## Database setup

PostgreSQL 17. Use an isolated database per environment. Test databases must
contain `test`, `audit` or `ci` in the name (the test seams refuse anything
else). See [Database](../deployment/DATABASE.md).

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
`ADMIN_API_TOKEN`). [Backend README](../../apps/backend/README.md)

## Frontend applications

`apps/web-react/` is a React 19 + Vite SPA built into the untracked `react/`
directory and served same-origin. Public runtime settings come from the
no-store `runtime-config.js` ([ADR 0010](../decisions/0010-runtime-public-configuration.md)).
`dist/` is the classic compatibility deliverable.

### Frontend source of truth (audited 2026-11-12, `main` `38e17f4`)

There is **one served frontend**: the React SPA. It embeds a classic runtime
layer for the landing page and the terminal, so some behavior lives outside
`src/`. Edit the left column; never edit a copy.

| Path | Role | Served? | Edit here? |
| --- | --- | --- | --- |
| `apps/web-react/src/` | Canonical React source: routes (browser history at `/`), shells, wallet/SIWE, checkout, i18n | Built into `react/` | **Yes** |
| `apps/web-react/public/legacy/` (21 files) | Classic runtime loaded by React pages (`Landing.tsx`, `TradingPages.tsx`, `InformationShell.tsx`, `Portfolio.tsx`, `MarketIcon.tsx`): landing scripts, terminal runtime/CSS, locale | Copied into `react/legacy/` | **Yes**, except `vela-bridge.js` and `gains-adapter.js` |
| `packages/openfund-charts/src/vela-bridge.js`, `packages/openfund-gains-adapter/src/gains-adapter.js` | Sources of the two bridge scripts | `npm run build:charts` copies them into `public/legacy/` **and** `dist/` | **Yes** (then run `build:charts`) |
| `apps/web-react/public/assets/` | Fonts, logos, notices, Vela bundle and Pine worker (the last two generated by `build:charts`) | Copied into `react/assets/` | Yes (generated files: rebuild instead) |
| `react/` | Vite output (`emptyOutDir`), the only directory `apps/backend/server.js` serves; `/react/…` is a compatibility mount and 308 redirect | **Yes** | No: generated, untracked, guarded by `scripts/release/test/untracked-build.test.mjs` |
| `dist/` | Frozen classic static site (`index.html`, `terminal.html`, 18 JS/CSS/JSON files) and asset mirror; **not served** by the backend | No | Only the mirrors that `build:charts` and `apps/web-react/test/community.test.mjs` keep in sync; its JS/CSS are 2–17 commits behind `public/legacy/` |
| `src/wallet.jsx` | Source of the old demo bundle `dist/wallet.js` (mock wallets) | No | No (historical) |
| `apps/web/`, `apps/terminal/` | README-only ownership pointers; no code, no build | No | No |
| `vendor/vela/`, `third_party/` | Upstream sources with licenses and patches | Via `build:charts` | Only through the [upstream process](../integrations/UPSTREAM_REGISTRY.md) |

Whether `dist/` stays a tracked deliverable is an open owner decision
(`AGENTS.md` currently requires it); see
[Repository hygiene](REPOSITORY_HYGIENE.md#candidates-needing-an-owner-decision).

## Directus CMS

Directus (`openfund-cms`) holds editorial content and the plan catalog.
Market data and payments never flow through it. Collections are defined in
`apps/backstage/scripts/apply_schema.py`. [Backstage docs](../backstage/README.md)

## Wallet integration

Wallet connection (RainbowKit/wagmi, EIP-6963, optional WalletConnect) and
authenticated login (SIWE) are distinct states. A signature over a fresh,
single-use, address-bound nonce creates a server session (HttpOnly cookie,
hashed at rest). One wallet address is exactly one user (unique constraint).
A wallet change logs the session out, and sessions never follow another
wallet. [Identity](../wallet/IDENTITY.md) · [Authentication reference](../architecture/WALLET_AUTHENTICATION.md)

## Arbitrum configuration

Arbitrum One (chain `42161`) is the only network for wallet connection and
SIWE sign-in. Other chain ids are rejected server-side (`invalid_chain`), and
wallets are asked to switch. `AUTH_RPC_URL` optionally points contract-wallet
signature checks at a dedicated Arbitrum RPC. Arbitrum is **not** a payment
restriction: payments use the settlement chains in `PURCHASE_PAYMENT_CHAINS`
(see [DePay](../payments/DEPAY.md)). The Gains market-data integration reads
Arbitrum One. [ADR 0022](../decisions/0022-arbitrum-checkout-coupons-order-lifecycle.md)

## Payment architecture

Server-priced orders and chain-aware verification as the only authority. Each
configured settlement chain has its own token, receiver, finality depth and
RPC endpoint. EVM payments are verified from the receipt and the settlement
token's `Transfer` log; Solana payments from a finalized signature and the
receiver's SPL balance change. The verifier checks status, receiver,
settlement token, amount, block time and finality. Each transaction is usable
once per chain. Provisioning is atomic and recoverable.
[Verification](../payments/VERIFICATION.md) · [Activation checklist](../payments/ACTIVATION.md)

## DePay integration

The official DePay button lists the server-configured chains and carries only
the order id. DePay fetches a server-signed dynamic configuration with one
`accept` entry per chain, and its token conversion lets payers use other
tokens. Configuration requests, callbacks and events are verified by DePay
`x-signature` and remain hints; orders are correlated only by the signed order
id. Endpoints: `/purchases/depay/configuration`, `/purchases/depay/callback`,
`/purchases/depay/events`. The integration, keys, chains and receivers are
**not configured** in production yet.
[DePay reference and dashboard checklist](../payments/DEPAY.md)

## Challenge purchase lifecycle

Explicit, database-enforced states: `awaiting_payment → payment_detected →
paid → provisioned`, plus `manual_review`, `cancelled`, `expired`,
`partially_refunded` and `refunded`. Every transition is recorded
append-only. [Order lifecycle](../payments/ORDER_LIFECYCLE.md)

## Coupon management

Administrators create and manage coupons in the Directus Data Studio
(Commerce group, Commerce Admin role): percentage, fixed and 100% discounts,
product, challenge-model, account-size, customer, usage and time restrictions,
internal test coupons limited to two test accounts, redemption history,
related orders and an append-only audit trail. The backend validates and
redeems coupons under a row lock; database triggers keep Directus edits within
the business rules. [Coupons](../payments/COUPONS.md)

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
on a free port; see [Testing](../development/TESTING.md).
`apps/backend/test/commerce.test.mjs` covers coupons, zero payment, races,
order transitions and DePay security. Its simulated chain verifier is not
evidence of a real payment.

## GitHub workflow

Issues use the templates in `.github/ISSUE_TEMPLATE/`. Vulnerabilities are
reported privately ([SECURITY.md](../../SECURITY.md)). Dependabot proposes updates.
A weekly read-only workflow watches upstreams ([automation](../integrations/UPSTREAM_AUTOMATION.md)).

## Branch and pull request conventions

Branch from current `main` (`codex/<topic>`, `qwen/<topic>`, `docs/<topic>`),
use Conventional Commits and fill in every section of the pull request template
(checked by CI). Never force-push or push directly to `main`.
[Pull requests](../development/PULL_REQUESTS.md) · [AGENTS.md](../../AGENTS.md)

## CI/CD pipeline

`ci.yml` runs the required checks: `Web (React + Vite)`, `Backend (API +
engine)`, `Render Blueprint`, `Secret scan`, `Release package gates` and
`Release secret scan`. `release.yml` and `deploy-release.yml` publish and
deploy. Branch protection on `main` requires these checks and blocks force
pushes. Required pull request reviews are **not** currently enforced by
branch protection. [CI](../development/CI.md)

## Versioning

Tags are `vMAJOR.MINOR.PATCH`, allocated from Conventional Commits by
`scripts/release/plan.mjs`. The `version` fields in `package.json` are
component provenance, not the application version. The release manifest and
`/version` carry the application version and exact commit.

## Release process

A maintainer dispatches **Unified release** on `main` with `publish=true`.
After the gates, the workflow creates a tag and GitHub Release. No release is
created by pull requests. [Releases](../deployment/RELEASES.md) · [Checklists](../deployment/CHECKLISTS.md)

## Render infrastructure

The Blueprint (`render.yaml`) defines `openfund` (web, API + SPA),
`openfund-cms` (Directus) and `openfund-db` (PostgreSQL) in Frankfurt. Commit
auto-deploy is off. `npm run validate:blueprint` gates every PR.
[Render runbook](../deployment/RENDER.md) · production domains
`openfund.cloud`, `openfi.cloud`.

## Production deployment

After the `production` environment approval, Render deploys the exact
released commit, and the workflow checks `/version` on both domains. Follow
the [deployment checklist](../deployment/CHECKLISTS.md#deployment-checklist-production).
A merge never deploys.

## Rollback procedures

Redeploy the previous official release. Migrations are additive, so older code
keeps working on the newer schema. [Rollback](../deployment/ROLLBACK.md)

## Backup and recovery

Render PostgreSQL backups and manual dumps: [Database](../deployment/DATABASE.md).
Directus content: [Backup and restore](../backstage/BACKUP_RESTORE.md).
Confirm a restorable backup before any risky schema change.

## Security

SIWE with single-use nonces; HttpOnly hashed sessions; strict CSP; origin
checks; rate limits; server-side ownership checks; signature-verified DePay
deliveries; idempotent, append-only financial records; gitleaks in CI. No
independent security audit is claimed. Report vulnerabilities privately:
[SECURITY.md](../../SECURITY.md) · [Security architecture](../security/SECURITY.md)

## Operational monitoring

`/health`, `/version`, Render logs and the payment review queue. No automated
alerting is configured yet. [Operations](../operations/README.md)

## Contribution guidelines

Read [CONTRIBUTING.md](../../CONTRIBUTING.md) and the [documentation index](../README.md).
Keep documentation in English, preserve Persian localization and RTL, update
Feature Status, the changelog and the affected docs in the same pull request,
and never commit secrets or personal data.
