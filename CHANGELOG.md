# Changelog

Notable changes are recorded here. Dates should use ISO 8601.

## Unreleased

### Production content overhaul + complete CMS migration (2026-11-01, branch `qwen/content-overhaul`)
- **feat(catalog):** challenge catalog replaced with the researched, adopted specification — Standard (2-phase 8%+5%, $44–$652), One-phase (12%, $74–$666), Instant (no evaluation, 5% trailing, 95% share, $60–$888) and a 14-day Free Trial — with full condition coverage (daily-loss basis + 00:00 UTC+3 reset, static/trailing drawdown, payout cycles, consistency, refunds, min trading days). Provenance in `docs/research/`; unverified items (2-Step Pro/Flex pricing) documented as not-adopted, never fabricated.
- **feat(cms):** complete migration of the public content layer to the existing Directus — new collections `home_content`, `faqs`, `trading_rules`, `legal_documents`, `footer_links` (+translations), `challenge_plans` registered as the editable commercial table (same PostgreSQL table the backend reads), `ui_messages` extended to 412 strings. Home/Rulebook/Markets/landing render from Directus at runtime; edits appear on the next page load without a rebuild; drafts filtered at the public API; whitelisted link destinations; no hardcoded marketing fallback (explicit CMS-unavailable states). Admin guide + coverage report in `docs/backstage/`.
- **feat(content):** professional bilingual copy across Home, Challenges, Markets, Rulebook, FAQ (9 catalog-accurate items), footer and legal; prototype language removed («هزینهٔ نمونه»، «پرداخت امن · فعال‌سازی آنی» false claim, «پلن‌های نمونه», fabricated team personas → role cards); honest not-yet-active disclosures preserved (purchases/payouts/trial provisioning).
- **fix(i18n):** direct route-locale change on the landing (URL edit / link) now re-runs the legacy translation pipeline — the page can no longer show fa text under an /en URL; `Number(null)→0` in the CMS client dropped Instant/Free-Trial plans — fixed; 375px header/footer overflow (wallet chip, unwrapped EN footer links) — fixed.
- **tests:** catalog unit 5/5 · information 6/6 · markets 6/6 · tsc clean · build ok · CMS E2E **35/35** (all 17 mandatory checks: live edits, unpublish, drafts, permissions, no-rebuild, Gains independence, transparency untouched) · content E2E **104/104**.

### Product Gateway, Markets page & unified website navigation (2026-11-01, branch `qwen/product-gateway-markets`)
- **feat(home):** new one-screen product gateway at `#/{locale}/home` ("همه بازارها در یک پلتفرم معاملاتی / All Markets, One Trading Platform") with two **original** Openfund vector illustrations (`assets/home/prop-trading.svg`, `assets/home/perpetual-trading.svg` — animated, reduced-motion aware, true brand colors in light mode), two product CTAs, shared header, no footer. Direction B (dual panels) is the default; `?variant=a` previews direction A on the same route.
- **feat(markets):** standalone Markets directory at `#/{locale}/markets` — **Gains Network as the authoritative source**: 488 instruments and categories derived from live metadata (never hardcoded), localized category tabs with data-derived counts, normalized client-side search (English works in fa), live mark prices via the **existing shared Gains adapter/WebSocket** (no second price engine), animated asset-universe hero, Gains-only fields (no fabricated volume/24h/market-cap), and market deep-links that open the symbol directly in the terminal.
- **feat(routing):** `/` is now the gateway (language-aware redirect); the legacy landing moved to `#/{locale}/challenges` **fully preserved** (route locale wins on boot; the language toggle syncs the URL via `history.replaceState` without remounting the legacy runtime). Legacy deep links (`#/markets`, `#/accounts`, `#/how`, `#/team`, `#/rules`, …) migrate to the page that owns the content; unknown hashes fall back to Home.
- **feat(nav):** exactly four menu items in one order on every public page — چلنج‌های معاملاتی / بازارها / قوانین معاملاتی / شفافیت (Trading Challenges / Markets / Trading Rules / Transparency) — from a single authoritative definition (`features/information/content.ts`) over the shared landing header chrome; logo → Home everywhere; terminal's Markets link now opens the Markets page; language switching preserves the page on all five pages.
- **fix(terminal):** ONE narrowly-scoped change — market deep-link boot hook (sessionStorage `of-terminal-symbol`, applied once, only for symbols in Gains metadata). Trading behavior untouched.
- **docs:** `docs/integrations/MARKETS_PAGE.md`, ADR `docs/decisions/0001-product-gateway-routing.md`, delivery report + screenshots in `docs/reviews/gateway-markets/`.
- **tests:** markets unit suite **6/6** · information regression **6/6** · tsc clean · build ok · browser E2E **53/53** (bilingual, responsive 375/1440, deep-links, legacy migration, rulebook/transparency/terminal regressions, zero page errors).

