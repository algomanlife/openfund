# Technology stack registry

> Single source of truth for every technology used in Openfund. Update this file when a dependency is added, upgraded, or its status changes. Statuses: **Active** (in the running app), **Vendored** (source kept, used indirectly or unused), **Planned**.

## App layer — `apps/web-react` (React migration, branch `qwen/react-migration`)

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| React | 19.3.1 | UI runtime (app shell, hash routing pages) | Active | MIT |
| React DOM | 19.3.1 | DOM renderer | Active | MIT |
| TypeScript | 5.7.3 | Type-safe app source | Active | Apache-2.0 |
| Vite | 6.4.5 | Dev server + bundler (`react/` output, base `/react/`) | Active | MIT |
| react-router-dom | 7.18.5 | Hash router (`#/`, `#/terminal`, catch-all) | Active | MIT |

## Wallet layer

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| @rainbow-me/rainbowkit | 2.2.11 | Wallet connect UI (ConnectButton.Custom, bilingual trigger) | Active | MIT |
| wagmi | 2.19.5 | React hooks over viem (account, balance, chain) | Active | MIT |
| viem | 2.57.13 | TypeScript Ethereum interactions | Active | MIT |
| @tanstack/react-query | 5.105.0 | Async state for wallet hooks | Active | MIT |
| Arbitrum Sepolia | chain 421614 | Testnet (connection only — no transactions) | Active | — |

Notes:
- `RainbowKitProvider` renders a `<div data-rk>` wrapper — it must wrap **only** the wallet button, never the app root (the legacy translator skips `[data-rk]` subtrees).
- WalletConnect requires `VITE_WALLETCONNECT_PROJECT_ID` in `apps/web-react/.env`; without it the config falls back to `createConfig` + injected connector (MetaMask/Rabby still work — `getDefaultConfig` throws on an empty project id).

## Charting

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| @luxalgo/vela | 0.9.3 | Full Vela workspace bundle (`vela-workspace.global.min.js` → `window.VelaWorkspace`): topbar, drawings, indicators, symbol search | Active | See `vendor/vela/NOTICE` — visible "Charts by Vela" credit kept for compliance |
| esbuild | (dev-time) | Bundles the Vela workspace into the IIFE global | Build tool | MIT |

## Market data

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| Gains Network public API | api.gains.trade/v1/arbitrum | REST: /markets (488), /prices, /markets/{sym}/candles (1m…1d, **no 1w**); WS: prices channel with ping/pong + seq-gap resubscribe (~90 upd/s) | Active | Public API, CORS `*` (verified) |
| @gainsnetwork/sdk | 1.8.10 | On-chain trading SDK | Vendored — **unused** (intentionally: public market-data API only, no contracts assumed) | See `vendor/gains-sdk` |

## Legacy runtime (classic pages `dist/` + embedded in React shell)

| Technology | Role | Status |
| :--- | :--- | :--- |
| Vanilla JS modules (`locale.js`, `app.js`, `features.js`, `market.js`, `motion.js`, `terminal.js`, `terminal-data.js`) | Landing + terminal behaviour | Active (both classic and React pages) |
| Custom CSS (`style.css`, `terminal.css`, `wallet.css`) | Design system (mint `#82e7bd`, bg `#060808`, light theme = `invert(1) hue-rotate(180deg)`) | Active |
| Fonts | Irancell (fa, weights 400–900), Ubuntu (en), Openfund Persian (woff2 wordmark) | Active |

## Tooling & operations

| Technology | Role | Status |
| :--- | :--- | :--- |
| Python `http.server` | Local static serving of `dist/` + `react/` on :4173 | Active |
| Playwright (playwright-core 1.64) | Real-browser E2E (clicks, theme/lang/dir, REST rows, reload teardown) — 18/18 green on dev + build | Active (test) |
| GitHub (branches `qwen/*`, `codex/*`, PR review) | Agent collaboration workflow | Active |

## Verified API constraints (do not regress)

- Gains candles: `1m 5m 15m 30m 1h 4h 1d` — **1w is NOT supported** (verified empty).
- Gains provides **no volume / open interest history / order-book / trade-tape** — those fields show `—` or are labelled simulated.
- Per-market `maxLeverage` from `/markets` clamps the leverage control (BTC 200×, XAU 4×).
- WS protocol: `{op:'subscribe',channel:'prices'}`, answer `{op:'ping'}` with `{op:'pong'}`, resubscribe on sequence gap.
