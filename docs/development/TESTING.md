# Testing and validation

Use Node 26 and the per-app lockfiles. [Local setup](LOCAL_DEVELOPMENT.md) describes installation. Run checks against the current branch and report their actual outcomes.

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

## Economy suites

`npm run test:economy --prefix apps/backend` (part of `test:all`) runs pure policy arithmetic, treasury snapshots with an injected chain reader, the Live Market Access flow mounted in-process with sandbox adapters, and the ambassador/coach HTTP suite. The last needs the test backend started with `ADMIN_API_TOKEN` and the placeholder receiver, and `ADMIN_API_TOKEN` (or `TEST_ADMIN_TOKEN`) in the test environment. No chain, RPC or payment network is contacted. See [Economy](../economy/README.md).

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

## Responsive matrix

`e2e/test-responsive-matrix.cjs` runs over the built web application. It starts
its own static host (`e2e/helpers/static-site.cjs`) with a stub
`/runtime-config.js` and returns 503 for every backend and CMS request. It needs
no database, backend or Directus.

```bash
npm ci && npm --prefix apps/web-react ci
npx playwright install chromium
npm run build:web
npm run test:browser:responsive-matrix
```

The suite loads every public route (`home`, `challenges`, `markets`, `rulebook`,
`transparency`, `whitepaper`, `roadmap`, `checkout`) and every terminal route
(`prop/dashboard|trade|chart|radar|heatmap|portfolio|journal`, `perpetual/trade`).
Each route runs in all five locales (`fa` and `ar` RTL; `en`, `ru` and `zh-CN`
LTR) and in both themes, and is resized through 320, 360, 375, 390, 430, 768,
1024, 1280, 1440 and 1920 px. At each width it asserts:

- no document-level horizontal overflow, including with every `<details>` open;
- no visible control clipped by the viewport or by an ancestor that hides
  overflow (controls inside scroll containers count as reachable), and no label
  wider than its control;
- the document `dir` and `lang` match the locale.

Each route, locale and theme also gets three further checks. Uncaught
exceptions and route errors count as critical console errors; failed resource
loads from the absent backend are expected. axe-core (WCAG 2.0, 2.1 and 2.2
A/AA rules) runs at 375 and 1280 px and must find no serious or critical
violations. On `/markets` and `/prop/trade` the off-canvas drawer is exercised
at every width where its trigger is visible. Every phone width must expose a
trigger. The drawer must open on the inline-start edge (right for RTL, left for
LTR), take focus, and close on Escape (returning focus), on an outside click and
after navigation.

Options: `MATRIX_SHARD=i/n` (CI runs three shards), `MATRIX_LOCALES`,
`MATRIX_THEMES`, `MATRIX_WIDTHS` and `MATRIX_ROUTES` (comma lists), `MATRIX_ROOT`
(another build directory), `TEST_FRONTEND_URL` (an already running frontend
instead of the static host), `MATRIX_CAPTURE=1` and `MATRIX_OUTPUT=<dir>`.
Font metrics differ between macOS and the Linux CI runners, which changes
spacing-dependent results such as axe `target-size`. To reproduce CI, run the
suite in the Playwright image that matches the installed version:

```bash
docker run --rm -v "$PWD":/work -w /work --ipc=host mcr.microsoft.com/playwright:v1.65.1-noble node e2e/test-responsive-matrix.cjs
```

Every run writes `report.json` (or `report-<i>.json` per shard) with each failed
check to the output directory.

## Release gate coverage

`release:build` invokes `test:backend` and its recorded browser gate list. At v0.2.0/main `561e7f3`, that list did not include explicit purchase-browser acceptance and did not configure a receiver. CI separately sets the test receiver and invokes `test:browser:purchase`. The website worktree adds the focused website suite; it does not establish live-chain payment or wallet-device acceptance. Inspect `scripts/release/build.mjs`, `.github/workflows/ci.yml` and the actual `verification.json` stage/skip results for the tested revision. Never equate a successful package with production payments, deployed CMS or current local startup.

## CI and security

Workflow inventory, timings, change tiers and the sharded browser matrices are documented in [CI](CI.md). [CI](../../.github/workflows/ci.yml) runs frontend, documentation, PostgreSQL-backed backend/browser checks, Blueprint validation, gitleaks and advisory reports. Authenticated Render validation only runs when its secret is configured. Dependency reports are not proof of security; triage findings without silently changing runtime versions in a documentation task.

Before delivery, check the authored diff for whitespace and secrets. Preserve licenses/notices and record unexecuted checks explicitly. [Delivery evidence](../reviews/repository-transformation/DELIVERY.md) belongs to this branch; historical reports are not fresh test results.

## Unified account acceptance

`npm run test:unified --prefix apps/backend` adds permanent trial lifecycle, concurrent funding/stop, independently derived five-category settlement constants, precise zero-boundary checks, stop gaps, estimates and date-filter reconciliation. It is included in `npm run test:backend` and uses the isolated PostgreSQL database.

`npm run test:engine --prefix apps/backend` runs the Prop engine audit suites: pure rule-boundary checks (no database) and DB-backed engine scenarios driven by a deterministic in-process feed with synthetic `X*/USD` symbols. They need only the isolated `DATABASE_URL`, not a running backend, and are included in `npm run test:backend`. Expected values are hand-computed, never produced by the code under test. See the [engine audit](../audits/PROP_ENGINE_AUDIT.md).

`npm run test:browser:unified` exercises the actual account cards, journal preferences/playbooks, live Gains depth/tape and a controlled local execution/termination scenario. Set the same isolated database and `SIM_TEST_MODE=1` backend; include the frontend hostname in `ALLOWED_DOMAINS`. This live-source suite is opt-in because public feed availability varies. CI runs the existing controlled browser and chart regressions; no external-feed failure is hidden with generated liquidity. Screenshot provenance is in the [delivery report](../reviews/unified-trading/DELIVERY.md).

Controlled backend mode requires both `SIM_TEST_MODE=1` and an isolated database name containing a `test`, `audit` or `ci` segment. Only that mode exposes price injection and bypasses shared rate buckets, avoiding minute-boundary-dependent acceptance results. Production never enables either behavior. Opening order requests require a durable idempotency key.

## Deterministic time and market data

Browser suites must not depend on when they run or on live markets.

- **Conduct clock.** In controlled backend mode, `POST /internal/test-clock` with `{ "at": "<ISO instant>" }` pins the clock that the conduct rules read (the funded daily pre-close window, the Instant weekend rule and news windows). `{ "at": null }` releases it. `SIM_TEST_CLOCK` pins it from start-up. The pinned clock is frozen, and pinning also adds the empty test-mode calendar coverage around that instant. Production never builds this clock: `ConductService` keeps `Date.now` and every restriction is unchanged (`apps/backend/test-clock.js`). `e2e/test-controlled-challenges.cjs` runs its lifecycle at a fixed open-market instant and asserts each boundary: market open, the pre-close window, the exact close, closed, weekend, reopen, and the summer/winter close-hour change. CI starts that server inside the close window to prove the suite is independent of the wall clock.
- **Radar and heatmap data.** `e2e/test-heatmap-radar.cjs` serves every `/radar/*` response from `e2e/fixtures/radar-fixtures.cjs` and starts the page clock at a fixed instant. The search target is the fixture's smallest market, and the suite covers empty and unavailable states. `npm run test:browser:heatmap-radar:live` (`e2e/test-heatmap-radar-live.cjs`) checks the real feed; CI runs it as a non-blocking step.