### Bilingual Rulebook and Transparency (2026-11-01)
- Add two React pages in English and Persian using the existing landing chrome, fonts, tokens and theme.
- Separate the documented demo from draft evaluation/payout terms; provide 21 numbered Rulebook sections, section navigation, tables, definitions and explanations.
- Add a labelled sample Transparency dashboard with typed fixtures, derived metrics, accessible charts, chart-period controls and data tables; no reporting API or financial integration changes.
- Preserve page identity when switching locale; add landing navigation/footer links and client-side localized metadata.
- Validation and screenshots: `docs/reviews/bilingual-pages/DELIVERY.md`.

### LuxAlgo Trade Journal integration — native Portfolio (2026-11-01, branch `qwen/portfolio-journal`)
- **feat(portfolio):** native Portfolio page (`#/portfolio`) with **the terminal's own header, fonts and design** (shared topnav, wallet chip, theme/language toggles — fa/en, RTL/LTR, dark/light): overview cards, performance analytics, equity curve (realized-basis, honestly labeled), drawdown, PnL calendar (UTC policy), filterable/paginated trading history, trade details with the ledger, and private trade notes.
- **feat(vendor):** `@luxalgo/journal-core` vendored under `third_party/` (upstream commit `834e7b6`, MIT, PROVENANCE with reproducible esbuild build) — its verified analytics (metrics, equity/drawdown, daily stats, aggregation) power the Portfolio; the Next.js app and importers are intentionally NOT included (single source of truth = Openfund engine).
- **feat(api):** `/portfolio/overview|buckets|trades|trades/:id|notes` (auth-guarded, ownership-scoped, paginated); `trade_notes` table (user-private, separate from authoritative trades).
- **fix(cors):** backend CORS now allows PUT (notes preflight was failing).
- **fix(terminal):** teardown-race guards on periodic functions (clock, renderBook/Trades/Bottom, computeForm, chartOverlay, market stats) — page transitions are error-free now.
- **tests:** portfolio backend suite **31/31** · browser E2E **36/36** (20-step acceptance + isolation + no-import probes) · full matrix green (SIWE 22/22, engine 54/54, regressions 19+9+11 dev, trading 23 + portfolio 36 on build).


