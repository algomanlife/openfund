# Feature status

2026-11-11 P0 SIWE production-domain correction (**source branch; not deployed**):
`POST /auth/verify` returned `400 invalid_domain` on both public domains while
the onrender host reached signature validation. The effective Render
`ALLOWED_DOMAINS` contained only the onrender host. The Blueprint now lists
all three serving hosts, and CI exercises signed SIWE, owned profile,
session restore, logout, wallet switching and domain rejection for both
production HTTPS origins against an isolated local server. Real wallet
acceptance on the deployed site remains **Blocked** until an approved deploy
and device/browser verification. WalletConnect mobile access is separately
unconfigured (`VITE_WALLETCONNECT_PROJECT_ID` absent); injected wallets are
not dependent on it.

2026-11-10 production-readiness branch (`codex/production-readiness`, **unmerged,
not deployed**): Arbitrum-only wallet/SIWE/checkout, DePay request/callback/event
signature verification, coupon engine with a zero-payment flow, an explicit
database-enforced order lifecycle, and the Economy › Governance / Ambassador (IB)
restructuring. Statuses below marked "(branch)" describe that branch only.
Production on 2026-11-10: `/version` commit `0c45594` (manifest 0.4.4,
`official: false`), `paymentsEnabled: false`, `PURCHASE_PAYMENT_CHAIN=11155111`,
no payment/DePay/admin secrets configured.

2026-11-10 reconciliation (read-only checks): production serves **v0.4.4**
(`c1cb707`) on `openfund.cloud` and `openfi.cloud` (`/version` matched on both),
and `paymentsEnabled` is `false`. Work merged to `main` after v0.4.4 (Economy,
Transparency and partner programs, extra locales, Whitepaper v1.0, terminal Chart
tab with Quick Trade, Hybrid Governance v1.0) is **unreleased and not deployed**;
open pull requests are not on `main`. The dated notes below are history. The
wallet sign-in `ALLOWED_DOMAINS` item below was not re-probed on 2026-11-10.

2026-11-08 v0.4.2 release batch: `main` contains PR #50 (Persian terminal
RTL/mobile), PR #51 (system-default theme) and PR #52 (Prop engine audit),
plus release-driven deployment ([ADR 0013](../decisions/0013-release-driven-production-deployment.md)).
Release automation is **Completed** in source scope; its first live run is
the v0.4.2 publication. Dual-domain serving (`openfi.cloud`,
`openfund.cloud`) is **Completed** for HTTPS and routing; wallet sign-in on
both custom domains is **Blocked** until `ALLOWED_DOMAINS` on the Render
service lists them (live probe returned `invalid_domain` on 2026-11-08).
Check the GitHub Release and `/version` for publication and deployment.

