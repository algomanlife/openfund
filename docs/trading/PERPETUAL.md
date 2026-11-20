# Perpetual Trading

Openfund Perpetual Trading provides the common Vela terminal and wallet-scoped Gains Network account review on **Arbitrum One (`42161`)**. Current integration is read-only. Wallet connection and SIWE do not enable order submission, approvals, collateral transfers or settlement.

## Current experience

Traders can discover Gains markets, open a chart, inspect wallet positions and pending orders, review historical events and provider statistics, and maintain a private product journal. The backend derives the wallet from the authenticated session; clients cannot substitute another account reference.

`apps/backend/gains-portfolio.js` reads official open-trade/trading-variable and personal-history/statistics endpoints. It decodes collateral units using metadata decimals, price fixed point at 1e10 and leverage at 1e3. Reads use bounded timeouts and a short cache (20 seconds for account reads, 60 seconds for metadata). Portfolio refresh is separate from the chart price stream.

## Read-only presentation

Every non-trading terminal page shows the product identity: **Openfund Prop — Simulated evaluation** or **Openfund Perpetual — Gains account view**. Perpetual pages show the source (Gains Network), the network (Arbitrum One · 42161), a read-only badge and the feed state (`live`, `stale`, `inconsistent`, `outdated`, `unavailable`) with the last fetch time. A snapshot kept after a failed refresh is labelled outdated. The trade workspace labels the account "Gains account view · read-only". Order submission, close, SL/TP and cancel controls are disabled; only Details and Share stay active. Wallet addresses render left-to-right in every locale.

## Data interpretation

Gains history/events are native provider records, not Prop simulated trades. Per-collateral values retain their own currency basis. Missing balances, accrued borrowing/funding, fee-adjusted unrealized PnL and unavailable analytics remain unknown. Upstream failure returns an explicit error (`gains_unavailable`, `gains_timeout`, `gains_schema_changed`), not a manufactured empty account. Unset TP/SL is unavailable, not zero. Pending orders carry their Gains order type (limit or stop). The [read model contract](../integrations/GAINS.md#read-model-contract) lists the source of every field. Aggregate Prop-only endpoints return `409 use_native_gains_records` for Perpetual.

Market prices, candle availability, open interest and metadata depend on upstream sources. Oracle prices cannot establish order-book depth, executed tape or footprint volume. The [Gains integration contract](../integrations/GAINS.md) records sources and freshness policy.

## Execution gate

The owner's intended product is Perpetual trading on Gains (Arbitrum One), with Gains as the authority for positions. It is **not implemented**; only the read-only view exists. The [execution RFC](../architecture/PERPETUAL_EXECUTION_RFC.md) defines the options, gaps and reviews required. The [readiness report](../reviews/gains-integration/READINESS.md) records the evidence and the verdict: the read-only integration is ready for review, and live trading is not authorized.

The full order lifecycle (review, pending, filled, rejected, unconfirmed, cancel, close, outage) is exercised only in an isolated test simulation (`e2e/test-perpetual-simulation.cjs`). Playwright injects it, and a SIMULATION banner shows in every document. The application has no flag or URL that enables it.

Perpetual execution is blocked pending an approved network/contract model, transaction simulation, fee/collateral validation, explicit wallet confirmation, receipt handling and indexed-state reconciliation. Gains documents an Arbitrum Sepolia testnet for its beta Trading API; Openfund has not verified or used it. Deterministic local fixtures are the test environment. The [eligibility and compliance gate](../integrations/GAINS.md#eligibility-and-compliance-gate) and the approval table in the [execution gate](../integrations/GAINS.md#execution-gate) list what a future live-execution review must close. Vendoring the Gains SDK is not an executed integration.

No Hyperliquid or dYdX adapter is implemented by this work. Their aggregation belongs to the [future Protocol product](../roadmap/PROTOCOL.md).

[Wallet and Identity](../wallet/IDENTITY.md) · [Portfolio and Journal](PORTFOLIO_JOURNAL.md) · [Feature Status](../product/FEATURE_STATUS.md)