### Trading math audit — Gains alignment, Vela position overlays, SL/TP & UI repairs (2026-11-01, branch `qwen/trading-math-vela`)
- **fix(engine, Gains):** closing fee now charged on the **initial** position size (was exit notional — Gains: "fees are always applied on the initial position size"); per-asset-class fee tiers (BTC/ETH 0.035%, crypto 0.05%, forex 0.012%, fallback 0.06%); fixed spread applied to execution (BTC/ETH 0.005%/side, forex 0.005%…); limit/stop fill at the target price without extra spread. All from the official fees-and-spread doc + v10 changelog; assumptions documented and classified (A/B/C).
- **fix(terminal):** SL/TP and Details dialogs were dead in server mode (`+uuid → NaN` id coercion) — fixed; liquidation column NaN fixed (engine-rule liq mapping); positions table rebuilt with fixed readable columns and all three action buttons in fa AND en (round-7 item 1).
- **feat(vela):** live **position overlays** on the chart — native `position` drawing per open trade (entry/SL/TP box with risk:reward zones), updated on SL/TP edits, removed on close/liquidation, symbol-isolated on market switch, restored after refresh; `positionId → drawingId` mapping keeps user drawings untouched.
- **feat(i18n):** Persian/Arabic-Indic numeric input accepted everywhere (normNum: ۰-۹, ٠-٩, ٫, separators) — inputs converted to `inputmode="decimal"`; fa and en produce mathematically identical trades.
- **tests:** engine suite **54/54** with independent Gains-math fixtures (no self-fulfilling expectations) · acceptance E2E extended to **23/23** (Persian digits, Vela overlay + chart/backend SL-TP agreement, Gains-fee accounting) · regressions 18/18 + 9/9 + 11/11 on dev AND build · tsc clean.


### Demo trading platform — 100,000 DAI persistent accounts (2026-11-01, branch `qwen/demo-trading`)
- **feat(trading):** every authenticated user gets ONE free demo account funded with exactly **100,000 virtual DAI** (single atomic idempotent ledger event; concurrent logins cannot double-credit; returning users restore their account, positions and history).
- **feat(engine):** server-authoritative trading engine — market/limit/stop orders (long/short), SL/TP updates, manual close, liquidation monitoring (1 s loop, runs with the browser closed), per-account locking, transactional updates, idempotency keys, stale-price rejection, ownership checks. All money math with decimal.js into NUMERIC(24,10).
- **feat(market-data):** server-side Gains feed (REST bootstrap + WS with the verified ping/pong + seq-gap protocol, 60 s REST resync) — the backend owns execution prices; the client never submits one.
- **feat(api):** `/trading/order`, `/trading/state`, close/protection/cancel (auth-guarded) + **SSE stream** pushing account/positions changes.
- **feat(ui):** TradingBridge connects the existing terminal to the backend (`window.__ofServerTP` provider swap; async submit/close/cancel/SLTP; live PnL from server marks) — unauthenticated visitors keep the labelled client demo.
- **feat(directus):** demo accounts, positions, orders and the append-only ledger are admin-visible with ALL financial fields read-only; public API: no permission (verified).
- **tests:** engine suite **52/52** (funding, PnL/fees, rejections, triggers, SL/TP, liquidation, duplicates, ownership, suspension, reconciliation) · acceptance E2E **17/17** (full wallet→trade→restore→admin scenario) · regressions 18/18 + 9/9 + 11/11 on dev AND build.
- **docs:** `docs/architecture/DEMO_TRADING.md` (architecture, execution rules, formulas, simulation assumptions, testing); audit/resume in `docs/audits/DEMO_TRADING_AUDIT.md`.
- Simulation assumptions are explicit and configurable (fees 0.05%/side, maintenance 10%, no slippage, no funding) — Gains parity is NOT claimed.


