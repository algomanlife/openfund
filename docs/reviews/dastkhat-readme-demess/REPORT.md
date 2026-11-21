# Report — Dastkhat everywhere, repository de-mess, README contract, permanent gates

Branch `agent/claude/dastkhat-readme-demess`, based on `main` `a797a5f`
(2026-11-21). Commits:

| Commit | Scope |
| --- | --- |
| `feat(typography): make Dastkhat the only Persian face project-wide and remove retired fonts` | W1 |
| `docs: de-mess the repository and restructure the README` | W2, W3 |
| `ci(docs): enforce README structure, retired registry and font policy on every commit` | W4 |
| `docs(reviews): report, evidence and progress for the Dastkhat/README/de-mess change` | this report |

The release planner allocates **0.9.0** for this range (`feat` → minor; no
breaking marker), so the owner's `release_version=0.9.0` is accepted.

## Starting facts that had changed

The brief's inventory predated PR #161, which had already moved the live CSS of
the site, terminal, Backstage and Open Trade to Dastkhat. These were still open:
the `dist/` snapshot (Irancell + "Openfund Persian" preloads), the certificate
`FontFace` name `OpenfundCertificateFa`, five separate Persian `@font-face`
copies, 54 retired binaries, Vazirmatn in the brandbook and the Persian
investor documents, the k6 asset manifest, the content registry/whitepaper
licence row, and stale legal, design and tech-stack docs. `/persian.woff2` and
the Vazirmatn CSS lines named in the brief no longer existed.

## W1 — Dastkhat migration

- **Vendored:** `DastkhatFaNum-Variable.woff2` and `FONTLOG.txt` added beside
  the existing Dastkhat and Dastkhat Arabic files. `Dastkhat-Variable.woff2`
  and `DastkhatFaNum-Variable.woff2` are byte-identical to tag `v1.210`
  (blobs `6b2b7a8…`, `af3afa1…`). The pin stays at commit `ac5b015`, the
  first upstream commit that also contains Dastkhat Arabic. SHA-256 for every
  file is in `SOURCE.json` and `brand/typography/README.md`.
- **One `@font-face` set:** `apps/web-react/public/assets/fonts/dastkhat/dastkhat.css`
  declares `Dastkhat`, `Dastkhat Arabic` and `Dastkhat FaNum` with
  file-relative URLs. Every other Persian `@font-face` was deleted.
- **Every reference replaced** (migration map below). Backstage serves the CSS
  and all three WOFF2 files from its own origin; the CSP is unchanged
  (`font-src 'self'`, `style-src 'self'`).
- **Retired binaries deleted (54):** 15 in `apps/web-react/public/assets/`,
  15 + 2 in `dist/assets/`, 10 in `brand/typography/`, 10 in the
  investor-pack typography directory (all `irancell-*.ttf`, `openfund-1…5.ttf`,
  `openfund-persian-*-v4.woff2`), plus `Vazirmatn.ttf` and
  `Vazirmatn-LICENSE.txt` in the web and dist assets.
- **Legal:** `THIRD_PARTY_NOTICES.md` now lists Dastkhat (with FaNum) and
  credits "based on Vazirmatn by Saber Rastikerdar"; the Irancell, renamed and
  Vazirmatn rows are gone. The Irancell provenance blocker is marked
  **RESOLVED by removal** in `LICENSING.md` and `LICENSE_DECISION.md`.
- **Embedded-font business artifacts — regenerated, none left blocked:**
  - Brandbook (three identical zips): rebuilt from its own `build.py` with
    Dastkhat and the OFL/FONTLOG files.
  - The four Persian DOCX/PPTX files: 5,721 `Vazirmatn` typeface attributes
    re-pointed to Dastkhat.
  - Four Persian PDFs: re-exported with LibreOffice, now embedding
    Dastkhat-Regular/Bold.
  - The Persian public overview: the HTML now loads Dastkhat (pinned jsDelivr
    `@v1.210`) and the PDF was re-printed with Chrome.

  No PDF in the tree embeds a retired face. The old Persian PDFs had in fact
  rendered with DejaVu fallbacks.

### Migration map (old → new)

