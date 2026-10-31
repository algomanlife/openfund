# LuxAlgo Vela integration specification

**Status: Planned.** Installing a package does not mean the Vela chart is embedded or functional.

## Goals

Embed a responsive chart inside the existing Openfund terminal while retaining Openfund navigation, layout and styling. Respect all upstream licensing, notices and required attribution.

## Verification checklist before implementation

- Identify the exact upstream repository, package version, license and NOTICE requirements.
- Inspect actual package exports, supported frameworks, renderer APIs and CSS requirements.
- Determine supported candle/time-series inputs, timeframes, symbol changes and resize lifecycle.
- Confirm any replay, footprint, indicator or order-book features in the actual version; do not assume they are included.
- Verify whether the intended data source has real trade/volume/depth data; oracle ticks alone are insufficient for genuine footprint/order book.

## Proposed adapter interface

`mountChart(container, options)`, `setSymbol(symbol)`, `setTimeframe(interval)`, `setCandles(candles)`, `appendCandle(candle)`, `resize()`, `destroy()` — **design targets only, not claimed Vela API exports**.

Normalize candles as timestamp, open, high, low, close and optional genuine volume with explicit units. Provide loading, stale-data and error states.

## Acceptance criteria

Rendered chart visible in `dist/terminal.html` or its migrated successor; instrument/timeframe updates; resize cleanup; verified source data; tests and documented attribution. Until these pass, keep feature status `Planned`.

Upstream reference: https://github.com/LuxAlgo/Vela
