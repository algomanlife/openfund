# Website refresh delivery

Status: implementation candidate based on merged main `561e7f3`; not yet an official release. [Pre-implementation audit](AUDIT.md).

## Changes

Shared service footer, official TradingView and DePay assets, bilingual attribution, five honest platform cards, reusable Telegram action and current documentation. The community destination is unavailable until an owner-verified URL is configured. The prior generic Telegram homepage implementation/captures are historical candidate evidence, not an Openfund community or current authorization. All native applications remain Coming Soon; the official tar.gz is the web/API package. Payment-processing and wallet-authentication logic are preserved.

## Publication checkpoint — 2026-11-03 19:52 UTC

GitHub run 41705345213 succeeded and published official v0.2.0 at main
`561e7f3101f3a43376068d9bba1a87c30e2b7d71`; annotated tag and official manifest agree.
PR #40/#41 are included, but this dirty website branch is not. No port 8080 startup
or deployed Render acceptance is verified by this documentation update. See
[release identity and scope](../../deployment/RELEASES.md).

## Official artwork provenance

- TradingView: https://raw.githubusercontent.com/tradingview/lightweight-charts/master/website/src/img/tradingview-logo.svg (official TradingView repository); full wordmark geometry retained, monochrome inversion only for dark backgrounds. News destination unchanged. Existing upstream license notice retained.
- DePay: https://depay.com/brand/DePay%20Logo.svg via https://depay.com/brand; geometry and colors unchanged.
- Telegram: Logo.svg from the logo archive linked at https://telegram.org/tour/screenshots; geometry/colors unchanged.
- App Store platform icon: https://developer.apple.com/assets/elements/icons/app-store/app-store-128x128_2x.png; no fabricated Download on the App Store badge or listing.
- Google Play: https://www.gstatic.com/android/market_images/web/play_prism_hlock_2x.png; original aspect ratio, no claimed listing.

Third-party marks identify linked services/platforms and do not imply endorsement. Existing Gains, Vela, Render descriptions and Shiraz credit are preserved.

## Validation and screenshots

- TypeScript, production build, complete frontend suites, chart suites, release-integrity suites and Blueprint validation passed.
- `docs:check` passed: 124 Markdown documents / 680 local targets, 14 Mermaid diagrams, no Markdown or language failures at this checkpoint.
- Focused browser acceptance: 214 checks passed across Persian/English, dark/light and 390/768/1440 widths; five platform states, official logo loads, secure Telegram destinations, keyboard focus, reduced motion, public footer reuse and terminal/dashboard exclusion. No request interception was used in this focused matrix.
- Backend suites passed on isolated `openfund_refresh_test_20261103`, including 54 purchase/profile/invoice/withdrawal checks with zero skips. Initial test startup used a disposable DB name without the required test marker; its injection seam correctly stayed disabled. Retried with the correctly named isolated test database; no product code was changed or test weakened.
- Purchase browser lifecycle passed 17 checks (disposable signer, real SIWE/local DB, labelled catalog fixture and test-only confirmation; no chain writes). An initial run overlapped the candidate rebuild of tracked React output and timed out at withdrawals; the full run after rebuilding passed without changing payment code. Capture tooling now requires the actual workspace before recording an account screenshot.
- Ten actual anonymous candidate captures plus five refreshed disposable authenticated captures are recorded in the screenshot manifest. Account capture utility now opens the existing wallet disclosure before selecting sign-in/account actions; the old selectors assumed always-visible controls.
- The first full candidate reached existing UI-polish acceptance after backend, 515 terminal checks, layout and chart checks. Its old assertions still required the now-explicitly-removed external-resource label and four service entries; updated those assertions to enforce label removal and all five services, including DePay. The complete gate will be rerun; no financial assertion was removed.

