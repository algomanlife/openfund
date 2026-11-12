# Upstream isolation and patch registry

The **inventory of record** (versions, licences, pins, locations, tests, risks) is the generated [upstream dependency registry](UPSTREAM_REGISTRY.md); changes to it follow [Dependency governance](../development/DEPENDENCY_GOVERNANCE.md). This page does not duplicate that inventory. It records what the inventory cannot: the isolation layers, the patch registry, the status of each provider against newer upstream versions, rollback limits, and the controlled update procedure. Its machine-readable twin is [`infra/upstream/registry.json`](../../infra/upstream/registry.json) (enforcement data: recipes, guards, observed versions); `npm run test:upstream` fails if it disagrees with the vendored manifests, lockfiles or `render.yaml`, and `npm run deps:check` guards the inventory. Decision record: [ADR 0019](../decisions/0019-upstream-isolation.md).

Reviewed 2026-11-10. "Observed" means the version exists upstream; it does **not** mean it was reviewed or is compatible.

## Three layers

| Layer | What lives there | Rule |
| :--- | :--- | :--- |
| **Upstream** | `vendor/vela`, `vendor/gains-sdk`, `third_party/luxalgo-trade-journal`, npm packages in lockfiles, the Directus image, the hosted Gains API | Replaced wholesale on update. Edited only through a registered patch. Licences and notices stay intact. |
| **Integration** | `packages/openfund-charts` (Vela bridge, Pine build compatibility, locale registration), `packages/openfund-gains-adapter`, `apps/backend/market-data.js`, `apps/backend/portfolio.js` (journal seam), `apps/backstage/scripts`, `packages/cms-client`, `apps/web-react/src/cms` | Version compatibility, adapters, normalisation and error handling. Gains and Directus specifics stop here. |
| **Openfund custom** | Branding and themes, terminal UI, Quick Trade, symbol categories, custom Pine indicators (`indicators/`), account and order adapter, localisation and RTL, trading and evaluation engines, schema and seed content | Never changed by an upstream update. Guarded by tests. |

Application code does not import vendored source directly (checked by `npm run check:upstream`). The only reach into `third_party/` is the documented Trade Journal seam in `apps/backend/portfolio.js`.

## What is actually integrated

| Dependency | Integration, verified in code | Modified upstream source? |
| :--- | :--- | :--- |
| LuxAlgo Vela | `vendor/vela` is upstream tag **v0.9.3** (commit `57d011a`). `scripts/build-charts.mjs` bundles `packages/openfund-charts/src/workspace-entry.ts` against it into `apps/web-react/public/assets/vela-workspace.global.min.js`. The bundle is byte-reproducible. | **Yes, three files**, registered below |
| Vela Pine addon and PineTS | npm `@luxalgo/vela-pinets` 0.3.2 and `pinets` 0.13.1 in `apps/web-react`. The addon's embedded worker is extracted and wrapped at build time into `openfund-pine-worker.min.js`. | No source edit; one build-time wrapper, registered |
| Gains Network API | `apps/backend/market-data.js` (engine price stream) and `packages/openfund-gains-adapter` (browser chart and markets). Hosted API, no version. | n/a |
| Gains Network SDK | `vendor/gains-sdk` is byte-identical to upstream commit `aa7a05a` (package 1.8.10). No application code imports it; market and wallet reads use the public API. | No |
| LuxAlgo Trade Journal | **Integrated, partially.** Only `packages/core` (`@luxalgo/journal-core`) is vendored. `apps/backend/portfolio.js` imports its compiled bundle for Portfolio analytics. The upstream web app and importers are not used. | No (byte-identical sources, committed build output) |
| Directus | `docker.io/directus/directus:11.17.4` in `render.yaml`; schema and seeders in `apps/backstage/scripts`. | No |

Direct modification of upstream source exists in exactly one place: three files of `vendor/vela`. This was established by diffing the vendored tree against `git archive` of the upstream tag, and the repository re-proves it on every update (`update-vendor.mjs` refuses to run unless the vendored tree equals "upstream at the installed ref plus the registered patches").

## Patch registry

Source of truth for modifications: [`infra/upstream/patches.json`](../../infra/upstream/patches.json). Patch files are reversible unified diffs under `infra/upstream/patches/`.

