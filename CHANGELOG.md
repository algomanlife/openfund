# Changelog

## Unreleased

- **Fix: Economy menu banners side by side (owner fix 1).** The banner column was a fixed 260 px, so the whitepaper banner stacked under the council banner and left a tall banner column with an empty gap in the middle of the panel. A group with two banners now gets a `has-banner-pair` body with a 520 to 560 px banner column. The two banners are equal cards side by side; a subgrid lines up their art, titles, bodies and calls to action, and they stretch to the tile list's height, so no gap remains (the panel is 425 px tall instead of 510 px at 1440 px). Single-banner groups keep their layout. In the drawer, the two compact horizontal cards stack whenever the drawer row is narrower than 420 px (a container query, since the drawer is about 344 px wide even on tablets). `e2e/test-mega-menu.cjs` gains 41 checks (69 in total).
- **Fix: header controls are one size (owner fix 5).** The search button was 44 px while its neighbours were 36 px (40 px on phones, 30 px in the terminal), because it never read the header's control height. Every header now defines one height and radius (`--hc-h`, `--hc-r`, plus `--hc-icon`), and search, theme, language, "Enter terminal", "Connect wallet" and the menu all use it; search is a square of that height with the same border, radius and icon size. On touch screens each control gets an invisible 44 × 44 px hit area (a `::after` pseudo-element) instead of a larger visible box. This covers the website, terminal, compact terminal and phone headers in both themes and directions. New browser suite `test:browser:header-controls` (533 checks at seven widths, five locales, both themes, in CI).
- **Release planner: opt-in owner patch line.** The Unified release workflow gains a `keep_minor_line` input. With an explicit `release_version`, it lets a batch whose commits allocate only a minor bump stay in the latest tag's minor line (for example `0.8.5` after `v0.8.0`). It is off by default, so existing allocation is unchanged; breaking-change batches, versions outside that line and reused tags are still refused, and no tag is moved.
- **Bug bounty program (item J).** New `/:locale/bug-bounty` page ([ADR 0057](docs/decisions/0057-bug-bounty.md)), linked from Resources → Security, the footer and `SECURITY.md`. It has a security-scan hero (illustrative), reward cards (defaults: Critical $2,000; High $1,000 to $1,500; Medium $500 to $800; Low $300; exceptional findings may receive more), a filterable scope table, rules with a safe-harbor statement, a report → triage → fix → payout → disclosure timeline, a consent-only hall of fame (empty until someone agrees to be named) and a FAQ. Reports go through GitHub's private advisory flow. Reward amounts are owner-edited in Backstage → Security → Bug bounty (Directus `bug_bounty_tiers`, owner gated and audited). Payouts are recorded as verified expenses in the new `bug_bounty` category. The backend serves `/.well-known/security.txt` (RFC 9116) from each region's own origin.
- **Terminal guide (item K).** An educational, multi-step popup on the trading terminal ([ADR 0056](docs/decisions/0056-terminal-guide.md)). Each step has a video (MP4 and WebM with a poster) or an image, Persian and English copy (other languages read English) and Persian and English WebVTT subtitles. It opens every time the terminal is entered unless the visitor ticked "Don't show again" for the current version; that choice is a cookie holding only the version number (`SameSite=Lax`, `Secure` on https, lifetime set in Backstage). A "Guide" entry in the terminal menu reopens it. Backstage → Marketing → Terminal guide creates, edits, reorders and archives steps, uploads media checked by signature and size, previews, activates, sets the cookie lifetime and publishes a new version, with anonymous counters (`POST /guides/events`, table `guide_daily_stats`). The two seeded videos, "Connect your wallet and activate your account for trading" and "Find a market and open a position", were recorded from Openfund's own terminal with `scripts/guides/record-terminal-guide.mjs` (local build, demo data, a generated test wallet with the address masked). Promotional popups stay banned on the terminal.
- **Labs: limited drops (item M).** New `/:locale/labs` page and `GET /labs` ([ADR 0055](docs/decisions/0055-labs-limited-drops.md)). A drop is a plan published from Backstage plan administration with a `lab` block (number, inventory, per-wallet cap of 1 to 5, sale window); inventory is counted from paid orders and live reservations under a lock on the plan row, so it is never oversold, and an unpaid reservation returns to the drop once its order expires past the late-payment grace. Drops stay out of the normal plan catalog; checkout takes one with `?lab=`. The page shows the drop as a capsule card: price, tightness gauges against the standard plans, the real inventory, a countdown, a quantity selector, and its rules on the trading-objectives cards. It also has an archive of previous drops with the real number sold and a FAQ with the simulated-demo disclaimer. The Challenges menu has a Labs tile whose badge names the open drop. No drop is defined in code: until the owner publishes one, the page says so and sells nothing. Plan validation now refuses rules the evaluation engine does not enforce (an end-of-day trailing maximum loss, a cap on the number of payouts, a minimum daily profit for a trading day, or an unknown drawdown mode) instead of publishing them.
- **Fix: the transparency sales table no longer shows raw plan slugs.** Each row now shows the reviewed, localized plan name, or "Drop #N" for a Labs drop. Before this fix, a Labs drop's operator slug appeared as untranslated English in every locale. `GET /economy/transparency` adds `model` and `labNumber` to each `sales.byAccount` row.
- **Trading objectives page and funded-trader agreement (item L).** New `/:locale/trading-objectives` page ([ADR 0054](docs/decisions/0054-funded-trader-agreement.md)): a tab per paid plan and an account size selector, with one card per objective (profit target, daily loss, maximum or trailing loss, trading days, consistency, profit split, payout cycle, conduct, fee refund) whose dollar amounts are computed from the published catalog, each linking to its rulebook section; a stage progression, worked pass and fail scenarios, the other paths, a FAQ and a buy link that carries the plan and size to checkout. Small original schematics animate only while on screen and stop under reduced motion. It is linked from the challenges menu, the landing page and checkout. Funded accounts created on or after `FUNDED_AGREEMENT_FROM` must sign the funded-trader agreement with their wallet (EIP-191, or EIP-1271 for contract wallets) before the first order; the engine answers `409 funded_agreement_required` until then, and the profile shows a signing card. The setting is unset by default, so no account already trading is blocked. New table `funded_agreements` (append-only) and endpoints `GET /funded/agreements`, `POST /funded/agreements/:id/message`, `POST /funded/agreements/:id`.
- **Site search and search analytics (item D).** A search button beside the theme toggle in the website, terminal and mobile headers, plus `Ctrl/⌘+K` and `/`, opens a command palette ([ADR 0052](docs/decisions/0052-site-search.md)): a lazily loaded per-locale index of published content only (pages, FAQ, glossary, rules, learning paths, tools, whitepaper chapters, developer docs and market symbols), grouped results with icons and highlighting, keyboard navigation, combobox/listbox ARIA, local recent searches, and full screen on phones. `/:locale/search?q=` adds filter tabs, pagination and editor suggestions when nothing matches; it is `noindex`. Persian and Arabic letters, ZWNJ, diacritics and Persian/Arabic/Latin digits are normalized; typos within one or two edits and editor synonyms still match. `GET /search/index` is built per region from the CMS snapshot (IRAN serves its own); `POST /search/events` keeps anonymous daily counts per locale and masked query (no IP, wallet, user id, cookie or user agent; twelve-month retention). Backstage gains a Search analytics dashboard (top, zero-result and no-click queries, trend, filters, CSV export, one-click synonym or suggestion). New Directus collections `search_synonyms` and `search_suggestions`; new table `search_query_stats`; shared core in `packages/site-search`. Bugs fixed: the visual-editing build plugin now decodes its own file path, so `npm run build:web` works in a checkout whose path contains a space. **Bugs fixed:** the header search trigger is now owned by React for its label, so the legacy landing translator no longer re-translates it (Arabic and Chinese showed it as untranslated); on phones up to 430 px with a connected wallet, "Enter terminal" becomes a compact icon button so the search trigger stays on screen.
- **Follow-ups (item H).** `FEATURE_STATUS.md` is corrected from evidence: rows that still said "branch", "unmerged" or "not deployed" now name the PR that merged them and whether they are in the v0.8.0 tag or deployed on GLOBAL (production `/version` reports `main` at `9f8b171`, checked 2026-11-23; `docs/status/status.json` records that commit). The header mega menu now also closes on Escape wherever focus is (including after a hover-open), and on every route change (a tile link, Back, or an in-page section change on the challenges page), with browser tests for Escape, outside click and route change. The Applications page frames, captured from Open Trade 0.0.2, are labelled "Captured from 0.0.2" instead of carrying a "0.0.2 BETA" title, so they are not read as the current 0.0.4 release (genuine 0.0.4 captures need a desktop build at the tag).
- **Terminal Funding and Details tabs (item G).** The chart panel's tab bar is now Chart | Funding | Details | News & info, with arrow, Home and End keys (mirrored in RTL) and matching phone workspace views ([ADR 0053](docs/decisions/0053-terminal-funding-history.md)). Funding shows current long and short funding, borrowing, an open-interest ratio bar and skew from the documented Gains endpoints, and a history chart with a zero line (mint above, coral below), range (1D, 1W, 1M, 3M) and interval (1h, 4h, 1d) selectors, a long/short switch, a tooltip and an annualized toggle, labelled "Market data from Gains Network". Gains publishes no funding history, so the backend samples the documented `/markets` list hourly (`market_funding_samples`, 400-day retention); ranges without enough samples are disabled and say from when data exists, and nothing is estimated. Details shows the Gains market specification and your Openfund account limits as two cards. New endpoints `GET /markets/:symbol/funding`, `/details` and `/funding-history`.
- **Migration to Openfund (item B).** A trader with a funded account at a recognised prop firm and at least three payouts in the last twelve months proves it and buys a Standard or One-phase challenge that starts at the funded stage, at the normal price and with the plan's normal funded rules, up to the largest proven funded size ([ADR 0051](docs/decisions/0051-migration-to-openfund.md)). **Flow**: request (firm, largest funded size, full name), upload with a live checklist (identity document, funded-account proof, three distinct payouts in the window), Backstage review queue, approve or reject with an audited reason (approval also needs KYC and a name match), a single-use wallet-bound migration pass, and checkout's Migration path (`/checkout?migration=<pass>`: eligible plans and sizes only, no coupon). Provisioning consumes the pass under a row lock and starts the challenge at stage 0. One migration per person; rules, eligible plans, retention and the firm list (FTMO, FundingPips, FundedNext, E8 Markets; text only, with a not-affiliated disclaimer) are editable in Backstage. **Evidence storage**: a private S3-compatible bucket (`MIGRATION_STORAGE_*`, secrets `sync: false`), SigV4 implemented in `migration-storage.js` (checked against the AWS test vector), server-side encryption, download-only signed links for reviewers (at most 15 minutes), inert formats checked by content (PDFs with scripts or embedded files refused), automatic deletion 90 days after the decision, and each region keeps its own files. On-chain payouts are checked through the configured RPC endpoints as a reviewer signal. Until storage is configured the form says "opening soon" and stores nothing. **Owner update (2026-11-23):** the `/migrate` hero is a frameless, full-bleed flamingo scene (birds at three depths in the upper sky; three land in the shallow water, wade and take off again; never over the copy or call to action; fewer, smaller birds on phones; static under reduced motion); the menu flamingo banner no longer shows the OpenFi mark or its reflection; the accepted-firms list shows each firm's name, official site, accepted program types and the evidence the firm provides, with an optional logo the owner uploads in Backstage (PNG, JPEG or WebP up to 200 KB; never downloaded or recreated) and an original monogram badge until then; the request form asks for an email address; the Economy menu gains a second featured banner, "Openfund whitepaper" (an animated document: a page turns, mint lines and a chart draw in; two compact horizontal cards in the drawer; static under reduced motion). **Website**: `/:locale/migrate` with the cinematic flamingo hero, a normal-versus-migration comparison, the steps, accepted evidence, the request and status panel and questions; a migration card on the challenges page. Schema: `migration_firms`, `migration_settings`, `migration_requests`, `migration_evidence`, `migration_events` (append-only), `migration_passes` and `purchase_orders.migration_pass_id`. New `test:migration` (in `test:all`) and browser suite `test:browser:migration` (22 checks, in CI).
- **Openfund Premium League (item A).** A 30-trading-day demo competition ([ADR 0050](docs/decisions/0050-openfund-premium-league.md)): one $125,000 account per entrant, daily loss 5% (UTC+3 day basis), static maximum loss 10%, consistency 35%, ranked by final equity to the cent (ties: lower maximum drawdown, then the earlier time the final equity was reached). Start Monday 4 January 2027, 00:00 UTC. **Backend** (`apps/backend/tournament.js`): accounts are ordinary challenge accounts from a hidden, never-sold plan, so the engine enforces the limits; a breach marks the entry "out of ranking" and leaves the account open for practice. Registration needs the wallet session, a verified email (6-digit code, stored hashed, rate-limited), an optional nickname and acceptance of the published terms; one entry per wallet and per email. Server-side equity samples feed the live leaderboard (masked wallets or nicknames); the owner freezes the standings after the end, then issues awards idempotently: cash and hardware tracked to fulfilment, a $50K Standard challenge entitlement for ranks 4 to 10, a single-use 35% wallet-bound coupon for ranks 11 to 100, rank and Finisher badges as certificates. New tables `tournaments`, `tournament_registrations`, `tournament_email_codes`, `tournament_snapshots`, `tournament_standings` (append-only) and `tournament_awards`. **Email**: `apps/backend/email.js`, one provider adapter (`EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`); until configured, registration says "opens soon" and collects nothing. **Website**: `/:locale/tournament` with a neon countdown, a podium with falling-cash motion, an original prize scene (generic console, controller and blank cases in a neon city; product names in text only), rule gauges, a timeline, ten rank badges plus Finisher, the registration count or leaderboard, a four-step registration (wallet, email, code, done with confetti and a downloadable "I'm in" card) and questions; `/:locale/tournament/terms` renders only a published terms document. Motion is transform/opacity only and runs only while on screen and the tab is visible. IRAN shows that the competition is not available there. **Backstage**: a Competitions section with schedule and status changes before the start, registrations (CSV export), review signals, disqualification, finalization, award issuing and fulfilment tracking, all owner-gated and audited. Draft terms (`legal_documents`, `doc_type 'tournament-terms'`) are seeded once as a draft for the owner to review and publish. New `test:tournament` (in `test:all`) and browser suite `test:browser:tournament` (25 checks, in CI). **Bug fixed:** the home page showed "This section's content is unavailable" while the CMS request was still loading, then replaced the whole page when it answered; it now shows a quiet placeholder until the request settles.
- **Backstage fully operational (item E).** A section-by-section audit is recorded in [`docs/backstage/CAPABILITY_MATRIX.md`](docs/backstage/CAPABILITY_MATRIX.md); everything found broken is fixed. **Plans administration**: the owner creates, edits (JSON draft with a field-by-field diff preview), publishes (catalog version bump, history in the append-only `plan_catalog_history`), retires and reactivates challenge plans. One shared validator (`packages/plan-validation`) backs the website catalog and the backend, which also requires `normalizeRules` to accept the plan; existing challenges keep their frozen rules ([ADR 0049](docs/decisions/0049-backstage-plan-administration-and-entitlements.md)). **Challenges**: owner-gated, reasoned decisions to extend the time limit, void, fail or pass to the next stage, settled through the engine and refused while a market has no fresh mark. **Entitlements**: issue a challenge or a funded account as a single-use 100% coupon bound to one wallet, plan and size (`granted_entitlements`); a funded entitlement starts at stage 0 through the normal checkout provisioning. **Traders**: a full profile (purchases, challenges, support, certificates, entitlements, tournament and migration records), append-only internal notes and tags. **Content workspace**: create draft items with Persian and English copy, archive and restore, reorder, upload media, and an owner-gated editor for the four department mailboxes on the Contact page. **Announcement banners**: tone (info, success, warning), a non-dismissible option, and the `terminal` and `portfolio` pages; the same banner component is mounted in the terminal shell, and its close button is 44 px. Directus: the editor role gains create and sort on editorial collections and the mailbox fields (permission lists are now merged per collection and action); `register_operator_roles.py` adds Tournament Operator, Migration Reviewer and Analytics Viewer roles (read-mostly, no deletes, no financial collections). **Bugs fixed**: Backstage answered 404 for write-only console sections; backend reason codes were reduced to a generic error; a validator rejection reached the console as 502; two permissions for one collection in `register_backstage_editor.py` overwrote each other.
- **Trading challenges menu, flamingo migration banner and the `--flamingo` token.** The header's Trading challenges link is now a mega-menu group (desktop panel, tablet and phone drawer, and a matching section in the terminal menu) with five tiles, each with an original line icon and a one-line description: Compare challenges, Buy a challenge (`/checkout`), Migration to Openfund, Openfund Premium League (a "New" badge and a compact countdown to the start on Monday 4 January 2027, 00:00 UTC) and Trading rules. Its featured banner is an original SVG scene: a V-formation of flamingos with offset wing timing glides across and settles over a calm lake that reflects the OpenFi mark, with gentle ripples. Copy ("Migration to Openfund", "Proven funded trader? Skip evaluation with three verified payouts.", "Start migration") is editable through the interface registry in five locales; the Maharloo Lake concept is in a screen-reader-only description. Motion runs only while the menu is open, is transform/opacity only, and reduced motion shows a static frame; the drawer and terminal menu show a compact card with three smaller birds. New accent token `--flamingo` (`#f4a3b8` dark, 10.3:1; `#b23a63` light, 5.7:1), reserved for migration scenes, documented in `docs/design/DESIGN_SYSTEM.md` and added to the brandbook source (`brand/brandbook/Openfund-brandbook.zip`, rebuilt with its own `build.py`). The menu's two new destinations exist from this change: `/:locale/tournament` (name, one-line description, start date and countdown) and `/:locale/migrate` (the migration copy with the cinematic flamingo scene; motion only while on screen and the tab is visible). Items A and B replace them with the full tournament and migration pages.
- **Direction-aware arrows.** One arrow primitive (`apps/web-react/src/ui/DirArrow.tsx`, geometry in `src/ui/arrows.ts`, styles in `src/ui/dir-arrow.css`) renders inline-SVG arrows of six semantic kinds: `forward`, `back`, `forward-down`, `external`, `down` and `up`. Horizontal kinds mirror by the element's own direction (`:dir(rtl)`), never by the interface language, so Russian and Chinese (LTR) no longer show the Persian-oriented arrows and Arabic behaves like Persian; `up` and `down` never mirror. Arrow glyphs are removed from copy, translations, the landing dictionary and legacy HTML across about 50 components, the landing page, the legacy terminal, Backstage (`operations/public/dir-arrow.js`) and Open Trade (`src/DirArrow.tsx`, same geometry, checked by a test). The language-based `swapArrows`, the arrow entries in the information-page dictionary and the ad-hoc `scaleX(-1)` arrow rules are deleted. `apps/web-react/scripts/check-arrow-glyphs.mjs` fails when an arrow glyph appears in copy again, and `e2e/test-dir-arrows.cjs` opens every public route in all five locales and checks each rendered arrow points along the reading direction. `apps/backstage/scripts/strip_arrow_glyphs.py` is an idempotent Directus migration (dry run by default) that removes leading or trailing arrow glyphs from existing editorial values without changing the words.
- **Footer: a cinematic "alien trader" banner.** The shared site footer (home page and every information page) gains a full-bleed band between the documents row and the credits: an original illustrated scene of a slender grey alien, seen from behind, at a desk facing six monitors in two rows. The Openfund mark glows on the chair back, with mint and teal rim light. The screens show scrolling candles, a line chart, a symbol ticker (no prices), depth bars, a heat grid and one real Open Trade capture. It is decorative (`aria-hidden`) and lazy: the scene is a separate chunk loaded only near the footer, and the slot reserves its height. It animates only while visible (IntersectionObserver, `visibilitychange`; transform and opacity only), has light scroll parallax and a static reduced-motion frame, stays a dark band in the light theme, and uses a 4:5 focal crop on phones. The room layer can be swapped for raster artwork through one asset path ([docs](docs/website/FOOTER_BANNER.md)). New `e2e/test-footer-banner.cjs` (16 checks) runs in CI.
- **Home hero card: an animated trader journey.** The hero account card on the home page now loops through an evaluation (the sparkline draws in behind a moving head between the profit-target and maximum-loss lines), reaching the target, a verification flip to a "Clear rules" face (profit target, daily loss limit, trader reward share), and a funded state with a brushed-metal sheen and an orbiting highlight, then resets. It keeps the "Concept illustration" label and the OpenFi wordmark, uses only transform/opacity animations driven by `features/home/heroJourney.ts`, starts 300 ms after `load` so it does not delay LCP, pauses off screen (IntersectionObserver) and in background tabs (`visibilitychange`), tilts with the pointer on desktop, adds a light particle layer only at desktop widths, and shows a static Funded frame under reduced motion. All copy reuses existing dictionary entries in five locales. Bug fixed: the hero heading, intro, actions and micro-copy faded in from opacity 0 (and blur), which hid the LCP text; they now slide in by transform only and paint at full opacity. New `e2e/test-hero-journey.cjs` (7 checks) runs in CI.
- **Header mega menu.** The Economy and Resources menus open a wide glass panel under the header (fade-and-drop entrance, soft page scrim): a grid of tiles, each with an original line icon, a title and a one-line description, and a featured banner per group — a mini council chamber linking to the council proposals, and the Open Trade desktop downloads. Resources is grouped into Learn (Learn, Glossary, FAQ), Product (Applications, Tools, Roadmap, Developer docs) and Company (About, Contact, Certificate verification). On desktop it opens on hover after a short intent delay, on click and from the keyboard (arrows, Escape back to the trigger, correct `aria-expanded`); compact layouts use the drawer with an accordion per group, two-column icon tiles and a compact banner card; the terminal menu uses the same tiles. One data model drives all three. Descriptions and icons are bundled with fallbacks and editable in Directus `navigation_items` (new `icon` field); banner copy is in the editable interface registry. New `npm run test:browser:mega-menu` (12 checks, in CI).
- **Developer documentation page and merge rule.** New `/:locale/developers` page (Resources menu): quick start, monorepo structure, architecture, environment and deployment, testing and CI, releases, editorial and CMS rules, typography, contributor and agent rules, and a dated developer changelog, each linked to its source file on GitHub, with a sticky section index (collapsible on narrow screens), search, readable code blocks with copy buttons, and last-verified commit and date. Source of truth: `docs/developer-portal/` (English) plus fully written Persian; Arabic, Russian and Chinese show the English text until an editor publishes a reviewed translation. Directus collection `developer_docs` (published-only public read) with an idempotent seed that never overwrites editor values, and a bundled fallback when Directus is down. New merge rule in `AGENTS.md`, `CONTRIBUTING.md` and the PR template, enforced by `scripts/docs/check-docs-impact.mjs`: changes to routes, the backend API, schema, `render.yaml`/environment, package scripts, CI, releases or `apps/open-trade` update `docs/developer-portal/` unless the description declares `Developer-docs: none — <reason>`. New `npm run test:browser:developers` (21 checks, in CI).
- **Governance hero: council chamber illustration.** The Governance page hero shows an animated, clearly labelled illustration beside the text (below it on narrow screens): a hemicycle of exactly ten council seats seen slightly from above with a central rostrum; an illustrative proposal card appears, seats light up one by one (mint approve, coral reject, grey abstain), a tally counts up and a quorum bar fills toward 7, then an Approved or Rejected stamp holds and the next illustrative proposal begins. Seats, quorum (7 participating) and the approval threshold (6 of 10) come from the council rules, abstaining counts as participation, and a unit test checks every illustrative cycle against `evaluateSession()`. It is `aria-hidden` with a visually hidden description, runs only on screen, and shows a static result frame for reduced motion. `Hero` gains an optional `visual` slot; other information pages are unchanged. Drafted ar, ru and zh-CN entries for its seven strings (flagged for native review). New `e2e/test-council-chamber.cjs` (11 checks, in CI).
- **Checkout: model banners and the challenge's conditions.** `GET /purchases/plans` now returns each plan's public `rules`, a whitelisted projection of the evaluation engine's normalized rules (no prices), with backend tests. The checkout shows one animated SVG banner per model inside the existing radio inputs (Standard: a two-step staircase with both phase targets; One-phase: one rising line to its target; Instant: a pulse straight to the funded node), with an animated mint border on the selected model. A conditions panel shows each rule as a percentage and its dollar amount for the selected size (for example "Daily loss 5% = $500"), computed from the server's rules; a collapsible "More conditions" section lists reward cycles, consistency and the news and holding rules with a link to the Rulebook, and notes when the server's catalog version is newer than the page. The lower daily-loss option appears only when the server offers it with a price (none does today). The order summary is restyled as an account ticket. URL-driven selection, coupons, quotes and payment steps are unchanged. New `e2e/test-checkout-rules.cjs` (14 checks, in CI) asserts every condition equals the server rules times the selected size.
- **Language selector: globe and listbox, politically neutral.** The selector is a wireframe globe with the current language code; it opens a panel listing each language with a representative script glyph, its name in its own script and in the current interface language (from the browser's `Intl.DisplayNames`), a check on the active language and an RTL/LTR badge. Hovering or focusing an option turns the globe to the broad region where the language is widely spoken, shown as a soft glow; there are no flags or borders. Full keyboard support with `listbox`/`option` semantics (arrows, Home/End, Enter, Escape back to the button, type-ahead); a bottom sheet with 52 px rows on phones. The legacy terminal and portfolio toggles use the same globe face. Browser tests now choose languages through the panel (`e2e/helpers/language.cjs`); new `npm run test:browser:language-select` (12 checks, in CI).
- **Contact page: two-column layout and fixes.** A compact hero with a message-routing animation (a light pulse travels from the centre node to the support, legal, technical and community nodes; the chosen team stays lit). From 1024 px the form sits in the main column with the team selectors, Telegram card and safety notice beside it, which removes the orphan Telegram card; mobile stacks safety, teams, form, Telegram. Team selectors stay synced with the form's department select. Fields are clearly visible with a mint focus glow and a required-fields progress bar; a successful request shows an envelope animation and types out the reference. The "email not published yet" line is hidden while the CMS address is empty, choosing a team scrolls the form title below the sticky header, unpublished Quick-help links (terms, privacy, refund) are hidden, the map spans the full width with the address card over it, and Quick help is a grid of icon tiles. New `npm run test:browser:contact` (20 checks, in CI).
- **Open Trade 0.0.4 downloads on the Applications page.** The page now links the five installers of the published pre-release `open-trade-v0.0.4` (unsigned experimental beta: macOS Apple Silicon and Intel, Windows x64, Linux AppImage and .deb). Every file's SHA-256 was recomputed from the downloaded file and matched GitHub's asset digest; `builds.json` and `releases.json` record the real hashes, sizes, CI run and tag, and pass the unchanged `validatedRelease()`. Each platform card has a primary button per file ("Download for macOS (Apple Silicon)"), a collapsed "Details and SHA-256 check" section with a copy-hash button, its own unsigned-build instruction (Gatekeeper, SmartScreen, `chmod +x`) and highlights the visitor's detected system. New [install guide](docs/releases/OPEN_TRADE_INSTALL.md). The window frames around the 0.0.2 captures keep the capture version. The release gate's `open-trade-releases` test now asserts that `releases.json` is exactly the generator output for `open-trade-v0.0.4` (it previously required an empty list until a release was published); the generator now links the install guide and records the plain version number.
- **Applications page: motion, step tabs and real captures.** The hero shows the real Open Trade window floating with a gentle perspective tilt, pointer and scroll parallax, a mint under-glow and a floor reflection; the hero text is no longer faded in, so it paints immediately. Capture sequences are driven by step tabs (real buttons with tablist semantics, progress bars, click or arrow keys to jump, auto-advance pauses briefly) and switch frames with clip-path wipes that follow how the layout splits; the per-frame keyframe window that left a blank gap every cycle in the three-frame sequence is gone, and the near-empty start screen is no longer its first frame. A depth scene layers three real windows; the Web Terminal card shows a slowly panning real capture of the web terminal; platform cards get original line glyphs, a hover glow and a check beside each SHA-256 from the CI build record. New `npm run test:browser:applications` (30 checks, in CI).
- **Wallet showcase: seamless full-bleed loop with a scanner beam.** The Challenges page showcase no longer runs out and jumps: its strip is anchored left-to-right (only the cards are RTL), spans the full viewport, and holds as many copies as needed for one copy to exceed the viewport plus a card, re-measured on resize and locale changes; one linear animation moves it by exactly one copy. A fixed mint scanner beam sits at the centre; cards are clipped to the entry side and dissolve into a deterministic monospace data rendition of the same demo card on the other side (RTL enters from the right, LTR mirrors). It pauses only while one card is hovered or the strip has keyboard focus (arrows step one card), uses a lighter 9% edge fade without blur, drops the data layer below 768 px, and stays a static scrollable row for reduced motion. Demo labels and disclaimer are unchanged.
- **Wordmark "OpenFi".** The text wordmark beside the logo mark now reads "OpenFi" in the site header, footer, home hero and challenge cards, legacy terminal and portfolio headers, the React terminal header and menu, the site navigation drawer and the share-P&L card. One source of truth (`apps/web-react/src/brand/wordmark.ts`, `BrandWordmark`) feeds React and, through a template token, the legacy HTML; the share card reads the injected value. The "A CLEARER WAY FORWARD" caption is re-balanced to the shorter word at every breakpoint, the wordmark is never case-transformed, and brand links are named "OpenFi". The logo mark, company-name copy, page titles, legal text and certificates are unchanged; the frozen `dist/` snapshot is not regenerated by any build and keeps its old wordmark.
- **Complete, graphical README built from data, with a merge rule.** The README returns to a complete front page — banner, an icon on each of 18 sections, product cards, stats, features, languages and regions, lifecycle, repository map, technology badges, roadmap timeline and documentation map — generated from `docs/readme/*.json` by `npm run docs:write` into `docs/assets/readme/`. The [README contract](docs/development/README_STRUCTURE.md) replaces size budgets with minimums (banner, badges, at least 60 images, content in every section) and fails CI when the README or its graphics drift from the data or the repository map misses a directory. New docs-impact gate (`scripts/docs/check-docs-impact.mjs`, in the required `Web (React + Vite)` job): a pull request that changes product code, screenshots, infrastructure or README data must update the matching record, or declare `Docs-impact: none — <reason>`. The rule is written into `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` and the PR template.
- **Dastkhat is the only Persian face, project-wide (v0.9.0 candidate).** One shared `@font-face` file (`apps/web-react/public/assets/fonts/dastkhat/dastkhat.css`: Dastkhat, Dastkhat Arabic, Dastkhat FaNum, v1.210, SIL OFL 1.1) is loaded by the legacy pages, terminal iframe, React app, Open Trade, Backstage and the `dist/` snapshot; every other Persian `@font-face` is gone. `dist/` moves from Irancell/Openfund Persian to Dastkhat; the certificate canvas face is renamed `Dastkhat Certificate`. All 50 Irancell and renamed-Irancell files and the standalone Vazirmatn copies are deleted, which resolves the Irancell provenance blocker by removal. The brandbook is rebuilt from its `build.py`, and the Persian investor documents and PDFs are regenerated with Dastkhat. Ubuntu remains the general/Latin face.
- **Repository de-mess and README restructure.** The README is a 13-section, ≤350-line entry point; deep detail moves verbatim to the [platform tour](docs/product/PLATFORM_TOUR.md), [business model in detail](docs/economy/BUSINESS_DETAIL.md) and [platform reference](docs/architecture/PLATFORM_REFERENCE.md). One curated gallery is generated from `docs/assets/gallery/gallery.json`; the four dated galleries and superseded review snapshots (v0.4.1, v0.6.5, release 0.6.5/0.6.6) move to `docs/reviews/_archive/`. New retired registry ([RETIRED.md](docs/development/RETIRED.md) from `RETIRED.json`).
- **Permanent gates in `npm run docs:check` (CI, every commit).** `check-readme.mjs` enforces the [README contract](docs/development/README_STRUCTURE.md) (exact sections, hierarchy, one responsibility per section, budgets, version freshness, single-source links, link resolution, generated blocks); `check-retired.mjs` fails while a retired item is referenced or listed as an active license; `check-fonts.mjs` allows only Ubuntu and Dastkhat faces and rejects any retired font file or reference, including inside archives, Office documents and PDFs. 24 gate regression tests.

- Restore the complete business README structure, detailed product/operations/economy/security tables, architecture diagram and every original image after the earlier update condensed them. Expand terminal/journal, three Pine indicators, Footprint, Heatmap/Radar, all ten tools, learning, desktop, funded/IB/treasury, Backstage/CMS, repository map and test coverage. Preserve current factual corrections, expand the labelled historical bilingual gallery and record fresh screenshot gaps.

- Refresh the project README with v0.8.0 payment release scope, merged desktop 0.0.3 and indicator work, dated 2026-11-20 gallery captures, current Dastkhat typography and explicit licensing boundaries. Correct stale source states in the canonical register while preserving dated operational observations. Record retained legacy font files; no license grant or binary removal.

- **Open Trade 0.0.4 (desktop, internal unsigned build)** ([release notes](docs/releases/open-trade-0.0.4.md)).
  - Faster workspace: coalesced price ticks, memoised charts, overlays re-drawn only when a level moves, and pointer drags that no longer re-render the app.
  - Quick Trade opens top-right; the trading panel opens, resizes and closes by dragging its grip.
  - Liquid-glass title bar, side rail, watchlist and trading panel over macOS vibrancy / Windows 11 acrylic; in-app title bar with native window controls on Windows and Linux.
  - Openfund chart mark on every chart, a new app icon, and branded macOS DMG and Windows installer pages.

- **Open Trade 0.0.3 (desktop, internal unsigned builds; not published)** ([release notes](docs/releases/open-trade-0.0.3.md), [owner setup](docs/releases/OPEN_TRADE_0.0.3_OWNER_SETUP.md), [delivery](docs/reviews/open-trade-0.0.3/DELIVERY.md)).
  - Prop and read-only Perpetual (Gains) accounts in one wallet session, with product switching that stops the other product's stream and keeps per-product chart layouts.
  - Five-locale desktop UI using the web dictionaries; desktop-only ar/ru/zh-CN strings are drafts pending review.
  - Wallet sign-in errors localized; failed sign-ins disconnect the pairing; address change or wallet disconnect signs out.
  - Packaged builds accept only canonical regional backends; 4 MiB response limit; allowlisted external links; GitHub-Release update notification (no auto-install).
  - Signed `beta`/`stable` packaging with macOS notarization and Windows Artifact Signing or certificate, verified on the building runner; unsigned builds are named `internal-unsigned`. CI covers macOS arm64, macOS x64, Windows x64 and Linux x64.

- **Openfund Pine indicators: optimization, dashboard removal and lookahead fixes** ([ADR 0048](docs/decisions/0048-pine-indicator-optimization-and-provenance.md), [report](docs/reviews/pine-optimization/README.md)).
  - Open Algo V5: the SMRT Algo dashboard, its three settings and its five higher-timeframe requests are removed (76 inputs). Saved workspaces with the old settings load normally; the keys are dropped. Disabled overlays no longer compute. Initial calculation is 63–67% faster, with identical chart output.
  - Price Action Concepts: previous day/week/month levels now use the last completed period and stay fixed while the current one develops. Trendline Liquidity no longer stops the indicator when the multi-timeframe order blocks are on. Order-block drawings are rebuilt only when visible, and default secondary requests fall from 7 to 3. Initial calculation is 48–72% faster.
  - Smart Money Concepts: higher-timeframe fair value gaps are confirmed when their third candle closes, instead of reading that candle's final high/low early. Initial calculation is 7–15% faster.
  - New deterministic benchmark (`npm run bench:charts`), differential and live harnesses, and 29 configuration snapshots in `npm run test:charts`.
  - Indicator licensing is unchanged and still unresolved ([details](docs/legal/LICENSING.md#pine-indicator-sources)).

- **Perpetual Gains read-only readiness** ([ADR 0047](docs/decisions/0047-perpetual-gains-read-only-readiness.md)).
  - The Gains account snapshot now states its network, its read-only capabilities, the source of each field and its freshness (`fresh`, `stale` or `inconsistent`). A cached read keeps its original fetch time.
  - Malformed provider data returns `502 gains_schema_changed` instead of a 500. Timeouts are reported separately as `504 gains_timeout`.
  - Unset TP/SL is shown as unavailable instead of `0`. Pending orders show their Gains order type. Transaction links are built only from valid hashes.
  - Terminal pages name the product: "Openfund Prop — Simulated evaluation" or "Openfund Perpetual — Gains account view". Perpetual pages show the source, the network, a read-only badge and the feed state, and label a kept snapshot as outdated.
  - The Perpetual trade workspace no longer calls itself a practice account.
  - New tests: deterministic backend scenarios and a browser acceptance suite (`npm run test:browser:perpetual`).
  - Live execution remains disabled. The Prop backend, engine and ledger are unchanged. **This is not the requested Gains trading product.** The draft [execution RFC](docs/architecture/PERPETUAL_EXECUTION_RFC.md) states what that product requires.
  - The responsive matrix no longer depends on third parties. Gains REST/WS data comes from documented fixtures (`e2e/helpers/market-fixtures.cjs`), and other external origins are blocked. Live account endpoints are checked separately and non-blocking (`npm run check:gains-account-live`, Upstream watch).
  - Isolated Perpetual UI simulation (test-only, Playwright-injected, visible banner, no writes), product-isolation import-graph tests, and axe scans of signed-in Perpetual pages. History-row links now meet the 24 px target size.
  - [Gains integration readiness report](docs/reviews/gains-integration/READINESS.md): gap analysis, Terms of Service and compliance assessment, threat model, test evidence, blockers with owners. Verdict: the read-only integration is ready for review; live trading is not authorized.
  - Release status reconciled: v0.8.0 is recorded as the latest official release, and GLOBAL Web/API is verified on 0.8.0 (`/version`, 2026-11-20). The status self-tests now follow the recorded release instead of hard-coding v0.7.0.


## v0.8.0 — 2026-11-20

- **Responsive launch matrix (workstreams D/E/F)** — new
  `e2e/test-responsive-matrix.cjs` covers the built web app at ten widths
  (320-1920 px), five locales (fa and ar RTL; en, ru and zh-CN LTR), both
  themes, the eight public routes and the terminal routes. It checks overflow,
  clipped controls, drawer side and closing, console errors and axe
  serious/critical violations. It runs in CI as the three-shard
  `Responsive matrix` job. Fixes for what it found:
  - `/transparency` no longer crashes with a route error when the backend
    returns a 2xx without JSON; the shared `useRemote` hook shows the
    unavailable state.
  - Whitepaper chart-data tables no longer widen phones to 680 px: unwrapped
    tables on information pages opt out of the legacy `min-width:680px` table
    rule. Whitepaper and transparency data tables use the new shared
    `TableScroll` region, which is focusable for keyboard scrolling.
  - Challenge and market filter tabs no longer cut their labels at 320-768 px:
    the shared strip rule stops buttons shrinking below their text.
  - Market cards wrap their head row instead of overflowing at 320 px (Russian).
  - The terminal's compact wordmark and menu label are visually hidden instead
    of `display:none`, so the brand link and the menu button keep accessible
    names.
  - Accessible names now match visible text (WCAG 2.5.3): the public header
    brand, the GitHub row and the market cards.
  - Fixed the challenge size group role, the unavailable-catalog notice inside
    `<dl>`, and keyboard focus for the ticker, wallet showcase and market list
    scroll regions.
  - Fixed light-theme contrast for table headers, empty and error states, the
    landing caption and the whitepaper chapter and contents numbers.
- **Journey acceptance (workstream H).** New browser suite
  `npm run test:browser:journeys` covers expired sessions, the SIWE
  chain id, daily- and maximum-loss failures, the minimum-trading-days gate,
  inbox notifications, and localized responsive checkout with order recovery.
  It runs in CI and in the release gates. The existing browser security suite
  now runs in CI. Fix: deep routes returned 404 when the server ran from a
  checkout under a dot directory. See the
  [report](docs/reviews/journey-acceptance-2026-11/REPORT.md).
- **Regional routing gates (ADR 0043, workstream B).** A read-only
  `scripts/ops/geo-redirect-readiness.mjs` reads `/version`,
  `/runtime-config.js`, `/runtime/ingress` and `/ready` of both regions and
  reports each gate for the IRAN geographic redirect as pass, fail or
  owner-approval-required; it never reports "ready" and changes nothing. A
  new host-matrix test covers all eight website hosts: canonical 301s with
  path and query, machine paths never redirected, the reversible region
  cookie, no redirect loops, and only a trusted IR country qualifying. The
  Liara IP database lookup now covers IPv6. The redirect stays disabled.

- **Dastkhat is the Persian UI font** (#161; merged, not yet released). Dastkhat and Dastkhat Arabic (SIL OFL
  1.1, by Dastyar) are self-hosted as unmodified variable WOFF2 files, pinned
  at upstream commit `ac5b01542f36` (font version 1.210) with the OFL text,
  upstream notices and SHA-256 hashes in
  `apps/web-react/public/assets/fonts/dastkhat/`. New design-system tokens
  (`--ds-font-persian`, `-arabic`, `-latin`, `-cjk`, `-numeric`) replace the
  Irancell, Openfund Persian, Vazirmatn and Tahoma-first defaults on the site,
  the legacy pages, the terminal iframe, Backstage, certificate exports, the
  share card, the chart theme and the Open Trade desktop package. Arabic uses
  Dastkhat Arabic for letters with Ubuntu digits. Latin, Cyrillic and CJK
  fallbacks are unchanged. Technical numbers stay isolated LTR with tabular
  Latin digits; the font no longer turns ASCII digits into Persian digits.
  Checked by `apps/web-react/test/typography.test.mjs` and the browser test
  `e2e/test-typography.mjs` (rendered font, font requests, CSP).

- **Deterministic CI for two flaky browser suites** — the Market Heatmap and
  Trade Radar suite now runs on fixed `/radar/*` fixtures and a fixed page
  clock, with empty and unavailable states covered. The real Hyperliquid
  feed check is a separate, non-blocking step. The controlled-challenge suite
  uses a test-mode conduct clock (`POST /internal/test-clock`,
  `SIM_TEST_CLOCK`; only with `SIM_TEST_MODE=1` and a test database) and
  asserts the daily close window, the weekend and the summer/winter close
  hour. Production keeps the real clock and unchanged rules.

- **Geo-IP first-visit language now applies to returning visitors (ADR 0043
  amendment).** The site, terminal and landing shells saved every displayed
  locale as the visitor's preference, so a stale value (including the pre-0.7
  Persian default) always beat the country default. Only the language
  selector now records an explicit choice (`of-language-choice`); the static
  document default is English/LTR. A new test runs the real pre-paint script
  across the country matrix and storage cases. Not released or deployed.

- **Security remediation (November 2026 follow-up)** — the
  [remediation report](docs/security/SECURITY-REMEDIATION-2026-11.md). Merged,
  not released or deployed.
  - Directus gets its own least-privilege PostgreSQL role, with a
    table-by-table policy, `scripts/ops/db-roles.mjs plan|apply|verify`, a
    migration guard against foreign-owned backend tables, an optional DML-only
    runtime role (`MIGRATION_DATABASE_URL`) and a dedicated `openfund-cms`
    connection secret (OF-2026-11-12, #149). Data Studio shows challenge,
    account, position and user status as read-only; user suspension stays in
    Backstage Operations.
  - Directus 11.17.4 runs with verified compensating controls: response cache
    off, an explicit file-import deny list including `0.0.0.0`, and image/PDF-
    only uploads (OF-2026-11-11, #151). The 12.x upgrade still waits for a
    licence.
  - The IRAN edge image moves to nginx 1.31.7 mainline slim, pinned by digest,
    with 0 Critical/High in the built image and a blocking Trivy gate
    (OF-2026-11-20, #150).
  - `uuid` (web) and `minimatch` (desktop build) advisories are fixed, and CI
    now enforces the dormant protocol package's activation block (#152).
  - Rate limits and audit logs use the visitor IP behind Cloudflare instead of
    the Cloudflare edge address; the Blueprint forbids API autoscaling (#153).
  - New `Security scans` workflow (actionlint, zizmor, Semgrep, Trivy, ZAP
    baseline, OSV-Scanner, SBOM) and a CycloneDX SBOM attached to every
    release (#154).

- **Security assessment (November 2026)** — the first published
  [security self-assessment](docs/security/SECURITY-AUDIT-2026-11.md), with a
  [test matrix](docs/security/SECURITY-TEST-MATRIX.md) and a
  [remediation plan](docs/security/SECURITY-REMEDIATION-PLAN.md). Not
  released or deployed.
  - The backend deletes expired SIWE nonces and sessions every hour.
  - The test-only internal-seam token check returns 401, not 500, for a
    token of any length, and accepts `Authorization: Bearer`.
  - A malformed chart-workspace scope returns 400 instead of 500.
  - CI gains a blocking production-dependency gate for the backend and
    Backstage (`audit-production`).
  - **Payments:** a DePay-attested payment signed by a wallet other than the
    order owner's is held for operator review instead of provisioning
    automatically. `DEPAY_ATTESTED_ANY_PAYER=true` restores the previous
    behaviour (OF-2026-11-05).
  - Malformed ids, NUL bytes and negative paging values return 4xx instead
    of 500. A `Permissions-Policy` header is set. Exception text in the
    terminal chart overlay is escaped. Referral codes are drawn without
    modulo bias.
  - The web app overrides `ws` 8.x to 8.23.0 (wallet SDK transitive
    advisory).
  - New security suites: `test:pentest` (15 HTTP penetration checks),
    financial invariants in `test:security`, and `test:browser:security`.
  - The report, now with a [penetration test](docs/security/PENETRATION-TEST-2026-11.md)
    document, records three open High findings (Directus advisories, the
    database credential Directus shares with the API, and the IRAN edge base
    image) and a **NOT READY** decision for real customer funds.
- **CI supply chain (security audit 2026-11, OF-2026-11-07)** — GitHub
  Actions are pinned to commit SHAs (the commits their current tags point
  to), checkouts no longer persist the job token except in the two
  workflows that push proposal branches, and the image publish step reads
  step outputs from `env`. No workflow behaviour changes.

- **Openfund Pay** — first-party, provider-independent checkout and payment
  ledger ([ADR 0046](docs/decisions/0046-openfund-pay.md),
  [guide](docs/payments/OPENFUND_PAY.md)). Not released or deployed.
  - **Pay with Wallet** (primary): the server freezes a payment intent
    (approved stablecoin, treasury, exact base units of the remaining
    balance). The connected wallet signs one ERC-20 `transfer` on any
    configured network, and the hash is recorded before verification.
    Sign-in stays Arbitrum-only, and the signer must be the signed-in wallet.
  - **Partial payments and overpayments:** a verified amount below the order
    total is recorded as *Partially Paid — Remaining X*. Further transactions
    (any method or network) complete it, and the challenge activates exactly
    once. Any excess becomes a refund liability that is never counted as
    revenue. Refunds are reviewed, approved, recorded and verified on-chain,
    never sent automatically.
  - **Treasury watcher:** finds transfers without a customer TXID, using a
    leased per-chain cursor, a rescan window for reorgs and RPC failover.
    Attribution happens only when unambiguous: by intent, by attempt, by
    Solana memo, or when the sender is the SIWE wallet of exactly one open
    order. Every other transfer waits in a Backstage review queue.
  - **Status:** a server-authoritative status with 21 codes. A rejected
    payment is no longer shown as "Verification Pending". After 15 minutes
    the page explains the delay. After 20 minutes the case escalates to
    review, and it is never auto-failed.
  - **Manual transfer:** a mandatory red Persian/English sender warning that
    must be acknowledged, and the TXID is now optional.
  - **DePay:** off for new payments by default (DePay announces shutdown on
    2026-12-31). A runtime switch in Backstage controls it. Callbacks,
    events and recovery of existing DePay payments continue.
  - **Backstage Payments workspace:** overview, investigation search, deposit
    review (associate with written proof, refund case, close), refund
    lifecycle, payment-method settings, watcher and alert metrics.
  - **Fixes:** an 18-decimal stablecoin above about $100 overflowed
    `payments.amount`. Treasury inflow totals counted a multi-transaction
    order more than once. A partially paid order could expire.
- Documentation: README and canonical status record the published v0.7.0
  release and the 2026-11-18 real-payment findings
  ([incident report](docs/payments/INCIDENT_2026-11-18.md)).

## v0.7.0 — 2026-11-18

Official release ([notes](docs/releases/openfund-0.7.0.md)). Contents:

- Terminal Heatmap and Trade Radar:
  - **Heatmap tiles:** stay readable. Small markets are grouped into proportional "+N" tiles that open at readable size, and the order holds steady during live updates.
  - **Heatmap controls:** colour is a separate metric (24h change or funding) with a selectable range. Details appear only for a selection (bottom sheet on phones), with a hover tooltip and symbol search.
  - **Trade Radar:** compact table, a fading highlight for new trades, a stable scroll position, wallet copy, and labelled cards on phones.

- Challenges page: an animated row of sample wallet cards after Market Pulse.
  It shows shortened addresses, identicons and demo returns, risk and
  activity from a fixed seed, every card is labelled demo, and a disclaimer
  says they are not Openfund traders or verified results. It uses a CSS-only
  seamless loop with depth, edge falloff, a breathing mint glow and drifting
  figures, runs only while visible and is static for reduced motion
  ([design](docs/marketing/WALLET_SHOWCASE.md)).

- Marketing: promotional popups and announcement bars, managed in Backstage
  (Marketing) and published without a deploy, on one Directus model with
  separate behavior and anonymous counters ([ADR 0045](docs/decisions/0045-campaigns-and-announcements.md)).
  Popups wait for visible time, cap at one per session, skip checkout and
  trading pages, and are accessible modals. A campaign with a coupon appears
  only while that coupon is valid, and its checkout link carries the code.
  The long all-locale Iran notice is replaced by a short Persian-only bar
  linking to https://openfi.live/.

- Documentation: one canonical status source (`docs/status/status.json`,
  rendered to `docs/status/README.md` and the README summary) records the
  release and, separately for GLOBAL and IRAN, what is deployed, enabled,
  verified and owner-accepted, each with a timestamp and evidence.
  `npm run docs:check` now fails when a released version is still labelled
  Unreleased, a current document contradicts the recorded state, or an old
  operational snapshot is not marked Historical. Stale statements were
  corrected: GLOBAL purchases are enabled (no real purchase recorded yet),
  v0.6.5 is deployed and IRAN runs on Liara.

- Coupons: Backstage creates a coupon and activates it in one step, generates
  codes, picks eligible models and sizes from the plan catalog, and reports
  the exact outcome. A date-only expiry now lasts the whole UTC day. A 100%
  coupon needs a usage cap before it can be active. Checkout keeps the coupon
  in the URL (campaign links, reload, size changes) and no longer creates a
  full-price order when a typed code was not applied.

- Equity sampling locks the account before ownership checks and skips a
  concurrent deletion. The Challenges language selector keeps the route,
  document locale and community portal in sync across repeated changes.
  A deterministic two-session PostgreSQL test reproduces the former deadlock
  with the pre-fix statement and proves both interleavings of sampling and
  account deletion now complete, with ownership fencing unchanged.

- Release orchestration: an official release now deploys GLOBAL Backstage at
  the same commit as the Web/API and verifies it (`/health` reports the
  commit). The deploy refuses to start unless auto-deploy is off on both
  Render services. `scripts/release/regions-status.mjs` reports commit or
  version skew across both regions. Root cause of the 2026-11-17 split:
  dashboard auto-deploy built `cd057fa` before its release gates finished;
  Backstage went live without a gate.
- Live funding: a concurrency test proves that three settlement workers pay
  each record exactly once (a deliberately broken claim is caught).
- Canonical domains and Geo-IP language (ADR 0043): `openfi.cloud` (GLOBAL)
  and `openfi.live` (IRAN) are canonical; aliases answer 301 with path and
  query (Cloudflare rules for GLOBAL, applied; application redirect for the
  `iran.*` hosts). First visits get a default language from the visitor's
  Cloudflare country (IR fa, RU ru, CN zh-CN, Arab League ar, others en)
  instead of Persian for everyone; the URL and a saved choice always win.
  Cloudflare zones now use Full (strict), TLS 1.2+ and Always Use HTTPS. The
  Iran web app runs market data so orders there are no longer refused as
  stale; a two-engine race test proves exactly-once closes. Backstage shows
  both regions. The IR geographic redirect exists disabled behind gates;
  cross-region forwarding is proposed in ADR 0044.
- Iran runtime deploy: a root `.liaraignore` keeps `liara deploy` from
  dropping `apps/web-react/src/brand` (the root `.dockerignore` pattern
  `brand` matched it under the Liara CLI's gitignore rules); `stack.json`
  uses the live production names (`openfund-iran`, network `staging`) so the
  create-only provisioner cannot create duplicates; the worker lists
  `CMS_PUBLIC_URL`, without which it exits at boot.
- Infrastructure source of truth (ADR 0042): `stack.json` now describes
  GLOBAL, IRAN production, IRAN staging and the dormant edge with their
  GitHub environments; `npm run infra:check` (CI) and `--live` detect drift.
  Both Liara deploy workflows run a guard first: the edge can never target a
  runtime app, the runtime deploys only the manifest's provisioned apps, the
  web app before the worker, and production only an official release tag.
  Audit: `docs/reviews/liara-iran-infrastructure/AUDIT.md`.

## v0.6.5 — 2026-11-17

Release notes: [docs/releases/openfund-0.6.5.md](docs/releases/openfund-0.6.5.md).

- Fix: Render dashboard deploys of untagged `main` failed once more than
  250 commits separated it from the latest release; the candidate check now
  uses GitHub's exact compare total.
- Observability: audit-write and payment-recovery failures are counted and
  logged; `/admin/operations/metrics` reports engine-loop lag and feed
  staleness.
- Notifications: `purchase_paid` when a paid purchase provisions its
  challenge.
- Tooling: purchase-test readiness probe, backup/restore drill, engine load
  report, framing-policy boot test.
- Dependencies: `ws` 8.23.0, `express-rate-limit` 8.7.4,
  `markdownlint-cli2` 0.24.1.
- Includes the launch-completion batch below.

## Launch completion (shipped in v0.6.5; first described as candidate v0.6.0)

Release notes: [docs/releases/openfund-0.6.0.md](docs/releases/openfund-0.6.0.md).

- Release manifest runtime is derived from `render.yaml` and the backend
  engine (it claimed Node 22 and Directus 11.9.1); `engine-strict=true`.
- Post-deploy live SIWE gate and runtime verification (`/version` official
  on the tag commit, frontend manifest, CMS health).
- Backstage: partner review and commissions, finance (expenses, reserves,
  obligations, treasury refresh), unified audit trail, trader suspension,
  commercial coupon wizard, support replies and departments, notification
  records, read-only live risk board, global search, and a Content workspace
  over Directus with a live read-only preview.
- Traders get an Inbox with in-app notifications and support conversations.
- Visual editing fix: the site lets the configured CMS origin frame it.
- Additive migration: `notifications`, `notification_relay_state`, support
  thread columns. No financial table changed.

## Shipped in v0.6.5 — release archive

- Include the shared footprint runtime in release archives so the extracted
  backend can start.

## Shipped in v0.6.5 — universal visual CMS editing

- Editors can open the existing Directus 11.17.4 visual editor, click registered editorial text, and save a draft or publish it without a frontend rebuild.
- Arabic, Russian and Simplified Chinese (`zh-CN`) are selectable translation slots. They are not auto-published.
- Public pages keep the current layout and fall back to bundled copy when Directus is unavailable. Financial, trading and payment fields are not editable this way.

## Shipped in v0.6.5 — Backstage operations

- Add reward payout details and an opt-in owner control to verify and record
  finalized Arbitrum One DAI settlement evidence.
- Add a bilingual owner workspace with secure sign-in, linked operational
  directories and password-confirmed Prop decisions.
- Align the Backstage Blueprint with the existing production hostname,
  `backstage.openfi.cloud`, and document the backend release prerequisite.
- Use the trading engine's account-first lock order for reward requests and
  reversals to prevent contention from deadlocking a payout workflow.

## Shipped in v0.6.5 — controlled challenge acceptance

- Add wallet-bound Instant and Two-Step test checkout with isolated rule
  snapshots, operator review and a dedicated simulated payout settlement.

## Shipped in v0.6.5 — funded financial controls and product roadmap

- Add versioned 7-, 14-, 21-day and monthly UTC payout choices behind an owner-approved sales cutoff.
- Verify manual funded rewards against finalized Arbitrum One DAI receipts before recording payment or issuing a new payout certificate.
- Add payout discussions, operator appeals, funded IB settlement and cross-region receipt claims.
- Journal approved revenue allocations and reconcile finalized treasury transfers against on-chain balances.
- Add a shared four-quarter product roadmap to the website and whitepaper seed and clarify the prop-firm product scope in the README.

## v0.6.5 candidate notes (shipped in v0.6.5; first prepared on branch `agent/claude/v0.6.5-modernization`)

Implemented and locally verified; **not merged, not released, not deployed**.
The release tooling would currently allocate 0.6.0 after v0.5.0; publishing as
v0.6.5 needs an owner decision (see the delivery record).

- **Certificates:** three branded square designs (purchase, completion,
  payout) rendered on the existing region-aware issuance and verification
  APIs; anonymous template previews for everyone; Persian/Latin-safe canvas
  text; redesigned verification page with an explicit "unavailable" state.
- **Trade Radar** and **Market Heatmap** terminal tabs: read-only public
  Hyperliquid data behind one shared backend cache and socket (adapted from
  drkxbt/whales and drkxbt/charts, MIT).
- **Terminal copy:** the approved Persian "entry point" label is enforced over
  CMS text; owner-specified virtual order book copy with Gains/Hyperliquid
  marks; the footer shows only the Persian "live" label with source marks;
  Support opens the localized Contact page.
- **Website:** Applications page redesign with real Open Trade 0.0.2
  captures and CI build evidence (no download links); Roadmap page mirroring
  ROADMAP.md; shared design-system layer; the Persian ticker shows only the
  owner-specified "live from the market" label (also on phones); `/en`, `/ru`, `/zh-CN` keep their
  language; a phone-width overflow (670px) fixed.
- ADR 0035; third-party notices for drkxbt/whales and drkxbt/charts.
- **Website redesign:** homepage rebuilt on the shared tokens (hero, product
  cards that stack on phones, consistent CTAs, technical-horizon cards,
  aurora accents); a site-wide layer gives every information page the same
  card system, hero treatment and scroll reveals; reduced-motion safe.
- **Responsive and accessibility:** 480-load audit (9 widths in fa/en, 2 in
  ar/ru/zh-CN) — fixed hidden-table overflow on Transparency, small targets
  and 9-10px labels on Challenges, light-theme contrast below 4.5:1 on new
  pages, and 110 missing ar/ru/zh-CN strings on Governance and Contact.
- **Release tooling:** an owner-approved dispatch may choose the patch inside
  the newly allocated line (0.6.0 -> 0.6.5); tests cover skips, reuse and
  out-of-line versions.
- **Open Trade 0.0.2:** CI installers verified (SHA-256, metadata, macOS
  launch); publication pack and download-manifest generator prepared; no
  release published.
- **README** redesigned with current captures, regional architecture, verified
  versions and status categories; licence decision addendum for desktop
  distribution.

## Shipped in v0.6.5 — Open Trade desktop beta

- Add an isolated Electron desktop companion, shared Vela chart integration and
  internal cross-platform packaging. Real-wallet acceptance, signing and public
  distribution remain pending; see `apps/open-trade/ACCEPTANCE.md`.

## Earlier changes (shipped by v0.6.5)

- Independent Iran regional runtime and regional synchronization (branch
  `infra/iran-regional-authority`, [ADR 0033](docs/decisions/0033-regional-authority-and-synchronization.md);
  **not deployed, not merged**). A database-enforced single home region per
  trading account (ownership fence with epochs, quarantine on conflicting
  claims, explicit two-sided handoff); a trigger-written transactional outbox,
  signed HTTPS delivery, an ordered idempotent inbox and read models of the
  other region; initial state transfer; checkpoint reconciliation that gates
  reopening after an outage; an operator API (`/admin/regional`); `/ready`;
  the Liara image, desired-state manifest, create-only provisioning tool and
  a gated deploy workflow. Render is unchanged until sync is configured and
  enabled. Tested with two real regions, fault injection and a simulated
  120-day backlog. Not implemented: purchases in IRAN, an operations UI.
- Iran access notice: lists all three Iran addresses (`iran.openfund.cloud`,
  `iran.openfi.cloud`, `openfi.live`) in every locale, with wording driven by
  the verified serving region and mode; replaces the single-address proxy copy.
- Same-origin `/cms` content path with last-known-good snapshots: the Iran
  runtime reads published content through its own backend and keeps serving
  it while the CMS is unreachable; GLOBAL uses it as a fallback. Certificates
  (#118) are region-aware and verifiable across regions.

- Keep public navigation above checkout content, add an Applications destination,
  and improve the localized purchase history and checkout entry point.
- Add direct chart controls for creating, moving and independently removing
  position protection. Show estimated gross profit or loss during dragging.
- Add an interface content registry and an editing workflow through Directus.
- Add certificates for eligible purchase, approved completion and recorded
  payout events, with public verification, QR codes, and PDF and PNG downloads.
- SIWE: `ALLOWED_DOMAINS` gains `iran.openfund.cloud` (Iran edge on Liara,
  [ADR 0031](docs/decisions/0031-iran-edge-on-liara.md)); the Blueprint
  validator now requires exactly the four hosts. Takes effect only after an
  approved Blueprint sync. **Not deployed.**

- Iran edge on Liara (branch `infra/liara-iran-mirror`,
  [ADR 0031](docs/decisions/0031-iran-edge-on-liara.md); **not deployed**):
  a stateless nginx reverse proxy for `iran.openfund.cloud`. It is not an
  independent Iranian deployment: it serves the exact release Render serves,
  caches hashed assets, blocks operator and DePay server routes, and runs no
  backend, database or secret in Iran. Manual, reviewer-gated deploys go to
  a staging Liara app first; production requires verified staging evidence for
  the same commit. The backend can accept the visitor IP from the edge with an
  opt-in shared key (`EDGE_CLIENT_IP_KEY`), so per-IP rate limits and audit
  logs are not collapsed onto one address. Country routing is prepared but
  disabled. The Persian Iran notice no longer promises access during an
  international cutoff or domestic market data. Owner guide in Persian:
  `docs/deployment/LIARA_IRAN_SETUP.md`.

- Owner decisions D1–D8 (branch `agent/claude/launch-readiness`, **not
  deployed**): per-model reward cycles chosen once; 30-day inactivity;
  Instant open-risk, trade-idea, profitable-day, news and weekend rules;
  on-demand strike system; funded auto-close and news deductions; fee refund
  on the fourth paid Standard reward; Openfund leverage ceilings for new
  challenges; daily-loss variants sold only when priced. Paid plans are not
  sold until a licensed economic calendar is imported. Fixed: challenges
  started without a frozen snapshot were provisioned from empty rules.
  Draft Terms, Privacy and Refund policies prepared for legal review.

- Launch readiness (branch `agent/claude/launch-readiness`,
  [ADR 0029](docs/decisions/0029-reward-lifecycle-and-support-queue.md),
  [report](docs/reviews/launch-readiness-2026-11-13/REPORT.md); **not deployed**):
  server-computed reward requests on funded accounts enforce the published
  split, first-payout wait, minimum request, consistency score, profitable days,
  monthly cycle and fourth-reward fee refund (the free-amount withdrawal request
  is removed); a final evaluation pass now goes to operator review, and an
  approval creates exactly one funded-demo account; rules snapshots move to
  version 2 (payout terms frozen; older snapshots untouched). New About Us and
  Contact Us pages in all five locales with a working support form stored in
  `support_messages` and handled in Directus by a new `Support Agent` role.
  The terminal support link no longer points to an unverified mailbox.

- Checkout, campaign, chart and trading completion (branch `agent/claude/checkout-campaign-chart-trading`, not deployed;
  [ADR 0028](docs/decisions/0028-manual-payment-treasury-networks-campaign-chart-english-lotage.md)):
  **Manual Payment** next to Pay with DePay on the same order, verified on-chain
  by the existing verifier (EVM: signed by the sign-in wallet; Solana: order id
  in an SPL Memo), with Verification Pending / Payment Failed / Activation
  statuses, rate limiting and two race fixes (`tx_already_used`,
  `order_already_paid`); Openfund Treasury wallets per network on the
  transparency page; a fa/en sales-campaign landing; the Vela chart layer is
  English and LTR in every locale; SL/TP can be created by dragging from the
  entry line; Lotage sizing for USD-quoted forex, gold, silver and WTI; "Buy
  Challenge" CTAs on the Home Prop card and the connected-wallet card; "Entry Price" terminology (Persian
  label "entry point"). No engine, PnL, drawdown, margin, price-feed
  or DePay-signature change.
- DePay checkout activation fixes (branch `agent/claude/depay-checkout-activation`,
  **not deployed**): the DePay endpoints also answer at
  `/api/payments/depay/{config,configuration,callback,events}`, the URLs the
  production DePay integration calls (it received 404, so the widget could
  never load a configuration); DePay-attested payments from smart-contract
  wallets are verified through router or reported-payer Transfer logs; the
  server logs why payments are disabled at startup and why a DePay request
  was refused; the checkout shows DePay widget errors. Owner procedure with
  verified USDC and DePayRouterV3 addresses:
  [Owner setup](docs/payments/OWNER_SETUP.md).
- Capacity optimization (branch `agent/claude/capacity-optimization`,
  [ADR 0027](docs/decisions/0027-trading-stream-fan-out-and-engine-loop-isolation.md),
  [report](docs/reviews/capacity-2026-11-13/REPORT.md); **not deployed**):
  `/trading/stream` computes one fresh state per account per push for all of
  its tabs and reacts only to that account's changes; `last_seen` is written at
  most once per minute; the engine loop samples equity without a full state
  read, on its own small connection pool, and equity samples are written in one
  statement with provable no-op writes skipped; shutdown waits for the running
  engine pass and ends streams. No rule, formula, rounding or API shape changed;
  an equivalence check against `main` gives identical financial state. Measured
  locally: stable concurrency A (100 + 200) → C (500 + 1,000), SL/TP p95 at C
  28.3 s → 1.7 s. The 1,500 + 2,000 target is not reached.

- Challenge checkout and DePay activation (branch `agent/claude/depay-checkout-chart-ux`,
  [ADR 0026](docs/decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md);
  **not deployed; first real payment pending the owner**): a dedicated
  `/:locale/checkout` page (wallet, challenge, size, coupon, customer email,
  review, Pay with DePay, live status, verified receipt, resume by link)
  replaces the checkout dialog. The official DePay widget is vendored
  same-origin and opened with the integration id and the order id only, so
  Openfund no longer depends on a CDN bundle, a CSP exception or a
  hand-computed hash, and never restricts DePay networks or tokens. A
  provisioning failure after a verified payment is retried without a second
  payment.
- Chart trading UX (same branch): compact BUY/SELL markers that sit off the
  wick (BUY ×n / SELL ×n per candle); the position box keeps the executed
  entry fixed and lets only an existing SL/TP move vertically, with
  validation, an unconfirmed preview and the existing position-update
  service; position information moves to compact right-hand labels that can
  be hidden and restored without touching the position; Chart Settings →
  Trading → "Show Buy / Sell Markers" (with its requested Persian label),
  saved per wallet.

- Documentation: correct current pages that still described the app as
  served at `/react/` (it is served from `/`; `/react/` redirects) and the
  web README's Node 22 requirement (Node 26); replace the stale v0.2.0 audit
  text in the documentation index with a canonical-source map; index the
  dormant protocol docs and 11 unlisted review records; remove two orphaned
  pointer pages (`docs/architecture/RENDER_DEPLOYMENT.md`,
  `docs/development/ROADMAP.md`); remove duplicated rules from `AGENTS.md`
  without changing any policy.
- Repository: stop tracking 92 stale generated `react/assets/` files that
  were re-committed by `afe173f` despite `.gitignore`; a fresh `build:web`
  deletes all of them, so nothing served changes. A release test now fails if
  any `react/` path is tracked
  ([hygiene record](docs/development/REPOSITORY_HYGIENE.md#regression-fixed-on-2026-11-12)).
- Licensing: component inventory covering fonts and images, a first-party
  [license decision document](docs/legal/LICENSE_DECISION.md) (no license
  chosen; owner approval gate), the missing Ubuntu Font Licence shipped beside
  the Ubuntu fonts, `dist/` notices re-synced with the React notices, and the
  unresolved Irancell font provenance recorded. README states plainly that
  Openfund's own code is all rights reserved.
- Terminal and Prop UI refinement (branch `agent/claude/terminal-prop-ui-refinement`,
  [ADR 0025](docs/decisions/0025-prop-leverage-sizing-and-economic-calendar.md)):
  BUY/SELL markers on the candle of each confirmed Prop fill (grouped with a
  count per candle, re-mapped on timeframe change, details on the timeline
  lane); SL/TP zones start at the entry candle with a dashed "Entry" boundary
  at the position's own entry price; renamed Persian risk-editor and entry
  labels (requested wording, terminal-wide); larger terminal typography; a separate
  account summary panel (collapsible on short screens); Prop-only maximum
  leverage (BTC/ETH 20×, other crypto 15×, forex/stocks/indices/commodities
  50×) enforced by the engine and the ticket; Collateral / Quantity sizing
  modes with Lots shown as unavailable until an approved contract
  specification exists; a larger Edge Score radar; an aligned dashboard
  Activity list; grouped journal toolbars; a visual journal settings form;
  internal page layout fixes; and a "News & Information" tab with the official
  TradingView Economic Calendar widget (two origins added to the application
  CSP). Perpetual leverage and execution are unchanged.

- Directus 11.17.4 (branch `agent/claude/directus-11.17.4`; **not deployed,
  needs owner approval and a production-backup rehearsal**): the CMS image pin
  moves from 11.9.1 to 11.17.4, the latest 11.x (same BUSL-1.1 licence) in
  `render.yaml`, `infrastructure/directus/compose.yaml` and the release
  workflow. Restored-backup rehearsal on seeded data: 103 of 104 checks, with
  collections, relations, roles, policies and item counts unchanged
  ([evidence](docs/reviews/directus-11.17.4-staging/README.md)). Directus 12
  stays blocked on the licence decision.

- Node.js 26 LTS (branch `agent/claude/node-26`; **needs owner approval
  before deployment**): CI workflows, the release image
  (`node:26-bookworm-slim`), the Render Blueprint `NODE_VERSION`, the backend
  `engines` field and the release build guards move from Node 22 (maintenance
  LTS) to Node 26 (Active LTS). Current development and release docs, and the
  release-candidate rule in `AGENTS.md`, say Node 26. Historical audit and
  review records are unchanged. No application code changed.

- Footprint activation (branch `agent/claude/footprint-activation`): the
  Render Blueprint sets `FOOTPRINT_ENABLED=1` on `openfund`, on the owner's
  request, so the terminal offers Chart Style → Footprint and the Footprint
  overlay (default Bid × Ask Ladder) with live Hyperliquid order flow over
  Gains candles. No code, schema, retention or stream-capacity change. Gains
  remains the price and candle source; trading, evaluation and PnL are
  untouched. History starts when the service first runs in production.

- Payments: [activation checklist](docs/payments/ACTIVATION.md) records the
  production state verified on 2026-11-12 (`paymentsEnabled: false`; no
  complete settlement chain, widget URL, SRI hash or CSP origins configured;
  DePay endpoints closed by design). Documentation only.

- Express 5 (branch `agent/claude/express-5`): `apps/backend` moves from
  Express 4.22.3 to 5.3.0. No route, middleware or handler changes were
  needed: the backend uses no Express 4-only path syntax or APIs. Observable
  differences: static JavaScript is served as `text/javascript` (RFC 9239)
  instead of `application/javascript`, and the HTML/CSS `charset` parameter is
  lower case. Upstream registry updated.

- Vite 8 (branch `agent/claude/vite-8`): `apps/web-react` moves from Vite
  6.4.5 and `@vitejs/plugin-react` 4.7.0 to Vite 8.3.8 (Rolldown bundler) and
  `@vitejs/plugin-react` 6.3.0. `vite.config.ts` needed no change. Production
  build time fell from about 9 s to 1.4 s locally. Landing pages render
  pixel-identically to the Vite 6 build (English, Persian, 390 px), and the
  wallet, purchase, DePay, chart, layout, risk, completion and responsive
  browser suites pass. Upstream registry updated.

- TypeScript 7 (branch `agent/claude/typescript-7`): `npm run typecheck` in
  `apps/web-react` moves from TypeScript 5.9.3 to 7.0.2 (native compiler,
  about 1.4 s per run). TypeScript 7 no longer ships the stable JavaScript
  compiler API, which `scripts/docs/check-language.mjs` uses to read comments;
  that scanner now loads the pinned `typescript-js-api` alias
  (`npm:typescript@6.0.3`, the newest stable release with the API). Vite and
  esbuild do not use `tsc`, so build output is unaffected.

- Vela 0.10.6 (branch `agent/claude/vela-0.10.6`;
  [Vela upgrade](docs/integrations/VELA_UPGRADE.md#upgrade-to-vela-0106-2026-11-12)):
  vendored LuxAlgo Vela 0.9.3 to 0.10.6 through the controlled update tool,
  `@luxalgo/vela` 0.10.6 (adds `@luxalgo/vela-ui` 0.4.1) and
  `@luxalgo/vela-pinets` 0.3.4; PineTS stays 0.13.1 (latest).
  - Patch OF-VELA-001 retired: 0.10.x keeps menus above the chart upstream.
    OF-VELA-002 and OF-VELA-003 re-apply cleanly. `LICENSE` and `NOTICE`
    unchanged; the shipped AGPL notice only changed line endings upstream.
  - OF-BUILD-001 re-anchored: the Pine worker's minified identifiers changed,
    so `build-charts.mjs` now locates them structurally and still fails
    unless each matches exactly once.
  - Visual parity: Vela 0.10 moves its chrome CSS into the `vela.chrome`
    cascade layer, so the terminal's unlayered element resets stripped the
    toolbar and range-bar button padding. Those resets now live in an
    `openfund-reset` layer ordered before Vela's, which restores the 0.9
    appearance without changing any other terminal rule.
  - `e2e/test-chart-indicators.mjs` finds numeric Pine inputs by the
    `spinbutton` role (native number input on 0.9, Zag number input on 0.10).

- Dependency patch updates (branch `agent/claude/deps-patch-2026-11`):
  `viem` 2.57.16 to 2.57.19 in `apps/backend` and `apps/web-react`, and `ws`
  8.22.1 to 8.22.2 in `apps/backend` (the version the capacity harness already
  uses). Upstream registry updated. No application code changed.
  The 30 open `npm audit` advisories in `apps/web-react` are all transitive
  through the wallet stack and are resolved only by wagmi 3, which the latest
  stable RainbowKit (2.2.11, peer `wagmi ^2.9.0`) does not support yet.

- Footprint archive importer (branch `agent/claude/footprint-archive-import`;
  [Footprint](docs/integrations/FOOTPRINT.md#archive-importer-prepared-not-yet-run-against-real-files)):
  `apps/backend/footprint/archive.js` and `scripts/footprint/import-archive.mjs`
  import decompressed Hyperliquid `node_fills_by_block` files into
  `footprint_minutes` with `source = 'archive'`, using the live path's
  normalization and deduplication. Taker fills only, fail-closed completeness
  checks, dry run by default, one transaction with `--apply`, recorded gaps
  trimmed to the imported window. Not yet run against real archive files: the
  requester-pays bucket needs owner AWS access. No schema change; the feature
  flag and production state are unchanged.

- Community, footer, platform motion and responsive navigation (branch
  `agent/claude/community-motion-responsive-ui`):
  - Community: Telegram is the only public community action (home, hero,
    footer) and links to the official `https://t.me/communitybuopenfund`;
    the Discord button is removed. The Discord/Instagram validators and
    runtime settings remain for configuration compatibility.
  - Footer services: Hyperliquid added as the eighth provider (visual
    listing only, no integration); balanced grid of 8 / 4 + 4 / 2 × 4.
    Official logo provenance is recorded in `Public-brand-assets.txt`.
  - Challenges platform flow: the static Gains mark is replaced by a CSS-only
    composition of three floating glass orbs (Gains, Hyperliquid, GMX);
    transform-only motion, static under reduced motion.
  - Website header: one compact mode decided from measured widths (links,
    then terminal entry, then language/theme move into the drawer) instead
    of a two-row phone header that pushed controls off-screen; new shared
    off-canvas drawer (`features/navigation/OffCanvas`) opening from the
    right in fa/ar and the left in en/ru/zh-CN, with focus trap, Escape,
    backdrop close, scroll lock and focus return.
  - Terminal: at ≤1100px every destination moves into a terminal drawer
    (`TerminalMenu`, own state, so the chart workspace is never re-rendered
    or remounted); desktop tabs and the More menu are unchanged.
  - New browser regression suite `e2e/test-responsive-navigation.cjs`
    (11 widths × 5 locales, short viewports, terminal state persistence).
- Capacity assessment (branch `agent/claude/capacity-assessment`): isolated
  k6 + SSE + Playwright capacity harness (`scripts/capacity/`) and measured
  report ([Capacity assessment 2026-11](docs/reviews/capacity-2026-11/REPORT.md)).
  Measured: 100 chart users + 200 visitors stable on one uncapped core; not
  stable at that stage under a Render-equivalent CPU quota; first bottleneck is
  per-stream SSE database polling on the 10-connection pool and the serial
  engine loop. No application code changed.
  Harness dependencies pinned to patched `ws` 8.22.2 and `viem` 2.57.16
  (GHSA-96hv-2xvq-fx4p); k6 dashboard HTML exports are no longer committed.

- Hybrid footprint chart (branch `agent/claude/hybrid-footprint`, disabled by
  default with `FOOTPRINT_ENABLED=0`; [Footprint](docs/integrations/FOOTPRINT.md),
  ADR 0024):
  - Gains stays the chart's price, candle and market source. Hyperliquid
    executed trades (aggressor side, exact prices) drive a footprint built
    only on Vela's public plugin SDK: a "Footprint" chart style and a
    "Footprint" overlay. Five display modes, with Bid × Ask Ladder as the
    default. POC, naked POC, value area, diagonal and stacked imbalances,
    filters, a stat table, a visible-range profile and up to three instances.
  - Footprint service: one shared Hyperliquid WebSocket per process, exact
    one-minute per-price slices in `footprint_minutes` (with optional
    `FOOTPRINT_DATABASE_URL`), recorded capture gaps, `/api/footprint/*`
    history and SSE stream. It is read-only and isolated from the engine,
    accounts and payments.
  - Price compatibility: footprint prices are never shifted. Per-market
    limits come from a measured Gains↔Hyperliquid basis, and the footprint
    is flagged, hidden or marked stale accordingly. The status chip states
    the offset.
  - BTC, ETH, SOL, gold, silver, EUR/USD, GBP/USD and USD/JPY were verified
    against live Hyperliquid metadata. History is captured from first run;
    archive backfill is pending.

- Production fix and terminal refinement (branch
  `agent/claude/production-fix-ui-refinement`):
  - Header controls: the theme switch is now a real box with the shared
    height, border and radius (it was a 23px pill with a faked outline
    frame); the signed-in wallet menu opts out of the landing FAQ `details`
    border that made it 37px and half a pixel off; unified hover/focus.
    Measured equal on 5 locales × 2 themes × 7 widths and while signed in.
  - Per-wallet chart workspaces: drawings, indicators, timeframe, chart and
    tool settings are saved to the backend for the signed-in wallet
    (`chart_workspaces`, revisioned, session-owned) and restored on any
    device; wallets never see each other's chart state
    ([Chart workspaces](docs/trading/CHART_WORKSPACES.md), ADR 0023).
  - Live position risk/reward overlay: SL-only and TP-only positions now get
    their zone (previously only positions with both), correct LONG/SHORT
    direction, theme colors, a compact per-position legend; the overlay's
    options are now actually applied (Vela takes them under `props`), so the
    fabricated "Loss · Size" line from a default 10,000 balance is gone.
  - SL/TP dialog: Persian and Arabic-Indic digits are accepted exactly
    (unreadable input previously became NaN and silently removed the level);
    closes only after the server confirms; shortened position id with copy.
  - Order review: one label/value row per field, LTR-isolated values, no
    clipping in RTL; values and submission path unchanged.
  - Seasonal header logo (designs approved by the owner): Yalda
    pomegranates from 28 Azar through 1 Dey (Tehran date, Jalali via the
    built-in Intl Persian calendar) and a Santa hat from 25 to 31 December
    (visitor's local date), on the website and terminal header logo only.
    The master mark is untouched (a CSS layer over the measured logo box);
    the normal logo returns automatically after each holiday.
  - Payments: no code defect found in the purchase/DePay path; production
    `paymentsEnabled` is false because the owner-controlled payment
    configuration is unset. The activation checklist now lists the DePay
    events URL and the widget's `connect-src` origins.

- Final frontend UI refinement (branch `agent/claude/final-ui-refinement`),
  frontend only, no backend, trading, payment or SIWE change:
  - One header-control geometry (wallet, terminal entry, language, theme) for
    the website and the terminal (`src/styles/header-controls.css`); the
    terminal now orders them like the website.
  - The public header measures real label/action widths and falls back to the
    menu only when they do not fit (replaces the fixed 1400px breakpoint that
    clipped Russian labels); smallest-phone tier keeps every control on one row.
  - Footer address no longer includes the "Land of Persia" parenthetical in
    any locale; footer service credits gain Bitpin (official logo) and lay out
    as one row of seven on desktop with balanced wrapping below; legacy
    stylesheets are requested with a per-build version so a cached copy cannot
    differ between domains.
  - Persian-only: Iran access notice under the header (owner-approved for
    production, `src/config/iranAccess.ts`; the iran.openfund.cloud host is
    connected separately) and a fixed bottom Bitpin price strip in Toman
    (read-only public API, one shared 30s poller, paused in hidden tabs,
    backoff on failure, prices withdrawn after 10 minutes without data).
  - Home: product cards share one structure with bottom-aligned CTAs; the
    Perpetual card carries an "Inactive / In Development" badge in five
    languages; the "Proposed design · product approval required" label is gone.
  - Terminal: the open market list no longer rebuilds on every price tick
    (rows under the pointer were detached, so the first click was lost or
    closed the menu); market selector, More stats, the More menu and the
    wallet menu share outside-click, Escape and one-open-at-a-time dismissal
    across the shell and the workspace iframe; the market strip follows RTL/LTR
    with symbols and numbers isolated LTR.
  - Terminal: the status-bar "Vela" label is removed at the owner's
    direction; chart engine, indicators and the website's Vela credit and
    notices are unchanged.
  - Challenges: the Web3 wallet card reflects the existing wallet and SIWE
    session (restoring, connected but not signed in, signed in with address
    and network) instead of always asking to connect.
- Repository governance and security (branch `agent/claude/repo-governance`,
  no application code changed): add `CODE_OF_CONDUCT.md`, `SUPPORT.md`,
  `.github/CODEOWNERS`, `CLAUDE.md`, UI-problem and documentation issue
  templates, [Repository governance](docs/development/REPOSITORY_GOVERNANCE.md)
  and [Repository security settings](docs/development/REPOSITORY_SECURITY.md);
  extend `CONTRIBUTING.md` with the fork-to-merge workflow, `SECURITY.md` with
  scope and expectations, and `AGENTS.md` with agent safety rules. Pin the
  third-party gitleaks action to a commit, validate the image workflow's
  version input, add a dependency-review workflow, ignore local `.env` and key
  files, and record reviewed full-history gitleaks false positives. Enabled on
  GitHub: private vulnerability reporting, secret scanning, Dependabot alerts
  and security updates, CodeQL default setup.
- Fix the Render Blueprint SIWE allowlist for both public domains and the
  onrender host. Add a Blueprint guard and CI coverage for signed Arbitrum
  login, owned profile, session restore, wallet switching and logout through
  both production origins. Production real-wallet acceptance remains pending.
- UI refinement (branch `claude/ui-refinement`), frontend only:
  - Wallet header chip no longer tilts (the FAQ accordion's `summary>span`
    rotation leaked into it); the wallet menu is grouped into wallet
    information (address, balance, network) and actions, RTL with LTR values.
  - Persian/Arabic landing card copy spacing and wrapping; tiny decorative
    English labels removed from the two landing illustrations.
  - Footer partners: Render restored and Liara added; the corporate
    information block is replaced by the address in five languages.
  - Day/night theme switch (MIT design, attributed) on the website header and
    terminal; "Growth Partner" is now Economy › Referral & Rewards (same URL).
  - Terminal account tabs show one shared signed-out empty state that runs the
    existing wallet flow.
- PR #81 completion (branch `claude/pr81-completion`):
  - Coupon administration acceptance now runs against a real Directus UI and
    passes 16/16 (create a 100% internal coupon in Directus, zero-cost
    checkout, provisioning, redemption history, reuse rejection, access
    control). Test fixes only; no schema change.
  - Checkout, profile and order dialogs: Latin digits outside Persian (the
    Irancell font rendered `$80` as Persian numerals) and the localized plan
    name instead of the bilingual catalog label (`/purchases/plans` adds
    `names`).
  - Payments: `payments.source_token` / `source_amount` now store DePay's
    `sent_token` / `sent_amount` (the payer's token) instead of the settlement
    values. DePay documentation rewritten for multi-chain settlement with the
    exact dashboard and Render settings.
  - Directus 12: second rehearsal shows the unlicensed Core tier also drops
    field-restricted permissions (Commerce Admin loses coupon create/update).
    `release.yml` probes use `/server/ping`; `render.yaml` adds a `LICENSE_KEY`
    secret slot. The image stays on 11.9.1 pending a licence.
  - README rewritten as a business-and-technical project homepage with real
    screenshots; engineering sections moved to
    `docs/development/ENGINEERING_REFERENCE.md` and checked by `docs:required`.

- Production readiness (branch `codex/production-readiness`, ADR 0022):
  - Wallet, SIWE and checkout are **Arbitrum One (42161) only**; other SIWE
    chains are rejected (`invalid_chain`), wallets are asked to switch, and
    `PURCHASE_PAYMENT_CHAIN` defaults to `42161` (any other chain disables
    purchases). New optional `AUTH_RPC_URL`.
  - DePay: the dynamic-configuration request is now verified (`x-signature`,
    new `DEPAY_VERIFY_PUBLIC_KEY`, legacy `DEPAY_CALLBACK_PUBLIC_KEY` still
    read); new signed `/purchases/depay/events`; callbacks compare chain,
    receiver and token, record deliveries append-only (`depay_events`) and
    return 500 on database failure so DePay retries; the configuration amount
    is the net server price as a JSON number; the checkout renders the
    official button with `blockchains='["arbitrum"]'`.
  - Coupon engine (percent, fixed, 100%, plan/size/user/time/usage limits,
    internal test coupons) with race-safe redemption, `/purchases/quote`,
    `/admin/coupons` and an append-only audit; 100% coupons provision through
    a dedicated zero-payment flow.
  - Explicit, database-enforced order lifecycle (`lifecycle_state`,
    `purchase_order_events`, immutable pricing, refund states). Additive
    migration; existing `status` derived.
  - Economy menu now holds Governance and a consolidated Ambassador (IB) page
    (Brand Ambassador and Verified Coach remain independent); `/coach`
    redirects to its section.
  - `test:payments` and the new `test:commerce` suites run in `test:all` (CI).
  - Documentation: README rebuilt around 38 required sections; DePay,
    coupons, order lifecycle, business model, operating governance,
    operations, licensing report, third-party notices, release/deployment
    checklists, issue templates; `docs:required` gate (required documents,
    README sections, every `render.yaml` variable documented).

- Website launch content: removed hosting-provider and release notes, the
  unverified office-location document, sample/illustrative product notes,
  placeholder documents, unreleased app badges, the public Team section and the
  Instagram promotion button from the public website; corrected the Challenges
  page claim that no plan has minimum trading days; exact `A-Book` / `B-Book`
  labels with a simulated-routing disclosure; protocol research labelled as not
  active; `/sitemap.xml`, `/robots.txt`, `og:locale` and indexable Economy and
  partner routes. Adds the five-locale content validation test
  (`test:content`), the product-rules consistency check
  (`check:product-rules`, backend mirror moved to `apps/backend/plan-catalog.js`)
  and `docs/website/CONTENT_ARCHITECTURE.md` / `docs/product/PRODUCT_RULES.md`.
- Fix (P0 production UI): explicit cache policy for the same-origin frontend
  (`apps/backend/static-cache.js`). Content-hashed Vite assets are `immutable`,
  unhashed files (`legacy/*`, fonts, `translations.json`, the Vela bundle)
  revalidate with `no-cache`, and 404s are `no-store`. Previously Cloudflare's
  4-hour Browser Cache TTL applied to every response without a stronger origin
  header, so a deploy-cutover 404 for the new stylesheet stayed cached and the
  site rendered unstyled (terminal collapsed to a 300x150 iframe).
- Pull request governance: a required-sections pull request template with a
  structural `PR description` check (and Conventional Commit title check),
  documented stacked-PR policy, branch-update practice, Conventional Commit
  scopes and merge-readiness checklist (`docs/development/PULL_REQUESTS.md`);
  release-traceability authority hierarchy in `docs/deployment/RELEASES.md` and a
  read-only release summary generator (`node scripts/release/summary.mjs`).
- Upstream governance automation: `scripts/upstream/check-releases.mjs` reads upstream releases and
  release notes, classifies risk by each provider's versioning policy (0.x, Directus breaking minors,
  semver majors, source heads) and feeds the weekly read-only `Upstream watch` workflow, which opens one
  draft proposal PR changing only `latest_observed`. `Upstream update candidate` (manual dispatch) runs
  the controlled vendor update and opens a draft PR with the report. No auto-merge, no deployment.
  ADR 0021 and `docs/integrations/UPSTREAM_AUTOMATION.md`.

- Upstream isolation and dependency registry: separates upstream, integration and Openfund-custom
  layers for Vela, the Pine addon and PineTS, the Gains API and SDK, the LuxAlgo journal core,
  Directus and key libraries. Adds `infra/upstream/` (registry, patch registry with three reversible
  Vela patches, customization guards, vendor manifest), `npm run check:upstream`, a controlled
  `update-vendor` report/apply tool that proves vendored source equals upstream plus registered
  patches, Gains market-data contract tests on recorded fixtures plus an optional live check, and the
  Vela/Gains upgrade protection guides. Vela stays at 0.9.3 (0.10.4 assessed: patch conflict, not
  adopted). `MarketData` gains an options seam with unchanged defaults; the trading engine is untouched.
- Directus upgrade readiness (no version change): staged rehearsal of 11.9.1 to 12.6.1 on an isolated
  PostgreSQL 17 database shows Directus 12 locks the current content model without a licence (Core tier:
  25 collections, no custom permission rules; Openfund registers 43 and filters every public read by
  status). The upgrade is blocked on an owner licensing decision; the repository stays on 11.9.1. Adds
  `apps/backstage/upgrade/` (inventory and verification tool, staging harness), a licence preflight in
  `apply_schema.py`, the Render health check on `/server/ping` and explicit `IP_TRUST_PROXY=true` (both
  safe on 11.x), backup/restore guide, production migration and rollback runbook and ADR 0020.

- Dependency governance: a machine-checked upstream registry (Vela, Vela Pine
  addon, PineTS, Gains SDK and APIs, journal-core, Directus, wallet libraries,
  protocol source) with versions, licenses, local modifications and update
  procedures; a conservative `dependabot.yml` (weekly grouped minor/patch, no
  automatic majors, upstream families excluded); and `npm run deps:check`, which
  fails when a pin drifts from the registry. Records that only the journal-core
  library of the LuxAlgo Trade Journal is integrated and that `vendor/gains-sdk`
  is unused.
- DePay checkout completed as the intended customer flow: **Buy Challenge**
  creates the server-priced order and opens the official widget with the
  integration id and only the order id; DePay asks the new signed dynamic
  configuration endpoint for chain, token, amount and receiver; DePay's
  signed callback is acknowledged at once and verified on-chain, then the
  existing provisioning creates exactly one challenge and the checkout shows
  *Payment successful*. Failed payments are shown in plain words, a pending
  order resumes after a page refresh, and a tampered widget bundle is
  blocked. Browser acceptance (`npm run test:browser:depay`) runs the real
  backend against a stub widget and a mock chain; real-network acceptance
  is still pending. Also fixes RPC HTTP errors (for example a 503) being
  reported as a final rejection instead of a retryable `rpc_unavailable`,
  and finality using a cached chain head.
- Challenge payment verification rewritten around an explicit correlation
  policy: the signer must be the signed-in wallet, only the approved ERC-20
  counts, and the amount is the sum of that token's transfers to the
  merchant from the payer or an approved router, so DePay router and swap
  payments verify and unrelated transfers never do. A dedicated
  `PURCHASE_RPC_URL` is required in production (no public-RPC fallback);
  token decimals come from the contract; native value is no longer treated as
  USD; production defaults to 12 confirmations with a reorg check; RPC
  outages and pending transactions are retryable instead of failures.
- Payment attempts are stored (`payment_attempts`), recovered by a
  background sweep after restarts or lost browser requests, and surfaced to
  operators through `/admin/payments` (lookup by order or hash, review
  queue for underpayment, wrong token, late, duplicate and overpayment,
  re-verify, audited resolution). Refunds stay manual.
- Orders swept to `expired` can now be paid inside the late-payment grace
  window as documented (previously unreachable).
- DePay checkout: Subresource-Integrity-pinned bundle, explicit CSP origins,
  mainnet token payments only, refresh-safe resume of a pending order and
  automatic follow-up of a submitted hash. Optional signed DePay server
  callback registers a retryable hint. Real-network acceptance is pending;
  see [payment activation](docs/payments/ACTIVATION.md).
- Repository: the generated `react/` build output (22.7 MB, 241 files) is no
  longer tracked; `npm run build:web` creates it and `Backend` CI builds it
  before booting the server. Removes the main source of merge conflicts between
  frontend pull requests. See `docs/development/REPOSITORY_HYGIENE.md`.
- CI: the locale matrix and the UI polish matrix (≈ 17 and ≈ 15.5 minutes
  sequentially in the release gates) now run as concurrent, never-retried
  shards, cutting the `Release package gates` job; documentation-only pull
  requests skip the heavy gates through a change classifier; pull request runs
  are cancelled when superseded while `main` and release runs never are; the
  Playwright browser cache is shared. See `docs/development/CI.md`.
- Terminal Chart tab and Quick Trade (branch `feat/terminal-chart-quick-trade`,
  implementation candidate): a Chart tab beside Trading shows
  the same Vela workspace full-viewport (order form, book and positions hidden)
  without reloading the chart, market stream, indicators or drawings. Quick
  Trade is a compact Buy/Sell control and order panel on that chart; it builds
  the order form's request and submits through the existing account adapter
  (validate, preview, submit with an idempotency key), so balance, leverage,
  margin and permission checks are unchanged. No bid/ask is shown because the
  market-data provider supplies a mark price only. No backend, engine or
  routing-convention change.
- Dependency lockfiles and npm configuration now use the official npm registry, avoiding CI timeouts from the previous package mirror.

- Unofficial Render candidates now retain the latest published version number while identifying new code by its exact commit SHA and `official: false`; only an explicit publish action allocates a new version.

- Hybrid Governance v1.0 (implementation candidate; council and voting remain inactive): off-chain, auditable governance with a ten-seat Community
  Council, OFP proposals, a validated lifecycle, quorum 7 and approval 6 of 10
  (7 for governance amendments), conflict-of-interest recusal, optional signed
  vote evidence, an election architecture gated on management approval and a
  hash-chained audit trail. Reserved company powers are advisory-only and the
  governance code has no access to treasury, trading, pricing or payout data.
  Adds `gov_*` tables (additive), `/governance` and `/admin/governance`, the
  `/:locale/governance` pages, Directus editorial collections, `GOVERNANCE.md`,
  `ECONOMY.md` and `docs/governance/`. No council is seated and no election is
  scheduled.
- Economy pages (Transparency, Revenue Model, Live Market Access) now show
  definitions, provenance lines, term names, expense categories and
  eligibility checks in Arabic, Russian and Simplified Chinese instead of
  English, which the five-locale acceptance matrix rejects.
- Official Openfund Whitepaper v1.0 at `/{locale}/whitepaper`: one
  anchor-navigated page with twenty Persian and English chapters, a sticky
  and mobile chapter navigator, copyable chapter links, data-driven
  architecture and flow diagrams, accessible charts (including an
  interactive hypothetical scenario) and catalog-derived pricing. Content
  is managed in new Directus `whitepaper_*` collections with published-only
  public reads, validated before rendering, and seeded idempotently by
  `seed_whitepaper_content.mjs`. The footer "Whitepaper · coming soon"
  placeholder is now the active link.
- Economy menu (Transparency, Revenue Model, Live Market Access) replaces
  the single Transparency link. Transparency now reports confirmed sales,
  refunds, challenge outcomes, payouts, treasury, financial position and
  verified expenses from operational records; the synthetic sample is gone.
- Openfund Treasury snapshots: scheduled on-chain balances (60–120 min,
  default 90) priced only by configured Chainlink feeds, with stale
  fallback; the address is configuration (`TREASURY_WALLET_ADDRESS`).
- Brand Ambassador program: reviewed applications, codes only after
  approval, 10% commission on the referred customer's first confirmed
  purchase (idempotent, refund/chargeback reversals, recorded payouts) and
  an ambassador dashboard.
- Verified Trading Coach program: independent approval, trader linking and
  qualification, 10% of distributable realized live profit only.
- Live Market Access control plane: record-based eligibility, explicit-tier
  management approval, verified-capital gate (≥ $500,000), risk-checked
  orders and idempotent profit-share settlement. Real execution and
  transfers remain disabled; only non-monetary sandbox adapters exist.
- Revenue Model page with cited single-firm research and a scenario
  calculator kept separate from company data.
- Release planning accepts an explicitly requested next patch on a manual
  main-branch batch, while rejecting skipped or reused versions.
- Stale market depth keeps readable text contrast in the light theme.
- The document security policy now hashes the served pre-paint script so
  clean-route recovery and locale direction remain allowed after builds.
- Terminal Share P&L: a Share action beside Details (open positions) and in
  Order History (closed positions with a recorded result) opens an
  Openfund-branded card rendered on a canvas that is also the exported PNG
  and the native-share file. Open-position values refresh from the live
  account data; closed positions show the recorded realized P&L.
- Terminal real-time stability: heartbeat watchdog and immediate reconnect
  for the Gains price socket, out-of-order mark guard, retryable boot,
  in-place table row patching with delegated actions, stale marking instead
  of blanking for marks and the Gains VOB ladder, and no workspace reload on
  locale changes. Depth remains the Gains virtual order book only.
- Persian gateway (`/fa/home`): the MADE BY HUMANS badge is removed and
  phones get readable, stable layout with natural scrolling.
- Arabic (`ar`, RTL), Russian (`ru`) and Simplified Chinese (`zh-CN`)
  interface locales with a five-language selector.
- Wallet connection: the connect button opens an explicit wallet picker
  (EIP-6963 wallets; generic browser wallet only when none announces
  itself) instead of connecting the first detected provider. Declined
  connection, network switch and signature requests show a neutral status;
  real failures (locked wallet, pending request, unknown network, server
  unreachable, SIWE domain/nonce/signature errors) name an actionable
  cause. Perpetual signs in on Arbitrum One in every locale (it used Sepolia
  for ar/ru/zh-CN). Explicit network-switch and disconnect controls;
  WalletConnect is offered only with a configured project id.
- Full content in all five languages: Perpetual and the two-product Home
  are available in every locale (no language redirects); seeds, public
  Directus content, the legacy landing and the terminal render in Arabic,
  Russian and Chinese from reviewed dictionaries loaded per locale, with
  Directus rows for those languages taking precedence. Untranslated text is
  reported and fails `npm run test:i18n` and the locale matrix instead of
  silently showing English. hreflang lists all five locales.
- Position Details: full labels (a CMS list value no longer collapses to
  one character per label) and a bidi-safe label/value layout.

- Clean SEO-friendly URLs: the public site now uses browser-history routes at
  the domain root (`/fa/challenges`, `/en/faq`) instead of
  `/react/#/fa/challenges`. The `/react` document prefix is permanently
  redirected (308) and old `#/…` bookmarks are recovered client-side by a
  pre-paint normalizer (the hash never reaches the server), preserving locale
  and query parameters. APIs, websockets and static assets are unaffected;
  cached legacy shells keep loading their `/react/assets/…` files.
- Branded loading experience: one shared Openfund-mark loader covers the
  genuine boot window and locale transitions. A pre-paint script sets
  `lang`/`dir` (and theme) before first paint so a language switch can never
  show Persian text in an LTR layout (or the reverse); the legacy landing
  loads its stylesheet before first paint instead of after the CMS fetch.
  Fast transitions stay loader-free (short display threshold), and backstops
  guarantee the loader never sticks. Route-driven SEO head: clean canonicals,
  `fa`/`en`/`x-default` hreflang on public pages, `noindex` on the
  authenticated product app.- Fix production deploys: GitHub's release download URL returned `504` to
  automated clients on 2026-11-08, so Render builds of v0.4.2 could not read
  the published manifest (three attempts failed; production stayed on
  v0.4.1). `render-build.mjs` and `deploy.mjs` now download release assets
  through the REST asset endpoint with bounded retries and still verify the
  manifest's SHA-256 digest. v0.4.2 remains published and immutable; its
  source cannot be deployed, so the next release supersedes it.
- Release container image: each stable release also publishes
  `ghcr.io/algomanlife/openfund:X.Y.Z`, built only from the verified release
  archive, smoke-tested and attested, with its digest on the GitHub Release
  ([ADR 0014](docs/decisions/0014-ghcr-release-image.md)). Render deployment
  is unchanged.

## v0.4.2 — 2026-11-08

Changes since v0.4.1 (`b8389ca`). Publication and deployment status: the
[GitHub Release](https://github.com/algomanlife/openfund/releases/tag/v0.4.2)
and the live `/version` endpoint.


- Initialize both public pages and the shared terminal from the OS light/dark
  preference only when the user has not selected a theme. Keep explicit
  user choices across routes, reloads and later OS changes.
- Keep the trading iframe and Vela chart synchronized with the root theme.
  Opera Force Dark Page remains a browser-level override; the user profile
  needs a per-site exception when that setting recolors the final paint.
  (PR #51)
- Prop engine audit fixes: a challenge passes only when the closed profit after
  settling open positions still meets the target; post-fill risk checks include
  the opening fee; minimum trading days count fill days; breach settlement
  finishes positions in closed markets once tradeable; the risk view reports
  the enforced day-basis daily limit. New `test:engine` suites (31 checks).
  See the [engine audit](docs/audits/PROP_ENGINE_AUDIT.md) and
  [ADR 0012](docs/decisions/0012-challenge-pass-settlement-and-trading-days.md).
  (PR #52)
- Persian terminal: mirror the header, align text direction and tables, fit
  the phone header and wallet label, open the wallet menu inside the viewport,
  and fix the mobile order form (PR #50).
- Release operations: a published stable release now chains its production
  deployment (approval required) with prerelease, stale-tag and idempotent
  retry guards, and rollback uses `rollback=true`
  ([ADR 0013](docs/decisions/0013-release-driven-production-deployment.md)).
- Documentation: README rewritten for the current architecture, release
  pipeline and both production domains (`openfi.cloud`, `openfund.cloud`).
  Wallet sign-in on a custom domain requires that hostname in
  `ALLOWED_DOMAINS` on the Render service.
- No schema change. On the first engine loop after deployment, closed
  challenge accounts that still hold open positions have them settled at the
  current mark. The Instant trailing "lock at breakeven" interpretation
  remains an open product decision (audit F6); behavior is unchanged.

## v0.4.1 — released 2026-11-07

- Move public CMS and other browser configuration to a no-store runtime script,
  outside the immutable frontend payload. The production CMS origin must be
  configured and validated; release builds strip public build variables.
- Resolve Render's official tag through GitHub rather than a checkout-specific
  Git remote, then compare the rebuilt frontend/backend/schema to the published
  verified manifest.
- Include website expansion content in the repeatable Directus bootstrap and
  resolve esbuild from the frontend lockfile without a manual symlink. Keep
  administrator credentials in environment variables.
- Narrow public translation-table reads to published parents; the earlier
  direct child endpoint exposed draft translations in a disposable test.
  Correct empty Home singleton detection and test that a rerun preserves edits.
- Synchronize the embedded terminal's theme state, icon and chart when the
  outer application changes theme. Follow-up work preserves the shell's theme
  when a product switch boots a replacement trading iframe.

The v0.4.1 tag is published and deployed.

## v0.3.1 — Prop soft launch: evaluation engine, challenge trading, admin operations (candidate, unreleased)

**New features**

- **Challenge evaluation engine** (`apps/backend/evaluation.js` + engine integration): the published Rulebook rules of record are enforced live on every purchased challenge account — profit targets measured on closed net profit, daily loss against max(opening balance, opening equity) with the 00:00 UTC+3 day boundary, static and trailing (breakeven-locked) maximum loss, minimum trading days, time-limit expiry. Breaches settle atomically: positions close at the server mark, pending orders cancel, the account closes and the violation lands in the append-only `challenge_events` history. Two-phase stage-1 passes auto-provision stage 2 with the frozen rules snapshot; a purchased challenge's contractual rules never change with later catalog edits. Evaluation defers (never force-settles) while marks are stale.
- **Challenge-account trading**: challenge accounts trade through the same server-authoritative simulation engine (ownership-checked account resolution, plan leverage cap 5×, per-event risk enforcement inside the account transaction, engine-loop monitoring for live marks and expiry). The `409 challenge_execution_unavailable` gate is retired; portfolio, journal, orders and analytics are account-scoped.
- **Terminal dark/light theme fix**: root cause — the srcDoc workspace rejected the shell's theme updates because `location.origin` in an `about:srcdoc` document is the string `"null"`; the navbar switched while the chart stayed on the boot theme. Fixed and covered by the 37-scenario auto-dark browser regression.
- **Administrative API** (`apps/backend/admin.js`): `ADMIN_API_TOKEN` service-token authorized (constant-time, disabled entirely while unset) — user directory + detail views (challenges, purchases with payment verification status, withdrawals, audit trail), challenge directory, and the withdrawal review workflow (approve/reject/paid with payout reference, invalid-transition rejection, duplicate-action prevention, audit logging). Payout execution (transferring real funds) is deliberately out of scope.
- **Payment lifecycle hardening**: configurable confirmation-depth finality (`PURCHASE_PAYMENT_MIN_CONFIRMATIONS`), late-payment grace window (a verified payment inside `PURCHASE_LATE_GRACE_MINUTES` after expiry still pays — money received is never silently dropped), and a 60s pending-order expiry sweep.
- **Security headers**: strict CSP (`script-src 'self'` + the hashed theme pre-paint script), X-Content-Type-Options, X-Frame-Options SAMEORIGIN, Referrer-Policy, HSTS in production; the terminal boot script is external (`legacy/react-boot.js` with a non-executable JSON data island) and the landing's legacy chain loads as ordered same-origin `<script src>` elements — the whole app runs under the real policy. Optional constant-time token on the test-only `/internal` seams; test-mode rate windows widened for sequential suites.
- **Challenge dashboard** (`ChallengePanel.tsx`): live evaluation metrics, status/stage/expiry, one-click challenge start, violation list and the immutable event timeline; account selector carries one id across journal/evaluation/trading scopes. Root SEO/OG metadata (static fallback + CMS-mirrored dynamic tags). One-command idempotent CMS bootstrap (`apps/backstage/scripts/bootstrap-cms.sh`).

**Database migrations** (additive, idempotent): `openfund_challenges` gains `stage`, `rules_snapshot`, `demo_account_id`, `expires_at`; new tables `challenge_events`, `challenge_equity_days`, `challenge_trailing`; `demo_accounts` UNIQUE(user_id, account_type) replaced by a partial unique index (one free demo per user, many challenge accounts); controlled `dailyLossPct` canonicalization of the legacy `maxDailyLossPct` plan key (never overwrites edited values).

**Bug fixes**: `num(null)` coercion turned an unlimited `timeLimitDays` into a same-second expiry (caught by the new browser E2E); duplicate provisioning when a rules snapshot existed without plan configuration; portfolio analytics now account-scoped for challenge accounts.

**Tests**: backend 351 checks green (siwe 22, trading 54, portfolio 31, products 58, gains 5, unified 11, audit 25, referral 18, **evaluation 48 new**, **admin 25 new**, purchases 54 — receiver enabled, no skips); web typecheck + 82/82 unit; browser E2E: purchase flow 17/17, **challenge lifecycle 15/15 new**, auto-dark theme 37/37, all under the strict CSP.

**Known limitations (honest)**: production payment activation is `BLOCKED_BY_EXTERNAL_CONFIGURATION` — the receiver address, production chain/token, finality policy and payout architecture are owner decisions; no production on-chain payment has been verified (testnet + SIM seam only). Funded-stage provisioning, real payout settlement, rewards and certificates remain planned. The free-trial challenge plan is not purchasable (free plans are `not_purchasable` by design). Directus DB-level column grants remain a documented hardening backlog (the backend stays the sole financial writer). Perpetual execution stays disabled.

## P0 delivery identity and acceptance — unreleased

- Reproduce Chromium auto-dark repainting computed white backgrounds to RGB(18,18,18); explicit `color-scheme: only light` protects public and nested terminal paint without filters or browser-profile changes. The owner Opera setting itself is not verified.
- Restore saved Vela cosmetics before reapplying the application palette, preserving drawings and tool preferences; include real auto-dark/OS-theme screenshot-pixel regression in the existing polish release gate.
- Recover missing frontend-manifest diagnostics without changing backend release identity or financial behavior; missing/unavailable identities now display a warning.
- Add real theme-button regression across public routes, Dashboard and Vela, navigation/reload/restored contexts and both OS preferences; preserve white light and dark-green canvases.
- Correct purchase harness route/session-restoration races without weakening assertions. Preserve historical failure logs and require fresh full-candidate validation.
- Move README tagline once into top branding, organize the requested section sequence and replace stale current screenshots with provenance-labelled P0 evidence. Owner Opera acceptance remains unavailable.
- Use the existing 24-gate pipeline and verified extracted candidate for canonical 8080; no official release, migration of user data or publication is implied.

## Community, native themes and README — unreleased addendum

- Coordinate provider-configured Telegram, Discord and Instagram controls in public Heroes/Footers with authentic icons, native colors, shared dimensions and reduced-motion behavior; absent owner destinations remain unavailable.
- Remove the footer only from Persian gateway Home; preserve its three Hero community controls, English Home and other public footers. Restore viewport fit without clipping or reduced touch targets.
- Correct actual light-mode empty-state, chart-workspace source/semantic-control and authenticated profile-action contrast using shared/native palettes; preserve dark-green identity and all trading/auth/payment logic.
- Replace root light-mode inversion with native public/terminal surfaces and supported Vela theme configuration; preserve official service artwork and five monochrome platform icons.
- Rebuild README around actual architecture, licensing and implementation boundaries; add isolated candidate verification and genuine bilingual light/dark screenshot evidence in [delivery](docs/reviews/community-theme/DELIVERY.md).
- Preserve trading/authentication/payment logic, the user database and real CMS; the requested v0.2.1 conflicts with the current 0.3.0 allocator and remains unallocated.

## Website and repository refresh — candidate

- Reconcile live v0.2.0 publication at main `561e7f3` with the excluded dirty website candidate; local port 8080 startup remains separately unverified.
- Correct dormant Protocol source, Gains provider-specific data limits, payment test coverage, invoice sequence/timing limits and overwritten screenshot provenance. Community destination remains unavailable pending an owner URL.

- Correct official TradingView artwork, add DePay service identification and bilingual developer attribution.
- Present desktop and mobile platforms with truthful Coming Soon states.
- Add shared, accessible Telegram actions to public heroes/footer; terminal excluded.
- Refresh source/release documentation and real candidate screenshots; preserve purchase/payment gates and unified release architecture.

## 2026-11-03 — Wallet profiles, challenge purchases, invoices and withdrawal requests

- Add wallet-profile editing (`PATCH /auth/profile`): display name (1–60 chars) and avatar (https URL or ≤256 KB image data URL) with server-side validation; the wallet identity itself stays immutable.
- Add server-priced challenge purchases (`apps/backend/purchases.js`): idempotent orders snapshot the catalog price from `challenge_plans`; payment instructions (receiver, chain, optional token) come from the `PURCHASE_PAYMENT_*` environment — purchasing stays disabled (`purchases_disabled`) while no approved destination is configured, and no production address is ever committed.
- Add server-side on-chain payment verification with viem (no new dependencies): receipt success, sender, receiver, ERC-20 Transfer or native amount (exact decimal-string unit math), and block-time ordering; `UNIQUE (chain_id, tx_hash)` plus an atomic provisioning transaction guarantees a confirmed payment provisions exactly one `openfund_challenges` record with an auditable payment row, sequence-numbered invoice and event trail. See [ADR 0009](docs/decisions/0009-challenge-purchases-and-payment-verification.md).
- Add the React checkout flow on the challenges page (no legacy runtime edits — a `CheckoutHost` bridges the existing summary dialog), an optional DePay widget gated behind `VITE_DEPAY_WIDGET`/`VITE_DEPAY_WIDGET_URL`, and Prop product pages for purchase/payment history with downloadable dependency-free PDF invoices and withdrawal requests (`#/{locale}/prop/purchases`, `#/{locale}/prop/withdrawals`).
- Add tests: 54 backend purchase/profile/invoice/withdrawal assertions (unit + HTTP, wired into `test:all`) and a 17-check browser E2E (`e2e/test-purchase-flow.cjs`, disposable EIP-6963 signer, full lifecycle through the SIM_TEST_MODE seam). Live-chain verification and production payment activation remain pending an approved destination; challenge rule enforcement stays future work.

## 2026-11-03 — Persian landing motion (merged from main, PR #40)

- Replace the Persian Home cartoon and previous Perpetual machine with original decorative SVG trading interfaces, add pointer-reactive networks, a compact proposed Perpetual feature strip and a Made by Humans badge.
- Retain existing CMS, header/wallet interfaces and English Prop challenge entry; add responsive, keyboard, touch and motion acceptance checks. See [landing evidence](docs/reviews/landing-motion/DELIVERY.md).

## Unreleased — integration recovery and unified releases

- Bind manual batch publication to the required successful secret check on the exact main commit, with explicit repository scan configuration.

- Recover the compact shared terminal navigation, account Dashboard layout, EIP-6963 connection and product-network synchronization from preserved unfinished work.
- Preserve account scope in trading reads, mutations and Journal links; keep reviewed-order retry identity and remove invented chart protection levels.
- Add main-only SemVer release packaging, artifact integrity checks, API/frontend diagnostics, approved exact-commit Render deployment and an exact-version local runner.
- Keep production, external wallets and first official release acceptance pending their actual evidence.


## Website navigation repair — 2026-11-02

- Share localized public header/footer destinations across Challenges and editorial pages; expose Resources on Home, repair Team/FAQ aliases and the brandbook download URL, deduplicate footer links, and preserve nested-page language switching.
- Repair Resources disclosure keyboard/touch behavior and tablet/mobile access without changing trading behavior or page content. See [navigation evidence](docs/reviews/website-navigation/DELIVERY.md).

## 2026-11-02 — Compact trading workspace

- Compact both terminals to a 40px application tier and 34px market tier; retain all routes through primary links and More.
- Reuse the dark-green design system with thin dividers, fixed bilingual column geometry, paired fields and always-visible critical risk and order action.
- Add explicit narrow/short-window views and anonymous/authenticated viewport acceptance; preserve trading, market, wallet and chart behavior.
- Record genuine before/after screenshots and [local verification](docs/reviews/terminal-ui/DELIVERY.md); deployment remains separate.

## 2026-11-02 — Unified accounts and trial lifecycle

- Add an owned account-card directory, persistent account navigation and journal module workflows/preferences.
- Provision new trials once in virtual USD; permanently disable zero-equity trials with transactional settlement, audit history and database reactivation/deletion guards. Preserve individual position liquidation and Challenge isolation.
- Add backend estimates, explicit instrument contracts/precision and stop-gap execution; align reporting dates to settlement.
- Restore Book/Trades using verified Gains VOB and real executed-trade resources; retain Vela and proprietary source indicators.
- Add independent five-category settlement fixtures, lifecycle regressions and browser acceptance coverage. See the [delivery evidence](docs/reviews/unified-trading/DELIVERY.md).


Historical entries describe their original changes, including past UI copy. They are not verification of business locations, commercial availability or present capabilities. See [Feature Status](docs/product/FEATURE_STATUS.md).

## 2026-11-02 — Website expansion: FAQ, Growth Partner, Tools Center, Learning Center

- Add four bilingual public sections on the existing shell: a searchable 43-question FAQ hub with categories and shareable question links, a Tools Center with ten deterministic browser-side calculators (position size, margin, liquidation, PnL, funding, risk/reward, risk of ruin, prop drawdown, consistency, CSV journal analyzer), a Learning Center with five paths, 25 lessons and a 40-term glossary, and a pre-launch Growth Partner page.
- Extend Directus additively (faq categories, learning paths/lessons/glossary, tool prose, referral singleton with a prelaunch/live switch) and seed them idempotently from the repository seeds; pages fall back to bundled content with a visible marker when the CMS is unreachable.
- Implement server-authoritative referral attribution: one invite code per wallet identity, a single attribution record at account creation from the of_ref cookie, self-referral impossible, session-scoped summary — with no commission, reward or payout fields anywhere.
- Group the new destinations under a Resources dropdown in the shared header (flat on mobile) and add footer/SEO rows; language switching preserves the destination.
- Add the calculator engine with coded locale-neutral validation, a Unicode-aware Persian search normalizer, 47 frontend tests and 18 backend referral tests, all wired into CI.

## 2026-11-02 — Proprietary chart indicators and interaction repair

- Add original Open Algo V5, Price Action Concepts and Smart Money Concepts to the shared chart catalog before all built-ins; resolve supplied Pine libraries locally.
- Run original calculations in the official Pine worker, preserve input settings across reloads and correct PAC nested secondary execution without changing source algorithms.
- Fix menu stacking, canonical timeframe labels, symbol state and missing-interval fallback; retain genuine candle extremes on live updates.
- Remove native VELA badges and chart footer branding; keep the required linked notice in terminal status and preserve licenses.
- Add source/runtime/provider/browser regressions and English architecture/limitation documentation. Deployment and independent reference conformance remain unverified.

## 2026-11-02 — Repository identity and documentation

- Rebuild the flagship README around Openfund's product strategy, current capabilities, genuine English screenshots and approved branding.
- Establish business/product guides, accurate architecture, a canonical capability register and seven-phase acceptance-based roadmap.
- Translate the integration delivery report and historical UI quotations; replace obsolete documentation captures with immutable historical links.
- Add English prose/comment checks, local link/image checks, Markdown and Mermaid validation to CI; preserve Persian product localization and Render infrastructure.
- Document remaining wallet, deployment, commercial and protocol gates. No MUX/protocol source imported; no application behavior or Render resource changed.

## 2026-11-02 — Integrated trading, account and Render repair

- Prop settlement now scopes retry keys by owner, includes fees and open loss in margin checks, rejects invalid/stale input, serializes protection/cancellation, and supports idempotent partial closes on the existing ledger.
- Engine and Portfolio share Decimal valuation; sub-cent prices retain precision, analytics deduct both fees, liquidation includes close costs, and sampled UTC equity drawdown persists without inventing challenge limits.
- SIWE validates URI/time, atomically consumes nonces and checks signatures on Sepolia or Arbitrum One; cookie-changing requests are ordered, wallet changes clear private state, disconnect revokes sessions, and SSE rechecks session validity.
- Account dialogs link to both products. Shared terminal uses server PnL/liquidation, reports stale/disconnected states, supports partial-close controls and preserves one Prop/Perpetual workspace.
- Home uses the existing nav-less layout and correct Perpetual route, removes a missing asset request and adds lightweight reduced-motion-aware ambient light. Wallet chips wrap on mobile.
- Preserve Render PR #23's graph; correct Directus database keys, public hostname references, service regions, single engine instance and build dependency installation. Extend CI, Blueprint semantic checks and integration/browser regression coverage. No production deployment.


### Shared product terminals, scoped Portfolio and Journal (2026-11-02)

- One reusable viewport-filling trading workspace with product adapters, independent locale/product routes and exact horizontal navigation; public marketing header preserved. Terminal has no surrounding headings, copy, banners or padding.
- Private account/product-scoped PostgreSQL notebooks, tags/classification, owned trade annotations, optimistic edits, atomic metadata restore, JSON/CSV exports, filtering/pagination and journal-core performance views including Edge Score v2 and time/tag reports.
- Read-only official Gains Arbitrum positions, pending orders, wallet history/statistics and per-collateral recent-event analytics. No new execution, fake balances, synthetic market depth or manufactured trades.
- Directus runtime product content and normalized editorial sections with published-only permissions; optional reviewed Render blueprint and same-origin frontend/API hosting.
- Fix realized-PnL column read, account-scoped portfolio queries, arbitrary annotation writes, millisecond-key collisions (legacy notes preserved), stale scoped UI responses and injected wallet connection when WalletConnect is not configured.
- Verification and remaining service dependencies: `docs/reviews/dual-terminals/DELIVERY.md`. No merge or production deploy.

Notable changes are recorded here. Dates should use ISO 8601.

## Unreleased

- Directus upgrade readiness (no version change): staged rehearsal of 11.9.1 to 12.6.1 on an isolated
  PostgreSQL 17 database shows Directus 12 locks the current content model without a licence (Core tier:
  25 collections, no custom permission rules; Openfund registers 43 and filters every public read by
  status). The upgrade is blocked on an owner licensing decision; the repository stays on 11.9.1. Adds
  `apps/backstage/upgrade/` (inventory and verification tool, staging harness), a licence preflight in
  `apply_schema.py`, the Render health check on `/server/ping` and explicit `IP_TRUST_PROXY=true` (both
  safe on 11.x), backup/restore guide, production migration and rollback runbook and ADR 0020.

### Openfund Protocol source integration (2026-11-02, branch `feat/openfund-protocol-foundation`)

- **feat(protocol):** imported the complete upstream mux-protocol source (revision `0f70a70b`, GPL-2.0) into `packages/openfund-protocol/` — contracts (margin-trading core, orderbook, liquidity management, governance, tokens, readers), the full test suite, deployment tooling, historical deployment records and the audit report. PROVENANCE.md records the exact revision, scope and a verified finding: the imported HEAD does not compile with its own pinned toolchain (upstream regression in OrderBook.sol — the parent revision compiles cleanly with the identical config).
- **rebrand:** module presented as **Openfund Protocol** with the positioning statement — liquidity aggregation across Gains Network, Hyperliquid and dYdX with intelligent routing (future release; routing/adapters documented as not implemented).
- **docs:** `docs/protocol/{OVERVIEW,ARCHITECTURE,ROUTING,DEVELOPMENT}.md` — imported foundation vs future capabilities, isolation rules and the protocol PR workflow.
- **isolation:** strictly dormant — no app/CI/Render/env changes; module-local lockfile only. Validated: blueprint OK · web tsc + units green · backend suites green (SIWE 22 · trading 54 · portfolio 31 · products 55 · audit 11 on an isolated schema).

### Home visual refresh — clean gateway, motion, original illustrations (2026-11-02, branch `qwen/home-visual-refresh`)

- **feat(home):** descriptive texts removed from the gateway (headline, product titles and CTAs remain; empty CMS fields simply don't render — owner can re-add anytime in Directus).
- **feat(art):** two NEW original illustrations — “evaluation desk” (a focused trader at a glowing terminal, evaluation chips floating above) and “market-data engine” (a market-data engine with a holographic lozenge core, glowing lenses and data ribbons) — in the Ethereum-illustration spirit, fully in the Openfund palette; both internally animated (scan shimmer, floating chips, lens pulses) with reduced-motion support.
- **feat(home):** animated backdrop scene “the gathering” — towers with lit windows, pine groves, a central glowing platform with rising sparks and a floating hologram network; slow parallax drift, twinkles and core pulse, bottom-anchored under the one-screen layout (hidden under reduced-motion).
- **feat(home):** heartbeat strip at the bottom of the single-screen layout — animated beating heart + Heartbeat · Built by traders, for traders (fa) / Heartbeat · Built by traders, for traders (en) — CMS-managed via the home_content note field (newline-separated lines).
- **feat(motion):** staggered entrance choreography (eyebrow → headline → panels → heartbeat), panel hover lift with mint glow, illustration parallax on hover.
- **tests:** CMS E2E **35/35** · content E2E **107/107** (new checks: clean gateway, heartbeat, backdrop, illustrations) · one-screen verified (≤1px slack @1440) · 375px + light mode verified · tsc + build clean.

### Production content overhaul + complete CMS migration (2026-11-01, branch `qwen/content-overhaul`)

- **feat(catalog):** challenge catalog replaced with the researched, adopted specification — Standard (2-phase 8%+5%, $44–$652), One-phase (12%, $74–$666), Instant (no evaluation, 5% trailing, 95% share, $60–$888) and a 14-day Free Trial — with full condition coverage (daily-loss basis + 00:00 UTC+3 reset, static/trailing drawdown, payout cycles, consistency, refunds, min trading days). Provenance in `docs/research/`; unverified items (2-Step Pro/Flex pricing) documented as not-adopted, never fabricated.
- **feat(cms):** complete migration of the public content layer to the existing Directus — new collections `home_content`, `faqs`, `trading_rules`, `legal_documents`, `footer_links` (+translations), `challenge_plans` registered as the editable commercial table (same PostgreSQL table the backend reads), `ui_messages` extended to 412 strings. Home/Rulebook/Markets/landing render from Directus at runtime; edits appear on the next page load without a rebuild; drafts filtered at the public API; whitelisted link destinations; no hardcoded marketing fallback (explicit CMS-unavailable states). Admin guide + coverage report in `docs/backstage/`.
- **feat(content):** professional bilingual copy across Home, Challenges, Markets, Rulebook, FAQ (9 catalog-accurate items), footer and legal; prototype language removed (“sample fee”, “secure payment · instant activation” false claim, “sample plans”, fabricated team personas → role cards); honest not-yet-active disclosures preserved (purchases/payouts/trial provisioning).
- **fix(i18n):** direct route-locale change on the landing (URL edit / link) now re-runs the legacy translation pipeline — the page can no longer show fa text under an /en URL; `Number(null)→0` in the CMS client dropped Instant/Free-Trial plans — fixed; 375px header/footer overflow (wallet chip, unwrapped EN footer links) — fixed.
- **tests:** catalog unit 5/5 · information 6/6 · markets 6/6 · tsc clean · build ok · CMS E2E **35/35** (all 17 mandatory checks: live edits, unpublish, drafts, permissions, no-rebuild, Gains independence, transparency untouched) · content E2E **104/104**.

### Product Gateway, Markets page & unified website navigation (2026-11-01, branch `qwen/product-gateway-markets`)

- **feat(home):** new one-screen product gateway at `#/{locale}/home` ("All Markets, One Trading Platform") with two **original** Openfund vector illustrations (`assets/home/prop-trading.svg`, `assets/home/perpetual-trading.svg` — animated, reduced-motion aware, true brand colors in light mode), two product CTAs, shared header, no footer. Direction B (dual panels) is the default; `?variant=a` previews direction A on the same route.
- **feat(markets):** standalone Markets directory at `#/{locale}/markets` — **Gains Network as the authoritative source**: 488 instruments and categories derived from live metadata (never hardcoded), localized category tabs with data-derived counts, normalized client-side search (English works in fa), live mark prices via the **existing shared Gains adapter/WebSocket** (no second price engine), animated asset-universe hero, Gains-only fields (no fabricated volume/24h/market-cap), and market deep-links that open the symbol directly in the terminal.
- **feat(routing):** `/` is now the gateway (language-aware redirect); the legacy landing moved to `#/{locale}/challenges` **fully preserved** (route locale wins on boot; the language toggle syncs the URL via `history.replaceState` without remounting the legacy runtime). Legacy deep links (`#/markets`, `#/accounts`, `#/how`, `#/team`, `#/rules`, …) migrate to the page that owns the content; unknown hashes fall back to Home.
- **feat(nav):** exactly four menu items in one order on every public page — Trading Challenges / Markets / Trading Rules / Transparency (Trading Challenges / Markets / Trading Rules / Transparency) — from a single authoritative definition (`features/information/content.ts`) over the shared landing header chrome; logo → Home everywhere; terminal's Markets link now opens the Markets page; language switching preserves the page on all five pages.
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
- **feat(i18n):** Persian/Arabic-Indic numeric input accepted everywhere (normNum: Persian/Arabic-Indic digits and decimal separators) — inputs converted to `inputmode="decimal"`; fa and en produce mathematically identical trades.
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
- **feat(wallet):** landing "Sign in with a Web3 wallet" card now opens the real RainbowKit modal (`window.__ofOpenConnect`); the RK modal is translated to Persian (fa not a built-in RK locale — DOM tree-walk translator + RTL) and follows the app language.
- **fix(terminal):** market category pills re-render on language switch (were stuck in the boot language); EN labels capitalized (All/Crypto/Forex/Stocks/Indices/Commodities) — static + Directus updated.
- **feat(terminal):** status bar rebuilt Gains/Hyperliquid-style: live clock with proper half-hour timezone (UTC+4:30), terminal version, live-data status + api.gains.trade source, support link; DEMO badge and garbled copy removed.
- **fix(ui):** header language/theme toggles unified at exactly 32×32 on both pages (width overflow fixed via box-sizing + min-width).
- **feat(footer):** full bilingual office addresses (Shiraz + San Francisco), Persian in fa / English in en; “Developed in San Francisco”.
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
- **feat(landing):** wallet connect button now lives in the landing header (`#wallet-root` inside nav-actions, right after the "Enter the terminal" CTA) with the same RainbowKit modal as the terminal; label follows the app language.
- **feat(landing):** new open-source row at the very bottom — GitHub mark + "Always transparent and open source" + "For collaborative development and ongoing user review" (fa/en), plus the FA-only line "the first Iranian open-source business" (auto-hidden in EN).
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

## Unreleased — UI polish batch

- Keep connected wallet actions in a compact accessible header disclosure.
- Restore FA-only two-product Home and Perpetual terminal availability; EN Home uses the existing Prop landing and unsupported product routes redirect.
- Add TradingView as a labelled external market/news footer resource, without claiming a data integration or partnership.
- Synchronize native light/dark terminal and Vela themes through the established preference and iframe lifecycle.
