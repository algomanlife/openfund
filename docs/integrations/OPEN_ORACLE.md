# Open Oracle integration contract

## Scope and acceptance state

Open Oracle is Openfund's independently developed multi-source market-data
aggregation and composite reference-price discovery protocol. It calculates
normalized, quality-adjusted reference prices, native candlesticks and audit
history from eligible provider observations. It is **In Progress**, independently
executable and fixture-verified. Live conformance and complete inventory
verification remain blocked. It does not power the production chart.

The existing Gains, Hyperliquid analytics and Iran fallback data paths are
unchanged. No imports from this package have been added to any application.
The separate dormant Solidity `openfund-protocol` package is unchanged.

## Provider interfaces and semantics

| Adapter | Discovery | Price | History | Timestamp and acceptance limits |
| --- | --- | --- | --- | --- |
| Gains | `GET https://api.gains.trade/v1/arbitrum/markets` | `GET /prices`, `index` only; preserve `mark` separately | `/markets/{dashed-symbol}/candles?interval=...&from=...&to=...` | `updatedAt`; compatibility with the existing repo adapter is inspected, live access is unverified |
| Hyperliquid | `POST https://api.hyperliquid.xyz/info`: `perpDexs`, `metaAndAssetCtxs` for every discovered dex, `spotMeta` | `metaAndAssetCtxs.oraclePx`; preserve `markPx`, `midPx`, funding, OI and source notional volume | `candleSnapshot`; trade OHLC stays provider-reference | Context snapshots have no documented per-price timestamp; receipt time is labelled and default-ineligible |
| GMX | `GET https://{arbitrum,avalanche}-api.gmxinfra.io/tokens` and `/markets` | `GET https://{arbitrum,avalanche}.gmxapi.io/v1/prices/tickers`; midpoint of `minPrice` and `maxPrice`, divided by `10^30` per whole token | Oracle API `/prices/candles?tokenSymbol=...&period=...&limit=...` | `originTs` is the oldest snapshot price timestamp, used conservatively; deployment access and payload conformance remain unverified |

GMX's whole-token API price encoding is distinct from its Oracle keeper's
per-unit contract encoding. The adapter deliberately does not interchange them.
Bounds are taken from the same response, token identity and timestamp. Reversed,
zero or malformed intervals are excluded and recorded diagnostically.
Gains missing reference indices never fall back to marks or last trades.

Initial transport is sequential, rate-bounded REST polling. Provider WebSocket
formats were inspected where available, but upstream WS conformance is not
claimed. The package's local subscription API uses SSE. Polling avoids invented
stream timestamp semantics, but does not establish production latency guarantees.

## Registry and source selection

The registry takes the union of every successfully discovered provider inventory,
including spot and synthetic entries that are not eligible reference inputs.
Discovery failures mark completeness false; unknown counts remain unknown.
All observed raw metadata is retained. Stablecoin quotes, wrapped assets,
contracts, synthetic units, sessions and builder dex identities stay separate
until an evidence-bearing equivalence rule establishes comparability.

An equivalence rule names `canonicalId`, `quoteAsset`, `unit`, `evidence` and
explicit `{source, sourceMarketId}` members. Both the quote and unit must match
source metadata. A separate quote-conversion utility requires an independently
verified, event-time-valid conversion rate; no USD/stablecoin peg is assumed.
Default discovery does not invent cross-source equivalence based on ticker text.

| Eligible providers | Output |
| --- | --- |
| Gains only | `SINGLE_SOURCE`, Gains price and provenance |
| Hyperliquid only | `SINGLE_SOURCE`, Hyperliquid price and provenance |
| GMX only | `SINGLE_SOURCE`, GMX price and provenance |
| Gains + Hyperliquid | `DUAL_SOURCE`, renormalized quality weights, or `DIVERGENT` |
| Gains + GMX | `DUAL_SOURCE`, renormalized quality weights, or `DIVERGENT` |
| Hyperliquid + GMX | `DUAL_SOURCE`, renormalized quality weights, or `DIVERGENT` |
| All three | `TRIPLE_SOURCE`, robust independently calculated composite |
| None | `UNAVAILABLE`, or last reference explicitly `STALE` |

Closed sessions produce `MARKET_CLOSED`. Two-source disagreement never proves
which provider is wrong. Any carried last reference has zero confidence and its
original reference timestamp. The baseline preference is not a correctness claim.

## Local API

| Route | Response |
| --- | --- |
| `GET /v1/markets` | Full registry, mappings and ambiguity |
| `GET /v1/markets/:id` | One canonical instrument |
| `GET /v1/prices` | Current evaluations and stale/unavailable states |
| `GET /v1/prices/:id` | One reference with every quality factor and weight |
| `GET /v1/candles/:id?timeframe=1m` | Native/reconstructed candle metadata and gaps |
| `GET /v1/sources` | Capabilities, inventory health and bounded error history |
| `GET /v1/health` | Local protocol health, last evaluation and input counters |
| `GET /v1/methodology` | Versioned experimental configuration |
| `GET /v1/stream` | SSE `price` and `candle` events |

Encode instrument IDs as URL components. The server accepts GET only, binds to
loopback, rejects foreign browser origins/hosts and disconnects slow SSE clients.
It exposes no signing, order, payment, account or admin operations.

## History and future integration

`backfill` retains provider OHLC with source timestamps as `PROVIDER_REFERENCE`.
`replay` uses received-time order and as-of source selection.
`replayHistory` consumes recorded RAW/HEALTH/composite evaluation boundaries.
All output identifies algorithm, configuration and confidence versions.

A future integration requires a separately approved mapping corpus, live
provider and usage-term acceptance, session calendars, empirically calibrated
source policies, socket acceptance and production capacity evidence. Existing
terminal/Prop/execution services must not import the package in this phase.

## Primary source references

- [Gains Trading API](https://docs.gains.trade/developer/trading-api/overview)
  and [existing repository integration](GAINS.md).
- [Hyperliquid perpetual info endpoints](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals),
  [info endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint),
  [rate limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits).
- [GMX markets](https://docs.gmx.io/docs/api/rest-api/markets/),
  [GMX prices/history](https://docs.gmx.io/docs/api/rest-api/oracle-prices/),
  [whole-token ticker encoding](https://docs.gmx.io/docs/api/gmx-api/get-tickers/).

Documentation inspection is evidence of interface intent, not a successful
live request. Provider usage and redistribution rights remain unverified;
external publication is disabled, and the package is private.
