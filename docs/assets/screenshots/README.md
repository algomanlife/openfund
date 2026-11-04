# Genuine application screenshots

Historical captures were made 2026-11-02 from source at baseline `2f5cf93`, built with `npm run build:web` and served by the matching Node backend at local port 8186. [manifest.json](manifest.json) records routes, viewports, account state and timestamps. Original captures are 1440 × 1000. The [terminal redesign](../../reviews/terminal-ui/DELIVERY.md) adds unedited baseline and production-build captures at 1440 × 900, 1280 × 720 and explicit responsive sizes; each entry records its own source commit, viewport and SHA-256 hash.

## P0 canonical-runtime captures — unreleased

`p0-*` images are new anonymous real-button-click captures from canonical 8080,
covering public Home, Dashboard and terminal in both modes/locales. No CSS or
theme-state injection, wallet fixtures or request interception is used. See
`p0Verification` and per-image records in [manifest.json](manifest.json) for
whether each image is pre-packaging worktree evidence or final verified extracted
candidate evidence. Missing manifest identity was observed before packaging.
Owner Opera profile access was not granted; no owner acceptance is claimed.
Final pipeline results and runtime hashes are distinct from historical checks.

## Historical final refinement captures — unreleased

The current `refinement-*.png` captures show the actual white light theme and
preserved dark-green theme, Persian Home without a footer, other public footers,
three community providers and native service SVGs. Public captures are anonymous;
`refinement-auth-*` captures use genuine SIWE with a generated disposable signer
on an isolated local test database, never a personal wallet or fabricated records.
Both locales, desktop/mobile and all inner surfaces retain their empty/unavailable
states. Profile edit captures perform no writes. The final
[delivery](../../reviews/community-theme/DELIVERY.md) and `refinementVerification`
in the [manifest](manifest.json) record exact evidence and remaining release limits.

## Historical community/theme addendum — unreleased

The 34 `addendum-*.png` images were captured from integrated `d05b4b8` plus the
recorded dirty source fingerprint, private backend 8293 and real Directus 8055.
They cover FA/EN Home, public footer and downloads in dark/light at 1440 × 900
and 390 × 844, supported anonymous terminals and the real no-wallet modal.
No requests were intercepted, no wallet injected and no financial data invented.
The [manifest](manifest.json) records hashes and source/build fingerprints in
`addendumVerification`; [delivery](../../reviews/community-theme/DELIVERY.md)
records validation and defects. The terminal light palette and native service
marks are visibly present, but light-mode platform names and footer text retain
low contrast. These images are evidence, not a claim of complete visual acceptance.

| Persian Home dark | Persian Home light |
| --- | --- |
| ![Anonymous Persian Home dark](addendum-home-fa-dark-1440.png) | ![Anonymous Persian Home light](addendum-home-fa-light-1440.png) |
| **Prop terminal dark** | **Prop terminal light** |
| ![Anonymous Prop terminal dark](addendum-terminal-prop-en-dark.png) | ![Anonymous Prop terminal light](addendum-terminal-prop-en-light.png) |
| **Mobile footer dark** | **Mobile downloads light — contrast defect preserved** |
| ![English mobile footer dark](addendum-footer-en-dark-390.png) | ![Persian mobile downloads with actual contrast defect](addendum-downloads-fa-light-390.png) |

## Historical PR #42 website candidate — 2026-11-03

Website images prefixed `refresh-` were finally recaptured at 20:20–20:21 UTC
from the dirty website-refresh production candidate (base main `561e7f3`),
private backend port 8395. Home shows actual published local Directus content,
not its unavailable state. Persian/English community controls correctly remain
Coming Soon without an owner-verified destination.
The refreshed account/profile, portfolio, journal and analytics images use a new
disposable signer and genuine SIWE/backend state in the pristine
`openfund_website_capture_test_20261103_2014` database. No trades, paid challenges,
notes or chain transactions were created; the session was revoked and private
key discarded. These are unofficial candidate images, not v0.2.0 release images.
The five overwritten account filenames and ten `refresh-` filenames now refer
only to these final captures; the superseded 19:10/19:14 pixels remain in Git
history, not under their old timestamps in this gallery.
Per-entry manifest provenance takes precedence over the historical overview below.
All 15 final images carry rechecked SHA-256 hashes, a capture-set fingerprint,
the actual dirty source/config/test fingerprint and frontend/backend/schema
build identities. See `websiteFinalVerification` in [manifest.json](manifest.json).
The complete unchanged release rerun passed all 24 stages, including the 294-check
website matrix. The earlier keyboard-focus stylesheet-readiness failure remains
preserved as an intermittent finding; no assertion was altered or suppressed.
The separate 294-check capture matrix and 207-check landing regression also
passed. Exact attempts and final gate results are recorded in
[delivery](../../reviews/website-refresh/DELIVERY.md).

CMS and Gains reads are real; explicit unavailable states remain visible when
an upstream cannot be reached. [Current delivery](../../reviews/website-refresh/DELIVERY.md).