2026-11-08 theme preference update (PR #51, in the v0.4.2 batch): when no explicit
choice exists, the application initializes from the OS light/dark preference
and follows later OS changes. A manual toggle saves an explicit choice and
takes priority across routes and reloads. `of-theme` remains the resolved
legacy value; `of-theme-choice` records user intent. Browser-level Force Dark
Page overrides cannot be disabled by website code; the owner Opera profile
required a per-site exception for `openfi.cloud`. PR #50 is merged into
`main`, while the live immutable v0.4.1 is still `b8389ca`.

Historical v0.4.1 stabilization checkpoint (2026-11-07, before release): v0.4.0 is the published and
deployed version. Runtime CMS configuration, a complete local bootstrap and
public translation permission narrowing are merged source work. The iframe
theme-state repair remains **In Progress** after post-merge CI exposed a
product-switch timing race. A fresh Directus 11.9.1 database completed the
bootstrap twice without duplicate rows. Production CMS still returns 403 for
the `ui_messages` translation query; production migration, full CMS coverage,
passing post-merge CI and deployed browser acceptance remain **Blocked**. See
[v0.4.1 audit](../reviews/v0.4.1/AUDIT.md).

P0 audit correction: the earlier mutable 8080 preview lost its frontend manifest and was unversioned. Clean-context real clicks verify white light canvases, not the owner Opera profile (permission unavailable). Final candidate hashes, pipeline outcomes and canonical extracted-archive captures are tracked in [P0 evidence](../../docs/assets/screenshots/manifest.json). Historical captures and prior matched-runtime claims do not identify the final build. Official v0.2.0 and integrated base `d05b4b8` remain unchanged; owner acceptance is open.

Canonical capability register reconciled with integrated source `d05b4b88fc2776e09bf1a701254ac229e8145a7f`: PR #42 is merged but unreleased. Official v0.2.0 remains `561e7f3101f3a43376068d9bba1a87c30e2b7d71`, including PR #40/#41. The `qwen/community-theme-readme` addendum is locally captured and UNRELEASED; white-theme and bilingual local refinement acceptance is verified with exact white canvases and text contrast >=4.5; official/deployed acceptance remains open. [Current evidence](../reviews/community-theme/DELIVERY.md). Official local startup at port 8080 and deployed acceptance remain separate gates. The requested v0.2.1 is unallocated and needs coordination with the Conventional Commit minor-bump policy. This is not a production readiness certificate. [Historical audit](../reviews/website-refresh/AUDIT.md) · [Release boundaries](../deployment/RELEASES.md).

Statuses: **Completed** = implemented within the stated boundary with repository evidence; **In Progress** = partial delivery remains; **Planned** = future work; **Blocked** = explicit prerequisite prevents completion. Completed rows do not imply real-world wallet, network or deployment validation unless separately evidenced.

| Capability | Status | Evidence and practical limits |
| --- | --- | --- |
| React product shell and hash routes | Completed | [Router](../../apps/web-react/src/main.tsx); `/react/#/{locale}/…`; Persian/English and RTL retained |
| Home product gateway and market discovery | Completed | `features/home`, `features/markets`; Gains data with source/freshness handling; instrument counts vary |
| Compact terminal presentation | Completed | [Local acceptance](../reviews/terminal-ui/DELIVERY.md); both products/languages, 74px header, non-scrolling form at four desktop sizes; no production or execution change |
| Shared Vela terminal | Completed | [Product architecture](../architecture/PRODUCT_TERMINALS.md); one workspace, independent Prop/Perpetual adapters |
| Gains market-data adapter | Completed | [Integration](../integrations/GAINS.md); REST candles/metadata and WS marks; separate [VOB/Trades resources](../integrations/GAINS_DEPTH.md) are now connected |
| Prop virtual account and ledger | Completed | [Engine](../../apps/backend/engine.js), [schema](../../apps/backend/schema.sql); one free_demo account, new funding in 100,000 virtual USD, preserved legacy DAI history, idempotent funding |
| Prop order lifecycle and risk controls | Completed | Market/limit/stop, SL/TP, cancellation, partial close, liquidation; owner-scoped retries and transactional updates; simulation only |
| Shared Decimal valuation | Completed | [Math](../../apps/backend/trading-math.js); fees/spread and stale values; no Gains contract parity |
| Drawdown telemetry | Completed | [Portfolio](../../apps/backend/portfolio.js); observed fresh equity since first measurement, UTC; no reconstructed earlier peaks |
| SIWE and sessions | Completed | [Backend](../../apps/backend/server.js); nonce/domain/URI/time/chain/signature, hashed session IDs, suspension, logout and SSE revalidation |
| Product network policy | In Progress (branch) | [Wallet config](../../apps/web-react/src/wallet/config.ts); **Arbitrum One 42161 only** for every route and SIWE ([ADR 0022](../decisions/0022-arbitrum-checkout-coupons-order-lifecycle.md)); backend rejects other chains; unit- and backend-tested; production still serves Prop on Sepolia until deployed |
| Real extension, hardware and remote WalletConnect acceptance | In Progress | Generated EIP-1193 browser tests exist; actual wallet/device and live contract-wallet acceptance still need external evidence |
| Prop portfolio and reporting | Completed | Owned positions/order history, trade detail, fee-aware analytics, filters and CSV; partial-close slices preserve parent provenance |
| Gains wallet portfolio reads | Completed | [Read adapter](../../apps/backend/gains-portfolio.js); official Arbitrum positions/orders/history/stats; upstream failure is explicit; unsupported PnL/balance stays unknown |
| Product journal | Completed | [Product routes](../../apps/backend/products.js); private account/product notes, optimistic versions, search/tags, metadata JSON import/export |
| Published CMS content and catalog | Completed | [Coverage](../backstage/CONTENT_COVERAGE.md); Directus editorial content, translations, product sections and challenge_plans; not financial authority |
| Website sections (FAQ, Tools, Learning Center, Growth Partner) | Completed | [Spec](../website/WEBSITE_EXPANSION.md); 43-question searchable FAQ, 10 browser-side calculators, 5 learning paths / 25 lessons / 40 glossary terms, pre-launch Growth Partner page; Directus-managed with bundled fallback |
| Persian Bitpin price strip | Completed (local, unreleased) | `features/ticker`; Persian public pages only; read-only `api.bitpin.ir/api/v1/mkt/tickers/` (IRT = Toman per Bitpin's market list), browser fetch, no proxy; display only, not connected to Gains data or trading; commercial-use terms with Bitpin need owner confirmation |
| Persian Iran access notice | Completed (owner-approved display) | `features/notice`; Persian public pages; owner approved production display on 2026-11-11 before `iran.openfund.cloud` is connected (no DNS record at that time), so the route itself is not yet verified |
| Referral attribution (invite code and link) | Completed | [Backend](../../apps/backend/referrals.js); server-side, one-time at account creation, self-referral impossible; session-scoped summary; no commission or reward data exists |
| Referral rewards and partner agreement | Planned | Growth Partner invite codes still carry no reward; the separate Brand Ambassador program below is the only commission-bearing referral |
| Brand Ambassador program | Completed (local) | [Partner programs](../economy/PARTNER_PROGRAMS.md); reviewed applications with recorded audience evidence, codes only after approval, 10% first-purchase commission recognized in the payment transaction, idempotent, refund/chargeback reversals, recorded payouts, referral dashboard; commission transfers are performed by operators |
| Verified Trading Coach program | Completed (local) | Independent approval, trader linking and qualification, coach-scoped visibility, 10% of distributable realized live profit only |
| Economy › Governance and consolidated Ambassador (IB) page | In Progress (branch) | Economy menu: Governance, Ambassador (IB), Transparency, Revenue Model, Live Market Access; one `/{locale}/ambassador` page with independent Brand Ambassador and Verified Coach sections; `/coach` redirects; ar/ru/zh-CN strings added; navigation unit tests updated; real-browser mobile/RTL captures not refreshed in this branch |
| Live Market Access control plane | Completed (local, execution disabled) | [Live Market Access](../economy/LIVE_MARKET_ACCESS.md); record-based eligibility (10 + 5 paid withdrawals, exact 2× second account, verified coach), explicit-tier approval, verified-capital gate ≥ $500,000, collateral-based risk checks, circuit breaker, idempotent profit split and settlement with reconciliation; only non-monetary sandbox adapters exist |
| Live order execution on Gains and automatic payout transfers | Blocked | Approved signer/custody design, supported testnet contracts, simulation, security review and explicit management activation required |
| Challenge account records and catalog selection | Completed | Backend/schema and catalog UI; challenge accounts trade through the same server-authoritative engine (v0.3.1) |
| Profile editing (display name and avatar) | Completed | `PATCH /auth/profile` ([backend](../../apps/backend/server.js)); `ProfilePanel.tsx` editor with avatar upload (≤256 KB image data URL or https); wallet identity stays immutable — one wallet, one user |
| Payment correlation policy, dedicated RPC, DePay router compatibility, attempt recovery and operator investigation | Implemented (local, deterministic fixtures); awaiting real-network acceptance | [ADR 0018](../decisions/0018-payment-verification-and-recovery.md); [Verification](../payments/VERIFICATION.md); [Activation checklist](../payments/ACTIVATION.md); payments stay disabled in production until every gate passes |
| Challenge purchase, server-priced orders and on-chain payment verification | Completed (local) | [ADR 0009](../decisions/0009-challenge-purchases-and-payment-verification.md); [purchases module](../../apps/backend/purchases.js) — viem receipt/token/amount/timing checks server-side, exactly-once provisioning, idempotent orders, confirmation-depth finality policy and late-payment grace window; purchases stay disabled while `PURCHASE_PAYMENT_RECEIVER` is unset; live-chain verification and production payment activation pending an approved destination |
| DePay request, callback and event signature verification; multi-chain settlement | Completed (code on `main`, deployed in v0.4.4, disabled by configuration); live payment pending | [DePay](../payments/DEPAY.md); Arbitrum-only wallet sign-in, payments on every chain in `PURCHASE_PAYMENT_CHAINS` (EVM + Solana) verified on their own chain, orders correlated only by the signed order id, settlement vs DePay `sent_token` accounting; tested in-process with simulated chains ([commerce tests](../../apps/backend/test/commerce.test.mjs) M1–M6, D1–D6). **Blocked — owner configuration required**: settlement chains (receivers), RPCs; the DePay endpoint-URL mismatch found 2026-11-13 is fixed on branch `agent/claude/depay-checkout-activation` (not deployed). Procedure: [Owner setup](../payments/OWNER_SETUP.md) |
| Coupon administration in Directus, coupon engine and zero-payment purchases | Completed (local acceptance through the Directus 11.9.1 UI, 16/16, 2026-11-11); production CMS bootstrap pending | [Coupons](../payments/COUPONS.md); Commerce Admin role creates, edits, activates, revokes and audits coupons in Directus; backend validates and redeems under a row lock; internal 100% test coupons (≤2 customers, finite limit) excluded from revenue and commission; [acceptance test](../../e2e/test-directus-coupons.cjs). Run `register_commerce_tables.py` against production Directus to enable |
| Explicit purchase order lifecycle | In Progress (branch): implemented, live verification pending | [Order lifecycle](../payments/ORDER_LIFECYCLE.md); database-validated transitions, append-only `purchase_order_events`, immutable pricing snapshot, refund states |
| Per-wallet chart workspaces (drawings, indicators, timeframe, settings) | Completed (local; branch, not deployed) | [Chart workspaces](../trading/CHART_WORKSPACES.md), [ADR 0023](../decisions/0023-per-wallet-chart-workspaces.md); PostgreSQL suite W1–W6 and browser journey wallet A → B → A on a fresh browser context |
| Live position risk/reward chart overlay (SL only, TP only, both; LONG/SHORT) | Completed (local; branch, not deployed) | [Chart workspaces](../trading/CHART_WORKSPACES.md#live-position-riskreward-overlay); browser journey `e2e/test-terminal-risk-workspace.cjs` |
| BUY/SELL markers on confirmed Prop fills and entry-anchored SL/TP zones | Completed (local; branch, not deployed) | [ADR 0025](../decisions/0025-prop-leverage-sizing-and-economic-calendar.md); `test/terminal-risk.test.mjs` (fill mapping per timeframe, grouping, zone span); browser journey `e2e/test-terminal-risk-workspace.cjs` |
| Compact BUY/SELL markers, fixed-entry position box with SL/TP-only drag, right-hand position labels, Chart Settings → Trading marker toggle | Completed (local; branch `agent/claude/depay-checkout-chart-ux`, not deployed) | [ADR 0026](../decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md); Openfund drawing types `of-position` / `of-exec-buy` / `of-exec-sell`; edits through the existing `modifyRisk` service; per-wallet setting in the chart workspace; `test/terminal-risk.test.mjs`, `e2e/test-terminal-risk-workspace.cjs` 74/74 |
| Prop-only maximum leverage (BTC/ETH 20×, other crypto 15×, forex/stocks/indices/commodities 50×) | Completed (local; branch, not deployed) | [ADR 0025](../decisions/0025-prop-leverage-sizing-and-economic-calendar.md); engine preview/submit enforcement (`test/prop-leverage.test.mjs`, `test/unified.test.mjs`); Perpetual unchanged |
| Prop position sizing by collateral or quantity | Completed (local; branch, not deployed) | Resolves to the engine's canonical collateral; exact decimal conversions (`test/position-sizing.test.mjs`) |
| Prop position sizing by lots | Blocked — no approved contract specification (contract size, lot min/max/step) exists for any instrument | Conversion code and tests ready; enable per instrument in `APPROVED_LOT_SPECS` after owner approval |
| Terminal "News & Information" tab (TradingView Economic Calendar widget) | Completed (local; branch, not deployed) | Official web component and attribution; CSP allows `widgets.tradingview-widget.com` (script) and `www.tradingview-widget.com` (frame) on application documents; widget content not yet verified in a standard desktop browser |
| Hybrid footprint chart (Gains candles + Hyperliquid order flow; chart style and overlay) | In Progress (merged in PR #90; the owner requested activation on 2026-11-12 and the Blueprint now sets `FOOTPRINT_ENABLED=1`; deployed acceptance is pending the approved Render deployment and is recorded in the activation pull request; history starts when the service first runs). **Blocked for historical backfill**: importer prepared and tested (`apps/backend/footprint/archive.js`); a first run needs owner AWS access to the requester-pays S3 archive | [Footprint](../integrations/FOOTPRINT.md), [ADR 0024](../decisions/0024-hybrid-footprint-chart.md); core, service, browser (`e2e/test-footprint.cjs`) and position-suite-under-footprint (`RISK_TEST_FOOTPRINT=1`) tests; load matrix 100–1,500 chart users + 2,000 visitors on one local process |
| Seasonal header logos (Yalda, Christmas) | Completed (local; branch, not deployed) — designs approved by the owner 2026-11-11 | `apps/web-react/src/brand/seasonalLogo.ts`: Yalda 28 Azar–end of 1 Dey (Asia/Tehran, Jalali via Intl), Christmas 25–31 Dec (visitor's local date); header/navigation logo only, master mark unchanged; sources in `brand/logos/seasonal/`; `test/seasonal-logo.test.mjs` |
| DePay checkout widget and dedicated checkout page | Completed (local; branch `agent/claude/depay-checkout-chart-ux`, not merged or deployed); real payment pending owner configuration | [ADR 0026](../decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md); `/:locale/checkout` (`CheckoutPage.tsx`) opens the official vendored `@depay/widgets` bundle via `DePayWidgets.Payment({ integration, payload: { orderId } })` without restricting networks or tokens; receipt endpoint; interrupted-purchase resume; `e2e/test-depay-checkout.cjs` 40/40, commerce K1–K3; the real widget mounts under the production CSP, DePay's configuration API answered 403 from localhost (owner domain/endpoint settings) |
| Purchase history, payment history and invoices | Completed (local) | `GET /purchases/history`, `GET /invoices/:id` (dependency-free PDF, [invoice-pdf.js](../../apps/backend/invoice-pdf.js)), Prop route `#/{locale}/prop/purchases`; browser E2E [purchase flow](../../e2e/test-purchase-flow.cjs) |
| Withdrawal requests and operator review | Completed (local) | `withdrawal_requests` + `GET/POST /withdrawals`; Prop route `#/{locale}/prop/withdrawals`; v0.3.1 adds the `/admin/withdrawals` review workflow (approve/reject/paid with payout reference, invalid-transition rejection, duplicate prevention, audit log) behind `ADMIN_API_TOKEN` — disabled while unset. Payout EXECUTION (real fund transfers) remains out of scope by design |
| Paid challenge evaluation and rule enforcement | Completed (v0.3.1, local) | [Evaluation engine](../../apps/backend/evaluation.js) enforces the published Rulebook rules of record on every challenge account: closed-net-profit targets, daily loss vs max(opening balance, opening equity) at the 00:00 UTC+3 boundary, static and trailing (breakeven-locked) maximum loss, minimum trading days, time-limit expiry; breach settlement closes positions at the server mark, cancels pending orders and records immutable `challenge_events`; two-phase stage-1 pass auto-provisions stage 2; rules snapshot frozen at purchase. A pass also requires the post-settlement closed profit to meet the target; trading days count fill days ([engine audit](../audits/PROP_ENGINE_AUDIT.md), 2026-11-08: five defects fixed, trailing-lock intent open). 48-check lifecycle suite + 31-check engine suite + full lifecycle browser E2E |
| Challenge trading through the terminal | Completed (v0.3.1, local) | Challenge accounts trade through the same server-authoritative engine with ownership checks and the plan leverage cap (5×); dashboard evaluation panel; account selector carries one id across journal/evaluation/trading scopes |
| Terminal dark/light theme synchronization | Completed (v0.3.1) | Root cause fixed (srcDoc `location.origin` is "null" so the shell's theme messages were rejected); 37-scenario browser regression across both products/locales, reloads and native auto-dark |
| Funded capital, payout processing, rewards and certificates | Planned | Withdrawal requests + review exist; funded-stage provisioning, payout settlement, rewards and certificates remain unavailable states |
| Perpetual on-chain execution | Blocked | Approved supported contracts, simulation, security review and receipt reconciliation required; execution disabled |
| Gains VOB and executed trades | In Progress | [Verified sources and restored panel](../integrations/GAINS_DEPTH.md); public reads, source validation, reconnect and reduced-motion handling; deployed acceptance pending |
| Footprint / centralized order matching | Blocked | Not supplied by the Gains VOB; no inferred oracle volume |
| Advanced analytics and execution workflows | Planned | [Engineering roadmap](../roadmap/ENGINEERING.md); scope and acceptance gates before implementation |
| Economy transparency report | Completed (local) | [Economy](../economy/README.md); `/economy/transparency` aggregates confirmed sales, refunds, challenge outcomes, payouts, verified expenses and financial position from operational records; synthetic fixtures removed |
| Official Whitepaper v1.0 page | Completed (local, unreleased) | [Specification](../website/WHITEPAPER.md); `/{locale}/whitepaper` single page, 20 bilingual chapters, data-driven diagrams and charts, catalog-derived pricing, activated footer document link; Directus collections, permissions and an idempotent seed are implemented and validated offline but not yet applied to the production CMS, which therefore renders the repository edition |
| Manual payment next to DePay (one order, server on-chain verification, EVM sender / Solana memo binding, Verification Pending state) | Completed (local; branch `agent/claude/checkout-campaign-chart-trading`, not deployed); real payment pending the owner | [Manual payment](../payments/MANUAL_PAYMENT.md), [ADR 0028](../decisions/0028-manual-payment-treasury-networks-campaign-chart-english-lotage.md); `test/manual-payments.test.mjs` 14/14 with simulated chain data; local browser probe of both locales |
| Openfund Treasury wallets by network on the transparency page | Completed (local; branch `agent/claude/checkout-campaign-chart-trading`, not deployed) | `GET /economy/treasury/networks`; `test/treasury-networks.test.mjs`; live local read of all seven configured networks through public RPCs (production uses `PURCHASE_RPC_URLS`) |
| Sales-campaign landing `/fa/campaign`, `/en/campaign` | Completed (local; branch `agent/claude/checkout-campaign-chart-trading`, not deployed) | [Campaign](../website/CAMPAIGN.md); `test/campaign-cta.test.mjs`; RTL/LTR, 1440/820/390 px, SEO and CTA checks in a local browser probe |
| Vela chart UI English-only and LTR in every locale | Completed (local; branch `agent/claude/checkout-campaign-chart-trading`, not deployed) | [Vela](../integrations/VELA.md#chart-ui-language-english-only-ltr-always); no Persian text found in the chart layer of the fa terminal (browser probe); `test/terminal-risk.test.mjs` |
| SL/TP created on the chart for positions without them | Completed (local; branch `agent/claude/checkout-campaign-chart-trading`, not deployed) | [Terminal](../trading/TERMINAL.md#creating-sltp-on-the-chart); `e2e/test-terminal-risk-workspace.cjs` 86/86 (LONG and SHORT: TP only, refused wrong side, SL, both) |
| Lotage sizing (USD-quoted forex, XAU, XAG, WTI conventions) | Completed (local; branch `agent/claude/checkout-campaign-chart-trading`, not deployed); conventions need owner approval | [Lotage](../trading/LOTAGE.md); `test/position-sizing.test.mjs` |
| Landing CTAs "Buy Challenge" (Home Prop card, connected-wallet card) | Completed (local; branch `agent/claude/checkout-campaign-chart-trading`, not deployed) | Both open `/:locale/checkout` client-side without a new connection or signature (browser probe) |
| Openfund Treasury balance and allocatable capital | In Progress | [Treasury](../economy/TREASURY.md); scheduled on-chain snapshots with Chainlink pricing and stale fallback are implemented and tested; the public treasury address, assets/feeds and reserves await management configuration, so capital reports `Unknown` |
| Render three-resource configuration | Completed | [Blueprint](../../render.yaml); openfund + openfund-db PostgreSQL 17 + openfund-cms Directus 11.9.1; same-origin `/react/` |
| CI and local validation tooling | Completed | [Workflow](../../.github/workflows/ci.yml); web, backend/Postgres, browser, Blueprint, secrets and advisory reports |
| Deployed Render acceptance and operational monitoring | In Progress | Configuration exists; authenticated validation, apply, deployed HTTPS sessions/CMS and recovery evidence are not established here |
| Dormant Openfund Protocol source foundation | Completed within source scope | `packages/openfund-protocol/` Solidity source, provenance and compile/test foundation integrated; not an active venue |
| Operational Protocol venue routing | Planned | [Protocol roadmap](../roadmap/PROTOCOL.md); no active quote aggregation, routing or execution |
| Additional integrations and developer services | Planned | [Product roadmap](../roadmap/PRODUCT.md); depends on validated product/execution contracts |

## Hybrid Governance v1.0

Branch `feat/hybrid-governance-v1`, unmerged and unreleased. Evidence is local
automated tests against an isolated PostgreSQL database and a local browser check
of the Governance page. **Nothing is in production use.** Authoritative policy:
[GOVERNANCE.md](../../GOVERNANCE.md); documentation: [docs/governance](../governance/README.md);
decision: [ADR 0017](../decisions/0017-hybrid-governance.md).

| Capability | Status | Scope and evidence |
| --- | --- | --- |
| Governance policy and economic boundary documents | Completed (documentation) | `GOVERNANCE.md`, `ECONOMY.md`, `docs/governance/`; open decisions listed in GOVERNANCE.md section 18 |
| Backend rules, schema, service and RBAC | Completed (local) | 10 seats, OFP lifecycle, quorum 7, approval 6 of 10 (7 for amendments), recusal, append-only evidence and hash-chained audit; automated tests, no production data |
| Financial isolation | Completed (local) | Static and runtime tests: no financial table access, no financial endpoint, financial-shaped fields rejected |
| Signed vote evidence | Completed (local) | Domain-separated, single-use EOA signatures; contract wallets unsupported; optional |
| Election architecture | Completed (local), **not active** | Gated on management approving the rules; no election scheduled |
| Public Governance page, proposal pages, council workspace | Completed (local) | `/:locale/governance`; renders real empty states; Persian RTL, English, dark and light checked locally; the authorised vote flow is covered by service tests and component rendering tests, not by a wallet-signed browser run |
| Directus editorial content | In Progress | Collections added to `apply_schema.py`; not applied to a live Directus instance in this work |
| Council seated and populated | Planned | Requires management appointments and eligibility verification; none exist |
| Ambassador, Coach and Funded Trader registries feeding eligibility | Blocked | No approved registry on this base; eligibility is a management-verified record |
| Whitepaper governance chapter | In Progress | Bilingual chapter prepared; the Whitepaper app is on the unmerged `feat/openfund-whitepaper-v1`, whose existing governance chapter must be replaced when it merges |
| On-chain or token governance | Not planned | Not a capability and not a commitment |

## Proprietary chart indicators

**In Progress:** Open Algo V5, Price Action Concepts and Smart Money Concepts execute original source through the shared worker; two local libraries resolve without external fetches. The ordered catalog, settings persistence, interval/symbol/menu repairs and permitted branding changes have local regression coverage. Genuine volume-dependent outputs, full optional-setting/reference conformance and deployed acceptance remain open. [Architecture](../trading/PINE_SCRIPT.md) · [Evidence](../reviews/vela-pine/DELIVERY.md).

## Evidence policy

Historical tests and findings remain in [reviews](../reviews/README.md); their results belong to their original commits and environments. The [repository transformation delivery](../reviews/repository-transformation/DELIVERY.md) records checks actually executed for this documentation branch, screenshot provenance and remaining limitations. No completion dates, adoption figures or commercial approvals are inferred from code presence.

[Capabilities](CAPABILITIES.md) · [Roadmap](../../ROADMAP.md) · [Documentation index](../README.md)

## Unified account and journal delivery

**In Progress:** [Unified account directory and permanent Free Trial lifecycle](../trading/UNIFIED_ACCOUNTS.md), [journal modules and definitions](../trading/JOURNAL_METRICS.md), backend preview, instrument precision validation and observed equity samples. Local verification and outstanding acceptance are recorded in [the delivery report](../reviews/unified-trading/DELIVERY.md). Challenge execution, real wallet/device acceptance and Render deployment remain separate gates. Existing virtual-DAI histories are preserved.

## Final integration and release recovery

**In Progress:** recovered shared terminal navigation, default account/detail Dashboard, EIP-6963 connection, route-network synchronization, scoped account adapter and Journal interactions. Main-only SemVer packaging, release diagnostics, immutable artifacts and approved exact-SHA deployment are implemented for verification. Official v0.2.0 publication and manifest source `561e7f3` are verified through GitHub; this does not verify current downloaded-archive startup at port 8080. Deployed acceptance remains unconfigured. [Recovery and release evidence](../reviews/final-integration/DELIVERY.md).

## UI polish batch

**In Progress:** responsive connected-wallet disclosure, FA/EN product presentation
and route restrictions, external TradingView resource attribution, native terminal
and Vela light/dark synchronization. [Scope and acceptance](../reviews/ui-polish/DELIVERY.md).
Country eligibility and actual wallet-device acceptance remain separate.

## Persian gateway motion

**In Progress:** landing-only SVG terminal illustration, pointer-reactive background,
compact proposed Perpetual concepts and Made by Humans badge. Existing CMS and
English Prop entry remain authoritative. Review,
product claims and unified-release acceptance remain open. [Implementation and
local checks](../reviews/landing-motion/DELIVERY.md).

## Public website launch content

Branch `codex/website-launch-content`, unmerged and unreleased. Local
verification only; Directus-backed text reaches production after an approved
seed refresh. Authority: [Content architecture](../website/CONTENT_ARCHITECTURE.md),
[Product rules](PRODUCT_RULES.md).

| Capability | Status | Scope and evidence |
| --- | --- | --- |
| Hosting, development and placeholder copy removed | Completed (local) | Office-location legal document, hosting notes, provider footer credit, sample/illustrative product notes, placeholder documents and app badges removed; stale Directus rows are suppressed by code guards |
| Public Team section removed | Completed (local) | Markup, dialog, navigation, footer seed and section routing; old links land on Challenges |
| A-Book / B-Book labels and routing disclosure | Completed (local) | Exact labels in all five locales; copy states that orders are not routed to live markets in this release |
| Protocol research labelling | Completed (local) | The four protocol directions are labelled as not active in this release |
| Product-rules consistency check | Completed (local) | `check:product-rules`: catalog, backend mirror and engine snapshot agree; the backend mirror was missing the 35% consistency value for Standard and One-phase |
| Advertised rules enforced by the backend | Blocked | `PLAN-DAILY-LOSS-VARIANT`, `PLAN-PAYOUT-CONDITIONS`, `PLAN-FEE-REFUND`; see [Product rules](PRODUCT_RULES.md) |
| Sitemap, robots and hreflang | Completed (local) | `/sitemap.xml`, `/robots.txt` per serving domain; all public routes indexable with five-locale alternates; product routes noindex |
| Five-locale content validation | Completed (local) | `test:content` in CI |
| Legal review of binding policies | Requires approval | Disclaimers, refund, payout and prohibited-practice policies need legal review before launch |

## Website and distribution refresh

| Capability | Status | Evidence and limits |
| --- | --- | --- |
| Bilingual public footer and Telegram presentation (PR #42) | Completed within merged source scope; unreleased | Integrated at `d05b4b8`, excluded from official v0.2.0; historical candidate evidence does not verify the new addendum; owner-verified destination missing |
| Shared Telegram/Discord public controls | Completed (local, unreleased) | Instagram promotion button retired from the public website (`codex/website-launch-content`); Telegram and Discord remain and show a link only when an owner-verified URL is configured. Production runtime configuration has no verified URLs, so both show the unavailable state |
| Native white light-theme and service-logo corrections | Completed within local refinement scope; UNRELEASED | Exact white public/terminal/Vela/account canvases, text contrast >=4.5, five native service vectors and generated-session profile/purchase/portfolio/journal evidence; preserved dark-green theme; official review/deployment separate; [captures and gates](../reviews/community-theme/DELIVERY.md) |
| Five platform availability presentation | Retired (local, unreleased) | Download badges removed from the Challenges page: no installer or store listing exists. Desktop and mobile applications remain Planned below |
| Desktop packaging | Planned | Unified release tar.gz packages web/API source and assets; it is not an OS installer |
| Mobile applications | Planned | No published listing or mobile application delivery verified |
| Official unified packaging | Completed within GitHub publication scope | v0.2.0 manifest/tag at `561e7f3`; PR #42 and current addendum excluded; requested v0.2.1 unallocated and requires coordination with the existing `feat:` minor-bump policy; local/deployed acceptance separate |
| Production deployment / payment acceptance | Blocked | No configured live Render; approved receiver, real-chain acceptance and optional widget acceptance remain required |

## Terminal sharing, real-time stability and added locales

Branch `claude/terminal-share-i18n-fixes`, unmerged and unreleased. Evidence
is local verification against an isolated backend and disposable database.

| Capability | Status | Scope and evidence |
| --- | --- | --- |
| Share P&L card | Completed (local) | Open and closed positions; PNG export and Web Share where the browser supports files; live refresh observed while open |
| Real-time feed stability | Completed (local) | Socket watchdog, reconnect, stale marking, row patching; unit tests in `test:depth`; Gains VOB only, no synthesized depth |
| Persian gateway mobile layout | Completed (local) | `/fa/home` at 320–414px without horizontal overflow; landing e2e updated for phones |
| Arabic, Russian, Simplified Chinese — interface and content | Completed (local verification) | Every public and product route renders in `ar` (RTL), `ru` and `zh-CN` (LTR): interface, seeds and the public Directus content via reviewed dictionaries (`src/i18n/content`), Directus `ar`/`ru`/`zh-CN` rows override them when editors add them. Untranslated text is reported, shown with a notice and fails `test:i18n` / the locale matrix. Translations are machine-assisted and not yet reviewed by native legal/financial translators; deployed acceptance pending |
| Language does not gate products | Completed (local verification) | Home shows the two-product gateway and Perpetual routes open in every locale; Prop/Perpetual data isolation unchanged |
| Explicit wallet choice and classified wallet errors | Completed (local verification) | EIP-6963 picker, neutral declined-request status, actionable failures, explicit network switch and disconnect; verified with scripted EIP-1193 providers only — real extensions, mobile WalletConnect and the deployed site are not yet accepted |
| Position Details layout | Completed (local) | Full labels in all five locales, LTR-isolated identifiers and numbers |


## Open Trade desktop — 2026-11-13

**In Progress (unmerged):** secure Electron host, chart-first bilingual workspace,
existing Vela/Gains integration and shared account API client. See the
[acceptance record](../../apps/open-trade/ACCEPTANCE.md) for executed checks and
platform artifacts. Real WalletConnect acceptance is pending a valid project ID
and wallet. Public release/signing and existing license decisions remain Blocked.
