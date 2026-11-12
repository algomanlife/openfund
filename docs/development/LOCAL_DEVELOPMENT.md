# Local development

Use Node.js 26 (Active LTS), npm, PostgreSQL 17 and Python 3 for optional Directus utilities. Run commands from the repository root unless shown otherwise. Root dependencies are orchestration/tooling only; each application has its own lockfile.

## Install

```bash
npm ci
npm ci --include=dev --prefix apps/web-react
npm ci --prefix apps/backend
```

Use an existing local PostgreSQL service and create a dedicated database for development. Do not run migrations/tests against a shared user or production database. The connection below assumes your local PostgreSQL role can connect; replace it with your own local credentials.

```bash
createdb openfund_dev
export DATABASE_URL=postgresql://localhost:5432/openfund_dev
npm run migrate --prefix apps/backend
npm run seed-plans --prefix apps/backend
```

Migrations are idempotent/additive; never reset an existing database to get started. [Database operations](../deployment/DATABASE.md) covers backup and schema ownership.

## Run the app

In one terminal, keep `DATABASE_URL` set and start the backend:

```bash
npm run dev:backend
```

In another terminal:

```bash
npm run dev:web
```

Open [English Home](http://localhost:5173/react/#/en/home), [Prop Terminal](http://localhost:5173/react/#/en/prop/trade), or [Perpetual Terminal](http://localhost:5173/react/#/en/perpetual/trade). The backend defaults to port 8080. Default local SIWE domains/CORS cover 5173 and 4173; custom ports require matching `ALLOWED_DOMAINS` and `CORS_ORIGINS`.

Optional `apps/web-react/.env` values:

```dotenv
VITE_BACKEND_URL=http://localhost:8080
VITE_DIRECTUS_URL=http://localhost:8055
VITE_WALLETCONNECT_PROJECT_ID=
```

VITE values are public build inputs. Never put privileged tokens there. Without Directus, supported static fallbacks keep the interface usable, but CMS-backed content/catalog sections can be unavailable. Never fake their availability. Use [Directus local setup](../backstage/LOCAL_SETUP.md) for published content; actual remote wallets need their own configuration and acceptance.

## Test the same-origin build

```bash
npm run build:web
npm start --prefix apps/backend
```

With the backend running and database configured, open [built Home](http://localhost:8080/react/#/en/home). The backend serves current `react/` output and API on one origin. `/health` checks database connectivity. A local build is not a Render deployment.

## Source care

`dist/` and `apps/web-react/public/legacy/` contain required compatibility sources. `react/` is generated build output: it is not tracked, and `npm run build:web` creates it (the backend reads `react/index.html` at start-up, so build before `npm start`). `dist/` remains a tracked source-critical deliverable; do not delete it. See [Testing](TESTING.md), [Repository maintenance](DOCUMENTATION.md) and [Contributing](../../CONTRIBUTING.md).

## Safe shared-machine acceptance

Use the single [AGENTS shared-machine contract](../../AGENTS.md#safe-shared-machine-acceptance)
for checkout/index preservation, port ownership and isolated databases. Development
startup above is not official delivery; use the [release runbook](../deployment/RELEASES.md)
for downloaded-archive verification, exact-version startup and rollback. Check
occupied ports before using backend defaults; never displace the intended official
8080 runtime with a test server.
