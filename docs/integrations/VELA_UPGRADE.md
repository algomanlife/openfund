# Vela upgrade protection

Procedure for moving the vendored LuxAlgo Vela, its Pine addon and PineTS to a newer version **without** replacing Openfund's modified chart, branding, indicators or terminal behaviour. Vela is pinned to an exact reviewed version (currently 0.10.6).

Inventory of record: [Upstream dependency registry](UPSTREAM_REGISTRY.md). Patches and rollback limits: [Upstream isolation and patch registry](UPSTREAM_DEPENDENCIES.md). Integration description: [Vela chart integration](VELA.md).

## Openfund customisations that an update must not touch

Each row is protected by a guard in [`infra/upstream/customizations.json`](../../infra/upstream/customizations.json) and, where marked, a browser regression.

| Area | Where it lives | Protected by |
| :--- | :--- | :--- |
| Branding: built-in V mark replaced, picker badge removed | `workspace-entry.ts` (`registerRendererDefaults({ attribution: false })`), patch OF-VELA-002 | guards, `test:browser:charts` (no `.vela-ip-badge`, no `.vela-attribution`) |
| **Attribution (legal)** | The terminal status-bar `Vela` link was removed on 2026-11-11 at the owner's direction (owner-accepted deviation from the on-screen attribution condition in `vendor/vela/NOTICE`); Vela stays credited in the website footer and shipped notices | `vela-notice-text` guard (NOTICE re-review trigger), `test:browser:charts` asserts no `.chart-notice` |
| Brand themes (dark and light) | `vela-bridge.js` `THEMES` | guard, theme assertions in browser suite |
| Single-chart layout, toolbar subset, hosted symbol selector | `vela-bridge.js` (`layout:false`, `topbar`) | guards |
| Chart tabs and Quick Trade | Terminal UI (`TradingPages.tsx`), account adapter; Vela only draws the chart | guard, `npm run test:web` (`chart-quick-trade.test.mjs`), `test:browser:completion` |
| Symbol selection and categories | Openfund markets selector (`CATEGORY_ORDER`), `setSymbol` through the bridge | guard, `test:markets`, browser suite (symbol picker changes chart and terminal state) |
| Account and order adapter | Outside Vela: position overlays never enter chart persistence | guard (`delete chart.drawings`), browser suite |
| Custom indicators | `indicators/*.pine`, `pine-sources.mjs`, `workspace-entry.ts` catalog; picker order via OF-VELA-003 | `test:charts`, browser suite (exact catalog order, 77 built-ins, three originals calculate) |
| Localisation and RTL | `registerLocale` for fa (RTL), ar, ru, zh-Hans in `workspace-entry.ts` | guard, `test:browser:locale` |
| Persistent settings | `localStorage` key `of-chart-v2-<product>` in `vela-bridge.js` | guard, browser suite (settings survive reload) |
| Mobile | Responsive terminal layout and chart dialogs | `test:browser:layout`, browser suite (responsive dialogs) |
| Licences and notices | `vendor/vela/LICENSE`, `NOTICE`, copies under `assets/notices/` | mirrors check |

### Attribution rule

`vendor/vela/NOTICE` allows disabling the built-in mark only if an equivalent visible attribution (the name "Vela" and a link to the project page) appears on the same screen. Openfund disables the mark and shows `Vela` linked to `https://velacharts.dev` in the terminal status bar. An update must keep both halves and must not hide or restyle the notice. If the NOTICE text changes, `update-vendor` raises a LEGAL REVIEW flag and the guard `vela-notice-text` fails until a human re-reads the new wording.

## Procedure

1. **Detect the candidate.** `npm run update:vendor -- --provider vela` lists the latest upstream tag against the installed one. Vela is 0.x, so every minor can break; treat any minor as high risk.
2. **Report.** Add `--to <tag>` for an exact target and `--report vela-report.md` to save it. Nothing is written.
3. **Review the report.**
   - Vendored tree identical to upstream plus patches (otherwise stop and document the stray edit).
   - Version class and risk, changelog excerpt and any `BREAKING` marker.
   - Changed `LICENSE` or `NOTICE`: legal review before anything else.
   - Upstream changes to patched files, new or removed dependencies, and changed `exports`.
   - Patch re-application result.
4. **Resolve conflicts by hand** against the new upstream, or retire a patch that upstream fixed (confirm by running the browser test without it). The tool never merges for you and never overwrites Openfund's modified chart UI with upstream defaults.
5. **Apply.** `npm run update:vendor -- --provider vela --to <tag> --apply` writes the candidate into the working tree on a dedicated branch. It does not commit.
6. **Rebuild and refresh derived files.** `node scripts/upstream/verify.mjs --write-manifest`, `node scripts/build-charts.mjs`, then confirm only intended files changed (`git status`). The bundle copies under `dist/` and `react/` are mirrors and must be refreshed the same way the repository already does.
7. **Run the regression set.** `npm run check:upstream`, `npm run test:charts`, `npm run test:web`, and the browser suites against a built application: `test:browser:charts`, `test:browser:layout`, `test:browser:locale`, `test:browser:completion`. Capture chart screenshots for light and dark themes, English and Persian, desktop and 390 px width.
8. **Open a pull request** with the report, test output, screenshots, the registry diff and a rollback note. The pull request must state that a human approval is required; do not merge or deploy from automation.
9. **After approval,** update `last_upgrade`, `compatibility` and `latest_observed.reviewed` in the registry, and record the version in `CHANGELOG.md`.

## Pine addon and PineTS

`@luxalgo/vela-pinets` and `pinets` are npm dependencies pinned to exact versions in `apps/web-react/package.json`. After changing either: run `node scripts/build-charts.mjs` (it throws if the worker marker moved), `npm run test:charts`, and `test:browser:charts`. Both packages are AGPL-3.0; keep the licence copies and the corresponding-source availability intact. Remove OF-BUILD-001 only after proving the nested-request bug is fixed upstream.

## Upgrade to Vela 0.10.6 (2026-11-12)

Previous assessment (0.10.4, 2026-11-10) stopped on one conflict: OF-VELA-001 patched `src/ui/components/menu/styles.ts`, which 0.10.x removed, and the 0.10.x changelog says open menus now stay above the chart. The 0.10.6 upgrade therefore:

1. Retired OF-VELA-001: reverse-applied to the vendored tree, patch file and registry entry removed.
2. Ran `npm run update:vendor -- --provider vela --to v0.10.6 --apply`: vendored tree proven identical to v0.9.3 plus the registered patches, 178 files added, 68 removed, 173 modified, OF-VELA-002 and OF-VELA-003 re-applied cleanly, no `LICENSE` or `NOTICE` change.
3. Pinned `@luxalgo/vela` 0.10.6 (adds `@luxalgo/vela-ui` 0.4.1) and `@luxalgo/vela-pinets` 0.3.4 in `apps/web-react`.
4. Re-anchored OF-BUILD-001: vela-pinets 0.3.4 renamed the minified worker identifiers (indicator class `Nr` to `Dr`, worker entry `y0` to `q0`). `build-charts.mjs` now finds both structurally and still throws unless each matches exactly once. PineTS is unchanged at 0.13.1, so the wrapper is still required.
5. Rebuilt the chart bundles and the web build, then ran the regression set. Results are recorded in the pull request.

The upgrade needs human review before merge, as with every 0.x minor.

[Upstream dependency registry](UPSTREAM_REGISTRY.md) · [Patch registry](UPSTREAM_DEPENDENCIES.md) · [Vela integration](VELA.md) · [ADR 0019](../decisions/0019-upstream-isolation.md)
