# Retired and no longer used

<!-- Generated from docs/development/RETIRED.json by `node scripts/docs/check-retired.mjs --write`; edit the JSON, not this page. -->

Registry updated **2026-11-27**. Status meanings:

- **retired** — Removed. Zero active references allowed; history may still name it.
- **legacy-only pending removal** — Still shipped for compatibility; no new work; replacement named; remaining references are counted, not gated.
- **dormant** — Kept in the tree but not built, shipped or operated. Not retired.

| Item | Kind | Status | Retired since | Replacement | Remaining refs |
| --- | --- | --- | --- | --- | --- |
| Irancell font files (`irancell-*.ttf`) and their byte-identical copies `openfund-1.ttf`–`openfund-5.ttf` | font | retired | 2026-11-21 | Dastkhat v1.210 — [typography policy](../design/DESIGN_SYSTEM.md#typography-and-font-tokens) | 0 |
| Renamed Irancell derivatives "Openfund Persian" (`openfund-persian-*-v4.woff2`), Backstage `/persian.woff2`, certificate face `OpenfundCertificateFa` | font | retired | 2026-11-21 | Dastkhat v1.210 (`/assets/fonts/dastkhat/`); certificate face `Dastkhat Certificate` | 0 |
| Standalone Vazirmatn copies (`Vazirmatn.ttf`, `Vazirmatn-LICENSE.txt`, Google Fonts `family=Vazirmatn`, `typeface="Vazirmatn"`) | font | retired | 2026-11-21 | Dastkhat v1.210, which is based on Vazirmatn (SIL OFL 1.1) and credits it | 0 |
| Superseded platform releases v0.6.5 and v0.7.0 as the README's current release | release | retired | 2026-11-20 | The latest official release recorded in [docs/status/status.json](../status/status.json) | 0 |
| Dated README galleries ("Recent … captures — YYYY-MM-DD", "Full product gallery — recorded v0.6.5", the v0.4.4 capture set in `docs/assets/screenshots/readme/`) | documentation | retired | 2026-11-21 | One curated gallery generated from [docs/assets/gallery/gallery.json](../assets/gallery/gallery.json); the old sets are in [docs/reviews/_archive/readme-galleries/](../reviews/_archive/readme-galleries/README.md) | 0 |
| Superseded release review snapshots (`docs/reviews/v0.4.1`, `v0.6.5`, `release-0.6.5`, `release-0.6.6`) | documentation | retired | 2026-11-21 | Kept as history under [docs/reviews/_archive/](../reviews/_archive/README.md); current state lives in [docs/status](../status/README.md) | 0 |
| Vanilla JS/CSS legacy layer (`apps/web-react/public/legacy/`) | code | legacy-only pending removal | 2026-11-21 | React application (`apps/web-react/src/`) | 23 files |
| Tracked `dist/` classic static snapshot (frozen classic site, asset mirror and script copies) | code | retired | 2026-11-27 | `apps/web-react/public/` (served assets and the legacy runtime), written by `npm run build:charts` | 0 |
| Openfund Protocol (dormant import of mux-protocol, `packages/openfund-protocol/`) | code | dormant | — | None — not retired; not built, shipped or operated ([provenance](../../packages/openfund-protocol/PROVENANCE.md)) | 126 files |

`Remaining refs` for a `retired` item counts active references and must be 0 (CI fails otherwise);
for other statuses it counts the files still in the tree.

## Notes

- **irancell-fonts** — "All rights reserved" with no recorded license; removed from public assets, `dist/`, `brand/typography/` and the investor pack, which resolved the provenance blocker.
- **openfund-persian** — Same unlicensed glyphs as Irancell under a new family name.
- **vazirmatn-standalone** — Prose attribution "based on Vazirmatn" is required by the OFL and is not a reference to the retired copy.
- **superseded-releases** — Runtime facts (for example a region still running v0.6.5) stay in the generated status block; release notes keep their history.
- **dist-snapshot** — Never served by the backend; most files were byte-identical copies. Removed by owner decision together with its build-charts, upstream-guard and test references.

## Historical paths

Text under these paths may still name retired items:

- `^CHANGELOG\.md$`
- `^docs/reviews/`
- `^docs/releases/`
- `^docs/decisions/`
- `^docs/legal/(LICENSING|LICENSE_DECISION)\.md$`
- `^docs/development/RETIRED\.(json|md)$`
- `^docs/development/README_STRUCTURE\.md$`
- `^scripts/docs/(check-fonts|check-retired|check-readme)\.mjs$`
- `^scripts/docs/test/`
- `^apps/web-react/test/typography\.test\.mjs$`
