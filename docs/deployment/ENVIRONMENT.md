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
| `ALLOWED_DOMAINS` | openfund | R | PUB | `fromService: openfund / envVarKey: RENDER_EXTERNAL_HOSTNAME` creates the onrender host. Comma-separated SIWE hosts; every public hostname that serves the app must be listed (production: `openfund-our6.onrender.com,openfi.cloud,openfund.cloud`, set on the service — see [Render › Production domains](RENDER.md#production-domains)). Redirect-only hosts such as `www.*` need no entry |
| `VITE_DIRECTUS_HOST` | openfund | R | PUB | `fromService: openfund-cms / envVarKey: RENDER_EXTERNAL_HOSTNAME`; runtime fallback when `CMS_PUBLIC_URL` is unset |
| `KEY`, `SECRET` | openfund-cms | R | SEC | `generateValue: true` (created once at first apply) |
| `WEBSOCKETS_ENABLED`, `CORS_ENABLED`, `CORS_ORIGIN`, `CORS_METHODS`, `MAX_PAYLOAD_SIZE` | openfund-cms | R | PUB | Directus hardening (public read-only API) |
| `IP_TRUST_PROXY` | openfund-cms | R | PUB | `true`: Render terminates TLS in front of Directus; explicit so Directus 12 (default `false`) keeps client-IP resolution identical to 11.x |
| `SESSION_TTL_HOURS` | openfund | R | PUB | default `168` (7 days) |
| `PURCHASE_PAYMENT_CHAIN` | openfund | R | PUB | `42161` (Arbitrum One) — the only checkout chain; any other value keeps purchases disabled (`paymentsReady()` = false). The live service still carried `11155111` at the 2026-11-10 audit. |
| `PURCHASE_PAYMENT_DECIMALS` | openfund | R | PUB | default `18` — token decimals used in server-side amount checks |
| `PURCHASE_LATE_GRACE_MINUTES` | openfund | R | PUB | default `60` — a payment verified within this many minutes after order expiry still pays the order; outside the window → explicit `order_expired` for manual reconciliation |

## Prompted at first blueprint apply (`sync: false` — never in Git)

| Variable | Owner | Notes |
| :--- | :--- | :--- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | openfund-cms | Directus administrator |
| `PUBLIC_URL` | openfund-cms | e.g. `https://openfund-cms.onrender.com` |
| `CMS_PUBLIC_URL` | openfund | Preferred public browser CMS origin, e.g. `https://cms.openfi.cloud`. Credential-free HTTPS origin; served by `/react/runtime-config.js`. |
| `VITE_WALLETCONNECT_PROJECT_ID` | openfund (runtime, public) | optional; enables mobile wallets (WalletConnect QR / deep link) in the wallet picker. Create a project at cloud.reown.com and list every serving origin in its allowed domains. Unset: browser (EIP-6963) wallets only, and the picker says mobile connection is not configured. Setting it also allows the WalletConnect Verify frame in the CSP. Public value, but never committed |
| `VITE_TELEGRAM_COMMUNITY_URL` | openfund (runtime, public) | optional owner-verified HTTPS `t.me` community or invitation URL; blank/invalid means a non-navigating Coming Soon action. URL validation does not establish ownership. |
| `VITE_DISCORD_COMMUNITY_URL` | openfund (runtime, public) | optional owner-verified HTTPS Discord invitation; blank/invalid means Coming Soon. URL validation does not establish ownership. |
| `VITE_INSTAGRAM_COMMUNITY_URL` | openfund (runtime, public) | optional owner-verified HTTPS Instagram profile; blank/invalid means Coming Soon. URL validation does not establish ownership. |
| `CORS_ORIGINS` | openfund | optional; only needed for extra origins / custom domains |
| `PURCHASE_PAYMENT_RECEIVER` | openfund | **deliberately unset by default — purchasing stays disabled (`purchases_disabled`) until an approved payment address is entered.** No hardcoded production destination exists in the repository. |
| `AUTH_RPC_URL` | openfund | optional dedicated Arbitrum One RPC used by SIWE for contract-wallet (EIP-1271 / ERC-6492) signature checks. Unset = viem's public Arbitrum endpoint. Wallet authentication accepts chain `42161` only. |
| `PURCHASE_PAYMENT_TOKEN` | openfund | approved ERC-20 USD stablecoin contract (priced 1:1 to USD). **Required in production**; unset permits native test-chain payments outside production only. |
| `PURCHASE_PAYMENT_DECIMALS` | openfund | optional; must equal the token's on-chain `decimals()` (mismatch fails closed). Unset = read from the contract. |
| `PURCHASE_RPC_URL` | openfund | **secret.** Dedicated RPC endpoint for the payment chain; required in production, no public fallback. Its chain id is checked. |
| `PURCHASE_ROUTER_ADDRESSES` | openfund | optional comma-separated approved payment routers (for example the DePay Payment Router on the configured chain). Empty = direct token transfers only. See [Verification](../payments/VERIFICATION.md). |
| `DEPAY_VERIFY_PUBLIC_KEY` | openfund | PEM public key from the integration's **Verify** section on app.depay.com. Verifies the `x-signature` (RSA-PSS / SHA-256) of the dynamic-configuration request, callbacks and events over the raw body. Callbacks and events only register retryable hints; the on-chain verifier decides. Unset = all three DePay routes return 404. See [DePay](../payments/DEPAY.md). |
| `DEPAY_CALLBACK_PUBLIC_KEY` | openfund | legacy name of `DEPAY_VERIFY_PUBLIC_KEY`, read only when the new name is unset. Prefer the new name. |
| `PURCHASE_PAYMENT_MIN_CONFIRMATIONS` | openfund | finality depth: the verifier waits for this many confirmations before provisioning (retryable `tx_not_final`). Unset = `12` in production, `0` elsewhere. |
| `ADMIN_API_TOKEN` | openfund | **secret service token for the `/admin/*` operational API (user directory, challenge directory, withdrawal review). Unset = the whole admin API stays disabled (404).** Bearer-auth, constant-time compare. Never expose to the browser. |
| `CSP_EXTRA_CONNECT` | openfund | optional comma-separated extra origins for the CSP `connect-src` (production CMS is HTTPS so normally unneeded; used for non-HTTPS local CMS deployments) |
| `INTERNAL_API_TOKEN` | openfund | optional constant-time token guarding the test-only `/internal` seams (defense in depth; production never mounts them) |
| `VITE_DEPAY_WIDGET` | openfund (runtime, public) | optional; `1` enables the DePay checkout widget |
| `VITE_DEPAY_WIDGET_URL` | openfund (runtime, public) | approved DePay widget bundle URL (https) |
| `VITE_DEPAY_WIDGET_INTEGRITY` | openfund (runtime, public) | Subresource Integrity hash (`sha384-…`) of that exact bundle. The widget stays hidden unless the toggle, an https URL and this hash are all set. |
| `VITE_DEPAY_INTEGRATION_ID` | openfund (runtime, public) | public DePay integration id created at app.depay.com. Required together with the three widget variables above. |
| `DEPAY_CONFIG_PRIVATE_KEY` | openfund | **secret.** RSA private key (PEM, newlines as `\n`) that signs the dynamic configuration (`accept`) our server returns when DePay asks for it. Generate with `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`; store only the public half on app.depay.com (Dynamic Configuration public key field). Unset = the configuration endpoint returns 404. The endpoint also requires `DEPAY_VERIFY_PUBLIC_KEY`. |
| `PAYMENT_RECOVERY_INTERVAL_MS`, `PAYMENT_RECOVERY_MIN_AGE_S` | openfund | optional tuning of the payment recovery sweep (defaults 60000 ms / 45 s). Lower values exist only to shorten acceptance tests. |
| `CSP_EXTRA_SCRIPT_SRC` | openfund | optional comma-separated https origins (no paths, no wildcards) added to `script-src`, for the approved DePay widget origin |
| `CSP_EXTRA_FRAME_SRC` | openfund | optional comma-separated https origins added to `frame-src` for the approved DePay widget |
| `TREASURY_WALLET_ADDRESS` | openfund | public Openfund Treasury address read by the backend scheduler. Unset = `Not configured`; allocatable capital stays `Unknown`. Never a private key or seed phrase. See [Treasury](../economy/TREASURY.md). |
| `TREASURY_CHAIN_ID` | openfund | treasury chain id (supported: 1, 42161, 8453, 11155111, 421614); defaults to `PURCHASE_PAYMENT_CHAIN` |
| `TREASURY_ASSETS` | openfund | JSON list of `{symbol, address \| "native", decimals, priceFeed?}`; an asset without a valid Chainlink `priceFeed` is shown unpriced and excluded from the USD total |
| `TREASURY_RPC_URL` | openfund | optional RPC endpoint for treasury reads (unset = chain default public RPC) |
| `TREASURY_REFRESH_MINUTES` | openfund | snapshot interval, clamped to 60–120 (default 90) |
| `TREASURY_PRICE_MAX_AGE_MINUTES` | openfund | maximum Chainlink answer age before an asset is treated as unpriced (default 1500) |
| `LIVE_EXECUTION_ADAPTER` | openfund | `none` (default, every live order refused), `sandbox` (non-monetary, refused when `NODE_ENV=production`), `gains` (reserved; reports `adapter_unavailable`). See [Live Market Access](../economy/LIVE_MARKET_ACCESS.md). |
| `LIVE_SETTLEMENT_ADAPTER` | openfund | `none` (default, settlements stay `pending`) or `sandbox` (non-monetary, refused in production) |

## Local development defaults (code fallbacks — no .env required)

| Variable | App | Default |
| :--- | :--- | :--- |
| `VITE_BACKEND_URL` | apps/web-react | dev: `http://localhost:8080` · prod build: same origin (`window.location.origin`) |
| `VITE_DIRECTUS_URL` | apps/web-react dev server only | `http://localhost:8055`; production uses `CMS_PUBLIC_URL` through the runtime script |
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