### Wallet-based user identity + backstage user management (2026-11-01, branch `qwen/wallet-identity`)
- **feat(auth):** SIWE (EIP-4361) authentication — `apps/backend` (Node 22 + Express + viem): single-use 10-min nonces, domain/chain binding, signature verification for EOAs and EIP-1271 contract wallets, HttpOnly opaque session cookies (hashed ids, 7-day server-side expiry), logout, rate limiting, input validation, audit log, generic error responses.
- **feat(identity):** one wallet = one Openfund user (unique normalized address); a user owns multiple independent challenge records (`openfund_challenges` + `challenge_plans` catalog); ownership enforced per request; suspension blocks login and live sessions; account switching invalidates the session.
- **fix(ui):** wallet area unified into ONE chip template — a single wallet chip (network dot + address + balance) plus a single action chip (sign-in / account / suspended), identical shape, size and radius on both pages and themes (replaces the mixed network/account/sign-in button shapes)
- **feat(frontend):** session UI — sign-in chip (connected ≠ logged in), signing/suspended states, profile panel with wallet/status/registration + challenge list (explicit empty state — no fake purchases); session survives refresh without re-prompting.
- **feat(backstage):** user management in Directus — `openfund_users` / `openfund_challenges` / `challenge_plans` / `audit_log` tracked for admins (search/filter/sort, m2o relations, readonly identity fields); public policy has NO permission on identity tables (verified).
- **docs:** English-only README (25 sections), USER_IDENTITY, WALLET_AUTHENTICATION, DATABASE_SCHEMA, USER_MANAGEMENT, phase-1 audit; new screenshots (wallet modal fa, profile panel).
- **tests:** SIWE matrix 22/22; full-stack session E2E 11/11 (real ECDSA signer behind a mock EIP-1193/EIP-6963 provider); regression 18/18 + round-6 9/9 on dev :5173 and build :4173.


### Round 6 — full content-editing backstage + UI fixes per user review (2026-11-01)
- **feat(cms):** FA-side editing — changing the Persian value in Directus now changes the Persian page (locale.js restores from `ofCmsLandingFa`); EN values unaffected. Editing **any** landing/terminal text (incl. buttons, nav, hero, footer) in both languages is now live.
- **feat(cms):** content-editing UX — `ui_messages` gains `section` (17 fa-labeled page areas) + `label` (friendly editor name); 110 key strings tagged (`tag_sections.py`); raw translation tables hidden from the sidebar; collection icons/notes set. Data Studio sidebar: UI Messages / Navigation / Pages / Site Settings only.
- **feat(wallet):** landing "ورود با کیف پول وب۳" card now opens the real RainbowKit modal (`window.__ofOpenConnect`); the RK modal is translated to Persian (fa not a built-in RK locale — DOM tree-walk translator + RTL) and follows the app language.
- **fix(terminal):** market category pills re-render on language switch (were stuck in the boot language); EN labels capitalized (All/Crypto/Forex/Stocks/Indices/Commodities) — static + Directus updated.
- **feat(terminal):** status bar rebuilt Gains/Hyperliquid-style: live clock with proper half-hour timezone (UTC+4:30), terminal version, live-data status + api.gains.trade source, support link; DEMO badge and garbled copy removed.
- **fix(ui):** header language/theme toggles unified at exactly 32×32 on both pages (width overflow fixed via box-sizing + min-width).
- **feat(footer):** full bilingual office addresses (Shiraz + San Francisco), Persian in fa / English in en; «توسعه‌داده‌شده در سان‌فرانسیسکو».
- WalletConnect projectId still needed for the full remote wallet list (only injected wallets show without it).


### Directus backstage — CMS for landing + terminal (2026-11-01, branch `qwen/directus-cms`)
- **feat(cms):** Directus 11.9.1 (pinned) + PostgreSQL 17 as the official Openfund backstage — docker compose deployment (`infrastructure/directus/compose.yaml`) + verified no-Docker local path (Homebrew postgres, Node 22 runtime).
- **feat(cms):** structured content model: `ui_messages` (+fa/en translations), `navigation_items`, `pages` (SEO), `site_settings`; public read-only policy on **published** content only; no tokens in the frontend.
- **feat(cms):** idempotent schema + seed scripts (`apps/backstage/scripts/`) — imported the current wording: 484 ui_messages (298 landing + 186 terminal labels), 10 navigation items, 2 pages, site settings. Re-runs never overwrite editorial changes.
- **feat(cms):** typed client (`packages/cms-client`, bundled at `apps/web-react/src/cms/client.ts`) — ONE request for all published strings, 2.5 s hard timeout, **silent fallback** to the static translations.json when the backstage is down (site stays fully usable — tested).
- **feat(cms):** both React pages await the CMS fetch before the legacy runtime boots (`window.ofCmsLanding` / `window.ofCmsTerminal` bridges in locale.js / terminal.js); CORS enabled for :5173/:4173.
- **test:** end-to-end live edit verified on dev AND build: change a value in the Data Studio → refresh the React page → the change renders (landing + terminal); fallback verified with the backstage stopped.
- **docs:** new `docs/backstage/` (README, CONTENT_MODEL, LOCAL_SETUP, TRANSLATIONS, PERMISSIONS); TECH_STACK / README / FEATURE_STATUS / MIGRATION_STATUS updated.


