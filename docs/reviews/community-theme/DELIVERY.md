# Community, native theme and README addendum

## P0 identity recovery — 2026-11-04

The current audit supersedes earlier runtime identity claims. PID 2527 served a
mutable dirty frontend with a missing frontend manifest; `/version` was
`unversioned`, not a matched release. Clean-context real button clicks already
produce `rgb(255, 255, 255)` in light mode and `rgb(6, 8, 8)` in dark mode,
including Dashboard and Vela srcdoc. The owner's reported Opera failure was not
reproduced; profile permission is unavailable and owner acceptance remains open.

The existing candidate pipeline must regenerate both manifests, run all 24 gates
on a fresh isolated test database and package only after these documentation
edits. Port 8080 must then run the verified extracted archive, not mutable
worktree assets, using preserved `openfund_release_local` without test mode or
migrations; Directus 8055 remains untouched. Final artifact/runtime hashes and
real-click screenshots are recorded separately in `p0Verification` of the
[screenshot manifest](../../assets/screenshots/manifest.json). No backend identity
or financial implementation is rewritten.

The real-click regression now exercises both OS preferences/locales, all public
routes, persistent navigation/refresh/restored contexts, Dashboard disclosure
and Vela data-window controls. Missing/unavailable manifest diagnostics are
visible and regression tested. Historical purchase timeouts were harness races:
120 ms legacy route-exit reloads preceded session checks, and restored Account
controls replaced the awaited Sign in button. The harness now observes route
teardown and accepts either actual connection state without suppressing errors.
The old polish timeout awaited removed `.tradingview-credit` markup; the current
suite already waits for the genuine service link in the footer. Assertions and
financial code are unchanged; final run outcomes take precedence over old logs.

README now keeps its tagline once in top branding and follows the requested
17-section sequence (branding plus 16 technical/community sections). Earlier
captures remain historical. Official v0.2.0 at `561e7f3`, integrated base
`d05b4b8`, unmerged dirty candidate, owner acceptance and deployment are separate.
No commit, PR, merge, publication or permission bypass is authorized here.

## Historical final refinement verification — 2026-11-04

This section supersedes the historical defect/runtime snapshot below, which is
retained as an honest record of earlier attempts. Dirty branch and integrated
baseline `d05b4b8` were preserved; no commit, PR, merge or publication was made.

- Persian gateway `Home.tsx` now uses `footer={false}`. Its three Hero community
  controls remain. English Home and every other public footer remain intact.
- Light canvases are exactly white; existing dark-green identity is preserved.
  Actual anonymous empty-state, active-side/source-label and authenticated profile
  action contrast failures were corrected with native/shared tokens. No trading,
  authentication, payment, backend or schema behavior was changed.
- Gateway decoration/spacing adapts to constrained sizes without hiding content,
  clipping text or reducing product/feature targets below 44px. Desktop providers
  now share a full-width wrapper rather than unequal intrinsic text widths.
- Geometry tests wait for actual stylesheet/font/header-token readiness, retaining
  exact alignment, no-scroll/no-footer and WCAG text contrast >=4.5 assertions.

Fresh Node 22 candidate run `output/refinement/resume-release-geometry.log` passed
all **24 stages** using private port 8297 and isolated database
`openfund_refinement_test_20261104_final`. This includes all installs, Blueprint,
docs, typecheck, frontend/chart/release tests, two reproducible builds, repeated
additive migrations, seeds, backend and all browser gates. Browser totals:
26 audit, 515 completion, 394 anonymous layout, 395 authenticated layout,
2499 UI-polish, **529 website**, 7 release diagnostics and 266 public-route cases;
the actual chart interactions passed as well.

Supplemental authenticated polish explicitly used `POLISH_REQUIRE_AUTH=1` and
fresh generated real SIWE session storage: **2529 checks passed**, including
profile editing presentation, purchases, portfolio, Journal and accounts in both
locales/themes at 1440, 900 and 390 widths. No personal wallet or financial data
fixtures were used. Log: `output/refinement/resume-auth-polish-geometry.log`.
The eight-viewport landing gate passed **207 checks**, including 375 x 667 fit,
no footer, no clipping, keyboard/touch and reduced motion:
`output/refinement/resume-landing-geometry.log`. Separate unchanged purchase
regression passed **17 checks** after the final build on private port 8299 with
only its disposable test database/test-only placeholder receiver:
`output/refinement/resume-purchase-final.log`.

Earlier failures are retained: genuine contrast/width/fit defects were fixed;
stylesheet/header readiness races were corrected in measurement setup without
relaxing assertions. One backend attempt failed its unchanged executable stop
mark check; a fresh-database full run passed, with no engine modification.
An intermediate supplemental website run failed public-footer route settling;
the complete final candidate passed all unchanged footer checks. These are not
claimed as production/authentication/engine bug fixes.

