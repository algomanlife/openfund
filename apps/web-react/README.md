# Openfund React application

React/TypeScript owns public routes, product shells, wallet/SIWE context, Portfolio and Journal. Vite serves/builds at `/react/`; production output is `react/` at the repository root and is hosted by the Node backend on the same origin.

From the repository root: `npm ci --include=dev --prefix apps/web-react`, then `npm run dev:web`. Use Node 22. Run `npm run typecheck`, `npm run test:web` and `npm run build:web`. [Local Development](../../docs/development/LOCAL_DEVELOPMENT.md) covers backend/database/CMS setup and environment variables.

Routes follow `/react/#/{locale}/{product}/{page}` for Prop/Perpetual. Public pages are Home, Challenges, Markets, Rulebook and sample Transparency. Persian/English, RTL and theme support remain product contracts. Product adapters isolate financial state; missing account values are not fabricated.

[Architecture](../../docs/architecture/ARCHITECTURE.md) · [Terminal](../../docs/trading/TERMINAL.md) · [Feature Status](../../docs/product/FEATURE_STATUS.md)