### Round 5 — UI polish per user review (2026-11-01, live-verified)
- **fix(terminal):** Openfund "O" chart brand moved to the **bottom-left of the plot** (was inline with the BT/BTC-USD statusline row); hover still reveals "penfund" + "Chart by Openfund Data".
- **fix(terminal):** Vela attribution link removed from the chart face and relocated as a discreet "Charts by Vela ↗" credit in the chart bottom bar — visible on the same screen, per the Apache-2.0 NOTICE requirement.
- **fix(terminal):** header language (EN ◎) / theme (◐) toggle buttons unified at 32px, matching the other icon buttons.
- **fix(landing):** footer credits logos — the blanket dark-mode invert was scoped to the black Render logo only, so the **Gains logo now shows its true teal gradients** (previously inverted to pink/orange); light-mode double-invert preserved for true brand colors in both themes.
- **feat(landing):** wallet connect button now lives in the landing header (`#wallet-root` inside nav-actions, right after the "ورود به ترمینال" CTA) with the same RainbowKit modal as the terminal; label follows the app language.
- **feat(landing):** new open-source row at the very bottom — GitHub mark + "همیشه شفاف و منبع‌باز" + "برای توسعهٔ دست‌جمعی و نظارت مداوم کاربران" (fa/en), plus the FA-only line "اولین کسب‌وکار منبع‌باز ایرانی" (auto-hidden in EN).
- Verified live on dev :5173 and build :4173 (Playwright: O position, Vela credit relocation, CTA adjacency, FA-only visibility, full regression 18/18 + fonts audited as Irancell).

### React migration: interactivity parity + wallet (2026-10-31, branch `qwen/react-migration`)
- **feat(react):** React 19 + Vite + TypeScript shell (`apps/web-react`) with both pages live at `http://127.0.0.1:4173/react/` (hash routing `#/` + `#/terminal`); build output lands in repo-root `react/`.
- **feat(wallet):** RainbowKit 2.2 + wagmi + viem + TanStack Query — custom bilingual `ConnectButton.Custom` in the terminal header (Arbitrum Sepolia, connection only, no transactions). Falls back to injected connectors when `VITE_WALLETCONNECT_PROJECT_ID` is unset (getDefaultConfig throws on an empty id).
- **fix(react):** legacy-runtime parity — working language/theme buttons, translations, RTL↔LTR and arrow glyphs in the React pages. Root causes: synthetic `DOMContentLoaded` must bubble (locale.js listens on window); StrictMode double-injection of legacy scripts (now once per page via window guard); RainbowKitProvider's `data-rk` wrapper around the whole app made the translator skip every node (provider now wraps only the wallet button); hash router hijacking in-page anchors (now intercepted, catch-all route added).
- **fix(react):** navigating between pages reloads the app (per-page StrictMode-safe reload timer) so the legacy runtime (Gains WS, intervals, Vela workspace) tears down cleanly.
- **test:** real-browser Playwright E2E — 18/18 functional checks green on dev :5173 and built :4173 (theme, lang/dir, arrows, anchors, market rows, workspace LTR + trade panel right, reload teardown).
- **docs:** README redesigned (gallery from the React app, product + funding-model intro, Mermaid architecture, 9-phase roadmap, tech registry); new `docs/architecture/TECH_STACK.md`; `docs/migration/MIGRATION_STATUS.md` phase-2a fixes recorded.

