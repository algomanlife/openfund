# Changelog

## Unreleased

- Upstream isolation and dependency registry: separates upstream, integration and Openfund-custom
  layers for Vela, the Pine addon and PineTS, the Gains API and SDK, the LuxAlgo journal core,
  Directus and key libraries. Adds `infra/upstream/` (registry, patch registry with three reversible
  Vela patches, customization guards, vendor manifest), `npm run check:upstream`, a controlled
  `update-vendor` report/apply tool that proves vendored source equals upstream plus registered
  patches, Gains market-data contract tests on recorded fixtures plus an optional live check, and the
  Vela/Gains upgrade protection guides. Vela stays at 0.9.3 (0.10.4 assessed: patch conflict, not
  adopted). `MarketData` gains an options seam with unchanged defaults; the trading engine is untouched.

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
