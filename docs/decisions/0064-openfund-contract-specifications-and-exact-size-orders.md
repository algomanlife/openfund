# ADR 0064 — Openfund contract specifications and exact-size orders

- Status: Accepted by the owner (2026-11-28).
- Supersedes: the lot conventions of [ADR 0028](0028-manual-payment-treasury-networks-campaign-chart-english-lotage.md)
  (lots only for forex, gold, silver and WTI, entered as collateral).
- Builds on: [ADR 0059](0059-open-oracle-pricing-service.md) (Open Oracle) and
  [ADR 0063](0063-on-chain-certificates-and-trade-ledger.md) (on-chain trade records).

## Context

The order panel offered three size modes, but only collateral reached the
engine: a quantity or a lot was converted to collateral rounded up to cents,
and the engine derived its own quantity from that collateral, the fill price
and the market precision. The position could therefore differ slightly from
what the trader asked for. Lots were available only where the industry has one
standard (forex, gold, silver, WTI) because the price venue defines no lots.

The owner's decision (2026-11-28): Openfund runs its own engine, its own price
service and its own public trade record, so Openfund defines its contract
specifications itself, for every market; and a trader can size every order by
lots, by symbol size or by collateral, with the lot and symbol-size modes
filled exactly.

## Decision

1. **Contract specifications** live in `apps/backend/contract-specs.js`
   (model `openfund_contract_specs_v1`), pure and dependency-free, with an
   identical copy of the rules in the browser ticket
   (`apps/web-react/public/legacy/position-sizing.js`). The backend test
   `test/contract-specs.test.mjs` fails if the two ever differ.

   | Markets | 1 lot |
   | :--- | :--- |
   | Forex (USD quote) | 100,000 units of the base currency |
   | Gold · silver · platinum · palladium | 100 · 5,000 · 50 · 100 troy oz |
   | WTI and Brent · natural gas · copper | 1,000 barrels · 10,000 MMBtu · 25,000 lb |
   | Other commodities | 1 unit |
   | Indices | 1 index unit |
   | Stocks | 100 shares (a round lot) |
   | Crypto | 1 coin; 10^(d − 4) coins when the price is quoted with d > 4 decimals |

   Minimum and step are 0.01 lot, raised to the smallest step whose size is
   on the market's quantity grid (for example 1 lot for an index traded in
   whole units). There is no lot maximum beyond the engine's size and margin
   limits. Markets quoted in another currency have no lot, because the engine
   values positions in USD only.

2. **Orders state their size.** `POST /trading/order` and
   `POST /trading/preview` accept `size_mode`: `collateral` (default, with
   `margin`), `quantity` (with `quantity`, base-asset units) or `lots` (with
   `lots`). For quantity and lots the engine fills exactly that quantity; the
   collateral is `quantity × entry / leverage`, rounded up to 10 decimals, at
   the expected entry (market: mark with spread; limit and stop: the target)
   for the margin checks, and recalculated at the actual fill price when the
   order fills. The resolved size (mode, quantity, lots, contract size,
   model) is stored with the order in `request_meta.size`, so a filled order
   keeps the lot definition it was placed with. No schema change.

3. Errors: `invalid_size_mode`, `lots_unavailable`, `invalid_lots`,
   `below_lot_min`, `off_lot_step`, `quantity_precision`, `invalid_order_size`
   (all `400`). An idempotent retry must repeat the same size: another lotage
   under the same key is `409 idempotency_conflict`.

## Consequences

- What the trader enters is what the engine opens, recorded on chain with the
  same quantity.
- The crypto rule depends on the catalog's price decimals; a catalog change
  can change a market's lot for new orders, never for orders already placed.
- Collateral orders behave exactly as before.
