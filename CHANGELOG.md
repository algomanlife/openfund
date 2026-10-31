# Changelog

Notable changes are recorded here. Dates should use ISO 8601.

## Unreleased

### Terminal — Vela × Gains (this branch)
- **feat(terminal):** replaced the lightweight-charts demo chart with a real **LuxAlgo Vela** chart (`@luxalgo/vela@0.9.3` global bundle in `dist/assets/vela.global.min.js`), including native crosshair, drawing toolbar, indicators and NOTICE attribution (enabled by default).
- **feat(gains):** verified **Gains Network** market-data integration (`dist/gains-adapter.js`, mirrored in `packages/openfund-gains-adapter/`): 488 live markets from `GET /v1/arbitrum/markets`, mark/index prices from `GET /prices` + the `wss://api.gains.trade/v1/arbitrum/ws` prices channel (auto-reconnect, staleness watchdog), and OHLC candles from `GET /markets/{sym}/candles` for 1m/5m/15m/30m/1h/4h/1d (**1w is not supported by Gains — verified — and is not offered**).
- **feat(charts):** `dist/vela-bridge.js` (mirrored in `packages/openfund-charts/`) mounts Vela with the Gains provider, exposing `setSymbol / setTimeframe / setTheme / resize / destroy`.
- **feat(terminal):** market selector now browses the 488 real Gains markets with category chips + search + watchlist stars; market stats show the real mark, index, 24h high/low/change (from real candles), real hourly funding and the real per-market max leverage (BTC 200×, XAU 4× …) which now clamps the leverage control.
- **feat(terminal):** the simulated demo trading engine now executes against **real Gains marks**; fees/margin/liquidation remain simplified demo assumptions (documented in the on-page "Demo assumptions" dialog). Volume, open interest, order-book depth and trade tape are **not provided by the Gains API** and are either shown as `—` or clearly labelled as simulated presentation views.
- Dark/light themes (persisted) and FA/EN bilingual UI now cover the Vela chart too (`chart.setTheme`, `chart.setLocale` best-effort).
- chore: removed temporary test/screenshot files from `dist/`.


### Documentation and structure
- Define modular Openfund application and adapter boundaries without migrating existing frontend files.
- Establish common agent collaboration rules, integration specifications, feature status, roadmap, security guidance and PR template.

### Existing repository baseline
- Landing/account and terminal prototypes exist in `dist/`.
- Charting dependency installation has been reported, but functional Vela embedding has not been verified.
- Gains SDK and testnet integration have not been verified as operational.

> This document describes the known baseline and scaffold; it is not a claim of implemented trading capabilities.
