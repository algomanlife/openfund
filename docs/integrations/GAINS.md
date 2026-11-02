# Gains Network integration

Openfund uses Gains public interfaces for market data and wallet-scoped Arbitrum reads. The vendored `@gainsnetwork/sdk` source is preserved for inspection; it does not enable transaction execution. [Perpetual Trading](../trading/PERPETUAL.md) defines product scope.

## Market data

The maintained adapter is [gains-adapter.js](../../packages/openfund-gains-adapter/src/gains-adapter.js), mirrored in `dist/` for script loading. The backend separately consumes server-owned marks in [market-data.js](../../apps/backend/market-data.js).

| Interface | Use and limits |
| --- | --- |
| `https://api.gains.trade/v1/arbitrum/markets` | Symbols, groups, precision, leverage bounds, funding/open-interest metadata; market counts are dynamic |
| `/v1/arbitrum/prices` | Mark/index values and source timestamps; not executable bid/ask depth |
| `/v1/arbitrum/markets/{SYMBOL-DASHED}/candles` | OHLC candles for adapter-supported 1m, 5m, 15m, 30m, 1h, 4h and 1d; weekly bars are not assumed |
| `wss://api.gains.trade/v1/arbitrum/ws` | Prices subscription, ping/pong, reconnect and sequence-gap resubscription |

`createVelaProvider()` exposes the provider's bars, symbols, metadata and subscription contracts. Source timestamps and staleness are preserved. Open-interest/funding metadata can be displayed when available; depth, executed tape and footprint volume are not supplied by this oracle price feed. The separate current Trading API supplies [Gains VOB and executed trades](GAINS_DEPTH.md), now integrated into the shared panel. Never invent missing values.

## Wallet reads

[gains-portfolio.js](../../apps/backend/gains-portfolio.js) derives the wallet from SIWE, reads official Arbitrum open trades, trading variables and personal history/statistics, and normalizes fixed-point values with collateral metadata. [Product contracts](../architecture/PRODUCT_TERMINALS.md#verified-read-sources) list exact paths, cache policy and error behavior.

The backend returns explicit upstream errors and unsupported-value states. Gains events remain distinct from Prop simulation and Openfund journal metadata. Unavailable accrued fees, borrowing/funding and net unrealized PnL are not approximated.

## Execution gate

No order submission, token approval or collateral transfer is enabled. Future work must verify official network support, addresses/ABIs, collateral/fee policy, transaction simulation, user approval, receipts, reverts and indexed-state reconciliation. Testnet availability must be established separately; a wallet supporting a chain does not prove Gains contracts exist there.

Current repository integration is evidenced by source and historical read checks, with branch validation recorded in [delivery](../reviews/repository-transformation/DELIVERY.md). API availability and counts are not permanent guarantees. The [protocol roadmap](../roadmap/PROTOCOL.md) does not change this boundary.
