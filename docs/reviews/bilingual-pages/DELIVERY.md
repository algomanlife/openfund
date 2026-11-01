# Bilingual Rulebook and Transparency

Delivered 2026-11-01 on `codex/bilingual-rulebook-transparency`, based on `origin/main` at `81179c1`. Implemented in the existing React application, not a separate website. Review and merge remain separate steps; no production deployment was requested.

## Routes and scope

The application already uses React Router hash routing with the `/react/` base. The added routes follow that convention:

| English | Persian |
| --- | --- |
| `/react/#/en/rulebook` | `/react/#/fa/rulebook` |
| `/react/#/en/transparency` | `/react/#/fa/transparency` |

Language switching preserves the page. Unknown locale prefixes redirect to Persian. Existing terminal and portfolio routes remain unchanged.

No trading, pricing, challenge, wallet authentication, portfolio, database, Directus schema/permissions or smart-contract implementation was modified. The generated `react/` output was used for production verification and is excluded from the source change. Build it using the existing build command.

## Existing landing design extracted before implementation

Inspected the real landing in the browser and its authoritative `apps/web-react/public/legacy/style.css` and `landing-body.html` source.

| Element | Existing source / reuse |
| --- | --- |
| Fonts | Local Irancell, weights 400/500/600/700/900; Ubuntu, 400/700; existing FA/EN font rules retained. No fonts added. |
| Color tokens | `--bg: #060808`, `--surface: #0b1010`, `--mint: #82e7bd`, `--white: #f1f3ef`, `--body: #b5bebb`, `--muted: #84928e`, `--line: #ffffff18`. |
| Backgrounds | Existing dark canvas, restrained mint atmosphere and radial/linear green card gradients. Reused `.hero-atmosphere`, `.model-card`, `.philosophy-panel`. |
| Borders / radii | Existing low-opacity mint/white borders; button 6px, table 7px, editorial cards 16–18px, pills 999px. |
| Container | `min(1240px, 100%)`, 40px inline padding; 28px below 1000px and 20px below 700px. |
| Type hierarchy | Landing hero 65px FA / 58px EN, 39–40px mobile; section headings around 40px; body 14–17px. New long-form headings use 31px, 25px mobile. |
| Spacing | Observed intervals 12/20/24/28/35/40px; page sections typically 70–110px apart. New information sections follow these intervals. |
| Buttons / links | Existing `.button`, `.text-link`, `.nav-cta`, `.language-toggle`, `.theme-toggle`, `.pill`. White primary action, mint focus ring, subtle hover lift. |
| Header / footer | Derived directly from landing markup, including existing navigation, attribution, document links and wallet control. No duplicate brand layout to drift. |
| Navigation | Existing mobile menu is enabled through 1000px because the two new links otherwise overflow at tablet width. Its original styling/behavior is retained. New-page header controls fit at 375px. |
| RTL | HTML `lang`/`dir`, logical spacing/borders, localized numbers and dates, isolated numerical values, LTR formulas and a documented chronological LTR chart axis. |
| Themes | Existing light-theme inversion is preserved; theme preference is shared through `of-theme`. No replacement palette introduced. |
| Motion | Reused atmosphere and existing hover transitions; reduced-motion CSS disables animation/transition. Keyboard section links move focus. |

New selectors are scoped to `.information-page`, except the small shared-header tablet menu adjustment required by the new navigation links. The landing content and visual sections have not been redesigned.

## References and original content