| File | Before | After |
| --- | --- | --- |
| `apps/web-react/public/assets/fonts/dastkhat/dastkhat.css` | — | the one Persian/Arabic `@font-face` set |
| `apps/web-react/public/legacy/style.css`, `legacy/terminal.css` | inline Dastkhat + Dastkhat Arabic `@font-face` | `@import url(../assets/fonts/dastkhat/dastkhat.css)` |
| `apps/web-react/src/styles/design-system.css` | two `@font-face` rules | removed; `index.html` links `dastkhat.css` |
| `apps/web-react/index.html` | — | `<link rel="stylesheet" href="/assets/fonts/dastkhat/dastkhat.css">` |
| `apps/backstage/operations/public/style.css` | inline Dastkhat `@font-face` | `@import url('/assets/fonts/dastkhat/dastkhat.css')` |
| `apps/backstage/operations/server.js` | served `Dastkhat-Variable.woff2`, `OFL.txt` | also serves `dastkhat.css`, Arabic and FaNum WOFF2 (same pinned files) |
| `apps/open-trade/src/style.css`, `index.html` | two inline `@font-face` | removed; `index.html` links `./assets/fonts/dastkhat/dastkhat.css` (copied by `prepare.mjs`) |
| `apps/web-react/src/features/certificates/export.ts` | `FontFace('OpenfundCertificateFa')`, `OpenfundCertificateLatin` | `'Dastkhat Certificate'`, `'Ubuntu Certificate'` |
| `dist/style.css`, `dist/terminal.css` | 5 Irancell `@font-face` each; 12 `'Irancell'` family uses | `@import url(../assets/fonts/dastkhat/dastkhat.css)`; `'Dastkhat'` |
| `dist/index.html`, `dist/terminal.html` | preload `openfund-persian-400/600-v4.woff2` | preload `assets/fonts/dastkhat/Dastkhat-Variable.woff2` |
| `dist/assets/fonts/dastkhat/` | — | same files as the web copy (identical git blobs) |
| `scripts/capacity/k6/route-assets.json` | `irancell-*.ttf` on 12 routes | `dastkhat.css` + `Dastkhat-Variable.woff2` |
| `apps/backend/test/static-cache.test.mjs` | sample `irancell-400.ttf` | `ubuntu-400.ttf` |
| `apps/web-react/src/cms/seed/whitepaper/chapters-foundation.ts` + `apps/backstage/content-registry.json` | "Vazirmatn font — OFL" licence row | "Dastkhat font (based on Vazirmatn) — SIL OFL 1.1"; registry rows byte-identical to the generator's output |
| `apps/web-react/test/typography.test.mjs` | per-file `@font-face` contract | one-file contract + every surface loads `dastkhat.css` (10/10) |
| `brand/brandbook/…zip`, `dist/downloads/…zip`, investor-pack zip | `Vazirmatn.ttf` + license | rebuilt with Dastkhat, `Dastkhat-LICENSE.txt`, `Dastkhat-FONTLOG.txt` |
| Investor pack FA DOCX/PPTX/PDF/HTML | Vazirmatn (named; PDFs fell back to DejaVu) | Dastkhat (named; embedded in PDFs) |
| `THIRD_PARTY_NOTICES.md`, `docs/legal/*`, `DESIGN_SYSTEM.md`, `TECH_STACK.md`, `brand/README.md`, investor `README`/`QC_REPORT`/`RESEARCH`, `apps/open-trade/README.md`, `DESIGN_AND_CONTENT_NOTES.md` | Irancell/Vazirmatn as active or unresolved | two-face policy; blocker resolved by removal; history labelled |

**Deliberate differences from the brief:**

- The license file keeps the upstream name `OFL.txt`, because tests and the
  Backstage route use it; the brandbook ships it as `Dastkhat-LICENSE.txt`.
- Static weights were not vendored: every surface uses the variable file, so
  static cuts would ship unused.
- `'Dastkhat FaNum'` is declared but used by no surface today, as documented in
  the design system.
- Dated capacity evidence (`docs/reviews/capacity-2026-11/results/**`) keeps
  its recorded Irancell URLs. Rewriting measured results would falsify them.

## W2 — De-mess

- `docs/development/RETIRED.json` holds 8 items: 3 fonts, superseded
  releases, dated galleries and review snapshots (all `retired`); the legacy
  layer and `dist/` (`legacy-only pending removal`); the Openfund Protocol
  (`dormant`). `RETIRED.md` and the README block are generated from it.
- Archived under `docs/reviews/_archive/`: the 34-image v0.4.4/v0.6.5 README
  capture set (with its split-out manifest), the old gallery text, and
  `v0.4.1`, `v0.6.5`, `release-0.6.5`, `release-0.6.6`. Every inbound and
  internal link was re-pointed; the link check covers 2,420 targets.
- Single sources:
  - Feature status: `docs/status/status.json` (README block).
  - Typography: `DESIGN_SYSTEM.md`.
  - Licenses: `THIRD_PARTY_NOTICES.md` (README block).
  - Gallery: `docs/assets/gallery/gallery.json`.
  - The README's deep detail moved verbatim to `PLATFORM_TOUR.md`,
    `BUSINESS_DETAIL.md` and `PLATFORM_REFERENCE.md`.
  - The domain/environment detail now appears in the platform reference and
    ADR 0043 only; the README has no domain table.

## W3 — README

1,045 lines / ~8,860 words / 45 images / 20 sections →
**289 lines / 1,458 words / 12 images / 13 sections**, in the exact contract
order. There are no orphan or dated headings. Hand-written version references
are v0.8.0 (current) and v0.9.0 (declared next in `status.json`).