| Prop Terminal candidate | Perpetual Terminal candidate |
| --- | --- |
| ![Prop terminal](refresh-en-prop-trade.png) | ![Persian Perpetual terminal](refresh-fa-perpetual-trade.png) |

## Historical provenance

Public pages use the existing local Directus instance on port 8055 through public read endpoints and live Gains market data. No request interception, fabricated prices, chart fixtures, CMS fixtures, injected trading history or hand-drawn UI was used. Network availability and prices are capture-time observations.

The original 2026-11-02 account captures (now superseded in the five filenames above) used a disposable generated in-memory wallet, actual ECDSA/SIWE verification and a separate local PostgreSQL test database. The real backend issues its normal 100,000 virtual-DAI practice account. No trades, notebook entries, deposits, approvals or blockchain transactions were created. The wallet address is a generated documentation identity, not personal wallet information. Its session was revoked and its private key discarded after capture. [Account capture utility](../../../scripts/docs/capture-account.cjs) enforces a localhost target and uses no financial response fixtures.

## Website sections (2026-11-02 expansion)

Captured from the same build and Directus instance as above; anonymous
sessions, CMS-sourced content, no fixtures. [Expansion spec](../../website/WEBSITE_EXPANSION.md).

| FAQ — Persian hub | FAQ — English hub | Tools — Persian index |
| --- | --- | --- |
| ![Searchable Persian FAQ with category sidebar](website-faq-fa.jpg) | ![English FAQ hub](website-faq-en.jpg) | ![Tools Center index](website-tools-fa.jpg) |
| **Position size calculator** | **Risk of ruin calculator** | **FAQ on mobile** |
| ![Position size calculator with defaults](website-tool-position-fa.jpg) | ![Risk of ruin calculator](website-tool-risk-en.jpg) | ![Mobile FAQ category navigation](website-faq-fa-mobile.jpg) |
| **Learning Center — Persian** | **Lesson with contents** | **Glossary** |
| ![Learning Center landing](website-learn-fa.jpg) | ![Lesson page with contents sidebar](website-lesson-fa.jpg) | ![Glossary with search and letter index](website-glossary-fa.jpg) |
| **Growth Partner — Persian** | **Growth Partner — English** | **Learning Center — English** |
| ![Pre-launch Growth Partner page](website-referral-fa.jpg) | ![Pre-launch Growth Partner page in English](website-referral-en.jpg) | ![Learning Center landing in English](website-learn-en.jpg) |

## Gallery

| Home | Markets |
| --- | --- |
| ![Historical English two-product gateway; no longer current English routing](home.jpg) | ![Historical Markets with capture-time Gains information](markets.jpg) |
| **Prop Terminal — anonymous account** | **Perpetual Terminal — anonymous read-only context** |
| ![Prop chart and disabled anonymous trading controls](prop-terminal.jpg) | ![Perpetual chart and read-only trading controls](perpetual-terminal.jpg) |
| **Challenges — published catalog** | **Prop Portfolio — new virtual account** |
| ![Historical catalog before gated purchase implementation](challenges.jpg) | ![Unofficial candidate virtual-USD portfolio, empty real local account](prop-portfolio.jpg) |
| **Candidate Journal — empty-account dashboard** | **Candidate account analytics — new account** |
| ![Actual Journal dashboard and module navigation with no seeded performance or notes](journal.jpg) | ![Actual new-account dashboard without manufactured performance history](analytics.jpg) |
| **Candidate Account / Profile — disposable identity** | **Historical wallet connection — unconnected modal** |
| ![Actual Openfund profile for disposable local test identity](account-profile.jpg) | ![Actual wallet connection modal with no personal wallet](wallet-connection.jpg) |
| **Candidate Perpetual Portfolio — new wallet, provider reads** | **Historical Transparency — labelled sample interface** |
| ![Native Gains read result for a generated wallet with no positions](perpetual-portfolio.jpg) | ![Transparency interface with explicit sample-data labels](transparency.jpg) |

[Rulebook — draft, not active](rulebook.jpg)

## Capture limits

- These are local application captures, not deployed Render evidence, customer activity, real capital, trading performance or a commercial launch.
- Prop terminal screenshots are anonymous and cannot place orders. Account screenshots show a fresh backend-created virtual account; they do not manufacture a richer trading history.
- Real extension/hardware/remote WalletConnect and live contract-wallet acceptance remain unverified. The generated signer is a test transport using real signatures.
- The English UI retains its authentic Persian language-switch glyph. The current Profile also formats some dates/identifier digits in Persian despite English labels; that application localization issue is preserved and documented, not edited out of the screenshot. Presentation graphics and explanatory captions are English.
- The new-wallet Gains view shows actual upstream read results; it does not establish an active position, fee-adjusted PnL or transaction settlement. Transparency remains explicitly synthetic.
- The initial market render may vary with upstream availability. Old captures are preserved through [historical Git links](../../reviews/repository-transformation/REMOVED_FILES.md), outside the active image tree.

[Terminal before/after gallery](../../reviews/terminal-ui/DELIVERY.md#before-and-after) · [README gallery](../../../README.md#product-gallery) · [Feature Status](../../product/FEATURE_STATUS.md)