Inspected the [reference Rulebook](https://carrotfunding.io/rulebook/) and [reference Transparency page](https://carrotfunding.io/transparency/). The first provided a useful outline for account definitions, risk limits, stages, conditions, payouts and support, with contents navigation, formulas and comparison tables. The second suggested reporting totals, infrastructure explanations, verification steps and records. Their commercial values, protocol claims, text, branding, illustrations, transaction links and wallets were not imported.

Openfund copy was written in English and Persian from these repository sources:

- `docs/architecture/DEMO_TRADING.md` and `apps/backend/engine.js`: authenticated demo funding, execution and accounting assumptions.
- `apps/backend/seed-plans.js`: provisional plan metadata, explicitly labelled inactive.
- `apps/web-react/src/pages/landing-body.html` and `public/legacy/features.js`: prototype plan examples, not confirmed offers.
- `docs/product/FEATURE_STATUS.md`: planned evaluation, purchasing and verification capabilities.
- `docs/architecture/WALLET_AUTHENTICATION.md` and `src/session/useOpenfundSession.tsx`: wallet ownership/session distinction.
- `apps/backend/portfolio.js` and `docs/audits/TRADE_JOURNAL_INTEGRATION_AUDIT.md`: account-derived analytics architecture.

Architecture descriptions are source-backed statements about implemented code, not claims that all backing services were live-verified in this task.

## Rulebook

Twenty-one numbered sections: overview; evaluation flow; terminology; account configurations; stages; targets; daily loss; maximum loss; equity/balance/margin; violations; conditions; markets; leverage; funded-account framework; identity; fees; payouts; verification; prohibited practices; summary; support/security.

Each section has a typed stable ID, bilingual title/paragraphs and `current`, `draft` or `planned` classification. Shared table structures have translated captions/headers, row headers and focusable horizontal scroll regions. Three formula blocks explain accounting/exposure/targets; two native disclosures expand examples. Desktop contents is sticky with active-section highlighting; mobile uses a labelled sticky select. Anchors and back-to-top respect the existing hash-router anchor handling.

The top notice identifies this as a working draft. Sample loss limits, targets, shares and plan sizes are traceable to existing Openfund examples and never described as enforced commercial rules.

### Commercial values needing confirmation

| Topic | Still requires approval / publication |
| --- | --- |
| Targets | Final percentages, net-profit basis, treatment of open positions and phase completion. Existing 5%/10% examples remain provisional. |
| Loss limits | Final percentages, balance/equity basis, static/trailing method, daily window/time zone, fee treatment, breach boundary. |
| Evaluation conditions | Time limits, minimum days, news/weekend/automation policies, holding periods, sanctions for violations, appeals and resets. |
| Funded accounts | Nature of account/capital, contractual rights, risk rules and termination. |
| Fees | Purchase price, taxes, refunds, recurring charges and payout costs. |
| Payouts | Split, eligibility, minimums, frequency, processing time, cap, currency and network. No guaranteed 24-hour payment. |
| Identity | KYC provider/documents, age/geography, deadlines and appeal process. Wallet signature alone is not KYC. |
| Support | Commercial contact channel, response commitment and appeals procedure. GitHub issues is presented only for product issues. |

## Transparency data and UI

`src/features/transparency/data/mockTransparency.ts` owns typed synthetic values with `provenance: 'sample'`, 14 consecutive ISO dates, numeric locale-independent history, outcomes and reusable metric definitions. It contains no API calls, wallets, transaction links or real account records.

`summarize()` derives volume, trades and virtual PnL from daily rows; completed evaluations = passed + failed; pass rate = passed / completed, excluding in-progress and guarding zero completions. The illustrative unique-account count is separate from daily active counts.

The interface contains six metric cards, a line chart, outcome donut/legend, diverging daily PnL chart, a 7/14-day chart control and an expandable exact-data table. Chart-period selection changes the charts/table; headline figures retain the explicitly stated whole-fixture period. Chart SVGs have accessible titles/descriptions and exact values are in the table. All numerical displays are labelled sample; evaluation results are additionally marked proposed reporting because the engine is not active.

`TransparencyDataState` separates loading/empty/error/ready states. The independently renderable `TransparencyDashboard` accepts that contract. A future API adapter can supply it without redesign; the current page uses synchronous fixtures and makes no fake reporting request. The page also covers evaluation monitoring, market data, demo engine, PostgreSQL records, portfolio analytics, Openfund Protocol and a planned verification roadmap without invented deployment dates or proofs.

## Localization, CMS and metadata

- Typed local `Localized<T>` content modules have both languages. New bodies do not depend on the legacy whole-document translation observer.
- Shared chrome uses the existing static translation dictionary plus published Directus overrides through the unchanged CMS client. The current CMS contract supports landing/terminal/common messages, not a confirmed long-form page renderer, so new page bodies remain local modules suitable for a future adapter. No collections were added.
- The locale bridge waits out legacy-page teardown, and the landing motion observer ignores router links when finding section anchors. `of-language` and `of-theme` compatibility keeps existing wallet chrome synchronized without changing wallet code.
- Each route sets localized document language/direction, title, description, canonical and English/Persian/x-default alternate links. These are client-side metadata with the real hash URLs; there is no new SSR/prerender infrastructure.

## Verification

Baseline on latest main: production build and genuine `npx tsc --noEmit` passed. Existing wallet dependency annotation/chunk-size warnings were recorded; they remain non-blocking. The repository root test script is a placeholder, and the frontend had no test script for these pages before this task.

Final checks:

- `npm run test:information`: **6/6 passed**. Covers changed-fixture reconciliation, denominator semantics, zero outcomes, consecutive dates/finite numbers, full bilingual rule structure, accessible chart rendering and all loading/empty/error states in both languages.
- `npx tsc --noEmit`: passed. The pre-existing `build:check` script masks failures with `|| true`; it was not used as evidence.
- `npm run build`: passed. Existing large-wallet-chunk warnings remain.
- Production build served at `/react/`: **16/16 responsive cases passed** across four routes × 375/768/1024/1440px. Every measured document width equals viewport width. See [browser-matrix.json](browser-matrix.json).
- Browser interactions: locale switches stay on equivalent pages; labels/direction/wallet text and metadata update; chart control changes history to seven rows; native disclosure expands; theme toggles; desktop/mobile section navigation, focus, active contents, menu open/Escape, home-section return and new header/footer links verified. Final clean-tab navigation regression recorded zero browser errors; see [navigation-regression.json](navigation-regression.json).
- Static scope review: terminal, portfolio, wallet implementation, backend, schema and financial engines unchanged. This was not a fresh end-to-end financial-engine test run.

Known inherited limits: original homepage has 479px content width at a 375px English viewport, independently reproduced on the original checkout; this task keeps that unrelated legacy issue separate. Its new tablet overflow was corrected with the existing menu. The inherited `/react/downloads/Openfund-brandbook.zip` link returns 404 in both source layouts because the asset is absent; the link is preserved. Several existing homepage marketing assertions remain as originally authored, outside the authorized copy scope. Hash routing/client metadata limits search indexing until a separate deployment/SEO change. No production reporting service or commercial policy approval is implied.

## Files

Created:

- `apps/web-react/src/features/information/{content.ts,InformationShell.tsx,information.css}`
- `apps/web-react/src/features/rulebook/{content.ts,Rulebook.tsx}`
- `apps/web-react/src/features/transparency/{content.ts,Transparency.tsx,TransparencyDashboard.tsx,data/mockTransparency.ts}`
- `apps/web-react/test/information.test.mjs`
- This report, browser matrix and screenshots.

Modified: `apps/web-react/src/main.tsx`, `src/pages/Landing.tsx`, `src/pages/landing-body.html`, `public/translations.json`, `public/legacy/motion.js` (router-link selector only), `apps/web-react/package.json`, root `README.md`, `CHANGELOG.md`, and `docs/product/FEATURE_STATUS.md`.

## Screenshots

| Page | English desktop | Persian desktop | English mobile, full page | Persian mobile, full page |
| --- | --- | --- | --- | --- |
| Rulebook | [EN](screenshots/rulebook-en-1440.jpg) | [FA](screenshots/rulebook-fa-1440.jpg) | [EN](screenshots/rulebook-en-375.jpg) | [FA](screenshots/rulebook-fa-375.jpg) |
| Transparency | [EN](screenshots/transparency-en-1440.jpg) | [FA](screenshots/transparency-fa-1440.jpg) | [EN](screenshots/transparency-en-375.jpg) | [FA](screenshots/transparency-fa-375.jpg) |

Additional Persian [dashboard](screenshots/transparency-fa-dashboard.jpg) and [charts](screenshots/transparency-fa-charts.jpg) views show the actual reporting layout below the hero. A [Rulebook contents view](screenshots/rulebook-en-contents.jpg) records the active section and formula styling.