### Terminal polish round 2 (user review feedback)
- **feat(charts):** the chart is now the **full Vela workspace** (`layout:false` single-chart mode, bundled as `dist/assets/vela-workspace.global.min.js`): native topbar (symbol / timeframe / style / indicator picker), drawing toolbar, status line, bottom bar (clock, ranges), native symbol search with keyboard — replacing the custom chart toolbar entirely. Custom timeframe/indicator buttons removed.
- **fix(gains):** the live WebSocket now speaks the verified Gains protocol (`{op:...}` + mandatory `ping→pong` heartbeat + sequence-gap resubscribe). Previously it used the wrong op shape and never stayed subscribed — prices were static. Verified live: ~90 updates/s, 1803 updates in 20 s.
- **feat(terminal):** symbol switches made inside Vela's own search now sync the whole terminal (stats, order form, book) and vice-versa.
- **feat(terminal):** market dropdown redesigned (Hyperliquid-style): 5 columns (market / live price / 24h change / real funding / real open interest), live in-place price cells with tick flashes, keyboard navigation (⌘K, ↑↓, Enter, ⌘S favorite, Esc) and lazily-fetched 24h change per row.
- **feat(terminal):** real open interest (long/short from Gains metadata) now shown in the stats bar; order book rows animate (depth-bar transitions + mid-price tick flashes, dYdX/Hyperliquid-style).
- chore: removed the superseded core-only Vela bundle.


### Terminal — Vela × Gains (this branch)
- **feat(terminal):** replaced the lightweight-charts demo chart with a real **LuxAlgo Vela** chart (`@luxalgo/vela@0.9.3` global bundle in `dist/assets/vela.global.min.js`), including native crosshair, drawing toolbar, indicators and NOTICE attribution (enabled by default).
- **feat(gains):** verified **Gains Network** market-data integration (`dist/gains-adapter.js`, mirrored in `packages/openfund-gains-adapter/`): 488 live markets from `GET /v1/arbitrum/markets`, mark/index prices from `GET /prices` + the `wss://api.gains.trade/v1/arbitrum/ws` prices channel (auto-reconnect, staleness watchdog), and OHLC candles from `GET /markets/{sym}/candles` for 1m/5m/15m/30m/1h/4h/1d (**1w is not supported by Gains — verified — and is not offered**).
- **feat(charts):** `dist/vela-bridge.js` (mirrored in `packages/openfund-charts/`) mounts Vela with the Gains provider, exposing `setSymbol / setTimeframe / setTheme / resize / destroy`.
- **feat(terminal):** market selector now browses the 488 real Gains markets with category chips + search + watchlist stars; market stats show the real mark, index, 24h high/low/change (from real candles), real hourly funding and the real per-market max leverage (BTC 200×, XAU 4× …) which now clamps the leverage control.
- **feat(terminal):** the simulated demo trading engine now executes against **real Gains marks**; fees/margin/liquidation remain simplified demo assumptions (documented in the on-page "Demo assumptions" dialog). Volume, open interest, order-book depth and trade tape are **not provided by the Gains API** and are either shown as `—` or clearly labelled as simulated presentation views.
- Dark/light themes (persisted) and FA/EN bilingual UI now cover the Vela chart too (`chart.setTheme`, `chart.setLocale` best-effort).
- chore: removed temporary test/screenshot files from `dist/`.


### Documentation and structure
- Define modular Openfund application and adapter boundaries without migrating existing frontend files.
- Establish common agent collaboration rules, integration specifications, feature status, roadmap, security guidance and PR template.

### Existing repository baseline
- Landing/account and terminal prototypes exist in `dist/`.
- Charting dependency installation has been reported, but functional Vela embedding has not been verified.
- Gains SDK and testnet integration have not been verified as operational.

> This document describes the known baseline and scaffold; it is not a claim of implemented trading capabilities.
