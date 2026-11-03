# Openfund backend

Node 22, Express, PostgreSQL, SIWE identity and server-authoritative practice trading. Setup: `npm ci`, supply DATABASE_URL/ALLOWED_DOMAINS/CORS_ORIGINS/PORT, run `npm run migrate`, `npm run seed-plans` where needed, then `npm start`. Do not reset an existing database.

- Auth and existing trading engine: `server.js`, `engine.js`, `market-data.js`.
- Portfolio/journal-core: `portfolio.js`; financial Engine arithmetic is unchanged.
- Scoped product/metadata journal routes: `products.js`.
- Read-only official Gains wallet records: `gains-portfolio.js`; source checks and fixed-point conversions in [product architecture](../../docs/architecture/PRODUCT_TERMINALS.md).
- Account/trial ownership and instrument contracts: `accounts.js`, `instruments.js`; new trials use virtual USD, preserving old DAI history.
- Profile editing: `PATCH /auth/profile` in `server.js`; immutable wallet identity.
- Gated orders/payments, exactly-once challenge records, history/invoices and withdrawal requests: `purchases.js`, `invoice-pdf.js`. Provisioning does not enable challenge execution/evaluation; requests do not settle payouts. [ADR 0009](../../docs/decisions/0009-challenge-purchases-and-payment-verification.md) records current verification limits.
- Additive application migrations, including purchase provenance and notebook tables: `schema.sql`, applied by existing `migrate.js`.
- Static React build is served at `/react/`, with same-origin auth/product APIs; `/health` checks DB connectivity.

Run integration suites against an **isolated database/backend**, using DATABASE_URL and TEST_BACKEND_URL. `npm run test:all` runs SIWE, Engine, Portfolio, product/journal, unified account/instrument and purchase/profile/invoice/withdrawal suites. The integration server needs SIM_TEST_MODE=1 for deterministic test marks, an isolated test-named database and a CI-only placeholder payment receiver for purchase lifecycle coverage; follow [Testing](../../docs/development/TESTING.md). Never enable that variable in production. Browser tests in `e2e/` use the same isolated environment and should run after Engine integration tests, as price injections are shared within a test backend.
