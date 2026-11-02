# Gains virtual depth and executed trades

Verified on 2026-11-02 using official documentation and successful live public reads:

- [Market-data API](https://docs.gains.trade/developer/trading-api/market-data.md)
- [Virtual book resource](https://docs.gains.trade/api-reference/markets/virtual-order-book.md)
- [Executed trades resource](https://docs.gains.trade/api-reference/markets/recent-executed-trades.md)
- [WebSocket contract](https://docs.gains.trade/developer/trading-api/websocket.md)

The older [client-derived VOB guide](https://docs.gains.trade/developer/integrators/guides/building-the-virtual-order-book) describes SDK construction from public depth bands and skew. The current Trading API exposes the resulting ladder directly. This supersedes the earlier repository claim that no supported VOB/tape resource exists.

## Sources and semantics

`GET https://api.gains.trade/v1/arbitrum/markets/BTC-USD/book?levels=15` returns `market`, `markPrice`, `asks`, `bids`, `timestamp`; levels contain `price`, base `size`, `sizeUsd`, `cumulativeUsd`.

`GET …/markets/BTC-USD/trades?limit=50` returns executed events containing `market`, `price`, `sizeUsd`, position `side`, execution `action`, timestamp and transaction hash. Position side is displayed as provider position direction; it is not inferred buyer/seller aggression on a central exchange.

One public socket at `wss://api.gains.trade/v1/arbitrum/ws` subscribes to `book` and `trades` for the selected market. Live probing verified that Book messages put `market` in the envelope and omit it from the inner ladder object; the adapter preserves that scope. Subscription acknowledgements carry no payload and are ignored. Book messages contain complete ladders; trade deltas append real events with duplicate prevention. Ping/pong, book sequence resubscription, abortable snapshots, selected-market generation guards, reconnect cleanup and page-unload cleanup are implemented in `market-depth.js`.

## UI and integrity

The existing panel beside Vela and order entry has Book/Trades tabs, sell-side levels above the midpoint, buys below, Price/Size/Total, best-level spread, depth bars, display precision and USD/base denomination controls. Base cumulative values convert provider cumulative USD by the provider mark for display; USD values are passed through. No ladder is constructed from oracle ticks. Reduced-motion disables transitions.

The panel is explicitly **Gains VOB**: vault-based virtual execution liquidity, not a resting central limit order book. Its spread describes the provider VOB, not the Openfund Prop simulation fee/spread policy. Unsupported, invalid, stale or failed data produces an unavailable state, never synthetic replacement liquidity. Historical trades can legitimately be old; they retain original timestamps. Book snapshots older than 15 seconds are not represented as fresh.

The existing terminal's market picker, Vela chart, original proprietary indicators, positions, order entry and wallet controls remain in place. This integration performs public reads only; no signing, approvals or blockchain transactions are introduced.
