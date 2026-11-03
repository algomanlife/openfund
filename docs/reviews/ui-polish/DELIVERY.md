# UI polish and language availability batch

## Verified baseline

On 2026-11-03, canonical `http://localhost:8080/version` reported official v0.1.0,
source `b2c54071b9bb4bccb217e3a177ddb4c67b38acd7`, with matched frontend/backend
manifests. PID 19590 served the downloaded release payload, launched by the
existing `release:local` runner. Current origin/main matched that source, including
PRs 35–38. The implementation branch is `codex/final-ui-polish`. No existing
worktree, database, stash or tracked historical frontend was discarded.

## Implementation

| Item | Cause | Change | Sources |
| --- | --- | --- | --- |
| UI-01 | Multiple wallet chips expanded the header and could wrap | One bounded connected-wallet disclosure retains balance, network correction, sign-in/account and wallet modal; responsive navigation and two-row mobile terminal header | `RainbowConnect.tsx`, session/header styles |
| UI-02 | Both locales used the gateway and unrestricted product shell | FA retains original two cards and hides only gateway central navigation; EN Home reuses existing Prop landing; router rejects EN Perpetual before mounting its shell | `main.tsx`, `Home.tsx`, `InformationShell.tsx`, `TerminalShell.tsx` |
| UI-03 | TradingView was absent | Fourth footer reference links to external TradingView news, with localized description and explicit external-resource wording | landing body, translations, logo/license |
| UI-04 | Terminal iframe used inversion and chart theme setter was a no-op; public styles could invert terminal after navigation | Real light terminal tokens, supported Vela workspace theme API, iframe load/message synchronization with the actual parent origin, persisted plot-palette repair and terminal inversion override | terminal styles/runtime, `TradingPages.tsx`, chart bridge |

The established `of-theme` preference and `html[data-theme]` remain authoritative.
No additional provider, geolocation service, trading engine or financial state was
introduced. Vela source is unchanged; its existing public `setTheme` API updates
workspace controls and chart cells. Chart assets are regenerated only through
`scripts/build-charts.mjs` from their existing pinned sources.

## Product eligibility boundary

Locale is presentation availability, not proof of Iranian residence. Existing
SIWE proves wallet control; neither `server.js` nor `products.js` enforces country
or verified residence. Existing published eligibility copy says geographic/KYC
rules remain unfinalized. EN Perpetual browser routes redirect to EN Prop Dashboard
without carrying a Gains account query. The authorized backend Perpetual read and
journal APIs remain unchanged. Real country eligibility needs an approved policy,
trusted residency verification, server-side authorization and an appeal process.
This batch does not claim jurisdiction-based access enforcement.

## TradingView provenance and meaning

Repository audit found Gains market data and Vela charts, with no TradingView
market/news feed. The footer is therefore an external market/news resource link,
not a feed/partnership assertion. Description: `Market Data & News` (localized in
FA). The logo comes from the [official Apache-licensed attribution SVG source](https://github.com/tradingview/lightweight-charts/blob/master/src/gui/attribution-logo-widget.ts),
with the original path geometry and embedded light palette. The upstream license
is bundled at `assets/notices/TradingView-logo-LICENSE.txt`. TradingView is a
trademark of its owner. No endorsement is claimed.

## Acceptance status

Implementation is a candidate until reviewed and merged. Automated release gates,
responsive/theme browser matrix, screenshot provenance and official local launch
results must be recorded here as they are obtained. Generated wallet tests use
disposable signers and labelled fixtures; they do not verify an installed wallet,
hardware device or WalletConnect account. No production deployment is configured.

The previous official release remains available for rollback. Start accepted
versions with Node 22 and the intended local database using:

```sh
DATABASE_URL=postgresql://localhost/openfund_release_local PORT=8080 npm run release:local -- --version current --migrate
```

[Release runbook](../../deployment/RELEASES.md)

## Local candidate evidence

- UI matrix: **862 passed**, FA/EN, light/dark, disconnected/connection fixture,
  1440/900/390px, supported products, Dashboard/Trading/Portfolio/Journal/Accounts,
  live chart palette switching, persistence, homepage language switching, all EN
  Perpetual redirects and context removal.
- Integration audit: **26 passed**, real local SIWE/account isolation and partial
  closes with disposable signers, controlled upstream failure and modal behavior.
- Terminal completion: **427 passed**, lifecycle/protection/idempotency, private
  journals, all supported product tabs and account switching.
- Authenticated terminal geometry: **395 passed**, 12 desktop screenshots plus
  narrow/short-screen view interactions.
- Public routes: **266 passed**, every bundled bilingual content destination.
- Blueprint and documentation validation passed. Full candidate package gates are
  required again before submission; the final package log takes precedence.

[Matrix evidence](browser-matrix.json) and [screenshot provenance](../../assets/screenshots/manifest.json)
identify these as candidate captures. They do not establish delivery on port 8080.
The immutable official package and its local runtime remain pending review/merge.

The first local/CI package attempt correctly stopped at a stale browser action
that tried to select an account-modal control after the wallet disclosure closed.
The test now reopens the disclosure through its real summary; the final local
terminal suite passed all 427 checks. Screenshots finish CSS entrance animations
and wait for classic-page teardown before capturing; all 862 matrix checks were
repeated successfully. No release was published by the failed attempts.

The UI matrix reads the existing local Directus for local acceptance. GitHub
Actions has no Directus service, so its matrix intercepts only `home_content` with
the repository's actual published Home editorial seed, loaded from its source.
It does not intercept financial/account/market APIs. CMS readiness is awaited
before product assertions. This test fixture is not a new runtime fallback or a
claim that a CMS is deployed; the result JSON explicitly records its content mode.

## CI-discovered lifecycle and availability regressions

Rapidly leaving the English legacy Home while CMS replies were pending could
execute its queued scripts against a removed DOM. The loader now fetches the
trusted bundled scripts first, verifies the owning page, then inserts them in
order synchronously. Translation boot also checks its captured toggle remains
connected after awaiting translations. Real navigation cannot cancel another
page instance's teardown; StrictMode can still cancel its own cleanup. A bounded
regression covers delayed CMS exits. No legacy trading calculations are changed.

A separate package timeout was traced to negative SIWE signature checks spending
five minutes per public-RPC fallback. The existing RPC transport now has a
five-second timeout and no transport retries, retaining fail-closed verification.
The SIWE integration test also bounds each HTTP request to 45 seconds. This is the
only backend change; the engine and account/journal/portfolio logic are unchanged.

The final package run also exposed a pre-existing test isolation race: the HTTP
server's monitoring loop could fill a direct Engine unit test's pending stop at
its own 51,000 fixture before the test applied its 53,000 gap. The unified unit
suite now creates its own random schema inside the guarded isolated test database,
uses the unchanged production schema and catalog, and removes only that owned
schema afterward. All numerical assertions remain unchanged; no engine behavior
was altered to make the test pass.
