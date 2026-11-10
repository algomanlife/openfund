# Repository hygiene and size inventory

Measured on `main` (`a8a4386`, 2026-11-10). Sizes are tracked-file sizes
(`du -k`); the Git history is reported separately and is **not** rewritten.

## Inventory and classification

| Path | Size | Class | Status |
| --- | --- | --- | --- |
| `docs/` | 48.9 MB (`assets` 36.2, `business` 12.4) | docs and assets, investor material | keep |
| `react/` | 22.7 MB, 241 files | **generated** (Vite output) | **no longer tracked** (this change) |
| `vendor/vela` | 13.7 MB | required vendor (patched upstream source, see registry) | keep |
| `vendor/gains-sdk` | 6.3 MB | vendored, **not imported by anything** | dormant; removal needs a dedicated, approved PR |
| `dist/` | 17.6 MB | source-critical classic deliverable per `AGENTS.md`; partly rewritten by `build:charts` | keep (owner decision) |
| `apps/` | 15.4 MB (`web-react` 14.8) | source | keep |
| `brand/` | 7.4 MB | docs and assets | keep |
| `packages/` | 3.3 MB | source (incl. dormant `openfund-protocol`) | keep |
| `third_party/` | 0.2 MB | required vendor (journal-core) | keep |

`.git`: 113 MB on disk (pack 99.98 MiB, 10 399 objects, one pack). Past `react/`
builds are in history; shrinking it needs a history rewrite and is out of scope
without separate approval.

Duplicates (not removed, for the reasons shown):
`Openfund-brandbook.zip` ×4 (3.7 MB each: `brand/`, `docs/business/.../08_Brand_Assets`,
`dist/downloads`, and the generated `react/assets` copy, which is gone now);
`vela-workspace.global.min.js` ×3 and `openfund-pine-worker.min.js` ×3 are written by
`npm run build:charts` into `apps/web-react/public/assets` **and** `dist/assets`
(the `dist/` mirror is a documented deliverable); `team-portraits.png` ×3 remain
(`brand/`, `apps/web-react/public/assets`, `dist/assets`).

## Why `react/` is no longer tracked

Evidence that it is reproducible and never read from Git:

- A clean `npm run build:web` on `main` rewrote about 180 of the 241 tracked files
  (content-hashed names and the commit SHA are baked in), so every frontend pull
  request conflicted on generated output.
- Render builds it: `render.yaml` → `node scripts/release/render-build.mjs` runs
  `npm run build:web` and compares the frontend identity with the release manifest.
- Release gates build it twice (reproducibility check) and package the fresh output;
  `scripts/release/test/release.test.mjs` covers the payload and manifest checks.
- CI: the `Web` job builds it; the `Backend` job now builds it **before** booting the
  server, because `apps/backend/server.js` reads `react/index.html` and `react/legacy`
  at start-up (verified: without `react/` the server exits with `ENOENT`; after
  `npm run build:web` it boots, `/health` is OK and `test:browser:website` passes 725 checks).
- `.dockerignore` already excluded `react/`.

Local use: run `npm run build:web` before `npm start`, as in
[Local development](LOCAL_DEVELOPMENT.md).

## Other changes

- `.gitignore`: `/react/`, logs, coverage, `*.tsbuildinfo`, `.DS_Store` anywhere.
- Five tracked `.DS_Store` files under the investor pack were removed.

## Rollback

`git revert` the pull request: `react/` returns to Git exactly as before. No
runtime path depended on the tracked copy.

## Candidates needing an owner decision

`vendor/gains-sdk` (6.3 MB, unused), the `dist/` mirror duplicates, and the
duplicated brandbook archive. The dependency registry (docs/integrations) lists the vendored trees.
