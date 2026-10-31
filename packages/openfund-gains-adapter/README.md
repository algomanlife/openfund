# openfund-gains-adapter

Verified Gains Network market-data adapter for the Openfund terminal.

- Source of truth: `src/gains-adapter.js` — mirrored verbatim into `dist/gains-adapter.js` (script-tag load; `window.OpenfundGains`).
- Verified endpoints: `GET /markets` (488 symbols), `GET /prices`, `GET /markets/{sym}/candles` (1m…1d; 1w unsupported), WS prices channel with reconnect + staleness watchdog.
- Exposes `createVelaProvider()` implementing the Vela `DataProvider` contract (`getBars`, `listSymbols`, `getSymbolInfo`, `subscribe`, `info`).
- Never fabricates volume, OI, depth or trades — those are absent from the API.
- On-chain trading via `vendor/gains-sdk` is out of scope for this package.

See `docs/integrations/GAINS.md` for the full verification table.
