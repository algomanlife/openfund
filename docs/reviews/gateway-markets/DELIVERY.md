# Product Gateway + Markets — Delivery Report

- **Branch:** `qwen/product-gateway-markets` (from `origin/main` @ `d4c6124`, which already
  contained round-8 dashboard PR #17 and the bilingual rulebook/transparency PR #18)
- **Date:** 2026-11-01
- **Scope:** new Home product gateway, standalone Markets page, unified 4-item website
  navigation, legacy deep-link migration. Terminal trading behavior, portfolio, engine and
  database untouched (one narrowly-scoped terminal change: market deep-link boot hook).

## Final route table

| Route | Page | Notes |
| :--- | :--- | :--- |
| `#/` | → `/{fa\|en}/home` | language-aware redirect (stored preference, default fa) |
| `#/{locale}/home` | **Home (new)** | one-screen product gateway, no footer; `?variant=a` previews direction A |
| `#/{locale}/challenges` | Trading Challenges | the preserved legacy landing, moved off `/` |
| `#/{locale}/markets` | **Markets (new)** | Gains-authoritative directory |
| `#/{locale}/rulebook` | Rulebook | unchanged content |
| `#/{locale}/transparency` | Transparency | unchanged content |
| `#/terminal`, `#/portfolio` | Terminal / Portfolio | unchanged |
| `#/{section}` (legacy) | migration | `markets`→Markets; `accounts/how/team/rules/platform/model/legal`→challenges (+post-boot scroll); unknown→Home |

## Navigation mapping (identical on all five pages)

fa: چلنج‌های معاملاتی · بازارها · قوانین معاملاتی · شفافیت —
en: Trading Challenges · Markets · Trading Rules · Transparency.
Logo → Home. Language switching preserves the current page on every page (including the
legacy landing, whose toggle now rewrites the hash with `history.replaceState`).

## Files created

- `apps/web-react/src/features/home/Home.tsx`, `home.css`
- `apps/web-react/public/assets/home/prop-trading.svg` (original, ~4 KB)
- `apps/web-react/public/assets/home/perpetual-trading.svg` (original, ~5 KB)
- `apps/web-react/src/features/markets/Markets.tsx`, `marketsData.ts`,
  `useGainsMarkets.ts`, `MarketIcon.tsx`, `markets.css`
- `apps/web-react/test/markets.test.mjs`
- `docs/integrations/MARKETS_PAGE.md`, `docs/decisions/0001-product-gateway-routing.md`,
  this report + screenshots

## Files modified

- `apps/web-react/src/main.tsx` — routes, root redirect, legacy-anchor migration,
  cross-page anchor handler (`#/#markets` → Markets page)
- `apps/web-react/src/pages/landing-body.html` — 4-item nav (dropdown removed),
  logo/brand → Home, footer Markets link → markets route
- `apps/web-react/src/pages/Landing.tsx` — route-locale sync, URL sync on toggle,
  challenges active state
- `apps/web-react/src/features/information/InformationShell.tsx` + `content.ts` —
  generalized `InfoPage`, exported `Chrome`, `footer`/`title` options, brand → Home
- `apps/web-react/public/translations.json` (+2 nav keys), `legacy/locale.js` (cache v15)
- `apps/web-react/public/legacy/terminal.js` — market deep-link boot hook ONLY
- `apps/web-react/package.json` — `test:markets` script
- `README.md`, `CHANGELOG.md`, `docs/product/FEATURE_STATUS.md`

## Test evidence (2026-11-01)

| Suite | Result |
| :--- | :--- |
| `node --test test/markets.test.mjs` | **6/6** |
| `node --test test/information.test.mjs` (regression) | **6/6** |
| `npx tsc --noEmit` | clean |
| `vite build` | ok (output in `react/`, served at :4173) |
| Browser E2E `e2e/test-gateway-markets.js` (Playwright, build :4173) | **53/53** |

E2E covers: Home fa/en (headline, both illustrations, both CTAs, one-screen fit, no
footer, 4-item nav order, logo→Home, language switch, mobile 375 + menu), variant A
preview, challenges preserved (hero/sections/Gains table/nav active/URL sync on toggle),
Markets fa/en (Gains metadata 488, tabs+counts, English search in fa, category filter
without reload, stream status, mobile), market deep-link into terminal (BTC → BTC/USD
selected, boot ready), rulebook/transparency regression (content + nav + language),
legacy hash migration (`#/markets`, `#/accounts`), terminal nav intact + terminal→Markets
link, zero page errors.

## Screenshots

`screenshots/` — home-fa-1440, home-en-1440, home-en-variant-a, home-fa-375,
markets-fa-1440, markets-en-1440, markets-fa-375, challenges-fa-1440, terminal-deeplink.

## Known limitations

1. **No live on-chain trading** — Product B CTA opens the terminal whose market data is
   real (Gains) but execution is simulated this phase; the Home note states this plainly.
2. **Classic `dist/` site** still carries the pre-gateway nav; `/react/` is the
   authoritative website (single-page hash routing cannot exist in the classic build).
3. Home `?variant=a` is a preview surface for direction A, not a separate production
   route.
4. Markets cards show only Gains-provided fields; volume/24h-change/market cap are absent
   by design (source does not provide them).
5. Landing `history.replaceState` URL sync keeps the router's internal location one step
   behind the address bar until the next navigation (harmless; verified in E2E).
