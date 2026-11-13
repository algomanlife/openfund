# Lotage

Status: implemented on branch `agent/claude/checkout-campaign-chart-trading`
(local verification; not deployed). Decision:
[ADR 0028](../decisions/0028-manual-payment-treasury-networks-campaign-chart-english-lotage.md).

## What Gains defines

Gains Network (gTrade) has **no lot or contract-size concept**:

- position size = collateral × leverage, denominated in the collateral
  (docs.gains.trade start page and glossary);
- Trading API order `size` is in base-asset units on the market's
  `sizePrecision` grid; collateral = size × price / leverage
  (docs.gains.trade, Trading API → orders);
- `/markets` and `/trading-variables` carry `pricePrecision`,
  `sizePrecision`, leverage limits, `minPositionUsd` and fee fields — no lot,
  contract size or multiplier for any market.

The Prop engine mirrors this: quantity = margin × leverage / entry, rounded
down to `sizePrecision`; contract size 1; USD quotes only
(`instruments.js` refuses other quote currencies).

## Openfund convention

A lot is therefore an Openfund entry/display convention, used only where one
industry-standard unit exists and the engine prices in USD:

| Markets | 1 lot | Basis |
|---|---|---|
| Forex, USD quote (EUR/USD, GBP/USD, AUD/USD, NZD/USD…) | 100,000 units of the base currency | standard FX lot |
| XAU/USD | 100 troy oz | CME gold (GC) contract unit |
| XAG/USD | 5,000 troy oz | CME silver (SI) contract unit |
| WTI/USD | 1,000 barrels | CME crude (CL) contract unit |

Minimum and step: 0.01 lot. The CME contract pages could not be fetched during
implementation (timeouts), so these units are recorded as conventions that
**need owner approval**; they are stated next to the input in the ticket.

Unavailable, with the reason shown: crypto (no standard lot), stocks (no
single standard), indices (contract sizes differ by venue), other commodities
(XPT, copper…) and every non-USD-quoted pair. An explicitly approved
per-market specification (`APPROVED_LOT_SPECS` or `meta.contractSpec.approved`)
overrides a convention.

## Conversion

Lots → quantity (lots × contract size, exact decimals) → collateral =
quantity × price / leverage rounded **up** to cents — the same canonical path
as the quantity mode. The engine then derives the final quantity from the
collateral, leverage, entry price and `sizePrecision`, which is never smaller
than the requested quantity. The ticket shows the equivalents (symbol size,
notional, collateral, leverage) and the review lists the requested lotage.
No order contract, backend formula or engine rule changed.

Tests: `apps/web-react/test/position-sizing.test.mjs` (conventions, round trip,
precision, limits, unavailable markets).
