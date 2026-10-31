# Audit — legacy frontend → React migration plan (Phase 1)

## Current architecture (dist/, served at :4173/dist/)

| File | Role | React destination |
| --- | --- | --- |
| `index.html` | Landing page (FA/EN, dark/light) | `pages/Landing.tsx` + section components |
| `style.css` | Landing styles (minified layers: base, motion v2, features, model cards, themes) | `styles/landing.css` (imported as-is initially) |
| `locale.js` | i18n engine (ofT walker + translations.json, dir flip, localStorage) | `lib/i18n.ts` (context + same dictionary) |
| `translations.json` | 290 FA→EN strings | copied to `src/i18n/translations.json` |
| `motion.js` | reveal/parallax/magnetic/header-hide | `lib/motion.ts` (same logic, refs) |
| `app.js` | account presets/builder + dialogs | `pages/landing/AccountsSection.tsx` |
| `features.js` | plan rules tables + age counter | same component |
| `market.js` | Gains REST/WS market table (live) | `pages/landing/MarketsSection.tsx` + `lib/gains/*` |
| `terminal.html` | Terminal shell | `pages/Terminal.tsx` + panel components |
| `terminal.css` | Terminal styles (landing-unified chrome) | `styles/terminal.css` |
| `terminal-data.js` | PriceBoard + demo TradingProvider + L() | `lib/gains/price-board.ts`, `lib/trading/demo-engine.ts` |
| `terminal.js` | Terminal UI logic (selector, book, form, tables) | components: MarketSelector, OrderBook, OrderForm, PositionsPanel, TopNav, StatusBar |
| `gains-adapter.js` | verified Gains REST/WS adapter (window.OpenfundGains) | `lib/gains/adapter.ts` (module export, no window) |
| `vela-bridge.js` | Vela workspace mount (window.OpenfundCharts) | `lib/vela/bridge.ts` (module export) |
| `assets/vela-workspace.global.min.js` | Vela bundle (script tag) | loaded via index.html script tag (kept) |
| `wallet.js` + `src/wallet.jsx` | legacy RainbowKit demo bundle | REPLACED by Phase 3 (proper RainbowKit in React) |

## Rules to preserve
1. Language switch: header flips dir; workspace pinned LTR; texts translate; numbers Latin LTR.
2. Light theme: host-level `invert(1) hue-180` (landing + terminal), logos double-inverted.
3. Terminal workspace: chart | book | trade-panel(right) — FIXED.
4. Vela: full workspace, no symbol chip in topbar, attribution replaced by O branding + Vela credit link (NOTICE).
5. Gains: op-protocol WS (ping/pong + seq), no fabricated volume/OI/depth (OI from /markets metadata).
6. Buttons/header = landing design system (single source of truth).
7. i18n: FA trading labels = Iranian Finglish (اوردربوک/لانگ/شورت/...), ofT-style dictionary.

## React app structure (apps/web-react/)

```
apps/web-react/
  vite.config.ts        (base:'/react/', build.outDir:'../../react')
  src/
    main.tsx  App.tsx   (router: / landing, /terminal)
    i18n/               (I18nContext, translations.json)
    theme/              (ThemeContext, css vars, invert light)
    lib/gains/          (adapter.ts, price-board.ts, use-markets.ts, use-prices.ts)
    lib/vela/           (bridge.ts, VelaChart.tsx)
    lib/trading/        (demo-engine.ts, TradingContext.tsx)
    components/ui/      (Button, Dialog, Toggle … landing button system)
    pages/landing/      (Hero, Markets, Platform, ModelCards, Features, Philosophy, Accounts, How, FAQ, Team, Footer)
    pages/terminal/     (TopNav, MarketBar, MarketSelector, ChartPanel, OrderBook, OrderForm, Workspace, StatusBar)
  public/assets/        (fonts, logos, vela bundle)
```

## Build & serve
- dev: `npm run dev` (Vite :5173)
- prod: `npm run build` → repo-root `react/` → **http://127.0.0.1:4173/react/** (same static server)
- legacy fallback stays at /dist/ until Phase 5 passes.
