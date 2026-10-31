# Migration status — React + RainbowKit (branch qwen/react-migration)

> RESUME FILE. Updated after every step and committed.
> If work is interrupted, continue from the first unchecked item.
> The legacy frontend in `dist/` remains the fallback until Phase 5 passes.

## Phase 0 — round-4 UI fixes (on legacy dist/)
- [x] 0.6 chart branding: O at top-left plot corner (was bottom, over range bar) — fixed
- [x] 0.1 terminal header restyled to landing design (height/blur/border, brand lockup + caption, nav underline motion, toggles/wallet styles)
- [x] 0.2/0.5 terminal buttons unified with landing button system (white primary + hover motion)
- [x] 0.3 footer credit logos keep true brand colors in dark AND light (double-invert SVGs in light)
- [x] 0.4 Hybrid-model + No-hidden-rules cards below platform section (FA/EN)
- [x] 0.x commit phase 0

## Phase 1 — audit & plan
- [x] inventory of dist/ scripts, styles, state, adapters (docs/migration/AUDIT.md)
- [x] component tree + module plan (AUDIT.md)

## Phase 2 — React + TS + Vite app
- [x] scaffold app (vite react-ts) in apps/web-react/ — BUILDING to repo-root react/, served at http://127.0.0.1:4173/react/
- [ ] design tokens + theme (dark/light invert) + i18n skeleton (fa/en, layout rules)
- [x] Gains adapter + Vela bridge + all legacy logic running (script modules after mount); styles/fonts identical (same css files, paths fixed)
- [ ] landing page components
- [ ] terminal page components (workspace LTR fixed, Gains selector, order panel)
- [x] hash routing (#/ and #/terminal) — static-server friendly
- [x] visual parity verified: landing + terminal screenshots match legacy (dark theme, Finglish, live Gains data)

## Phase 3 — RainbowKit
- [x] RainbowKit + wagmi + viem + TanStack Query wired (getDefaultConfig, WalletProvider)
- [x] Custom bilingual ConnectButton portal in terminal header (replaces legacy demo button): modal, address, balance, account switch, network status, disconnect, persistence
- [x] Arbitrum Sepolia (chain 421614) via VITE_WALLETCONNECT_PROJECT_ID (.env.example); no Gains contracts assumed
- [x] fa/en custom button labels; dark/light theme follows app theme (mint accent). NOTE: RainbowKit modal itself has no built-in fa locale — trigger/account surfaces fully translated, modal remains EN
- [x] connection only — no transactions/approvals

## Phase 4 — auth boundary
- [ ] SessionContext stub separating wallet connection from Openfund sessions (SIWE-ready interface, no fake auth)

## Phase 5 — regression (production build)
- [ ] landing / terminal parity, Vela init, Gains symbols + live prices
- [ ] lang switch, theme switch, responsive, wallet connect/disconnect/switch, refresh persistence
- [ ] `npm run build` output served and verified

## Phase 6 — delivery
- [ ] README / ARCHITECTURE / FEATURE_STATUS / CHANGELOG updates
- [ ] dev + prod commands documented
- [ ] PR opened (no merge without review)

## Environment notes
- Repo: Openfund_Landing_FA (server: python3 http.server 4173 -> dist/)
- Base branch: qwen/react-migration (from qwen/round-3-fixes, PR #2 still open)
- Vela bundle: dist/assets/vela-workspace.global.min.js (window.VelaWorkspace.VelaWorkspace)
- Gains WS protocol: op-shape + ping/pong + seq resubscribe (dist/gains-adapter.js)
- Bash quirk: absolute paths with spaces intermittently fail in python subprocess — use cd + relative paths

## Live URLs
- Public (QW Pages): https://deq7xbgv.qwenwork.page/  (#/ landing, #/terminal)
- Local React: http://127.0.0.1:4173/react/  |  Local legacy: http://127.0.0.1:4173/dist/
- WalletConnect needs a real project id in apps/web-react/.env (VITE_WALLETCONNECT_PROJECT_ID); injected wallets (MetaMask/Rabby) work without it.
