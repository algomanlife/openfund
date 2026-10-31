# Gains Network integration specification

**Status: Market-data integration Implemented / on-chain SDK Unverified** (branch `qwen/frontend-polish-vela-gains`).

The terminal consumes the **public Gains Network market-data API** (no SDK, no keys). Verified endpoints (2026-10-31, Arbitrum):

| Endpoint | Result |
| --- | --- |
| `GET https://api.gains.trade/v1/arbitrum/markets` | 488 markets with group, precision, min/max leverage, spread, funding & fee metadata |
| `GET /v1/arbitrum/prices` | `{market, mark, index, updatedAt}` — 335 symbols |
| `GET /v1/arbitrum/markets/{SYMBOL-DASHED}/candles?interval=1m\|5m\|15m\|30m\|1h\|4h\|1d&from={ms}&to={ms}` | OHLC strings, epoch-ms open times; **1w not supported (verified empty)** |
| `WS wss://api.gains.trade/v1/arbitrum/ws` — `{action:"subscribe",channel:"prices"}` | live mark/index updates |

**Not provided by this API (never fabricated):** volume, open interest, executed trade tape, order-book depth. The terminal shows `—` for volume/OI and labels its order book & trades views as simulated presentation only. `vendor/gains-sdk` (the on-chain SDK) remains vendored but unused; on-chain trading, wallets and testnet flows stay **out of scope** for this phase.

## Goal

Provide Openfund-branded market information, wallet context and eventually testnet-only demo trading through supported Gains Network interfaces, without replacing the upstream smart-contract execution model.

## Research gates

1. Confirm official Gains documentation, supported networks and current testnet status (including whether Arbitrum Sepolia is actually supported).
2. Identify canonical SDK/package and exact version; inspect types, exports and licensing.
3. Confirm deployed contract addresses and verified ABIs per chain; never guess addresses.
4. Document supported read APIs, price feed semantics, freshness, rate limits and any websocket capabilities.
5. Verify wallet/chain requirements, collateral/test-token requirements and transaction lifecycle.
6. Confirm how open trades, pending orders, PnL, margin, fees, liquidation levels and execution statuses are sourced and calculated.

## Adapter boundaries

- `NetworkConfig`: chain ID, RPC, contract references and environment status.
- `MarketDataProvider`: symbols, price updates, candle availability and source timestamps.
- `WalletContext`: connection, address, chain, account and disconnect state.
- `PositionsProvider`: read-only positions, pending orders and reconciliation.
- `DemoTradeGateway`: **disabled by default**; later explicit testnet simulation, validation, confirmation and transaction status.

These are proposed Openfund interfaces, **not confirmed Gains SDK names**.

## Demo flow (future)

Wallet connection → network verification → supported testnet setup → read-only market data → validated demo order preview → explicit user confirmation → signed testnet transaction → receipt and indexed state reconciliation. Always surface failure, pending, rejected and unsupported states.

## Market-data caveat

Oracle price streams are not equivalent to a centralized limit order book, executed trade tape or true bid/ask volume. Do not label synthetic reconstructions as authentic Gains order-flow data.

## Acceptance criteria

Verified official references; reproducible read-only integration; supported testnet configuration; wallet state synchronization; gated test transactions; UI evidence and tests. No real-fund execution by default.

Upstream reference: https://gains.trade/