## W4 — Gates (all in `npm run docs:check`, CI `web` job, every push and PR)

| Gate | Result on this branch | On original `main` |
| --- | --- | --- |
| `check-readme.mjs` | OK — 13 sections, 289/350 lines, 1,458/1,500 words, 70 links | fails (20 sections, 1,045 lines, stale versions) |
| `check-retired.mjs` | OK — 6 retired items with 0 active references | fails |
| `check-fonts.mjs` | OK — 1,755 text files, 12 archives/Office files | **433 problems** |
| `gates.test.mjs` | 24/24 | — |

`check-required.mjs` now reads the README section list from the shared
contract. `README_STRUCTURE.md` documents the contract and `AGENTS.md`
references it.

## Verification run in this session

| Check | Result |
| --- | --- |
| `docs:status`, `docs:readme`, `docs:retired`, `docs:fonts`, `docs:gates:test` | pass |
| `docs:links`, `docs:markdown` (markdownlint), `docs:language`, `docs:required`, `legal:licenses`, `deps:check` | pass |
| `apps/web-react` `test:typography` 10/10, `test:content-registry`, `test:governance`; `test:whitepaper` 15/16 | pass (the one whitepaper failure needs `jsdom`) |
| Backstage server tests | 16/16 |
| Content registry regenerated with its real generator | byte-identical to the committed file |
| Render evidence ([results.json](evidence/results.json), screenshots in `evidence/`) | 7/7: legacy site fa/ar, terminal iframe, React shell, certificate canvas, `dist/` landing, `dist/` terminal and Backstage load only Dastkhat/Ubuntu, with zero retired-font requests |

**Not run here (environment):** `npm ci` and the network are unavailable, so
the Vite build/typecheck, `docs:mermaid` (needs `jsdom`), backend suites and
browser e2e did not run. CI runs all of them on the PR. The React and Open
Trade `<link>` to a public-dir stylesheet is the one change that only a Vite
build confirms.

## Out-of-scope findings (report only, not fixed)

1. Backstage sets `font-family: Inter, system-ui` for Latin. Inter is not
   shipped, so English Backstage renders in system fonts rather than Ubuntu.
   Fixing it means serving Ubuntu from Backstage, which is a visual change
   outside the Persian-only mandate.
2. `npm run docs:language` resolves `typescript-js-api` from
   `apps/web-react`, so it cannot run before the web install. That couples a
   documentation check to an app dependency.
3. Persian captures before 2026-11-20 show the retired face. Current Persian
   captures of Heatmap/Radar, desktop and Footprint are still missing
   ([capture requirements](../../assets/gallery/CAPTURE_REQUIREMENTS.md)).
4. The regenerated FA business plan reflows from 25 to 22 pages, because the
   original was rendered with DejaVu fallbacks. Content is unchanged; the
   owner should skim it.
5. Post-release bookkeeping is manual. The release tooling does not update
   `status.json` `latestOfficial` or the CHANGELOG heading, and `status.mjs`
   and `check-readme.mjs` will flag both once the `v0.9.0` tag exists.

## Owner actions remaining

This session could not push: GitHub access was denied and the `gh` token is
invalid. The branch is delivered as a git bundle.

1. **Get the branch onto GitHub and open the PR:**
   `git fetch <bundle> agent/claude/dastkhat-readme-demess:agent/claude/dastkhat-readme-demess`,
   then `git push origin agent/claude/dastkhat-readme-demess`, then
   `gh pr create --base main --head agent/claude/dastkhat-readme-demess --title "feat(typography): Dastkhat everywhere, README contract, retired registry and permanent gates" --body-file docs/reviews/dastkhat-readme-demess/PR_BODY.md`.
   Keep the title without `!`, or the planner allocates 1.0.0.
2. **Merge** once CI is green (owner click).
3. **Release:** `gh workflow run release.yml --ref main -f publish=true -f release_version=0.9.0`.
4. **Approve** the `production` environment deployment when it is requested
   (owner click).
5. **Verify:** `node docs/reviews/dastkhat-readme-demess/evidence/verify-live.mjs --version 0.9.0`.
   Add `--browser` with Playwright for the live font-request check. It checks
   that `/version` is 0.9.0, official and matched; that Backstage `/health`
   reports the same commit; that Dastkhat is served; and that retired URLs no
   longer return fonts.
6. **Post-release docs PR:**
   - Set `docs/status/status.json` `release.latestOfficial` to v0.9.0 (commit,
     date, evidence) and clear `release.next`.
   - Record the verified services.
   - Rename the CHANGELOG's first `## Unreleased` to `## v0.9.0 — <date>` and
     add a fresh `## Unreleased`.
   - Run `node scripts/docs/status.mjs` and update the README's *Versioning
     and releases* paragraph. The gates require this.
