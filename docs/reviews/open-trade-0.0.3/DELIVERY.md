# Open Trade 0.0.3 — delivery report

Branch `agent/claude/open-trade-v0.0.3` from `main` `50d8d43`. Source and CI
changes only; nothing was built into installers, signed, released, tagged or
deployed.

## Environment of this delivery

The work was done in a Linux container with **no npm registry access**: the
pinned Electron, Vite, electron-builder, WalletConnect and Playwright packages
could not be installed. Consequently the renderer bundle, Electron app and
installers were **not built or launched here**. Node 22 (not the pinned 26)
was available. Everything below marked NOT VERIFIED must be run by CI or on
real hardware before any claim of function is made.

## Verified here

| Check | Result |
| --- | --- |
| `node --test apps/open-trade/tests/*.test.mjs` | 29/29 pass (policy, security, product model, release plan, i18n) |
| TypeScript 7.0.2 over `src/main.tsx`, `electron/*.ts` and the imported web i18n/Gains modules, with local type shims for the uninstallable packages | No errors other than shim artefacts (missing React/DOM event typings) |
| Workflow YAML parses | Yes |
| i18n coverage | 181 desktop strings; fa/en complete; ar/ru/zh-CN: 58 resolved from reviewed web dictionaries, 123 drafts awaiting review each |

## NOT VERIFIED (must run before release)

| Area | How to verify |
| --- | --- |
| Type check with real packages | `npm run typecheck --prefix apps/open-trade` (CI `checks` job) |
| Renderer/Electron build | `npm run build` (CI `desktop` job, four runners) |
| Desktop UI acceptance incl. five locales, version identity, IPC refusal | `npm run test:desktop` (CI) — updated for the new labels |
| Prop lifecycle + product switching | `TEST_BACKEND_URL` loopback backend with `SIM_TEST_MODE=1` and isolated DB; `account-acceptance.mjs` now switches Prop → Perpetual → Prop and asserts no Prop data or order controls in Perpetual |
| Real WalletConnect pairing and signing | Owner-provided Project ID + real wallet ([owner setup](../../releases/OPEN_TRADE_0.0.3_OWNER_SETUP.md#3-reown-project-configuration)) |
| Gains view with a wallet that has positions/orders/history | Real wallet on Arbitrum One |
| Installers: fresh install, launch, uninstall, upgrade from 0.0.2, session persistence | Each OS, real hardware or clean VM |
| macOS signing/notarization, Windows Authenticode | `signed` job + clean-machine Gatekeeper / SmartScreen check |
| Performance (cold/warm start, first chart, layout switching, 30-min memory, idle CPU) | `OPEN_TRADE_PERF_MINUTES=30 npm run test:performance` per OS; budgets are set from the first recorded baseline |
| Screenshots of the packaged build | Produced by `test:desktop` into `artifacts/`; none were captured for this delivery |
| `npm run docs:check`, `npm run validate:blueprint` | Not run here (dependencies unavailable) |

## Audit findings fixed

- Hardcoded `0.0.2` in the title fallback, `build.json`, CI artifact names; feature-branch push triggers and a `source` link to `feature/open-trade-desktop`.
- Placeholder translator that always returned English; no language selector.
- Account selector filtered to Prop only; selecting the Perpetual entry would have sent an invalid account to `/trading/state`.
- Wallet `accountsChanged`/`disconnect` listeners added on every sign-in and never removed; a `chainChanged` event signed the user out although SIWE was already verified; failed sign-ins left a live pairing.
- Any `OPEN_TRADE_BACKEND` origin was accepted by packaged builds; backend bodies were read without a size limit.
- macOS signing was impossible (`identity: null` in config); no notarization, entitlements, Windows signing or verification path; unsigned names said "beta".
- `scripts/release/open-trade-releases.mjs` hardcoded the 0.0.2 guide URL.

## Design decisions to review

- **Translations:** AGENTS.md forbids publishing machine translations, so the
  agent-drafted ar/ru/zh-CN desktop strings are stored in
  `src/i18n-desktop/drafts/` and not loaded. Approving them is a copy into
  `reviewed/`. `OPEN_TRADE_I18N_STRICT=1 npm run test:i18n` is the release gate.
- **Updates:** a notification that opens the official GitHub Release page,
  not electron-updater. Enabling installation requires signed builds and a
  separate review.
- **Gains history:** first 100 events only, with a pointer to the web terminal
  for paging (renderer requests carry no query strings by policy).

## Remaining blockers

1. Reown Project ID and real-wallet acceptance (owner).
2. Apple Developer ID + notarization credentials (owner, paid).
3. Windows signing provider and publisher identity (owner, paid).
4. Licence decisions: first-party licence, indicator redistribution rights
   ([LICENSE_DECISION.md](../../legal/LICENSE_DECISION.md)).
5. Reviewed ar/ru/zh-CN desktop strings.
6. CI run of all jobs on the four runners, installer acceptance and a
   performance baseline.
7. Iran region readiness (unchanged: disabled unless `OPEN_TRADE_IRAN_APPROVED=1`).
8. Explicit owner authorization to publish `open-trade-v0.0.3`.

## Publication checklist

1. Merge the reviewed PR; CI green on `main`.
2. Set `OPEN_TRADE_WALLETCONNECT_PROJECT_ID`; real-wallet sign-in recorded in `ACCEPTANCE.md`.
3. Approve translations; `OPEN_TRADE_I18N_STRICT=1 npm run test:i18n` passes.
4. Dispatch *Open Trade desktop* with `channel=stable`, `draft_release=true`; approve the environments.
5. Download the draft's assets; check SHA-256 against `SHA256SUMS.txt` and the `signatures-*.json` reports.
6. Clean-machine install, launch, upgrade from 0.0.2, uninstall on each OS; record results.
7. Update `apps/web-react/src/features/applications/builds.json`, run `node scripts/release/open-trade-releases.mjs open-trade-v0.0.3 <date>` after publishing.
8. Owner publishes the draft release.
