# v0.6.5 candidate — delivery record

Branch `agent/claude/v0.6.5-modernization`, based on `main` `60d5df9`.
Status: **implemented and locally verified; unmerged, untagged, not deployed.**
Both regions use this one source; nothing here deploys Render or Liara.

## Requirement status

| # | Requirement | Status | Evidence / remaining |
| --- | --- | --- | --- |
| 1 | Design system, VibeFarsi evaluation | Implemented, verified | `src/styles/design-system.css`, [ADR 0035](../../decisions/0035-design-system-foundation-and-ui-kit-evaluation.md). Legacy pages are not migrated onto the tokens |
| 2 | Website motion and responsive repair | Partially implemented | New pages use reveal/hover/cross-fade motion with reduced-motion fallbacks. Audit of home, challenges, markets, contact, apps, roadmap, verification at 320–1440px in fa/en: no horizontal overflow after fixes. Existing homepage motion (legacy `motion.js`) kept, not redesigned |
| 3 | Homepage, header, footer, ticker | Partially implemented | Ticker label and phone visibility fixed; locale redirects fixed; small legal/status text raised. Homepage structure unchanged; no visual redesign of hero/cards beyond the audit |
| 4 | Terminal Persian terminology, VOB copy, footer, Support | Implemented, verified | `test/terminal-copy.test.mjs`; live check in the terminal iframe |
| 5 | Trade Radar | Implemented, verified locally against live Hyperliquid | [Spec](../../integrations/HYPERLIQUID_RADAR.md); not deployed |
| 6 | Market Heatmap | Implemented, verified locally against live Hyperliquid | Only the 24h window is backed by data; no other windows offered |
| 7 | Applications page | Implemented, verified | Two motion sequences and screenshots from real Open Trade 0.0.2 captures |
| 8 | Desktop 0.0.2 artifacts | **Blocked (publication)** | Built and acceptance-tested in CI run 43611941782 (`76512b5`) for all three OS; unsigned. A GitHub Release needs owner approval; SHA-256 values come from that release |
| 9 | Certificate verification page | Implemented, verified | `e2e/test-certificates.cjs` |
| 10 | User certificates, three designs | Implemented, verified | Built on the existing issuance APIs; previews carry no personal data |
| 11 | Roadmap page and repository | Implemented (structure) | Mirrors ROADMAP.md, test-enforced; owner product roadmap **pending owner content** |
| 12 | README, docs, licences, release prep | Implemented | This record, CHANGELOG, FEATURE_STATUS, README rows, notices. Main licence remains an owner decision ([decision](../../legal/LICENSE_DECISION.md)) |

## Owner decisions and blockers

1. **Version number.** `scripts/release/version.mjs` allocates **0.6.0** after
   `v0.5.0`; `requestedPatchVersion` only allows the next patch (0.5.1) and
   forbids skipping. Publishing as v0.6.5 needs either releasing as 0.6.0 or an
   approved change to the release guard. Not changed here.
2. **Desktop publication.** Approve a GitHub Release for Open Trade 0.0.2 (unsigned
   beta) and add its assets to `apps/web-react/src/features/applications/releases.json`;
   download buttons appear only then.
3. **Order-book copy accuracy.** The owner-specified VOB note says data is
   aggregated from Gains and Hyperliquid. The order-book panel currently reads
   the Gains VOB only (`public/legacy/market-depth.js`). The copy is implemented
   exactly as instructed; it is accurate only once Hyperliquid depth is added.
4. **Roadmap content** and the **primary licence** remain with the owner.

## Tests executed (2026-11-15, local)

| Check | Result |
| --- | --- |
| `npm run typecheck` (web) | Pass |
| `npm run test:web` (all web unit suites) | Pass — 263 tests |
| `npm run test:i18n` (ar/ru/zh-CN coverage) | Pass |
| `npm run test:content-registry` | Pass (exceptions 74 → 70) |
| `npm run test:backend` (`test:all`, CI-equivalent env, fresh migrated DB) | Pass — 430 node tests + 347 scripted checks, incl. `test:certificates`, new `test:radar` |
| `test:region`, `test:regional-sync` (four disposable DBs) | Pass — 20 and 13 |
| `e2e/test-certificates.cjs` (real API, disposable SIWE wallet) | Pass — 46 checks (fa/en × light/dark × 5 widths, PNG/PDF, QR → serial) |
| Open Trade `npm test`, `typecheck`, `tests/desktop.mjs` (macOS) | Pass |
| `npm run validate:blueprint` | Pass |
| `npm run docs:check` | Pass (after this record) |
| gitleaks on every commit | No leaks |
| Browser suites not run locally: `test:browser:*` other than certificates | Not run — run in CI |

Live-data checks (local, real upstream): `/radar/markets` 179 markets (159 mapped
to Openfund markets); positions over 30 leaderboard wallets in ~3 s; shared tape
live on 30 coins; API RSS ~120 MB through a leaderboard load (was ~330 MB).

## Screenshots

Genuine captures, provenance in the [manifest](../../assets/screenshots/manifest.json):
[heatmap](../../assets/screenshots/v0.6.5/heatmap.png) ·
[radar positioning](../../assets/screenshots/v0.6.5/radar-positioning.png) ·
[applications](../../assets/screenshots/v0.6.5/applications.png) ·
[roadmap (fa)](../../assets/screenshots/v0.6.5/roadmap.png) ·
[verification](../../assets/screenshots/v0.6.5/certificate-verification.png) ·
[certificates (fa, signed out)](../../assets/screenshots/v0.6.5/certificates-fa.png) ·
[completion certificate export](../../assets/screenshots/v0.6.5/certificate-completion-fa.png) ·
[Open Trade 0.0.2](../../assets/screenshots/open-trade-0.0.2/)