| ID | Applies to | Reason | Regression test |
| :--- | :--- | :--- | :--- |
| OF-VELA-001 | Vela 0.9.3, `ui/components/menu/styles.ts` | Menu positioner lost its z-index after hover, so the canvas swallowed timeframe and style clicks | `npm run test:browser:charts` |
| OF-VELA-002 | Vela 0.9.3, `widget/indicator-picker.ts` | Native indicators must not carry a VELA badge (branding); attribution is carried by the terminal notice | `npm run test:browser:charts` |
| OF-VELA-003 | Vela 0.9.3, `workspace/ChartCell.ts` | Proprietary studies precede the built-in indicators in the picker | `npm run test:browser:charts` |
| OF-BUILD-001 | `@luxalgo/vela-pinets` 0.3.2 with `pinets` 0.13.1 (build time) | PAC's nested `getTFData` request needs full secondary execution | `npm run test:charts` |

Upstream has since moved: Vela 0.10.4's own changelog says open menus now stay above the chart, and the file OF-VELA-001 patches no longer exists there. When Vela is next reviewed, retire OF-VELA-001 first.

## Providers

Each section is the registry row in readable form. Rollback limits are what a rollback cannot undo.

### LuxAlgo Vela (vendored source)

- **Installed:** 0.9.3 (`57d011a`), vendored 2026-10-31. **Observed:** 0.10.4 (2026-11-10), **not reviewed**.
- **Source and licence:** <https://github.com/LuxAlgo/Vela>; Apache-2.0 plus a NOTICE that requires a visible attribution on every screen that shows a chart.
- **Integration path:** `packages/openfund-charts`, `scripts/build-charts.mjs`, `apps/web-react/public/legacy/vela-bridge.js`.
- **Openfund customisations:** see [Vela upgrade protection](VELA_UPGRADE.md#openfund-customisations-that-an-update-must-not-touch).
- **Compatibility status:** pinned and verified at 0.9.3. 0.10.4 is **not** a drop-in: 167 files added, 68 removed, 141 modified, a new `@luxalgo/vela-ui` dependency, and a patch conflict (see the upgrade page).
- **Tests:** `npm run test:upstream`, `npm run test:charts`, `npm run test:browser:charts`, `npm run test:browser:layout`.
- **Upgrade instructions:** [VELA_UPGRADE.md](VELA_UPGRADE.md).
- **Rollback limits:** a git revert restores the source and bundle. Saved chart settings in browser `localStorage` (`of-chart-v2-<product>`) are not migrated by Openfund, so a settings-schema change in Vela can discard a user's saved layout either way.

### Vela Pine addon and PineTS (npm)

- **Installed:** `@luxalgo/vela-pinets` 0.3.2 (observed 0.3.3, not reviewed); `pinets` 0.13.1 (current).
- **Licence:** AGPL-3.0. Corresponding source must remain available with the distributed bundle; licence copies ship under `assets/notices/`.
- **Customisation:** OF-BUILD-001. The build throws if the worker marker moves, so an update cannot silently drop the wrapper.
- **Tests / instructions:** `npm run test:charts`; [VELA_UPGRADE.md](VELA_UPGRADE.md#pine-addon-and-pinets).
- **Rollback limits:** lockfile revert and rebuild; indicator output must be compared against reference values again.

### Gains Network API (hosted)

- **Installed:** unversioned `v1` path; contract recorded 2026-10-31 and refreshed 2026-11-10.
- **Isolation:** all Gains specifics live in `apps/backend/market-data.js` and `packages/openfund-gains-adapter`. The trading engine reads `mark` through `MarketData` only. See [GAINS_UPGRADE.md](GAINS_UPGRADE.md).
- **Tests:** `node --test apps/backend/test/market-data-contract.test.mjs` (13 tests on recorded fixtures); optional live check `npm run check:gains-live`.
- **Rollback limits:** none possible, the provider controls the API. The integration fails closed: stale, malformed or missing data is rejected, never substituted.

### Gains Network SDK (vendored source)

- **Installed:** 1.8.10 (`aa7a05a`), vendored 2026-10-31; upstream default branch has no newer commit as of 2026-11-10; no releases or tags are published.
- **Status:** vendored, unused at runtime, transaction execution disabled by default per `AGENTS.md`.
- **Rollback limits:** git revert; nothing depends on it.

### LuxAlgo Trade Journal (vendored source)

- **Installed:** `journal-core` 0.1.0 from commit `834e7b6`, vendored 2026-11-01, MIT.
- **Integration:** `apps/backend/portfolio.js`; the compiled bundle `dist/index.js` is built by `third_party/luxalgo-trade-journal/build.mjs`.
- **Tests:** `node apps/backend/test/portfolio.test.mjs` compares output with independently computed expectations.
- **Rollback limits:** git revert and rebuild. A metric-definition change would alter user-visible Portfolio figures, so any update is high risk.

### Directus (container image)

- **Installed:** 11.17.4 (latest 11.x), pinned in `render.yaml` (index digest `sha256:eb326f679ae847c0a776f93b972761dc2ebe84980e0b9d274a6bc31cd62809f7`); previously 11.9.1. **Latest stable:** 12.6.1 (2026-11-04), reviewed.
- **Compatibility status:** 11.9.1 to 11.17.4 rehearsed on 2026-11-12 (backup restored into a new database, migrations run, 103/104 contract checks; the one difference is Directus adding `provider` to its built-in own-profile read permission). Directus 12 is **blocked on an owner licensing decision.** On a restored backup, 12.6.1 preserved all data but the Core tier (25 collections, no custom permission rules) locks Openfund's 43-collection, status-filtered content model. The CMS needs Node.js 26 from 12.6.0; the application stays on Node 22.
- **Tests, instructions, rollback:** [assessment](../backstage/DIRECTUS_12_ASSESSMENT.md), `apps/backstage/upgrade/cms-check.mjs`, [migration runbook](../deployment/DIRECTUS_MIGRATION_RUNBOOK.md). Directus migrations are forward only, so rollback is a database and media restore.

### Significant libraries (npm)

React 19.3.1, Vite 6.4.5 (8.3.7 observed), Express 4.22.3 (5.3.0 observed), pg 8.23.1, ws 8.22.1 (8.22.2 observed), viem 2.57.16 (2.57.17 observed), wagmi 2.19.5 (3.7.11 observed). Majors are manual migrations. Each needs the suites named in the registry; none is updated automatically.

## Vendored source update procedure

Applies to Vela, the Gains SDK and the Trade Journal core. Never edit `vendor/` or `third_party/` by hand.

1. Run the report: `npm run update:vendor -- --provider vela --to v0.10.4` (omit `--to` for the latest tag). It is read-only.
2. Read the report. It proves the vendored tree equals upstream plus the registered patches, then lists added, removed and modified files, the version class, changed licence or NOTICE text, changed manifest fields, upstream edits to patched files, changelog excerpt and patch re-application results.
3. Exit code 2 means a patch conflict or an undocumented local edit: nothing was written. Port the patch by hand, or retire it if upstream fixed the problem.
4. If the report is clean and the change is wanted, re-run with `--apply`. It rewrites the vendor tree, regenerates patch files, updates the registry and marks the provider `candidate-unreviewed`. It never commits, builds, pushes or opens a pull request.
5. Regenerate the manifest (`node scripts/upstream/verify.mjs --write-manifest`), rebuild derived assets (`node scripts/build-charts.mjs`, `node third_party/luxalgo-trade-journal/build.mjs` where relevant) and run the regression suite named in the registry.
6. Open a pull request with the report, the test evidence and a rollback note. A human approves; `main` is the integration authority.

## Library updates

Update one dependency per pull request, with its lockfile. Run `npm run typecheck`, `npm run test:web`, `npm run test:backend` and, for build tooling, `npm run build:web` and the affected browser suites. Majors and anything on the Gains price path (`ws`) or payment verification path (`viem`) also need the relevant contract tests.

## Enforcement

`npm run check:upstream` (offline) verifies: registry schema and versions against lockfiles and manifests; every vendored file against `infra/upstream/vendor-manifest.json`; each patch reverse-applies and its guard string is present; Openfund customisation guards (including the paired legal attribution guards); byte-identical mirrors of the chart bridge, Gains adapter, bundles and licence notices; and the no-direct-vendor-import boundary. The workflow `upstream-guard.yml` runs it with the chart and Gains contract tests on pull requests that touch these areas.

[Update automation](UPSTREAM_AUTOMATION.md) · [Upstream source management](UPSTREAM.md) · [Vela integration](VELA.md) · [Gains integration](GAINS.md) · [ADR 0019](../decisions/0019-upstream-isolation.md)
