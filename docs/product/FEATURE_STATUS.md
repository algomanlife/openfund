# Feature status

v0.4.1 stabilization checkpoint (2026-11-07): v0.4.0 is the published and
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
| Product network policy | Completed | [Wallet config](../../apps/web-react/src/wallet/config.ts); Prop Sepolia 11155111, Perpetual Arbitrum One 42161; no transactions |
| Real extension, hardware and remote WalletConnect acceptance | In Progress | Generated EIP-1193 browser tests exist; actual wallet/device and live contract-wallet acceptance still need external evidence |
| Prop portfolio and reporting | Completed | Owned positions/order history, trade detail, fee-aware analytics, filters and CSV; partial-close slices preserve parent provenance |
| Gains wallet portfolio reads | Completed | [Read adapter](../../apps/backend/gains-portfolio.js); official Arbitrum positions/orders/history/stats; upstream failure is explicit; unsupported PnL/balance stays unknown |
| Product journal | Completed | [Product routes](../../apps/backend/products.js); private account/product notes, optimistic versions, search/tags, metadata JSON import/export |
| Published CMS content and catalog | Completed | [Coverage](../backstage/CONTENT_COVERAGE.md); Directus editorial content, translations, product sections and challenge_plans; not financial authority |
| Website sections (FAQ, Tools, Learning Center, Growth Partner) | Completed | [Spec](../website/WEBSITE_EXPANSION.md); 43-question searchable FAQ, 10 browser-side calculators, 5 learning paths / 25 lessons / 40 glossary terms, pre-launch Growth Partner page; Directus-managed with bundled fallback |
| Referral attribution (invite code and link) | Completed | [Backend](../../apps/backend/referrals.js); server-side, one-time at account creation, self-referral impossible; session-scoped summary; no commission or reward data exists |
| Referral rewards and partner agreement | Planned | Reward model, qualifying event, attribution window, settlement method and caps are undecided; nothing in the code or copy presents them as active |
| Challenge account records and catalog selection | Completed | Backend/schema and catalog UI; challenge accounts trade through the same server-authoritative engine (v0.3.1) |
| Profile editing (display name and avatar) | Completed | `PATCH /auth/profile` ([backend](../../apps/backend/server.js)); `ProfilePanel.tsx` editor with avatar upload (≤256 KB image data URL or https); wallet identity stays immutable — one wallet, one user |
| Challenge purchase, server-priced orders and on-chain payment verification | Completed (local) | [ADR 0009](../decisions/0009-challenge-purchases-and-payment-verification.md); [purchases module](../../apps/backend/purchases.js) — viem receipt/token/amount/timing checks server-side, exactly-once provisioning, idempotent orders, confirmation-depth finality policy and late-payment grace window; purchases stay disabled while `PURCHASE_PAYMENT_RECEIVER` is unset; live-chain verification and production payment activation pending an approved destination |
| DePay checkout widget | Completed (local, gated) | `CheckoutPanel.tsx` loads the widget only with `VITE_DEPAY_WIDGET=1` plus `VITE_DEPAY_WIDGET_URL`, built from backend order data; manual payment instructions + transaction-hash verification remain the default; no widget bundle ships enabled |
| Purchase history, payment history and invoices | Completed (local) | `GET /purchases/history`, `GET /invoices/:id` (dependency-free PDF, [invoice-pdf.js](../../apps/backend/invoice-pdf.js)), Prop route `#/{locale}/prop/purchases`; browser E2E [purchase flow](../../e2e/test-purchase-flow.cjs) |
| Withdrawal requests and operator review | Completed (local) | `withdrawal_requests` + `GET/POST /withdrawals`; Prop route `#/{locale}/prop/withdrawals`; v0.3.1 adds the `/admin/withdrawals` review workflow (approve/reject/paid with payout reference, invalid-transition rejection, duplicate prevention, audit log) behind `ADMIN_API_TOKEN` — disabled while unset. Payout EXECUTION (real fund transfers) remains out of scope by design |
| Paid challenge evaluation and rule enforcement | Completed (v0.3.1, local) | [Evaluation engine](../../apps/backend/evaluation.js) enforces the published Rulebook rules of record on every challenge account: closed-net-profit targets, daily loss vs max(opening balance, opening equity) at the 00:00 UTC+3 boundary, static and trailing (breakeven-locked) maximum loss, minimum trading days, time-limit expiry; breach settlement closes positions at the server mark, cancels pending orders and records immutable `challenge_events`; two-phase stage-1 pass auto-provisions stage 2; rules snapshot frozen at purchase. 48-check unit suite + full lifecycle browser E2E |
| Challenge trading through the terminal | Completed (v0.3.1, local) | Challenge accounts trade through the same server-authoritative engine with ownership checks and the plan leverage cap (5×); dashboard evaluation panel; account selector carries one id across journal/evaluation/trading scopes |
| Terminal dark/light theme synchronization | Completed (v0.3.1) | Root cause fixed (srcDoc `location.origin` is "null" so the shell's theme messages were rejected); 37-scenario browser regression across both products/locales, reloads and native auto-dark |
| Funded capital, payout processing, rewards and certificates | Planned | Withdrawal requests + review exist; funded-stage provisioning, payout settlement, rewards and certificates remain unavailable states |
| Perpetual on-chain execution | Blocked | Approved supported contracts, simulation, security review and receipt reconciliation required; execution disabled |
| Gains VOB and executed trades | In Progress | [Verified sources and restored panel](../integrations/GAINS_DEPTH.md); public reads, source validation, reconnect and reduced-motion handling; deployed acceptance pending |
| Footprint / centralized order matching | Blocked | Not supplied by the Gains VOB; no inferred oracle volume |
| Advanced analytics and execution workflows | Planned | [Engineering roadmap](../roadmap/ENGINEERING.md); scope and acceptance gates before implementation |
| Production transparency and verification | Planned | Current dashboard uses labelled synthetic fixtures; no production reserve/payout evidence |
| Render three-resource configuration | Completed | [Blueprint](../../render.yaml); openfund + openfund-db PostgreSQL 17 + openfund-cms Directus 11.9.1; same-origin `/react/` |
| CI and local validation tooling | Completed | [Workflow](../../.github/workflows/ci.yml); web, backend/Postgres, browser, Blueprint, secrets and advisory reports |
| Deployed Render acceptance and operational monitoring | In Progress | Configuration exists; authenticated validation, apply, deployed HTTPS sessions/CMS and recovery evidence are not established here |
| Dormant Openfund Protocol source foundation | Completed within source scope | `packages/openfund-protocol/` Solidity source, provenance and compile/test foundation integrated; not an active venue |
| Operational Protocol venue routing | Planned | [Protocol roadmap](../roadmap/PROTOCOL.md); no active quote aggregation, routing or execution |
| Additional integrations and developer services | Planned | [Product roadmap](../roadmap/PRODUCT.md); depends on validated product/execution contracts |

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

## Website and distribution refresh

| Capability | Status | Evidence and limits |
| --- | --- | --- |
| Bilingual public footer and Telegram presentation (PR #42) | Completed within merged source scope; unreleased | Integrated at `d05b4b8`, excluded from official v0.2.0; historical candidate evidence does not verify the new addendum; owner-verified destination missing |
| Shared Telegram/Discord/Instagram public controls | Completed within locally verified source scope; UNRELEASED | Three coordinated public controls; Persian Home Hero only, English Home and other public Heroes/Footers retained; captured in both locales/themes and desktop/mobile; unavailable URLs do not navigate; owner activation remains Blocked; [evidence](../reviews/community-theme/DELIVERY.md) |
| Native white light-theme and service-logo corrections | Completed within local refinement scope; UNRELEASED | Exact white public/terminal/Vela/account canvases, text contrast >=4.5, five native service vectors and generated-session profile/purchase/portfolio/journal evidence; preserved dark-green theme; official review/deployment separate; [captures and gates](../reviews/community-theme/DELIVERY.md) |
| Five platform availability presentation | Completed (candidate) | Windows, macOS, Linux, App Store/iOS, Google Play/Android; all Coming Soon because no installer/store listing is verified |
| Desktop packaging | Planned | Unified release tar.gz packages web/API source and assets; it is not an OS installer |
| Mobile applications | Planned | No published listing or mobile application delivery verified |
| Official unified packaging | Completed within GitHub publication scope | v0.2.0 manifest/tag at `561e7f3`; PR #42 and current addendum excluded; requested v0.2.1 unallocated and requires coordination with the existing `feat:` minor-bump policy; local/deployed acceptance separate |
| Production deployment / payment acceptance | Blocked | No configured live Render; approved receiver, real-chain acceptance and optional widget acceptance remain required |
