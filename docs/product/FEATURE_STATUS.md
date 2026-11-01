# Feature status — source of truth

Use these statuses: **Implemented** (working and tested), **Prototype** (visible but not end-to-end validated), **Planned** (not built), **Blocked** (external dependency), **Unverified** (requires inspection).

| Capability | Status | Evidence / next step |
| --- | --- | --- |
| Landing/account static frontend | Implemented | `dist/index.html`; bilingual FA/EN, dark/light theme, Irancell/Ubuntu fonts; interactivity browser-verified |
| Terminal UI | Implemented | `dist/terminal.html`; FA/EN + themes + Vela workspace + live Gains data (browser-verified 2026-10-31) |
| React app shell (both pages, hash routing) | Implemented | `apps/web-react` → `react/`; Playwright E2E 18/18 green on dev :5173 + build :4173 (theme, lang/dir, arrows, anchors, market rows, workspace LTR, reload teardown) — 2026-10-31 |
| Wallet connection (RainbowKit) | Implemented | `apps/web-react`; ConnectButton.Custom, Arbitrum Sepolia 421614, connection only (no txs); injected fallback without WalletConnect projectId |
| Wallet state and chain switching | Implemented | Account/balance/network chips + account/chain modals; disconnect + refresh persistence verified |
| Brand assets and brandbook | Unverified | Audit `brand/` and archive rights/content |
| Vela npm dependency | Implemented | `vendor/vela@0.9.3` + `dist/assets/vela-workspace.global.min.js` (workspace bundle; loads in classic + React pages) |
| Embedded functional Vela chart | Implemented | `dist/vela-bridge.js` mounts the full Vela workspace (topbar, drawings, indicators, search); screenshot-verified in both pages |
| Gains SDK dependency | Unverified | `vendor/gains-sdk` vendored; terminal uses the **public REST/WS API** (`api.gains.trade`) instead — endpoints verified |
| Gains market data adapter | Implemented | `dist/gains-adapter.js` + `packages/openfund-gains-adapter/`; markets/prices/candles/WS verified live 2026-10-31 |
| Arbitrum Sepolia demo contract integration | Blocked | Verify supported contracts, addresses, ABI and testnet availability |
| Positions/order lifecycle | Planned | Specify read/write lifecycle and reconciliation |
| True order-book / footprint | Blocked | Confirm legitimate trade/volume/depth data source |
| SIWE wallet authentication (EIP-4361) | Implemented | apps/backend — nonce/replay/domain/chain/signature verified; 22/22 automated checks 2026-11-01 |
| Session management (HttpOnly cookies) | Implemented | opaque hashed-id sessions, 7-day expiry, logout, account-switch invalidation |
| User identity (one wallet = one user) | Implemented | unique normalized wallet_address; find-or-create on verified signature |
| Multi-challenge accounts | Implemented | openfund_challenges lifecycle per record; ownership enforced; UI list + empty state |
| Directus user management (admin view) | Implemented | users/challenges/plans/audit visible to admins; public policy: no permission |
| User suspension enforcement | Implemented | blocks login + live sessions (backend-enforced) |
| Challenge purchase / activation | Planned | kept separate — no fake flows |
| Evaluation engine / results | Planned | fields empty until a real engine exists | SIWE-ready SessionContext, no fake auth (migration Phase 4) |
| Directus backstage (CMS) — schema, seed, public API | Implemented | `infrastructure/directus`, `apps/backstage/scripts`, `packages/cms-client`; live-edit verified end-to-end 2026-11-01 (dev + build) |
| CMS-driven translations fa/en (landing + terminal) | Implemented | `ui_messages` bridges in locale.js/terminal.js; silent static fallback tested with backstage down |
| CMS media management / navigation rendering / editorial roles | Planned | See docs/backstage/PERMISSIONS.md roadmap |
| Backend, CI and production deployment | Planned | Define deployment architecture and test gates |

Agents must update this table when verified work changes the status.

> 2026-10-31 update (branch `qwen/react-migration`): React 19 shell now runs both pages at parity with the classic build — buttons, translations, RTL/LTR, themes and navigation all E2E-verified with real browser clicks; RainbowKit wallet connection is live (testnet, connection only). Classic pages in `dist/` remain the fallback. Demo trading stays simulated; no order-book or trade-tape data is fabricated.
> 2026-10-31 update (branch `qwen/frontend-polish-vela-gains`): market data, Vela chart and terminal UX are browser-verified against the live Gains API. The `vendor/gains-sdk` (on-chain SDK) remains **Unverified/unused** — the terminal intentionally consumes the public market-data API only.
