# Technology stack registry

> Single source of truth for every technology used in Openfund. Update this file when a dependency is added, upgraded, or its status changes. Statuses: **Active** (used by application source; not a claim of current runtime verification), **Vendored** (source kept, used indirectly or unused), **Planned**.

## App layer — `apps/web-react` (integrated React application)

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| React | 19.3.1 | UI runtime (app shell, hash routing pages) | Active | MIT |
| React DOM | 19.3.1 | DOM renderer | Active | MIT |
| TypeScript | 5.7.3 | Type-safe app source | Active | Apache-2.0 |
| Vite | 8.3.8 | Dev server + bundler (`react/` output, base `/react/`) | Active | MIT |
| react-router-dom | 7.18.5 | Hash router (locale/product hash routes and compatibility redirects) | Active | MIT |

## Backend (apps/backend)

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| Node.js | 22 (required) | backend runtime | Active | Node license |
| Express | 4.21 | Auth/profile, account/trading, portfolio/journal, purchases/invoices/withdrawal requests and diagnostics APIs | Active | MIT |
| viem (siwe) | 2.57 | EIP-4361 parse + verify (EOA + EIP-1271) | Active | MIT |
| pg | 8.13 | PostgreSQL access | Active | MIT |
| ws | 8.x | Gains WebSocket client (server-side marks) | Active | MIT |
| decimal.js | 10.x | authoritative money math (NUMERIC storage) | Active | MIT |

Run with Node 22 (viem/siwe + ESM). Server port 8080; env: DATABASE_URL, ALLOWED_DOMAINS, CORS_ORIGINS, SESSION_TTL_HOURS.

## Wallet layer

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| @rainbow-me/rainbowkit | 2.2.11 | Wallet connect UI (ConnectButton.Custom, bilingual trigger) | Active | MIT |
| wagmi | 2.19.5 | React hooks over viem (account, balance, chain) | Active | MIT |
| viem | 2.57.13 | TypeScript Ethereum interactions | Active | MIT |
| @tanstack/react-query | 5.105.0 | Async state for wallet hooks | Active | MIT |
| Ethereum Sepolia / Arbitrum One | chains 11155111 / 42161 | Prop SIWE / Perpetual SIWE and wallet reads; no transactions | Active | — |

Notes:

- `RainbowKitProvider` renders a `<div data-rk>` wrapper — it must wrap **only** the wallet button, never the app root (the legacy translator skips `[data-rk]` subtrees).
- WalletConnect requires `VITE_WALLETCONNECT_PROJECT_ID` in `apps/web-react/.env` (production: the runtime variable); without it the config uses `createConfig` with EIP-6963 discovery plus a generic injected connector (`getDefaultConfig` throws on an empty project id). Either way the Openfund wallet picker asks the person to choose the wallet — no connector is auto-selected.

## Charting

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| @luxalgo/vela | 0.9.3 | Full Vela workspace bundle (`vela-workspace.global.min.js` → `window.VelaWorkspace`): topbar, drawings, indicators, symbol search | Active | See `vendor/vela/NOTICE` — visible built-in Vela attribution kept for compliance |
| esbuild | (dev-time) | Bundles the Vela workspace into the IIFE global | Build tool | MIT |

## Market data

| Technology | Version | Role | Status | License |
| :--- | :--- | :--- | :--- | :--- |
| Gains Network public API | api.gains.trade/v1/arbitrum | REST: /markets (dynamic count), /prices, /markets/{sym}/candles (1m…1d, **no 1w**); WS: prices channel with ping/pong + seq-gap resubscribe (source-dependent update rate) | Active | Public API, CORS `*` (verified) |
| @gainsnetwork/sdk | 1.8.10 | On-chain trading SDK | Vendored — **unused** (intentionally: public market-data API only, no contracts assumed) | See `vendor/gains-sdk` |

## Legacy runtime (classic pages `dist/` + embedded in React shell)

| Technology | Role | Status |
| :--- | :--- | :--- |
| Vanilla JS modules (`locale.js`, `app.js`, `features.js`, `market.js`, `motion.js`, `terminal.js`, `terminal-data.js`) | Landing + terminal behaviour | Active (both classic and React pages) |
| Custom CSS (`style.css`, `terminal.css`, `wallet.css`) | Mint `#82e7bd`, bg `#060808`; public light theme uses root inversion with asset counter-filters; terminal/Vela use native palettes | Active |
| Fonts | Irancell (fa, weights 400–900), Ubuntu (en), Openfund Persian (woff2 wordmark) | Active |

## Tooling & operations

| Technology | Role | Status |
| :--- | :--- | :--- |
| Node same-origin hosting | API + built React at `/react/`; Vite for local development | Active |
| Playwright (playwright-core 1.64) | Browser acceptance for routes, wallets, accounts, purchases, charts and public presentation; results belong to their recorded source/runtime checkpoints | Active (test) |
| GitHub (branches `qwen/*`, `codex/*`, PR review) | Agent collaboration workflow | Active |

## Verified API constraints (do not regress)

- Gains candles: `1m 5m 15m 30m 1h 4h 1d` — **1w is NOT supported** (verified empty).
- The OHLC/mark adapter (`packages/openfund-gains-adapter/src/gains-adapter.js`) supplies no candle volume or open-interest history. Its marks are not liquidity or executed trades.
- The separate `apps/web-react/public/legacy/market-depth.js` reads authentic Gains VOB and executed-trade resources; see [provider-specific depth limits](../integrations/GAINS_DEPTH.md). This is not centralized matching or footprint data. Unsupported values remain unavailable; never fabricate volume or derive depth from oracle marks.
- Per-market `maxLeverage` from `/markets` clamps the leverage control (bounds come from live metadata).
- WS protocol: `{op:'subscribe',channel:'prices'}`, answer `{op:'ping'}` with `{op:'pong'}`, resubscribe on sequence gap.
