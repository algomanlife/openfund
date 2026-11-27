# Open Oracle integration contract

## Scope and acceptance state

Open Oracle is Openfund's independently developed multi-source market-data
aggregation and composite reference-price discovery protocol. It calculates
normalized, quality-adjusted reference prices, native candlesticks and audit
history from eligible provider observations. Since [ADR 0059](../decisions/0059-open-oracle-pricing-service.md) it is
also the **Openfund pricing service**: the backend `market-data` role runs it,
the demo engine executes on its usable composites and the public
`/api/oracle/*` API serves them (see [Pricing service](#pricing-service)).
The research protocol below keeps its own defaults and acceptance limits.
Remote CI has verified public inventory, nonempty reference observations and
provider history for all three sources, and a live service acceptance window.

The Hyperliquid footprint analytics path and the separate dormant Solidity
`openfund-protocol` package are unchanged.

## Provider interfaces and semantics

| Adapter | Discovery | Price | History | Timestamp and acceptance limits |
| --- | --- | --- | --- | --- |
| Gains | `GET https://api.gains.trade/v1/arbitrum/markets` | `GET /prices`, `index` only; preserve `mark` separately | `/markets/{dashed-symbol}/candles?interval=...&from=...&to=...` | `updatedAt`; public discovery, reference observations and provider history verified in the linked capture |
| Hyperliquid | `POST https://api.hyperliquid.xyz/info`: `perpDexs`, `metaAndAssetCtxs` for every discovered dex, `spotMeta` | `metaAndAssetCtxs.oraclePx`; preserve `markPx`, `midPx`, funding, OI and source notional volume | `candleSnapshot`; trade OHLC stays provider-reference | Context snapshots have no documented per-price timestamp; receipt time is labelled and default-ineligible |
| GMX | `GET https://{arbitrum,avalanche}-api.gmxinfra.io/tokens` and `/markets` | `GET https://{arbitrum,avalanche}.gmxapi.io/v1/prices/tickers`; midpoint of `minPrice` and `maxPrice`, divided by `10^30` per whole token | Oracle API `/prices/candles?tokenSymbol=...&period=...&limit=...` | `originTs` is the oldest snapshot price timestamp, used conservatively; public catalog/ticker/history payloads verified; conservative oldest-price timing retained |

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
source metadata. A member may declare an evidenced `sourceUnit` and positive
`priceMultiplier` to normalize contract/multiplier units into the canonical unit;
raw and normalized prices remain separately visible. No multiplier is inferred
from a ticker. A separate quote-conversion utility requires an independently
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

## Pricing service

`OpenOracleService` (`src/service.mjs`) is the production form. The backend
(`apps/backend/open-oracle.js`, `market-data.js`) wires it as follows.

| Input | Transport | Price used | Age policy |
| --- | --- | --- | --- |
| Gains | The backend's existing Gains price socket (REST snapshot every 60 s) | `mark` | `updatedAt`; 30 s bound, 8 s half-life (last-change time) |
| Hyperliquid | `metaAndAssetCtxs`, main perp dex only, every 3 s | `oraclePx` (thousand-unit `k` coins × 0.001) | receipt time, accepted for this source only; 9 s bound |
| GMX | Arbitrum `/v1/prices/tickers`, every 2 s | min/max midpoint, 30-decimal whole-token encoding | `originTs` (oldest price, conservative); 15 s bound |

- **Market universe.** One composite per Gains market; Gains stays the
  catalog for symbols, sessions and specifications.
- **Equivalence.** `buildEquivalences` joins a Gains crypto/USD market with
  one Hyperliquid main-dex perp and one GMX Arbitrum token with a unique
  symbol only when the member's normalized price is within 10 % (log
  distance) of the Gains price at build time. Forex, stocks, indices,
  commodities and stablecoins are never joined. Rules are rebuilt every
  10 minutes; the last composite survives a rebuild as the stale fallback.
- **Policy** (`SERVICE_CONFIG`, `openfund-service-1`): weights Gains 0.4,
  Hyperliquid 0.3, GMX 0.3; alignment window 12 s; two-source tolerance 2 %;
  three-source hard deviation 5 %.
- **Execution gate** (`isUsable`): `TRIPLE_SOURCE`, `DUAL_SOURCE` or
  `SINGLE_SOURCE`, not stale, evaluated within 5 s. `DIVERGENT` and
  `MARKET_CLOSED` composites are kept for valuation but never executed,
  liquidated on or settled on; `STALE` and `UNAVAILABLE` age out.
- **Fallback.** `MARKET_PRICE_SOURCE=gains` restores Gains-only marks.

### Public API

Read-only, same origin, `Cache-Control: no-store`, rate limited. Records carry
composites and per-source contributions, never provider payloads.

| Route | Response |
| --- | --- |
| `GET /api/oracle/prices` | `{source, at, status, data: [{market, price, mode, confidence, stale, at, eligible, configured}]}` |
| `GET /api/oracle/prices/:market` | One composite with each source's normalized and raw price, age, eligibility, exclusion reason and weight (`BTC-USD` or `BTC%2FUSD`) |
| `GET /api/oracle/status` | Service health: modes, joined markets, members per source, poll and failure counts |
| `GET /api/oracle/stream` | SSE: one `snapshot` event, then `prices` events with the changed composites of each evaluation; 15 s heartbeat |

Without a running service the routes answer `503 {"error":"oracle_unavailable"}`.
A process without the market-data role can mirror another region with
`OPEN_ORACLE_UPSTREAM` (it follows that region's stream).

## History and future integration

`backfill` retains provider OHLC with source timestamps as `PROVIDER_REFERENCE`.
`replay` uses received-time order and as-of source selection.
`replayHistory` consumes recorded RAW/HEALTH/composite evaluation boundaries.
All output identifies algorithm, configuration and confidence versions.

The pricing service keeps no durable composite history yet (no history store
is attached in the backend). Chart history therefore remains provider
reference history; native composite candles are later work, as are session
calendars and per-category policies.

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