Final `refinement-*` images comprise 34 anonymous real-CMS public/terminal/modal
captures, 56 genuine generated-session inner-route captures in both locales,
themes and desktop/mobile, plus 12 profile edit-presentation captures. All are
unaltered, with image hashes, timestamps and build identities recorded in
`refinementVerification` of the screenshot manifest. Inspection confirms white
public/inner surfaces, visible service vectors, coordinated providers and no
Persian Home footer. Empty histories remain empty; charts may show real live
unavailable/connecting states rather than fabricated candles.

Latest preview PID **2527** runs Node 22 at **8080** with preserved
`openfund_release_local`, normal runtime, no `SIM_TEST_MODE` and no purchase
receiver. The prior owned PID was verified by command and working directory
before replacement; real Directus 8055 was preserved. `/health` is 200,
`/version` is matched and unofficial 0.3.0, and all tested served assets match the
final build byte-for-byte. The test confirmation endpoint is 404. Evidence:
`output/refinement/resume-live8080-verification.json` and server log.
Frontend fingerprint: `4a497d885df9a02c05057d871ceaab4af4a2ddbf30887cfc49c38ce8ad41c727`.

Candidate artifact remains `output/releases/v0.3.0/openfund-v0.3.0.tar.gz`.
The allocator returns 0.3.0, not requested 0.2.1; no policy override or tag rewrite
was made. Owner-verified Telegram/Discord/Instagram URLs remain unset and disabled.
Official review, final-commit CI/security checks, version coordination, publication,
real-wallet/live-payment and deployment acceptance remain separate.
Evidence-only docs/manifest updates after packaging do not retroactively change
that archive's documentation snapshot; frontend bytes remain the tested build.

## Historical addendum delivery boundary

This report covers the uncommitted `qwen/community-theme-readme` addendum on
integrated main `d05b4b88fc2776e09bf1a701254ac229e8145a7f`. Official v0.2.0 remains
`561e7f3101f3a43376068d9bba1a87c30e2b7d71`; PR #42 is merged but unreleased.
This work is an **UNRELEASED local candidate**, not an official release,
production deployment, real-wallet or live-payment certificate.

The requested v0.2.1 does not exist in fetched tags. The repository allocator
returns **0.3.0** because the integrated batch contains `feat:` commits.
No version policy was overridden, and no commit, PR, merge or release was made.
Coordinate the target with the parent/release owner before publication.

## Implementation and safety

- Preserve all source/community/theme/documentation contributors' changes.
- Shared provider-configured community controls remain public-only; Telegram
  blue and Discord blurple, authentic SVG marks and reduced-motion behavior.
  Neither owner-verified destination is configured; both remain non-navigating
  unavailable controls. Provider URL validation is not proof of ownership.
- Native public and terminal tokens reuse `data-theme` and persisted `of-theme`.
  Vela uses its supported configuration API; no root inversion or white overlay.
  Official service marks retain geometry and native colors with neutral backing
  where contrast requires it. Five platform cards remain Coming Soon.
- Mirror only changed public legacy stylesheet hunks into source-critical `dist/`,
  normalize relative asset paths and preserve distinct unrelated compatibility
  content. Bump compatibility stylesheet cache queries after changed mirrors.
- Do not alter trading, authentication, payment, market-data or database schema
  logic. Migrations/tests use a new disposable local test database only.
- Rewrite README around actual architecture, feature boundaries and upstream
  licensing. No blanket repository license or production-readiness claim.

## Validation evidence

Node 22 full candidate validation uses private port 8291 and the fresh isolated
`openfund_addendum_test_20261103_2115` database. Exact gate outcomes are recorded
in `output/addendum-release.log` and `output/releases/v0.3.0/verification.json`.
The complete candidate command passed **all 24 stages**, including installs,
Blueprint/docs/typecheck, frontend/chart/release tests, two identical production
builds, repeated additive migrations, seed plans, backend and all existing browser
gates plus authenticated layout. Browser results: 26 audit, 515 completion,
394 anonymous layout, 395 authenticated layout, **1412 UI-polish**, **368 website**
and 7 release diagnostics checks. Public-route and chart gates also passed.
Artifact: `output/releases/v0.3.0/openfund-v0.3.0.tar.gz`, with `SHA256SUMS`,
`release-manifest.json`, `verification.json` and verified payload checksums.
The package is explicitly unofficial, from dirty integrated source, not v0.2.1.
Post-build evidence-only documentation updates passed `npm run docs:check` again;
the archive represents its packaging-time documentation snapshot, not those
later report edits. Frontend content remained identical through final recapture.
No assertion or production logic was changed to hide a failure.

