# Perpetual Trading

Openfund Perpetual Trading provides the common Vela terminal and wallet-scoped Gains Network account review on **Arbitrum One (`42161`)**. Current integration is read-only. Wallet connection and SIWE do not enable order submission, approvals, collateral transfers or settlement.

## Current experience

Traders can discover Gains markets, open a chart, inspect wallet positions and pending orders, review historical events and provider statistics, and maintain a private product journal. The backend derives the wallet from the authenticated session; clients cannot substitute another account reference.

`apps/backend/gains-portfolio.js` reads official open-trade/trading-variable and personal-history/statistics endpoints. It decodes collateral units using metadata decimals, price fixed point at 1e10 and leverage at 1e3. Reads use bounded timeouts and a short cache (20 seconds for account reads, 60 seconds for metadata). Portfolio refresh is separate from the chart price stream.

## Data interpretation

Gains history/events are native provider records, not Prop simulated trades. Per-collateral values retain their own currency basis. Missing balances, accrued borrowing/funding, fee-adjusted unrealized PnL and unavailable analytics remain unknown. Upstream failure returns an explicit error, not a manufactured empty account. Aggregate Prop-only endpoints return `409 use_native_gains_records` for Perpetual.

Market prices, candle availability, open interest and metadata depend on upstream sources. Oracle prices cannot establish order-book depth, executed tape or footprint volume. The [Gains integration contract](../integrations/GAINS.md) records sources and freshness policy.

## Execution gate

Perpetual execution is blocked pending an approved network/contract model, transaction simulation, fee/collateral validation, explicit wallet confirmation, receipt handling and indexed-state reconciliation. Supported testnet availability must be verified before claiming a testnet path. Vendoring the Gains SDK is not an executed integration.

No Hyperliquid or dYdX adapter is implemented by this work. Their aggregation belongs to the [future Protocol product](../roadmap/PROTOCOL.md).

[Wallet and Identity](../wallet/IDENTITY.md) · [Portfolio and Journal](PORTFOLIO_JOURNAL.md) · [Feature Status](../product/FEATURE_STATUS.md)
