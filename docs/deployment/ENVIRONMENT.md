# Environment Variables — Reference

Legend: **scope** B = build time, R = runtime · **class** PUB = safe to expose
to the browser, SEC = secret, never in Git · **owner** = which Render service
(or local app) consumes it.

## Managed by the blueprint (render.yaml)

| Variable | Owner | Scope | Class | Value / source |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | openfund (API) | R | SEC | `fromDatabase: openfund-db / connectionString` (internal) |
| `MIGRATION_DATABASE_URL` | openfund (API) | R | SEC | Not in `render.yaml`. Only for the optional runtime-role split: the owner/migration connection used by `migrate.js`, while `DATABASE_URL` points at the DML-only `openfund_runtime` role ([database roles](../security/DATABASE_ROLES.md)). Unset = `migrate.js` uses `DATABASE_URL` |
| `DB_CLIENT` / `DB_CONNECTION_STRING` | openfund-cms | R | PUB / SEC | `pg` + a `sync: false` secret: the internal connection string of the least-privilege `openfund_directus` role, never the `openfund-db` owner credential ([database roles](../security/DATABASE_ROLES.md), OF-2026-11-12). Directus does not consume the API's `DATABASE_URL` variable |
| `PORT` | both web services | R | PUB | set by Render (Directus and Express both honor it) |
| `NODE_VERSION` | openfund | B | PUB | `22` (matches `apps/backend` engines) |
| `NODE_ENV` | openfund | R | PUB | `production` (enables Secure cookies) |
| `ALLOWED_DOMAINS` | openfund | R | PUB | Blueprint value: `openfund-our6.onrender.com,openfi.cloud,openfund.cloud,iran.openfund.cloud`. These are exact SIWE message hosts; the validator requires exactly these four and rejects any removal, addition or a `fromService` replacement. `iran.openfund.cloud` is the Iran edge on Liara ([ADR 0031](../decisions/0031-iran-edge-on-liara.md)), which proxies this same service. Redirect-only `www.*` hosts need no entry. The live service must be rechecked after an approved Blueprint sync; see [Render › Production domains](RENDER.md#production-domains). |
| `VITE_DIRECTUS_HOST` | openfund | R | PUB | `fromService: openfund-cms / envVarKey: RENDER_EXTERNAL_HOSTNAME`; runtime fallback when `CMS_PUBLIC_URL` is unset |
| `KEY`, `SECRET` | openfund-cms | R | SEC | `generateValue: true` (created once at first apply) |
| `WEBSOCKETS_ENABLED`, `CORS_ENABLED`, `CORS_ORIGIN`, `CORS_METHODS`, `MAX_PAYLOAD_SIZE` | openfund-cms | R | PUB | Directus hardening (public read-only API) |
| `CACHE_ENABLED`, `IMPORT_IP_DENY_LIST`, `FILES_MIME_TYPE_ALLOW_LIST` | openfund-cms | R | PUB | OF-2026-11-11 compensating controls while Directus is on 11.x: response cache off, an explicit file-import deny list (including `0.0.0.0`, `::`, loopback, link-local and private ranges) and an image/PDF-only upload list. The Blueprint validator enforces them; `scripts/ops/test/directus-hardening.test.mjs` verifies them at runtime ([assessment](../backstage/DIRECTUS_12_ASSESSMENT.md)) |
| `IP_TRUST_PROXY` | openfund-cms | R | PUB | `true`: Render terminates TLS in front of Directus; explicit so Directus 12 (default `false`) keeps client-IP resolution identical to 11.x |
| `LICENSE_KEY` | openfund-cms | R | **SECRET** | Directus 12+ licence or Open Innovation Grant key. Unset on 11.x. Required before the image moves to 12.x: the unlicensed Core tier ignores field-level and row-level permission rules, which breaks public content reads and the Commerce Admin coupon workflow. `PUBLIC_URL` must be an absolute URL. Never set together with `LICENSE_TOKEN`. See [Directus 12 assessment](../backstage/DIRECTUS_12_ASSESSMENT.md) |
| `SESSION_TTL_HOURS` | openfund | R | PUB | default `168` (7 days) |
| `PURCHASE_PAYMENT_CHAIN` | openfund | R | PUB | `42161`. Legacy single settlement chain, used only while `PURCHASE_PAYMENT_CHAINS` is unset. Payments are **not** tied to the Arbitrum sign-in chain. The live service still carried `11155111` at the 2026-11-10 audit. |
| `PURCHASE_PAYMENT_DECIMALS` | openfund | R | PUB | default `18` — token decimals used in server-side amount checks |
| `PURCHASE_LATE_GRACE_MINUTES` | openfund | R | PUB | default `60` — a payment verified within this many minutes after order expiry still pays the order; outside the window → explicit `order_expired` for manual reconciliation |
| `MARKET_PRICE_SOURCE` | openfund | R | PUB | `open-oracle` (default): the market-data role runs the Open Oracle pricing service (Gains, Hyperliquid main perp dex, GMX Arbitrum) and the demo engine executes only on usable composites; `/api/oracle/*` is served. `gains`: emergency fallback to Gains-only marks, no `/api/oracle/*` (answers 503). Any other value refuses to start. See [ADR 0059](../decisions/0059-open-oracle-pricing-service.md) and [Open Oracle](../integrations/OPEN_ORACLE.md#pricing-service) |
| `FOOTPRINT_ENABLED` | openfund | R | PUB | `0` (off). `1` starts the footprint service (one shared Hyperliquid trade WebSocket, `/api/footprint/*`) and exposes `footprint: true` in the public runtime config so the terminal registers the Footprint chart style and overlay. Off: nothing is registered, fetched or rendered and every `/api/footprint/*` route answers 404. See [Footprint](../integrations/FOOTPRINT.md). |
| `FOOTPRINT_RETENTION_DAYS` | openfund | R | PUB | `30` — days of stored one-minute footprint history (1–3650) |
| `FOOTPRINT_MAX_STREAMS` | openfund | R | PUB | `5000` — concurrent live footprint SSE streams one process accepts; extra streams are refused with `footprint_stream_capacity` |

### Canonical domains and Geo-IP language ([ADR 0043](../decisions/0043-canonical-domains-geo-routing-and-locale.md))

| Variable | Service | Value / meaning |
| :--- | :--- | :--- |
| `PUBLIC_ORIGIN` | openfund (Blueprint), Liara web (`stack.json`) | The region's canonical website origin: `https://openfi.cloud` (GLOBAL), `https://openfi.live` (IRAN). Used for sitemap and robots, and as the redirect target. Bare `https` origin only |
| `CANONICAL_ALIAS_HOSTS` | openfund (Blueprint), Liara web (`stack.json`) | Hosts whose browser navigation (GET/HEAD outside machine paths) answers 301 to `PUBLIC_ORIGIN` with path and query. GLOBAL: `openfund.cloud,www.openfund.cloud,www.openfi.cloud` (Cloudflare redirects them first). IRAN: `www.openfi.live,iran.openfund.cloud,iran.openfi.cloud` |
| `GEO_COUNTRY_SOURCE` | backend | `cloudflare` (default): `CF-IPCountry` from a Cloudflare hop. `ip-database`: IPv4/IPv6 lookup of the platform-written visitor address. Needs `GEO_CLIENT_HOP` and `GEOIP_DB_PATH`; never reads `CF-IPCountry` |
| `GEO_CLIENT_HOP` | backend (with `ip-database`) | `X-Forwarded-For` position, from the right, where the platform writes the visitor. Measure it with `GET /runtime/ingress` on the real ingress; there is no default |
| `GEOIP_DB_PATH` | backend (with `ip-database`) | Path of an IP-to-country CSV (`start,end,country`, plain or `.gz`), for example DB-IP Lite (CC BY 4.0, attribution required). The owner chooses and licenses the dataset |
| `GEO_FALLBACK_LOCALE` | Liara web (`stack.json`) | Default language when no trusted visitor country exists. Unset = `en`. IRAN sets `fa`: Liara is not behind Cloudflare, and only Iranian traffic is routed there |

## Prompted at first blueprint apply (`sync: false` — never in Git)

| Variable | Owner | Notes |
| :--- | :--- | :--- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | openfund-cms | Directus administrator |
| `EDGE_CLIENT_IP_KEY` | openfund | **SECRET**, optional. At least 32 characters of `[A-Za-z0-9_-]`; the same value is set on the Iran edge (Liara). A request that carries it in `X-Openfund-Edge-Key` may set `req.ip` from `X-Openfund-Edge-Client-Ip`, so per-IP rate limits, `audit_log`, `auth_sessions` and referral visitor hashes see the real visitor. Unset (default): unchanged behaviour, and edge visitors share the edge's egress IP. A malformed value stops the service at start-up. See [ADR 0031](../decisions/0031-iran-edge-on-liara.md) |
| `OPENFUND_REGION` | openfund | Optional. `GLOBAL` (default; Render) or `IRAN` (the Iran runtime on Liara). `migrate.js` claims the database for this region once; the server refuses to start on a database claimed by another region. `IRAN` refuses every state-changing request outside a non-financial allowlist. **Leave unset on Render.** See [ADR 0032](../decisions/0032-iran-sovereign-regional-runtime.md) |
| `OPENFUND_ROLES` | openfund | Optional comma-separated background roles: `http`, `market-data`, `engine`, `purchase-expiry`, `payment-recovery`, `settlement`, `treasury`, `footprint`, `sync`. Unset: every role in `GLOBAL` (unchanged behaviour), `http` only in `IRAN`. `IRAN` refuses `purchase-expiry`, `payment-recovery`, `settlement` and `treasury` at start-up; `engine` runs there only on IRAN-owned accounts (ADR 0033 ownership fence). Without `http` the process serves only `/health`, `/version` and `/runtime/status`. **Leave unset on Render.** See [ADR 0032](../decisions/0032-iran-sovereign-regional-runtime.md) |
| `CHAIN_RECORDS_ENABLED` | openfund (and the Iran runtime apps) | `1` starts the on-chain records worker in processes with the `engine` role ([ADR 0063](../decisions/0063-on-chain-certificates-and-trade-ledger.md)). Blueprint value `0`. Records queue in `chain_records` either way and are sent once enabled. Runbook: [CHAIN_RECORDS.md](../operations/CHAIN_RECORDS.md) |
| `CHAIN_RECORDS_PRIVATE_KEY` | openfund (and the Iran runtime apps) | **SECRET**. This region's recorder key, `0x` + 64 hex. Holds Arbitrum Sepolia test ETH only; one key per region, each allowed as a recorder on both contracts. Required when enabled |
| `CHAIN_RECORDS_CERTIFICATE_ADDRESS`, `CHAIN_RECORDS_LEDGER_ADDRESS` | openfund (and the Iran runtime apps) | Public. Deployed `OpenfundCertificate` and `OpenfundTradeLedger` addresses. Required when enabled |
| `CHAIN_RECORDS_CHAIN_ID`, `CHAIN_RECORDS_RPC_URL`, `CHAIN_RECORDS_EXPLORER_URL` | openfund | Optional. Default `421614`, `https://sepolia-rollup.arbitrum.io/rpc`, `https://sepolia.arbiscan.io` |
| `CHAIN_RECORDS_MIN_BALANCE_ETH`, `CHAIN_RECORDS_BATCH`, `CHAIN_RECORDS_MAX_ATTEMPTS` | openfund | Optional tuning: low-balance warning (default `0.01`), records per pass (default 10, max 50), attempts before a record is marked failed (default 20) |
| `REGION_SYNC_KEYS` | openfund (and the Iran runtime apps) | **SECRET**, optional. JSON `{"<kid>":"<secret>"}` (key id `[A-Za-z0-9_.-]{1,40}`, secret ≥ 32 characters); the same set on GLOBAL and IRAN. Unset: the signed peer endpoint `/sync/v1/*` answers 404 and nothing is sent. Rotation: add a kid on both sides, switch `REGION_SYNC_ACTIVE_KID`, then remove the old one. See [ADR 0033](../decisions/0033-regional-authority-and-synchronization.md) |
| `REGION_SYNC_ACTIVE_KID` | openfund (and the Iran runtime apps) | Optional. Key id this side signs with (default: the first key) |
| `REGION_SYNC_PEER_URL` | openfund (and the Iran runtime apps) | Optional. Origin of the other region (`https://iran.openfund.cloud` on Render; the Render origin on Liara); https in production. Unset: the sync worker does not start. Capture into the outbox additionally needs an operator `POST /admin/regional/sync/enable` |
| `REGION_SYNC_INTERVAL_MS`, `REGION_SYNC_BATCH`, `REGION_SYNC_MAX_BACKOFF_MS` | openfund | Optional tuning: delivery interval (default 2000 ms), batch size (default 200, max 1000), maximum retry backoff (default 300000 ms) |
| `MIGRATE_ON_START` | Iran runtime web app only | `1` runs `migrate.js` before the server in `infra/liara-iran-runtime/start.sh` (exactly one app migrates). Not used on Render |
| `CMS_SNAPSHOT_ORIGIN` | openfund (and the Iran runtime web app) | Optional. Origin that the same-origin `/cms` content path reads server-to-server (public role only) and snapshots as last-known-good content. Default: `CMS_PUBLIC_URL`. See [ADR 0033](../decisions/0033-regional-authority-and-synchronization.md) |
| `PUBLIC_URL` | openfund-cms | e.g. `https://openfund-cms.onrender.com` |
| `CMS_PUBLIC_URL` | openfund | Preferred public browser CMS origin, e.g. `https://cms.openfi.cloud`. Credential-free HTTPS origin; served by `/react/runtime-config.js`. When set (or derived from `VITE_DIRECTUS_HOST`), the site adds exactly this origin to `frame-ancestors` and omits `X-Frame-Options`, so the Directus Studio visual editor can frame it ([ADR 0038](../decisions/0038-universal-visual-editing.md)); no other origin may frame the site. |
| `CSP_EXTRA_FRAME_ANCESTORS` | openfund | Optional, public. Comma-separated exact origins allowed to frame the site in addition to `'self'` and the CMS origin, e.g. `https://backstage.openfi.cloud` for the Backstage Content workspace's read-only preview. https only in production (loopback http is accepted only outside production); paths and wildcards are dropped. Unset: only `'self'` and the CMS origin |
| `BACKSTAGE_DIRECTUS_TOKEN` | openfund-backstage | **SECRET**, optional. Directus static token of a dedicated user whose role can read and update only the editorial collections (`ui_messages`, `ui_message_translations` and the registered surface collections and their translations). The Content workspace writes through it after owner password re-entry; Backstage still refuses forbidden/financial collections and protected fields itself. Unset: the Content workspace is read-only (published content only) |
| `CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC` | openfund-cms | Public, owner-entered. Lets the Studio visual editor frame the website: `'self'` followed by every site origin an editor opens, space-separated. For the current serving domains: `'self' https://openfi.cloud https://openfund.cloud https://openfund-our6.onrender.com`. Directus 11.17.4 emits no default `frame-src`, so `child-src` governs frames (verified on a disposable instance, 2026-11-17). Each origin must also be listed in Directus *Settings → Visual Editor URLs*. Unset: the visual editor cannot frame the site (Studio content editing still works) |
| `VITE_WALLETCONNECT_PROJECT_ID` | openfund (runtime, public) | optional; enables mobile wallets (WalletConnect QR / deep link) in the wallet picker. Create a project at cloud.reown.com and list every serving origin in its allowed domains. Unset: browser (EIP-6963) wallets only, and the picker says mobile connection is not configured. Setting it also allows the WalletConnect Verify frame in the CSP. Public value, but never committed |
| `VITE_TELEGRAM_COMMUNITY_URL` | openfund (runtime, public) | optional owner-verified HTTPS `t.me` community or invitation URL; blank/invalid means a non-navigating Coming Soon action. URL validation does not establish ownership. |
| `VITE_DISCORD_COMMUNITY_URL` | openfund (runtime, public) | optional owner-verified HTTPS Discord invitation; blank/invalid means Coming Soon. URL validation does not establish ownership. |
| `VITE_INSTAGRAM_COMMUNITY_URL` | openfund (runtime, public) | optional owner-verified HTTPS Instagram profile; blank/invalid means Coming Soon. URL validation does not establish ownership. |
| `CORS_ORIGINS` | openfund | optional; only needed for extra origins / custom domains |
| `PURCHASE_PAYMENT_RECEIVER` | openfund | **deliberately unset by default — purchasing stays disabled (`purchases_disabled`) until an approved payment address is entered.** No hardcoded production destination exists in the repository. |
| `PURCHASE_PAYMENT_CHAINS` | openfund | Public JSON list of DePay settlement chains, e.g. `[{"blockchain":"arbitrum","token":"0x…","receiver":"0x…","routers":["0x…"]}]`. `blockchain` uses DePay identifiers (`ethereum`, `bsc`, `polygon`, `avalanche`, `gnosis`, `arbitrum`, `optimism`, `base`, `worldchain`, `solana`); `token` is the settlement token (Solana: SPL mint); `receiver` the merchant address (Solana: owner key); optional `tokenDecimals`, `minConfirmations`. Each complete entry is offered by the DePay button and the dynamic configuration and verified on its own chain. Unset = the legacy `PURCHASE_PAYMENT_*` single chain. See [DePay](../payments/DEPAY.md). |
| `PURCHASE_RPC_URLS` | openfund | **secret.** JSON map from chain id or DePay blockchain name to a dedicated RPC endpoint, e.g. `{"42161":"https://…","solana":"https://…"}`. Required in production for every configured chain. |
| `AUTH_RPC_URL` | openfund | optional dedicated Arbitrum One RPC used by SIWE for contract-wallet (EIP-1271 / ERC-6492) signature checks. Unset = viem's public Arbitrum endpoint. Wallet authentication accepts chain `42161` only. |
| `PURCHASE_PAYMENT_TOKEN` | openfund | approved ERC-20 USD stablecoin contract (priced 1:1 to USD). **Required in production**; unset permits native test-chain payments outside production only. |
| `PURCHASE_PAYMENT_DECIMALS` | openfund | optional; must equal the token's on-chain `decimals()` (mismatch fails closed). Unset = read from the contract. |
| `PURCHASE_RPC_URL` | openfund | **secret.** Dedicated RPC endpoint for the payment chain; required in production, no public fallback. Its chain id is checked. |
| `PURCHASE_ROUTER_ADDRESSES` | openfund | optional comma-separated approved payment routers (for example the DePay Payment Router on the configured chain). Empty = direct token transfers only. See [Verification](../payments/VERIFICATION.md). |
| `DEPAY_VERIFY_PUBLIC_KEY` | openfund | PEM public key from the integration's **Verify** section on app.depay.com. Verifies the `x-signature` (RSA-PSS / SHA-256) of the dynamic-configuration request, callbacks and events over the raw body. Callbacks and events only register retryable hints; the on-chain verifier decides. Unset = all three DePay routes return 404. See [DePay](../payments/DEPAY.md). |
| `DEPAY_CALLBACK_PUBLIC_KEY` | openfund | legacy name of `DEPAY_VERIFY_PUBLIC_KEY`, read only when the new name is unset. Prefer the new name. |
| `PURCHASE_PAYMENT_MIN_CONFIRMATIONS` | openfund | finality depth: the verifier waits for this many confirmations before provisioning (retryable `tx_not_final`). Unset = `12` in production, `0` elsewhere. |
| `ADMIN_API_TOKEN` | openfund | **secret service token for the `/admin/*` operational API (user directory, challenge directory, withdrawal review). Unset = the whole admin API stays disabled (404).** Bearer-auth, constant-time compare. Never expose to the browser. |
| `CSP_EXTRA_CONNECT` | openfund | optional comma-separated extra origins for the CSP `connect-src` and `img-src` (CMS content and CMS images such as campaign media; production CMS is HTTPS so normally unneeded; used for non-HTTPS local CMS deployments) |
| `INTERNAL_API_TOKEN` | openfund | optional constant-time token guarding the test-only `/internal` seams (defense in depth; production never mounts them) |
| `VITE_DEPAY_WIDGET` | openfund (runtime, public) | optional kill switch: `0` disables the DePay widget. Unset or `1` = enabled whenever `VITE_DEPAY_INTEGRATION_ID` is set |
| `VITE_DEPAY_WIDGET_URL` | openfund (runtime, public) | optional override: an externally hosted widget bundle (https). Unset = the vendored, same-origin `@depay/widgets` bundle ([ADR 0026](../decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md)), which needs no CSP change |
| `VITE_DEPAY_WIDGET_INTEGRITY` | openfund (runtime, public) | Subresource Integrity hash (`sha384-…`) of the override bundle; used only with `VITE_DEPAY_WIDGET_URL`. The vendored bundle's hash is compiled into the frontend |
| `VITE_DEPAY_INTEGRATION_ID` | openfund (runtime, public) | public DePay integration id created at app.depay.com. Enables the **Pay with DePay** button on `/:locale/checkout`; payments still require a complete settlement chain (`PURCHASE_PAYMENT_CHAINS`) |
| `MIGRATION_STORAGE_ENDPOINT`, `MIGRATION_STORAGE_BUCKET`, `MIGRATION_STORAGE_REGION` | openfund | private S3-compatible storage for Migration to Openfund evidence ([ADR 0051](../decisions/0051-migration-to-openfund.md)): https origin, a bucket with public access blocked, and the signing region. Objects are written with server-side encryption (AES256); reviewers get download-only links that expire within 15 minutes; files are deleted after the retention period. Until every `MIGRATION_STORAGE_*` value is set, the request form says "opening soon" and stores nothing. The IRAN runtime sets its own values on Liara so its users' files stay in that region. |
| `MIGRATION_STORAGE_ACCESS_KEY_ID`, `MIGRATION_STORAGE_SECRET_ACCESS_KEY` | openfund | **secrets**, entered by the owner: a key limited to that bucket (put, get, delete). |
| `MIGRATION_STORAGE_PATH_STYLE` | openfund | `1` for providers that need path-style URLs; unset for virtual-hosted style (AWS). |
| `EMAIL_PROVIDER` | openfund | `resend` (blueprint) or `log` (local development and tests only; refused when `NODE_ENV=production`). Transactional email for Premium League registration codes ([ADR 0050](../decisions/0050-openfund-premium-league.md)). |
| `EMAIL_FROM` | openfund | public sender on a domain verified with the provider, e.g. `Openfund <no-reply@openfi.cloud>`. |
| `EMAIL_API_KEY` | openfund | **secret**, entered by the owner. Until it and `EMAIL_FROM` are valid, the adapter reports not configured and Premium League registration shows “opens soon”; nothing is collected. |
| `TOURNAMENT_CODE_PEPPER` | openfund | optional secret mixed into the HMAC of 6-digit registration codes (codes are stored hashed either way). |
| `TOURNAMENT_SAMPLE_INTERVAL_MS` | openfund | default `300000`. Interval of Premium League account provisioning at the start and equity sampling (GLOBAL, engine role). |
| `DEPAY_CONFIG_PRIVATE_KEY` | openfund | **secret.** RSA private key (PEM, newlines as `\n`) that signs the dynamic configuration (`accept`) our server returns when DePay asks for it. Generate with `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`; store only the public half on app.depay.com (Dynamic Configuration public key field). Unset = the configuration endpoint returns 404. The endpoint also requires `DEPAY_VERIFY_PUBLIC_KEY`. |
| `PAYMENT_RECOVERY_INTERVAL_MS`, `PAYMENT_RECOVERY_MIN_AGE_S` | openfund | optional tuning of the payment recovery sweep (defaults 60000 ms / 45 s). Lower values exist only to shorten acceptance tests. |
| `DEPAY_ATTESTED_ANY_PAYER` | openfund | default `false`. When `false`, a DePay-attested payment settles automatically only if its on-chain signer is the order owner's wallet; other payers are held for operator review (security audit 2026-11, OF-2026-11-05). `true` trusts DePay's attestation for any payer (gift and second-wallet payments). Owner decision. |
| `PAYMENT_DEPAY_NEW_PAYMENTS` | openfund | default `false`. DePay for NEW payments (DePay announced shutdown on 2026-12-31). Callbacks, events and recovery of existing DePay payments never depend on it. Backstage → Payment methods overrides it at runtime (audited). |
| `PAYMENT_WALLET_ENABLED`, `PAYMENT_MANUAL_ENABLED` | openfund | default `true`. Openfund Pay direct-wallet and manual-transfer methods for new payments; Backstage overrides at runtime. |
| `PAYMENT_PARTIAL_BALANCE_HOURS` | openfund | default `72`. A partially paid order never expires; after this many hours without the remaining balance it moves to `manual_review`. |
| `PAYMENT_WATCHER_ENABLED` | openfund | default `true`. Treasury watcher that discovers inbound settlement-token transfers without a customer TXID (runs with the `payment-recovery` role, GLOBAL only; leased per chain). |
| `PAYMENT_WATCHER_INTERVAL_MS`, `PAYMENT_WATCHER_REORG_BLOCKS`, `PAYMENT_WATCHER_MAX_RANGE`, `PAYMENT_WATCHER_BACKFILL_BLOCKS`, `PAYMENT_WATCHER_LEASE_SECONDS` | openfund | watcher tuning (defaults 30000 ms, 64 blocks, 2000 blocks, 20000 blocks, 120 s). Per chain, `PURCHASE_PAYMENT_CHAINS` may also set public `watchFromBlock` (EVM) and `receiverTokenAccount` (Solana treasury SPL token account). `PURCHASE_RPC_URLS` values may be a string or an ordered array (failover). |
| `CSP_EXTRA_SCRIPT_SRC` | openfund | optional comma-separated https origins (no paths, no wildcards) added to `script-src`. Needed only for an external `VITE_DEPAY_WIDGET_URL`; the vendored widget is same-origin |
| `CSP_EXTRA_FRAME_SRC` | openfund | optional comma-separated https origins added to `frame-src` for the approved DePay widget |

The application CSP (HTML documents only) always allows `https://widgets.tradingview-widget.com` in `script-src` and `https://www.tradingview-widget.com` in `frame-src` for the terminal's News & Information tab (official TradingView Economic Calendar widget, [ADR 0025](../decisions/0025-prop-leverage-sizing-and-economic-calendar.md)). No environment variable is involved.
| `FUNDED_AGREEMENT_FROM` | openfund | Optional UTC date (YYYY-MM-DD). Funded accounts created on or after it must sign the funded-trader agreement with their wallet before the first trade ([ADR 0054](../decisions/0054-funded-trader-agreement.md)). Unset = not required, so accounts already trading are never blocked retroactively. Set it once the funded-trader terms are published. |
| `FUNDED_PAYOUT_V1_FROM` | openfund | Optional owner-approved purchase cutoff (UTC YYYY-MM-DD) for the new funded payout terms. Leave unset until approved sales terms are published. |
| `TREASURY_WALLET_ADDRESS` | openfund | public Openfund Treasury address read by the backend scheduler. Unset = `Not configured`; allocatable capital stays `Unknown`. Never a private key or seed phrase. See [Treasury](../economy/TREASURY.md). |
| `TREASURY_CHAIN_ID` | openfund | treasury chain id (supported: 1, 42161, 8453, 11155111, 421614); defaults to `PURCHASE_PAYMENT_CHAIN` |
| `TREASURY_ASSETS` | openfund | JSON list of `{symbol, address \| "native", decimals, priceFeed?}`; an asset without a valid Chainlink `priceFeed` is shown unpriced and excluded from the USD total |
| `TREASURY_RPC_URL` | openfund | optional RPC endpoint for treasury reads (unset = chain default public RPC) |
| `TREASURY_REFRESH_MINUTES` | openfund | snapshot interval, clamped to 60–120 (default 90) |
| `TREASURY_PRICE_MAX_AGE_MINUTES` | openfund | maximum Chainlink answer age before an asset is treated as unpriced (default 1500) |
| `LIVE_EXECUTION_ADAPTER` | openfund | `none` (default, every live order refused), `sandbox` (non-monetary, refused when `NODE_ENV=production`), `gains` (reserved; reports `adapter_unavailable`). See [Live Market Access](../economy/LIVE_MARKET_ACCESS.md). |
| `LIVE_SETTLEMENT_ADAPTER` | openfund | `none` (default, settlements stay `pending`) or `sandbox` (non-monetary, refused in production) |
| `FOOTPRINT_DATABASE_URL` | openfund | **secret.** Optional dedicated PostgreSQL for footprint market data (`footprint_minutes`, `footprint_gaps`). Unset = those self-contained tables live in the main database. `npm run migrate` applies `apps/backend/footprint/schema.sql` to whichever database is used. |

## Iran regional runtime on Liara (not a Render service)

The runtime apps `openfund-iran` (web) and `openfund-iran-worker` read the
backend variables listed in [LIARA_IRAN_RUNTIME.md](LIARA_IRAN_RUNTIME.md#environment),
with their own `DATABASE_URL` (never the Render database). Identifiers,
roles and GitHub environments: [`stack.json`](../../infra/liara-iran-runtime/stack.json),
checked by `npm run infra:check`.

Open Oracle there follows `MARKET_PRICE_SOURCE` like Render: both runtime apps
run the `market-data` role, so each runs its own pricing service and needs
outbound access to the Gains, Hyperliquid and GMX public APIs; a provider it
cannot reach drops out and the affected markets degrade to fewer sources,
labelled as such. `OPEN_ORACLE_UPSTREAM` (optional, runtime, public) is an
https origin of another Openfund region without a path: a process **without**
the `market-data` role follows that region's public `/api/oracle/stream` and
serves the same `/api/oracle/*` from its own origin. It is unset on Render.

## Iran edge on Liara (dormant; not a Render service)

The Liara edge reads only `OPENFUND_UPSTREAM_HOST` (Render origin host) and
`EDGE_PORT`; both are public and none of the Render variables above are copied
to it. GitHub needs `LIARA_API_TOKEN` (secret), `LIARA_APP_NAME`,
`LIARA_PUBLIC_URL` and `OPENFUND_UPSTREAM_HOST`. See
[Iran edge on Liara](LIARA_IRAN.md#configuration).

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
| `SIM_TEST_CLOCK` | apps/backend | unset; test mode only (`SIM_TEST_MODE=1` and a test database). An ISO instant that pins the conduct clock (daily close window, weekend and news rules) at start-up. Ignored otherwise; production always uses the real clock |
| `SIM_MAINT_PCT` | apps/backend engine | 10 (maintenance/liquidation level) |
| `PORTFOLIO_TZ` | apps/backend | `UTC` (PnL calendar policy) |
| `FOOTPRINT_HL_INFO_URL`, `FOOTPRINT_HL_WS_URL` | apps/backend | official `https://api.hyperliquid.xyz/info` and `wss://api.hyperliquid.xyz/ws`; overrides exist only for replay/isolated tests and are never set in production |

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

The web application pins `@luxalgo/vela@0.10.19`, `@luxalgo/vela-pinets@0.3.5` and `pinets@0.13.1`; esbuild is an explicit frontend build dependency. `prebuild` generates the workspace, hosted worker and readable licenses before Vite copies public assets. No new environment variable, secret, backend dependency or Render service is required. A restrictive CSP must permit the same-origin worker; no external Pine library service is used. See [Pine architecture](../trading/PINE_SCRIPT.md).

## Release tooling

The [release runbook](RELEASES.md) defines Actions production settings and public build parity. `RELEASE_VERSION` is allocated from immutable tags; `RELEASE_TEST_PORT` defaults to 8288 for isolated local gates. `RENDER_GIT_COMMIT` is supplied by Render. These are build/orchestration metadata, not new application services. `DATABASE_URL` has no fallback in release tooling. Do not enable `SIM_TEST_MODE` in deployed releases.

## Open Trade desktop (not a Render service)

`OPEN_TRADE_BACKEND` is the public HTTPS API origin; the requested beta target is
`https://openfi.cloud`. `OPEN_TRADE_WALLETCONNECT_PROJECT_ID` is the public connector
project ID, currently unconfirmed. Both are desktop build/launch settings and can
be changed in Settings. They are not backend secrets or Render variables. Electron,
React, Vite, WalletConnect and electron-builder are separately locked under
`apps/open-trade`. No new backend runtime dependency or service is added.

Open Trade 0.0.3: packaged builds accept only `https://openfi.cloud` and
`https://openfi.live` for `OPEN_TRADE_BACKEND`. `OPEN_TRADE_CHANNEL`
(`internal` default, `beta`, `stable`) selects unsigned or signed packaging.
Signing credentials and their names are listed in the
[owner setup](../releases/OPEN_TRADE_0.0.3_OWNER_SETUP.md); they are GitHub
environment secrets only, never Render variables.

## Certificate rendering dependency

The web application directly depends on `qrcode` 1.5.4 (MIT) to encode the
current site's localized certificate verification URL. Encoding and exports
run locally in the browser; no QR service receives holder data. The Persian
text uses the self-hosted Dastkhat font and the approved emblem is reused. PNG and landscape PDF
exports embed the same 2400 × 1600 canvas. No additional environment variable,
service, backend renderer or production credential is introduced.

## Trade Radar and Market Heatmap (runtime dependency, no new variables)

`apps/backend/radar.js` needs outbound HTTPS to `api.hyperliquid.xyz` and
`stats-data.hyperliquid.xyz` and a websocket to `wss://api.hyperliquid.xyz/ws`.
No environment variable, secret or Render service is added. The leaderboard
is condensed in a short-lived child process (`radar-board-worker.js`,
`--max-old-space-size=384`), so the starter-plan API process stays near
120 MB. Where Hyperliquid is unreachable (for example the Iran runtime) the
`/radar/*` endpoints answer 503 and the tabs show an outage state.
[Specification](../integrations/HYPERLIQUID_RADAR.md)

## Backstage operations service

| Variable | Value |
| --- | --- |
| `BACKSTAGE_REAL_SETTLEMENT` | Defaults to `false`. Set to `true` on the owner service only after settlement security acceptance. Enables submitting an already-completed transfer hash for backend verification. |
| `BACKSTAGE_ORIGIN` | Exact browser origin for Backstage. |
| `BACKSTAGE_BACKEND_ORIGIN` | Exact origin of the authoritative GLOBAL backend. |
| `RENDER_GIT_COMMIT` (Backstage) | Set by Render. Backstage reports it on `/health`, so the release deployment can verify that Backstage runs the released commit |
| `BACKSTAGE_IRAN_ORIGIN` | Blueprint value `https://openfi.live`. The System view reads the IRAN runtime's public `/runtime/status`, `/ready` and `/version` beside GLOBAL's. No credential, cookie or actor header is sent, and redirects are not followed ([ADR 0043](../decisions/0043-canonical-domains-geo-routing-and-locale.md)). |
| `BACKSTAGE_DIRECTUS_ORIGIN` | Exact origin of the existing Directus editor. |
| `BACKSTAGE_OWNER` | Break-glass owner identity, 2 to 50 ASCII characters, signing in with `BACKSTAGE_PASSWORD_VERIFIER`. Other people sign in as named operators (`npm --prefix apps/backend run operator`); once operators exist, create this name as an `owner` operator too. |
| `BACKSTAGE_PASSWORD_VERIFIER` | Secret salted scrypt verifier generated by the Backstage provisioning command. |
| `BACKSTAGE_BACKEND_TOKEN` | Server-held operator API bearer token for the selected backend. |

See the [Backstage operations guide](../backstage/OPERATIONS_GUIDE.md).
