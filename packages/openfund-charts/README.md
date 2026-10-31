# openfund-charts

LuxAlgo Vela chart bridge for the Openfund terminal.

- Source of truth: `src/vela-bridge.js` — mirrored verbatim into `dist/vela-bridge.js` (requires `assets/vela.global.min.js` + `dist/gains-adapter.js` loaded first).
- API: `window.OpenfundCharts.mount(container, {symbol, timeframe, theme})` → controller with `setSymbol`, `setTimeframe`, `setMarket`, `setTheme`, `resize`, `on`, `chart`, `destroy`.
- Registers the Gains provider under the `gains:` symbol prefix; charts resolve symbols like `gains:BTC/USD`.
- Vela NOTICE attribution mark stays enabled (required by the upstream NOTICE).
- Resize handled via `ResizeObserver` → `chart.resize()`.

See `docs/integrations/VELA.md` for verified Vela facts.
