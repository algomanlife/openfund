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
- [ ] inventory of dist/ scripts, styles, state, adapters (written into docs/migration/AUDIT.md)
- [ ] component tree + module plan

## Phase 2 — React + TS + Vite app
- [ ] scaffold app (vite react-ts) in `apps/web-react/` (legacy dist/ untouched)
- [ ] design tokens + theme (dark/light invert) + i18n skeleton (fa/en, layout rules)
- [ ] Gains adapter + Vela bridge imported as modules (keep working)
- [ ] landing page components
- [ ] terminal page components (workspace LTR fixed, Gains selector, order panel)
- [ ] routing + language/theme persistence
- [ ] dev build runs; visual parity screenshots

## Phase 3 — RainbowKit
- [ ] RainbowKit + wagmi + viem + TanStack Query wired (versions from package.json)
- [ ] ConnectButton in terminal header, modal, address, account switch, network status, disconnect, persistence
- [ ] Arbitrum Sepolia configurable test network (no Gains contracts assumed)
- [ ] fa/en + dark/light theming of the modal
- [ ] no transactions/approvals — connection only

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
