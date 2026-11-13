# Openfund React application

React/TypeScript owns public routes, product shells, wallet/SIWE context, Portfolio and Journal. Vite serves/builds at `/`; production output is `react/` at the repository root and is hosted by the Node backend on the same origin.

From the repository root: `npm ci --include=dev --prefix apps/web-react`, then `npm run dev:web`. Use Node 26 (as CI and the backend `engines` field). Run `npm run typecheck`, `npm run test:web` and `npm run build:web`. [Local Development](../../docs/development/LOCAL_DEVELOPMENT.md) covers backend/database/CMS setup and environment variables.

Routes use browser history: `/{locale}/{page}` for public pages and `/{locale}/{product}/{page}` for Prop/Perpetual (old `/react/#/…` bookmarks are normalized client-side). Persian Home is the gateway; English Home and both Challenges routes use the existing Prop landing runtime. English Perpetual routes redirect to Prop Dashboard. Public pages also include Markets, Rulebook, sample Transparency, FAQ, Tools, Learning and Referral. Persian/English, RTL and theme support remain product contracts. Product adapters isolate financial state; missing account values are not fabricated.

`features/purchase/` hosts gated checkout, purchase/payment history and invoices (`prop/purchases`) plus withdrawal requests (`prop/withdrawals`). `session/ProfilePanel.tsx` edits name/avatar without changing wallet identity. Purchased challenge records are not executable evaluations; withdrawal requests do not pay funds.

Candidate public presentation reuses `pages/landing-body.html` and `features/information/InformationShell.tsx`, with `features/community/TelegramCommunity.tsx` in public heroes/footer only. No marketing footer belongs in TerminalShell or account workspaces. The community action is unavailable until an owner URL is configured; all five native platform cards remain Coming Soon. These dirty-branch additions are not official v0.2.0 content.

[Architecture](../../docs/architecture/ARCHITECTURE.md) · [Terminal](../../docs/trading/TERMINAL.md) · [Feature Status](../../docs/product/FEATURE_STATUS.md)
