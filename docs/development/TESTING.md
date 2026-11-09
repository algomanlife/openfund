# Testing and validation

Use Node 22 and the per-app lockfiles. [Local setup](LOCAL_DEVELOPMENT.md) describes installation. Run checks against the current branch and report their actual outcomes.

## Frontend and documentation

```bash
npm run docs:check
npm run typecheck
npm run test:web
npm run build:web
npm run validate:blueprint
```

`docs:check` checks English documentation/explanatory comments, local links and image paths, screenshot/asset manifests, Markdown syntax and Mermaid parsing. App translations and localization fixture strings are retained. The documentation policy and precise exclusions are in [Documentation maintenance](DOCUMENTATION.md).

## Backend integration

The full suite writes records and injects deterministic prices. Use a newly created database whose name includes `test`, `audit` or `_ci`, never a production/CMS database. The examples assume a local PostgreSQL role with database creation rights.

```bash
createdb openfund_test
export DATABASE_URL=postgresql://localhost:5432/openfund_test
npm run migrate --prefix apps/backend
npm run migrate --prefix apps/backend
npm run seed-plans --prefix apps/backend
# CI-only placeholder; never use it as an approved payment destination.
PORT=8294 SIM_TEST_MODE=1 \
  PURCHASE_PAYMENT_RECEIVER=0x000000000000000000000000000000000000c1a1 \
  npm start --prefix apps/backend
```

In a second terminal with the same `DATABASE_URL`:

```bash
TEST_BACKEND_URL=http://localhost:8294 npm run test:backend
```

The example deliberately uses a private test port, not the intended official runtime at 8080. Default tests use backend port 8080 and SIWE origin/domain `localhost:5173`. If running another port, set `PORT` for the server and `TEST_BACKEND_URL` for tests; keep `localhost:5173` in server `ALLOWED_DOMAINS` and `http://localhost:5173` in `CORS_ORIGINS`. The test seam is disabled in production; never enable it in a public environment. Purchase HTTP/browser lifecycle tests need the CI-only placeholder receiver above. Without a receiver, purchase-disabled paths may pass while enabled lifecycle cases skip; report skip counts. `/internal/confirm-order` exercises local atomic provisioning, not live receipt finality, token economics or DePay network compatibility.

## Browser suites

Governance (Hybrid Governance v1.0) has its own suites. The backend suite needs only an
isolated PostgreSQL database with `schema.sql` applied and starts no server; the website
suite renders components on the server and needs no browser. See
[governance documentation](../governance/README.md).

```bash
DATABASE_URL=postgres:///openfund_governance_test npm --prefix apps/backend run test:governance
npm --prefix apps/web-react run test:governance
```

After backend suites finish (their test marks share a process), run:

```bash
npx playwright install chromium
npm run build:web
TEST_FRONTEND_URL=http://localhost:8294/react TEST_BACKEND_URL=http://localhost:8294 npm run test:browser:audit
TEST_FRONTEND_URL=http://localhost:8294/react TEST_BACKEND_URL=http://localhost:8294 npm run test:browser:purchase
TEST_FRONTEND_URL=http://localhost:8294/react TEST_BACKEND_URL=http://localhost:8294 npm run test:browser:website
```

The audit suite uses generated EIP-1193 signers and controlled CMS/Gains protocol fixtures with the real local API/database. `TEST_FRONTEND_URL` and `TEST_BACKEND_URL` support an isolated host/port. It tests real SIWE signatures, not actual extensions, remote WalletConnect, hardware wallets or chain execution. `npm run test:browser:live` requires the separately configured local CMS and live Gains availability; inspect its setup before running.

Genuine documentation screenshots use no market/CMS/financial protocol fixtures. Public pages are anonymous; authenticated captures use a disclosed disposable signer and real local account/session records, without seeded trades or performance history. [Screenshot provenance](../assets/screenshots/README.md) records route, viewport, build, services and limitations. Browser snapshots and raw logs live under ignored `output/playwright/` and `output/validation/`.

## Release gate coverage

`release:build` invokes `test:backend` and its recorded browser gate list. At v0.2.0/main `561e7f3`, that list did not include explicit purchase-browser acceptance and did not configure a receiver. CI separately sets the test receiver and invokes `test:browser:purchase`. The website worktree adds the focused website suite; it does not establish live-chain payment or wallet-device acceptance. Inspect `scripts/release/build.mjs`, `.github/workflows/ci.yml` and the actual `verification.json` stage/skip results for the tested revision. Never equate a successful package with production payments, deployed CMS or current local startup.

## CI and security

[CI](../../.github/workflows/ci.yml) runs frontend, documentation, PostgreSQL-backed backend/browser checks, Blueprint validation, gitleaks and advisory reports. Authenticated Render validation only runs when its secret is configured. Dependency reports are not proof of security; triage findings without silently changing runtime versions in a documentation task.

Before delivery, check the authored diff for whitespace and secrets. Preserve licenses/notices and record unexecuted checks explicitly. [Delivery evidence](../reviews/repository-transformation/DELIVERY.md) belongs to this branch; historical reports are not fresh test results.

## Unified account acceptance

`npm run test:unified --prefix apps/backend` adds permanent trial lifecycle, concurrent funding/stop, independently derived five-category settlement constants, precise zero-boundary checks, stop gaps, estimates and date-filter reconciliation. It is included in `npm run test:backend` and uses the isolated PostgreSQL database.

`npm run test:engine --prefix apps/backend` runs the Prop engine audit suites: pure rule-boundary checks (no database) and DB-backed engine scenarios driven by a deterministic in-process feed with synthetic `X*/USD` symbols. They need only the isolated `DATABASE_URL`, not a running backend, and are included in `npm run test:backend`. Expected values are hand-computed, never produced by the code under test. See the [engine audit](../audits/PROP_ENGINE_AUDIT.md).

`npm run test:browser:unified` exercises the actual account cards, journal preferences/playbooks, live Gains depth/tape and a controlled local execution/termination scenario. Set the same isolated database and `SIM_TEST_MODE=1` backend; include the frontend hostname in `ALLOWED_DOMAINS`. This live-source suite is opt-in because public feed availability varies. CI runs the existing controlled browser and chart regressions; no external-feed failure is hidden with generated liquidity. Screenshot provenance is in the [delivery report](../reviews/unified-trading/DELIVERY.md).

Controlled backend mode requires both `SIM_TEST_MODE=1` and an isolated database name containing a `test`, `audit` or `ci` segment. Only that mode exposes price injection and bypasses shared rate buckets, avoiding minute-boundary-dependent acceptance results. Production never enables either behavior. Opening order requests require a durable idempotency key.