Historical screenshot entries retain their original capture context; the five overwritten account-image filenames now point only to their recorded 2026-11-03 candidate metadata. All 15 image hashes were rechecked and matched; the manifest records a capture-set fingerprint. A source patch/build fingerprint was not recorded at capture and cannot be retroactively inferred from the now-changing source. New images are unofficial candidates, not v0.1.1 or v0.2.0 screenshots. Earlier captures and the 214-check matrix predate unavailable-state correction and do not establish final Telegram acceptance. Public Home uses actual published local Directus content. Authenticated images show empty genuine accounts, not seeded profit/history.

## Remaining configuration boundaries

No owner-verified Openfund Telegram destination is configured. Keep the action unavailable until configured; Telegram's homepage must not be asserted as the community. Final source/browser acceptance and new capture provenance belong to the coordinating implementation owner.
Native installers/store listings, approved live payment destination, real-chain/widget
acceptance, challenge evaluation/payout processing and production Render deployment
remain outside this release’s verified capability. Existing published CMS legal copy
still mentions a past Sites host; that external editorial record requires a separate
content publication rather than a source snapshot being treated as deployed evidence.

## Final verification — 2026-11-03

The verification-only pass preserved all feature, wallet, payment, backend and
financial logic; no source/test assertions were edited, no commit or PR created.
Existing official port 8080 and Directus port 8055 were preserved. Node 22.23.4
was used. Base/main remains `561e7f3101f3a43376068d9bba1a87c30e2b7d71`;
the dirty website additions are not an official release or deployed acceptance.

### Executed checks

- Complete `npm run release:build -- --candidate`, candidate version 0.2.1,
  private port 8394, fresh `openfund_website_final_test_20261103_2014`: passed
  all three lockfile installs, Blueprint, docs, TypeScript, frontend/chart/release
  suites, both reproducible builds, both migrations, catalog seed, backend,
  integration audit, terminal completion, layout, charts and 1016 UI-polish checks.
  Backend purchase/profile/invoice/withdrawal coverage passed 54 checks, zero skips,
  using the CI-only receiver placeholder, not a production payment destination.
- This full attempt failed the new website gate at
  `e2e/test-website-refresh.cjs:64`, `fa/light/390 keyboard focus`. Packaging
  correctly stopped; it did not reach release diagnostics, public routes or
  authenticated layout. The first failed attempt is preserved under
  `output/release-attempts/v0.2.1-1793737329732/verification.json` and
  `output/website-final-release.log`; it must not be represented as green.
- The complete unchanged rerun on fresh
  `openfund_website_final_retry_test_20261103_2025`, private port 8394, passed all
  24 release stages, including the new 294-check website gate, release diagnostics,
  public routes and authenticated layout. No tests were suppressed or altered.
  It successfully verified and packaged the unofficial 0.2.1 candidate at
  `output/releases/v0.2.1/openfund-v0.2.1.tar.gz`; SHA-256
  `a406897be2c93cbaffa2a668901b37ed6bb100c9da028c3bc47567cf23a73d10`.
  See `output/releases/v0.2.1/verification.json` and
  `output/website-final-release-retry.log`. Source/config/test and frontend build
  fingerprints matched the final capture build; the initial failed attempt
  remains preserved as a readiness-flakiness finding, not silently discarded.
- An unchanged standalone website capture matrix passed 294 checks; a separate
  diagnostic reproduced `focused=true`, `focusVisible=true`, but `outline=none`
  and empty `--mint` immediately after portal attachment. After 100 ms the real
  stylesheet defined `--mint` and `outline=solid`. This points to stylesheet
  readiness timing, not a missing focus selector. Evidence is
  `output/website-final-focus-observations.json` and
  `output/website-final-focus-settle.json`. No wait or assertion was patched into
  the existing gate during verification.
- Explicit purchase browser regression passed all 17 checks on separate port
  8396 and `openfund_website_purchase_test_20261103_2014`. Existing labelled CMS
  catalog fixture and test-only confirmation seam were confined to that suite;
  real SIWE/PostgreSQL, disposable generated signer, no chain writes or payment.
