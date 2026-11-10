# Gains upgrade protection

Gains Network is a hosted API with no versioned releases, so protection is by **contract**, not by version number. Gains specifics stay inside the market-data integration layer; the trading engine, execution rules and evaluation logic never learn a Gains field name.

Registry: [Upstream dependency registry](UPSTREAM_DEPENDENCIES.md). Protocol description: [Gains integration](GAINS.md).

## Stable internal contract

`apps/backend/market-data.js` (server, authoritative for the engine) and `packages/openfund-gains-adapter/src/gains-adapter.js` (browser, charts and markets) translate the provider into this contract.

| Concern | Contract | Where enforced |
| :--- | :--- | :--- |
| Symbols and metadata | `BASE/QUOTE` symbol, `group` in crypto, forex, stocks, indices, commodities, `isOpen` boolean, integer `pricePrecision`, leverage bounds as decimal strings | `#loadMarkets`; unexpected shape throws `invalid_market_schema` |
| Prices | `{ market, mark, index, updatedAt }`; mark must be a finite positive number; `updatedAt` in epoch ms, seconds or ISO, never in the future | `quoteRecord` returns `null` for anything else |
| Mark versus index | Two different values. The engine reads the **mark** only; the index is kept for display and is `null` when absent | `mark()`, `tradeable()` |
| Precision | Provider `pricePrecision` is metadata; prices stay decimal strings and are never rounded by the integration | `marks` store strings |
| WebSocket | Subscribe to `prices` on open; answer `ping` with `pong`; ignore `hello` and `subscribed`; apply snapshots and increments | `#connect` |
| Ordering and gaps | A non-snapshot frame whose `seq` is not previous plus one forces unsubscribe, resubscribe and clearing of marks; older timestamps never overwrite newer ones | `#connect` |
| Reconnection | Close schedules one reconnect after 2 s; sequence state resets; a stopped feed never reconnects | `#connect`, `stop()` |
| Freshness | A mark older than 5 s is stale; stale, unknown or closed markets are not tradeable and the reason is explicit | `freshMark`, `tradeable` |
| Failure | HTTP errors and wrong shapes are errors, never silently substituted or defaulted | `bootstrap` |

## Tests

- **Contract tests (CI, no network):** `node --test apps/backend/test/market-data-contract.test.mjs` (13 tests). Fixtures were recorded from the live public API on 2026-11-10 under `apps/backend/test/fixtures/gains/`: metadata for 10 markets across all five groups (including closed stock and index markets), 7 live prices where mark and index differ, and the first four WebSocket frames of a real session. Mutation checks confirmed the suite fails when the stale window or sequence-gap handling is altered.
- **Browser data layer:** `npm --prefix apps/web-react run test:markets` and `test:depth`.
- **Optional live check (network, read-only, not gating):** `npm run check:gains-live` compares live shapes with the contract: field presence and groups for all 493 markets, quote validity, and a WebSocket snapshot with a numeric sequence. Exit 1 means drift, exit 3 means the API was unreachable. It passed on 2026-11-10 (493 markets, 373 prices, 18 frames).
- **Engine untouched:** the integration seam added to `market-data.js` is a constructor options object whose defaults reproduce the previous behaviour exactly. No engine, evaluation, pricing or execution file changed. Gains transaction execution stays disabled by default.

## When the provider changes

1. A contract test or the live check fails. Do not adapt blindly.
2. Record new fixtures with the same commands used above, review the diff in the fixtures, and decide whether the integration layer should map the new shape to the existing contract.
3. Change only the integration layer. If the stable contract itself must change, that is a trading-impacting decision: write an ADR and run the engine suites (`npm run test:backend`).
4. Protocol or contract upgrades (SDK, on-chain addresses, execution paths) are never adopted automatically.

## SDK

`vendor/gains-sdk` is byte-identical to upstream commit `aa7a05a` and is not imported by any application code. Updating it follows the [vendored source procedure](UPSTREAM_DEPENDENCIES.md#vendored-source-update-procedure); it does not change market-data behaviour.

[Dependency registry](UPSTREAM_DEPENDENCIES.md) · [Gains integration](GAINS.md) · [Gains depth](GAINS_DEPTH.md) · [ADR 0019](../decisions/0019-upstream-isolation.md)
