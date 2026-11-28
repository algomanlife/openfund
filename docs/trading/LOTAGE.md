# Lotage and order size

Status: implemented (ADR [0064](../decisions/0064-openfund-contract-specifications-and-exact-size-orders.md));
review and release pending. Supersedes the conventions of ADR 0028.

## Three ways to size an order

The Prop order panel sizes an order by **collateral**, **symbol size**
(base-asset quantity) or **lots**. The three fields stay in step: entering one
shows the others, with the notional, margin, estimated liquidation, P/L at the
stop and fees.

| Mode | Sent to the engine | Filled |
| :--- | :--- | :--- |
| Collateral | `size_mode: 'collateral'`, `margin` | quantity = margin × leverage / fill price, rounded down to the market precision |
| Symbol size | `size_mode: 'quantity'`, `quantity` | exactly that quantity |
| Lots | `size_mode: 'lots'`, `lots` | exactly lots × contract size |

For symbol size and lots the collateral is quantity × entry / leverage,
rounded up: estimated at the expected entry for the margin checks
(market: mark with spread; limit and stop: the target) and recalculated at
the actual fill price.

## What one lot is

Openfund defines its contract specifications itself
(`apps/backend/contract-specs.js`, mirrored in
`apps/web-react/public/legacy/position-sizing.js`; a backend test keeps them
identical).

| Markets | 1 lot |
| :--- | :--- |
| Forex (USD quote) | 100,000 units of the base currency |
| Gold (XAU) | 100 troy oz |
| Silver (XAG) | 5,000 troy oz |
| Platinum (XPT) · palladium (XPD) | 50 · 100 troy oz |
| WTI and Brent crude | 1,000 barrels |
| Natural gas | 10,000 MMBtu |
| Copper | 25,000 lb |
| Other commodities | 1 unit |
| Indices | 1 index unit |
| Stocks | 100 shares (a round lot) |
| Crypto | 1 coin; for prices quoted with more than 4 decimals, 10^(decimals − 4) coins (for example 1,000,000 for a token quoted with 10 decimals) |

Minimum and step: 0.01 lot, raised to the smallest step that is a whole
number of the market's quantity units (an index traded in whole units has a
1-lot step). No maximum beyond the engine's own limits. Markets quoted in
another currency than USD have no lot.

## Errors

`lots_unavailable`, `invalid_lots`, `below_lot_min`, `off_lot_step`,
`quantity_precision`, `invalid_order_size`, `invalid_size_mode` (`400`). The
ticket explains each one next to the field.

Tests: `apps/backend/test/contract-specs.test.mjs` (definitions and parity),
`apps/backend/test/trading.test.mjs` section 6b (exact quantity and lots
fills, pending lots orders, idempotency), `apps/web-react/test/position-sizing.test.mjs`.
