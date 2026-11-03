# Feature status

Canonical capability register for the repository based on `main` **2f5cf93**, including [PR #23](https://github.com/algomanlife/openfund/pull/23) and [PR #24](https://github.com/algomanlife/openfund/pull/24). Reviewed 2026-11-02. This is an implementation assessment, not a production readiness or deployment certificate.

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
| Challenge account records and catalog selection | Completed | Existing backend/schema and catalog UI; records do not establish commercial execution |
| Paid activation, evaluation and challenge enforcement | Planned | Payment, legal/product facts, assignment and risk-rule engine required; free_demo has no assigned commercial challenge limits |
| Funded capital, withdrawals, rewards and certificates | Planned | Visible capability pages are unavailable states, not operational services |
| Perpetual on-chain execution | Blocked | Approved supported contracts, simulation, security review and receipt reconciliation required; execution disabled |
| Gains VOB and executed trades | In Progress | [Verified sources and restored panel](../integrations/GAINS_DEPTH.md); public reads, source validation, reconnect and reduced-motion handling; deployed acceptance pending |
| Footprint / centralized order matching | Blocked | Not supplied by the Gains VOB; no inferred oracle volume |
| Advanced analytics and execution workflows | Planned | [Engineering roadmap](../roadmap/ENGINEERING.md); scope and acceptance gates before implementation |
| Production transparency and verification | Planned | Current dashboard uses labelled synthetic fixtures; no production reserve/payout evidence |
| Render three-resource configuration | Completed | [Blueprint](../../render.yaml); openfund + openfund-db PostgreSQL 17 + openfund-cms Directus 11.9.1; same-origin `/react/` |
| CI and local validation tooling | Completed | [Workflow](../../.github/workflows/ci.yml); web, backend/Postgres, browser, Blueprint, secrets and advisory reports |
| Deployed Render acceptance and operational monitoring | In Progress | Configuration exists; authenticated validation, apply, deployed HTTPS sessions/CMS and recovery evidence are not established here |
| Openfund Protocol and venue routing | Planned | [Protocol roadmap](../roadmap/PROTOCOL.md); no routing engine or new protocol source imported |
| Additional integrations and developer services | Planned | [Product roadmap](../roadmap/PRODUCT.md); depends on validated product/execution contracts |

## Proprietary chart indicators

**In Progress:** Open Algo V5, Price Action Concepts and Smart Money Concepts execute original source through the shared worker; two local libraries resolve without external fetches. The ordered catalog, settings persistence, interval/symbol/menu repairs and permitted branding changes have local regression coverage. Genuine volume-dependent outputs, full optional-setting/reference conformance and deployed acceptance remain open. [Architecture](../trading/PINE_SCRIPT.md) · [Evidence](../reviews/vela-pine/DELIVERY.md).

## Evidence policy

Historical tests and findings remain in [reviews](../reviews/README.md); their results belong to their original commits and environments. The [repository transformation delivery](../reviews/repository-transformation/DELIVERY.md) records checks actually executed for this documentation branch, screenshot provenance and remaining limitations. No completion dates, adoption figures or commercial approvals are inferred from code presence.

[Capabilities](CAPABILITIES.md) · [Roadmap](../../ROADMAP.md) · [Documentation index](../README.md)

## Unified account and journal delivery

**In Progress:** [Unified account directory and permanent Free Trial lifecycle](../trading/UNIFIED_ACCOUNTS.md), [journal modules and definitions](../trading/JOURNAL_METRICS.md), backend preview, instrument precision validation and observed equity samples. Local verification and outstanding acceptance are recorded in [the delivery report](../reviews/unified-trading/DELIVERY.md). Challenge execution, real wallet/device acceptance and Render deployment remain separate gates. Existing virtual-DAI histories are preserved.

## Final integration and release recovery

**In Progress:** recovered shared terminal navigation, default account/detail Dashboard, EIP-6963 connection, route-network synchronization, scoped account adapter and Journal interactions. Main-only SemVer packaging, release diagnostics, immutable artifacts and approved exact-SHA deployment are implemented for verification. The verified local baseline is official v0.1.0 at `b2c5407`; deployed acceptance remains unconfigured. [Recovery and release evidence](../reviews/final-integration/DELIVERY.md).

## UI polish batch

**In Progress:** responsive connected-wallet disclosure, FA/EN product presentation
and route restrictions, external TradingView resource attribution, native terminal
and Vela light/dark synchronization. [Scope and acceptance](../reviews/ui-polish/DELIVERY.md).
Country eligibility and actual wallet-device acceptance remain separate.
