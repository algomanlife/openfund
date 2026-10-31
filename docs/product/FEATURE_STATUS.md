# Feature status — source of truth

Use these statuses: **Implemented** (working and tested), **Prototype** (visible but not end-to-end validated), **Planned** (not built), **Blocked** (external dependency), **Unverified** (requires inspection).

| Capability | Status | Evidence / next step |
| --- | --- | --- |
| Landing/account static frontend | Prototype | `dist/index.html`; bilingual FA/EN, dark/light theme, Irancell/Ubuntu fonts |
| Terminal UI | Implemented | `dist/terminal.html`; FA/EN + themes + Vela chart + live Gains data (browser-verified 2026-10-31) |
| Brand assets and brandbook | Unverified | Audit `brand/` and archive rights/content |
| Vela npm dependency | Implemented | `vendor/vela@0.9.3` + `dist/assets/vela.global.min.js` (global bundle loads; 119 exports verified) |
| Embedded functional Vela chart | Implemented | `dist/vela-bridge.js` mounts Vela with candles, crosshair, drawings, attribution; screenshot-verified |
| Gains SDK dependency | Unverified | `vendor/gains-sdk` vendored; terminal uses the **public REST/WS API** (`api.gains.trade`) instead — endpoints verified |
| Gains market data adapter | Implemented | `dist/gains-adapter.js` + `packages/openfund-gains-adapter/`; markets/prices/candles/WS verified live 2026-10-31 |
| Arbitrum Sepolia demo contract integration | Blocked | Verify supported contracts, addresses, ABI and testnet availability |
| Wallet state and chain switching | Planned | Validate wallet library and UI |
| Positions/order lifecycle | Planned | Specify read/write lifecycle and reconciliation |
| True order-book / footprint | Blocked | Confirm legitimate trade/volume/depth data source |
| Backend, CI and production deployment | Planned | Define deployment architecture and test gates |

Agents must update this table when verified work changes the status.

> 2026-10-31 update (branch `qwen/frontend-polish-vela-gains`): market data, Vela chart and terminal UX are browser-verified against the live Gains API. The `vendor/gains-sdk` (on-chain SDK) remains **Unverified/unused** — the terminal intentionally consumes the public market-data API only. Demo trading stays simulated; no wallet, order-book or trade-tape data is fabricated.