The separate purchase regression uses private port 8292, the same disposable
test database and the existing test-only confirmation seam with a placeholder
receiver. The first run passed checkout, provisioning, history and PDF checks
then timed out waiting for the withdrawal form (15 seconds). A diagnostic rerun
with extra state logging passed all 17 unchanged assertions; an unchanged
`npm run test:browser:purchase` rerun also passed 17. The intermittent route/session
settling failure remains recorded, not claimed fixed; no timing or auth edits.
Logs: `output/addendum-purchase.log`, `output/addendum-purchase-diagnose.log` and
`output/addendum-purchase-rerun.log`. Normal candidate/demo runtimes never enable
these seams. Backend release tests retain their honest disabled-receiver skip;
the separate purchase browser run covers the otherwise absent lifecycle gate.

## Genuine screenshots and observed defect

Private capture backend 8293 uses normal development runtime, no test seam,
real published Directus 8055 reads and live Gains. All 34 `addendum-*.png` captures
are anonymous, without wallet injection or response interception. FA/EN public
Home, footer and downloads cover 1440 × 900 and 390 × 844 in both themes;
FA Prop/Perpetual and EN Prop terminals and real no-wallet modals cover both themes.
Each image is delivered under `outputs/` and mirrored in `docs/assets/screenshots/`.
The [manifest](../../assets/screenshots/manifest.json) records exact filenames,
SHA-256 hashes, timestamps and dirty source/frontend/backend fingerprints.
The README references the actual new captures. Historical `refresh-` images
retain their own provenance rather than being relabelled as this addendum.

Visual inspection finds native terminal/Vela surfaces, service artwork and
provider controls present, but **complete public light-mode acceptance fails**:
platform-name text inherits `rgb(241, 243, 239)` on `rgb(244, 245, 240)` and is
nearly invisible. Download subtitles inherit `rgb(181, 190, 187)`; footer links
inherit `rgb(175, 194, 180)` on the same light background. The current browser
suite does not test this text contrast. Evidence:
`addendum-downloads-fa-light-390.png`, `addendum-footer-fa-light-1440.png` and
`output/addendum-contrast-diagnosis.json`. Source fix belongs to the theme owner:
`apps/web-react/public/legacy/style.css` needs native light text/border tokens
for `.desktop-btn`, `.desktop-sub`, `.desktop-title` and footer text. No broad
source edits were made by the verification owner. Do not mark the complete
light-theme addendum verified until this is corrected and recaptured.

The first capture inspection found retained SPA scroll in English mobile Home;
the capture utility was corrected to reset scroll before each shot and preserve
intentional section scrolling. This changes capture positioning only, not UI or
test assertions. Final image metadata must describe the recaptured bytes.

Build warnings include upstream peer/deprecation notices and an inherited
`NODE_TLS_REJECT_UNAUTHORIZED=0` warning. These are disclosed rather than an
exact-commit security approval; official security/CI gates remain required.

## Runtime and publication limits

Preserve the real Directus service on port 8055 and `openfund_release_local`.
The owned preview PID 28237 was reverified with `lsof` and its worktree command,
then replaced only that process. Final Node 22 PID **38299** remains running on
8080 through the background runner, using normal development runtime and the
preserved `openfund_release_local` database, without `SIM_TEST_MODE` or payment
receiver activation. No migrations or tests touched that database; CMS 8055 was
not stopped. `/health` returned 200, `/version` returned `matched`, version 0.3.0,
source `d05b4b88fc2776e09bf1a701254ac229e8145a7f`, `manifest.official=false`.
The existing test-confirmation endpoint returns 404 in this normal runtime.

Browser verification loaded FA/EN Home, FA FAQ, EN Challenges and EN Prop trading,
with real CMS Home 200, two Persian products, four Challenges community controls,
five SVG platform icons, live Vela readiness and no browser exceptions. Served
HTML, legacy styles, provider/platform SVGs and current hashed JS/CSS were compared
byte-for-byte with the latest local build. Evidence:
`output/addendum-live8080-verification.json` and `output/addendum-live8080-server.log`.
Frontend fingerprint: `d3ea31244d0f10d60e8f615c9bd2d4d21864b13e29a13d568eb806a62fb554ad`.
Backend fingerprint: `36b182758a5f14b738b3d2e0572d93974dbbd94f258a7b47f052a24d2a99bb90`.
Dirty source/config/test fingerprint:
`67c05a1690e93b1aedf4741ba99054974a99744f432cd8584080da98be6a7c23`.
A matched candidate is not official v0.2.0 or deployed acceptance.
Official downloaded-archive startup, reviewed merge, CI on the final commit,
secret/advisory/security gates and publication remain separate acceptance steps.

[Feature Status](../../product/FEATURE_STATUS.md) ·
[Design system](../../design/DESIGN_SYSTEM.md) ·
[Screenshot provenance](../../assets/screenshots/manifest.json) ·
[Release policy](../../deployment/RELEASES.md)