- Remaining gates ran independently on private port 8397: release diagnostics,
  all public routes and authenticated layout passed. This evidence does not
  override the failed full build (`output/website-final-supplement.json`).
- Landing regression passed 207 checks across all eight viewport sizes using
  actual local Directus, no CMS fixture (`output/playwright/website-final-landing/validation.json`).

### Final rendered evidence and identity

Fifteen actual images were recaptured at 20:20–20:21 UTC from the private
candidate backend at 8395 using the pristine
`openfund_website_capture_test_20261103_2014` database. They include Persian Home,
English/Persian Challenges, both footer/download sections, Prop/Perpetual terminal,
anonymous and authenticated Dashboard, Profile, both Portfolios and Journal.
Capture tooling used real published Directus localhost:8055 fallback, live Gains
reads and explicit upstream unavailability; no market/account/CMS responses were
mocked. The new account had normal 100000 virtual USD, zero trades/challenges and
no notes. Its real SIWE session was revoked and generated private key discarded.
All final images were opened with the image reader and visually checked; Home
contains both actual product cards, not an unavailable heading. Coming Soon
community/platform states and empty real account data are visible.

[manifest.json](../../assets/screenshots/manifest.json) and the
[gallery captions](../../assets/screenshots/README.md) identify each final image,
its hash and actual dirty source/build provenance. Historical unrelated captures
retain their qualifications. The overwritten 19:10/19:14 candidate pixels survive
in Git history, not under outdated timestamps in the current gallery.

- Final fifteen-image capture-set SHA-256:
  `7c20e16f371ecfa1d783502c1c337cdff026e79cf2786df9b213e7b8494f08d0`.
- Dirty tracked source/config/test fingerprint:
  `04e0f3e4e824723a784e6077cb57db6891463fedd7af20b413d22dc401922c20`.
  Definition: sorted tracked non-Markdown files excluding docs, React build output
  and release manifests, read from disk including staged and unstaged changes.
- Source patch SHA-256:
  `a305016253d1388014f0a95bc9c89d1e4e07aeffedb882db58fcf238ddf8601e`.
  Evidence: `output/website-final-source-before.json` and
  `output/website-final-source.patch`; source drift was checked independently.
- Frontend build SHA-256:
  `112cdc938e5310c6f7b610316dd516acca5207d21559b016c6685ef868ddf04b`.
- Backend build SHA-256:
  `36b182758a5f14b738b3d2e0572d93974dbbd94f258a7b47f052a24d2a99bb90`,
  unchanged from official v0.2.0. Schema SHA-256 likewise remains
  `6a02dbb0aeb1d733e60308796c4795746473f57eab7079e19db8db0a30870568`.

Official localhost:8080 `/version` was independently checked: matched v0.2.0,
base SHA `561e7f3`, `official:true`. Its Persian Home now renders published
Directus content after the parent's CMS restoration. Actual screenshot:
`/Users/algoman/.qwenwork/workspace/mw138fu3x0fb4ecd/outputs/openfund-v0.2.0-cms-restored.png`,
SHA-256 `6b19f3ef55b28349caa2887fe895e78a8b63e9368ac1a4aeedf0222938592c28`.
This runtime observation supersedes only the earlier unverified-local checkpoint;
it does not put the dirty website changes into v0.2.0 or establish Render deployment.

### Remaining dependencies

Owner-verified Telegram destination, native installers/store identities, approved
live payment destination, real-chain/DePay/widget and actual-wallet acceptance,
challenge evaluation/payout processing and future Render deployment remain open.
All release gates passed on the unchanged full rerun. The initial intermittent
keyboard-focus stylesheet-readiness failure remains a coordinating-owner review
finding; no acceptance assertion was weakened. Final `npm run docs:check` passed:
124 Markdown documents, 709 local targets, 14 Mermaid diagrams and zero lint issues.
All owned test backends stopped; existing 8080/8055 services and user databases
were left untouched. Disposable verification databases and local evidence remain
available for inspection; the candidate is unofficial and not deployed.
