# v0.6.5 candidate — delivery record

Branch `agent/claude/v0.6.5-modernization` ([PR #122](https://github.com/algomanlife/openfund/pull/122)),
based on `main` `60d5df9`. **Unmerged, untagged, not deployed.** Both regions
use this one source; nothing here deploys Render or Liara or changes regional
authority, synchronization, DNS or routing.

Categories: **Completed and verified** · **Implemented, not fully verified** ·
**Blocked by an owner decision** · **Incomplete**.

## Requirements

| # | Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- | --- |
| 1 | CI and merge blockers | Completed and verified locally; CI result recorded in the PR | Earlier failures traced to a stale navigation expectation, light-theme contrast and two untranslated terminal strings — all fixed in code, none by weakening tests | Required checks on the final commit: see PR |
| 2 | Release versioning (v0.6.5) | Completed and verified | `requestedVersion()` + tests; `plan.mjs` yields 0.6.5 for an approved main dispatch and rejects 0.7.0 | Tag only on owner approval |
| 3 | Homepage and website redesign | Completed and verified (local) | Homepage rebuilt; `site-modern.css` + `useSiteMotion` on all information pages; captures in the README gallery | Not deployed |
| 4 | Responsive | Completed and verified (local) | 480-load audit (9 widths fa/en, 2 widths ar/ru/zh-CN, 20 pages); re-audit 0 overflowing loads at 320/768/1024/1920 | Real-device testing not done |
| 5 | Design system adoption | Completed (scope below) | `--ds-*` tokens used by homepage, site layer, certificates, radar, roadmap, applications | Legacy page CSS still holds page-specific rules |
| 6 | Applications page | Completed and verified | Real Open Trade 0.0.2 captures, two motion sequences, comparison, per-OS cards with version, arch, format, size, SHA-256 | Download buttons need a published release |
| 7 | Desktop 0.0.2 artifacts | **Blocked by an owner decision** | All five files downloaded from CI run 43611941782, SHA-256 matches, metadata 0.0.2, macOS arm64 launched; pack in [release notes](../../../releases/open-trade-0.0.2.md) | Approve the pre-release; clear the indicator-licence item; signing |
| 8 | Trade Radar | Completed and verified (local, live data) | Unit tests; 300-viewer load test (warm p95 122 ms, RSS ~77 MB settled); outage shows "Data unavailable" | Not deployed |
| 9 | Market Heatmap | Completed and verified (local, live data) | Treemap tests; deep-link to the chart; outage state | 24h window only (data limit) |
| 10 | Terminal copy and footer | Completed and verified | `test/terminal-copy.test.mjs`; live iframe check | VOB copy names Hyperliquid while the panel reads Gains only — owner review |
| 11 | Certificates | Completed and verified | `e2e/test-certificates.cjs` 46/46 on the final code | Owner's official artwork not supplied; Openfund designs used |
| 12 | Roadmap | Completed (structure) | Mirrors ROADMAP.md (test-enforced) | **Owner roadmap content** |
| 13 | README | Completed | Redesigned; required sections kept; `docs:check` green | — |
| 14 | Technical documentation | Completed for changed areas | Radar spec, release pack, design system, ADR 0035, environment, feature status, changelog | Older documents not rewritten |
| 15 | Licensing | **Blocked by an owner decision** | Audit and addendum in [licence decision](../../../legal/LICENSE_DECISION.md) | Choose a licence; Irancell fonts; Pine indicators; AGPL source offer |
| 16 | Two-region compatibility | Completed and verified | Region and regional-sync suites pass; radar GETs pass the region guard and degrade to 503 | Liara not deployed (by design) |

## Owner decisions

1. Approve the v0.6.5 dispatch (tooling ready; no tag created).
2. Publish Open Trade 0.0.2 as a pre-release — after deciding on the bundled
   Pine indicators and accepting unsigned installers (or funding signing).
3. VOB note accuracy (Gains-only data vs. text naming Hyperliquid).
4. Roadmap content; official certificate artwork if it differs.
5. Primary licence, contributor terms, Irancell fonts, indicator authorship.

## Tests executed on the final code (2026-11-15, local)

| Check | Result |
| --- | --- |
| Web typecheck, i18n coverage, content registry | Pass |
| `npm run test:web` | Pass — 263 |
| `npm run test:release` | Pass — 16 (incl. versioning and Open Trade manifest) |
| `npm run test:backend` (`test:all`, CI environment, fresh DB migrated twice) | Pass — 430 node tests + 347 scripted checks |
| `test:region`, `test:regional-sync` (four fresh DBs) | Pass — 20 and 13 |
| `e2e/test-certificates.cjs` | Pass — 46 |
| Open Trade `npm test`, typecheck; packaged arm64 launch | Pass |
| `validate:blueprint`, `docs:check`, gitleaks | Pass |
| Light-theme WCAG check (CI's algorithm) on touched pages | Pass, except a parser artifact on `color(srgb …)` backgrounds outside CI's scope |
| Browser suites needing local Directus (`test:browser:polish`, locale matrix) | Run in CI only |

## Screenshots

README gallery (`docs/assets/screenshots/readme/v065/`), v0.6.5 captures
(`docs/assets/screenshots/v0.6.5/`) and Open Trade 0.0.2
(`docs/assets/screenshots/open-trade-0.0.2/`), all with manifest provenance.
