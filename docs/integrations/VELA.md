# LuxAlgo Vela integration specification

**Status: Implemented (market-data chart) — branch `qwen/frontend-polish-vela-gains`.**

The terminal at `dist/terminal.html` mounts the real Vela chart via the global bundle (`dist/assets/vela.global.min.js`, attached as `window.Vela`, constructor at `window.Vela.Vela`). Verified working: candlestick rendering from Gains candles, crosshair, native drawing toolbar, `setMarket` symbol/timeframe switching, `setTheme` dark/light, `setLocale` (best-effort), `resize`, `destroy`, and the built-in NOTICE attribution mark (left enabled). Native indicators (`chart.availableNativeIndicators()` / `addNativeIndicator`) power the MA/VOL toolbar buttons when supported.

## Goals

Embed a responsive chart inside the existing Openfund terminal while retaining Openfund navigation, layout and styling. Respect all upstream licensing, notices and required attribution.

## Verified facts (2026-10-31)

- Upstream: https://github.com/LuxAlgo/Vela — `@luxalgo/vela@0.9.3`, vendored under `vendor/vela/` with LICENSE + NOTICE preserved.
- NOTICE obligation: visible Vela attribution wherever charts render. The built-in logomark satisfies it and stays enabled in `dist/vela-bridge.js`.
- Bar shape: `{ time (epoch ms, open time), open, high, low, close, volume? }`, sorted, de-duplicated, newest = forming candle.
- Provider contract: `getBars` (required) + optional `listSymbols`, `getSymbolInfo`, `subscribe(ticker, tf, onBar)`, `info()`. Implemented for Gains in `packages/openfund-gains-adapter/src/gains-adapter.js` (mirrored to `dist/gains-adapter.js`).
- Bridge: `packages/openfund-charts/src/vela-bridge.js` → `window.OpenfundCharts.mount(container, opts)` returning `setSymbol/setTimeframe/setMarket/setTheme/resize/on/destroy`.

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
