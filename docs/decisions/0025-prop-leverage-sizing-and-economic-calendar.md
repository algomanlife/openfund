# ADR 0025 — Prop leverage ceilings, position sizing modes and the economic calendar tab

- **Status:** Accepted (implementation on branch `agent/claude/terminal-prop-ui-refinement`; not deployed)
- **Date:** 2026-11-12

## Context

The owner requested eleven terminal and Prop refinements. Three of them
change behaviour rather than presentation and need a recorded decision:
Prop-only maximum leverage per instrument category, lot-based position
sizing next to quantity and collateral, and an economic calendar tab beside
the chart.

The Prop practice engine (`apps/backend/engine.js`) serves Prop accounts only;
Perpetual reads Gains directly and never reaches it. Its canonical order is
`{ margin, leverage }`; it derives `quantity = margin × leverage / entry`
rounded down to the instrument's quantity precision. Its instrument model
(`apps/backend/instruments.js`) is a linear virtual-USD contract with contract
size 1 and rejects any other contract size. The verified Gains `/markets`
metadata provides `symbol`, `base`, `group` (`crypto`, `forex`, `stocks`,
`indices`, `commodities`) and `maxLeverage`, and no lot fields.

## Decision

### Prop leverage ceilings

- `apps/backend/prop-leverage.js` defines the ceilings: BTC/USD and ETH/USD
  20×, other crypto 15×, forex, stocks, indices and commodities 50×.
- BTC and ETH are matched on the exact market identity (`symbol`, `base` and
  the `crypto` group), never on a substring: BTCDEGEN/USD and ETHFI/USD keep
  the 15× crypto ceiling.
- The effective maximum is the minimum of the market's `maxLeverage`, the
  Prop ceiling and a challenge plan's `referenceLeverageX`. A stricter
  existing limit always wins; the policy can only lower a limit.
- The engine enforces it in `previewOrder` and `submitOrder`. A direct API
  request above the ceiling is recorded as a rejected order with
  `leverage_exceeded` and never fills.
- The browser copy `apps/web-react/public/legacy/prop-leverage.js` drives
  the Prop ticket (slider maximum, disabled presets, an inline "Prop max"
  note, an announced clamp when the market changes). A parity test keeps the
  two tables identical. Perpetual keeps the market's own limit.
- Existing open positions and pending orders are not modified.

### Position sizing

- The Prop ticket offers Collateral, Quantity and Lots. Every mode resolves to
  the canonical collateral value the engine already accepts; there is no new
  execution path and no API change.
- Quantity mode keeps the requested quantity as the trader's intent and
  recomputes collateral (`quantity × price / leverage`, rounded up to cents)
  when price, leverage or market change. The quantity is cleared on a market
  change because it is in the previous market's base units. The review shows
  the requested quantity next to the server-preview quantity and explains any
  difference (spread and precision).
- Conversions use exact decimal arithmetic on `BigInt`
  (`legacy/position-sizing.js`).
- Lots require an approved contract specification (contract size, lot
  minimum, maximum and step). None exists: Gains metadata has no lot fields
  and the engine model has contract size 1. Lots are therefore shown as
  unavailable for every instrument, with the reason, and no lot size is
  guessed. Enabling lots for an instrument is a data change in
  `APPROVED_LOT_SPECS` (or approved contract metadata) once the owner approves
  a specification; the conversion functions and their tests already exist.

### Economic calendar

- A "News & Information" tab beside the chart embeds the official TradingView
  Economic Calendar web component (`<tv-economic-calendar>`, module from
  `https://widgets.tradingview-widget.com/w/<locale>/tv-economic-calendar.js`).
  It renders its own iframe from `https://www.tradingview-widget.com` and its
  own TradingView attribution, which is kept.
- The application CSP (HTML documents only) allows exactly those two origins
  in `script-src` and `frame-src`. API responses keep the strict policy.
- No calendar data is scraped, proxied or rebuilt; no undocumented endpoint
  is called. Styling uses the widget's documented `theme` attribute and
  `--tv-widget-*` CSS tokens. Persian is not a supported widget locale, so the
  Persian terminal shows the widget in English with a note.
- The panel overlays the mounted chart, so switching tabs never unmounts or
  resizes the chart and keeps market, timeframe, drawings, indicators and
  account context.
- The calendar is informational only: no price, order, risk or challenge rule
  reads it.

## Consequences

- Prop orders above the new ceilings fail where they previously succeeded.
  Three existing tests that opened BTC at 50× or 100× now use 20× with
  adjusted price moves that keep their intent (liquidation, negative equity).
- Lot sizing stays blocked until an approved contract specification exists.
- The calendar depends on TradingView's availability and terms; failures show
  an unavailable state with a retry.
