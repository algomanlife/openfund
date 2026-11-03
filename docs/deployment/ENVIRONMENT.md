# Environment Variables — Reference

Legend: **scope** B = build time, R = runtime · **class** PUB = safe to expose
to the browser, SEC = secret, never in Git · **owner** = which Render service
(or local app) consumes it.

## Managed by the blueprint (render.yaml)

| Variable | Owner | Scope | Class | Value / source |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | openfund (API) | R | SEC | `fromDatabase: openfund-db / connectionString` (internal) |
| `DB_CLIENT` / `DB_CONNECTION_STRING` | openfund-cms | R | PUB / SEC | `pg` + `fromDatabase: openfund-db / connectionString`; Directus does not consume the API's `DATABASE_URL` variable |
| `PORT` | both web services | R | PUB | set by Render (Directus and Express both honor it) |
| `NODE_VERSION` | openfund | B | PUB | `22` (matches `apps/backend` engines) |
| `NODE_ENV` | openfund | R | PUB | `production` (enables Secure cookies) |
| `ALLOWED_DOMAINS` | openfund | R | PUB | `fromService: openfund / envVarKey: RENDER_EXTERNAL_HOSTNAME` — the SIWE domain list tracks the served origin |
| `VITE_DIRECTUS_HOST` | openfund | B | PUB | `fromService: openfund-cms / envVarKey: RENDER_EXTERNAL_HOSTNAME`; the build command composes `VITE_DIRECTUS_URL=https://$VITE_DIRECTUS_HOST` |
| `KEY`, `SECRET` | openfund-cms | R | SEC | `generateValue: true` (created once at first apply) |
| `WEBSOCKETS_ENABLED`, `CORS_ENABLED`, `CORS_ORIGIN`, `CORS_METHODS`, `MAX_PAYLOAD_SIZE` | openfund-cms | R | PUB | Directus hardening (public read-only API) |
| `SESSION_TTL_HOURS` | openfund | R | PUB | default `168` (7 days) |

## Prompted at first blueprint apply (`sync: false` — never in Git)

| Variable | Owner | Notes |
| :--- | :--- | :--- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | openfund-cms | Directus administrator |
| `PUBLIC_URL` | openfund-cms | e.g. `https://openfund-cms.onrender.com` |
| `VITE_WALLETCONNECT_PROJECT_ID` | openfund (build) | optional; full remote wallet list (cloud.reown.com, free) |
| `CORS_ORIGINS` | openfund | optional; only needed for extra origins / custom domains |

## Local development defaults (code fallbacks — no .env required)

| Variable | App | Default |
| :--- | :--- | :--- |
| `VITE_BACKEND_URL` | apps/web-react | dev: `http://localhost:8080` · prod build: same origin (`window.location.origin`) |
| `VITE_DIRECTUS_URL` | apps/web-react | `http://localhost:8055` |
| `DATABASE_URL` | apps/backend | `postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms` |
| `ALLOWED_DOMAINS` | apps/backend | localhost dev origins |
| `CORS_ORIGINS` | apps/backend | localhost dev origins |
| `SESSION_TTL_HOURS` | apps/backend | 168 |
| `SIM_TEST_MODE` | apps/backend | unset in production — internal price-injection seam for E2E only |
| `SIM_MAINT_PCT` | apps/backend engine | 10 (maintenance/liquidation level) |
| `PORTFOLIO_TZ` | apps/backend | `UTC` (PnL calendar policy) |

See root `.env.example` for a copy-paste template. Anything Vite-exposed
(`VITE_*`) is PUBLIC by definition — never point it at secret material.

## Adding a variable (required workflow)

1. Add the variable to the owning service in `render.yaml` (value, `sync: false`,
   or a `fromService`/`fromDatabase` reference).
2. Document it in this table (owner, scope, class, format).
3. Add it to `.env.example` when it has a local-dev value.
4. Update CI when it affects build or tests.

## Integration audit (2026-11-02)

No extra runtime service or secret is required. The API and CMS explicitly use
Frankfurt with the existing PostgreSQL 17 resource. Public browser/SIWE hostnames
use `RENDER_EXTERNAL_HOSTNAME`; `fromService.property: host` is private-network DNS.
API PostgreSQL still uses `DATABASE_URL`; CMS uses `DB_CLIENT=pg` and
`DB_CONNECTION_STRING`. The build installs web devDependencies explicitly because
Vite/TypeScript are needed even when `NODE_ENV=production`.

Prop SIWE: Ethereum Sepolia (11155111); Perpetual SIWE: Arbitrum One (42161).
EIP-1271 checks use the message's supported chain. Existing opaque sessions remain
valid for their existing lifetime; new signatures use these product networks.
No Gains testnet execution is enabled. `SIM_TEST_MODE=1` is ignored in production.
`SIM_MAINT_PCT` remains the existing simulation-only maintenance percentage (10 by
default, finite and below 100), not a Gains liquidation threshold.

## Pine chart runtime

The web application pins `@luxalgo/vela@0.9.3`, `@luxalgo/vela-pinets@0.3.2` and `pinets@0.13.1`; esbuild is an explicit frontend build dependency. `prebuild` generates the workspace, hosted worker and readable licenses before Vite copies public assets. No new environment variable, secret, backend dependency or Render service is required. A restrictive CSP must permit the same-origin worker; no external Pine library service is used. See [Pine architecture](../trading/PINE_SCRIPT.md).

## Release tooling

The [release runbook](RELEASES.md) defines Actions production settings and public build parity. `RELEASE_VERSION` is allocated from immutable tags; `RELEASE_TEST_PORT` defaults to 8288 for isolated local gates. `RENDER_GIT_COMMIT` is supplied by Render. These are build/orchestration metadata, not new application services. `DATABASE_URL` has no fallback in release tooling. Do not enable `SIM_TEST_MODE` in deployed releases.
