# Upstream dependency registry

<!-- Generated from upstream-registry.json by scripts/deps/check-registry.mjs --write. Edit the JSON, not this file. -->

Verified against `main a8a4386` on 2026-11-10. Facts here are read from the repository (package manifests, lockfiles, render.yaml, source imports and PROVENANCE files). Anything not verified from the repository is stated as such. License summaries are an engineering inventory, not legal advice. Isolation layers, the patch registry, customisation guards and the controlled update tool are in [Upstream isolation and patch registry](UPSTREAM_DEPENDENCIES.md) (enforcement data in infra/upstream/). The Directus upgrade is tracked separately; this file records the state, it does not decide that upgrade.

The process for changing any of these is in [Dependency governance](../development/DEPENDENCY_GOVERNANCE.md). Source-management rules for vendored code are in [Upstream source management](UPSTREAM.md).

## Summary

| Dependency | Version | License | Runtime | Primary location |
| --- | --- | --- | --- | --- |
| LuxAlgo Vela (charting core) | 0.9.3 | Apache-2.0 plus a NOTICE attribution requirement | yes | vendor/vela |
| Vela Pine addon (@luxalgo/vela-pinets) | 0.3.2 | AGPL-3.0-only | yes | apps/web-react node_modules/@luxalgo/vela-pinets |
| PineTS (Pine Script runtime) | 0.13.1 | AGPL-3.0-only | yes | apps/web-react node_modules/pinets |
| Gains Network SDK (@gainsnetwork/sdk) | 1.8.10 | MIT | no | vendor/gains-sdk |
| Gains Network public APIs (market data) | unversioned external service (path /v1) | Service terms of the provider | yes | apps/backend/market-data.js |
| LuxAlgo Trade Journal — journal-core only | @luxalgo/journal-core (see packages-core/package.json) | MIT | yes | third_party/luxalgo-trade-journal/packages-core |
| Directus (CMS) | 11.9.1 | BSL 1.1 for the Directus core | yes | render.yaml |
| Wallet libraries (wagmi, viem, RainbowKit) | wagmi 2.19.5, viem 2.57.13, RainbowKit 2.2.11 (installed; manifests use caret ranges) | MIT | yes | apps/web-react/package.json |
| Openfund Protocol (MUX protocol source, dormant) | revision 0f70a70b9b3410c2ae7209900e5d2521635249d1 (2025-07-14) | GPL-2.0 | no | packages/openfund-protocol |
| Frontend runtime and build toolchain | see apps/web-react/package.json and package-lock.json | MIT | yes | apps/web-react |
| Backend runtime dependencies (express, pg, ws, decimal.js) | see apps/backend/package.json and package-lock.json | MIT/ISC family | yes | apps/backend |
| Repository tooling (Playwright, markdownlint, mermaid, jsdom, js-yaml) | see package.json (playwright is range-pinned; CI caches browsers per lockfile) | MIT/Apache-2.0 family | no | package.json |

## Details

### LuxAlgo Vela (charting core)

- **Upstream:** https://github.com/LuxAlgo/Vela
- **License:** Apache-2.0 plus a NOTICE attribution requirement (vendor/vela/NOTICE: visible Vela attribution wherever a Vela chart is displayed)
- **Pinned version:** 0.9.3
- **Source commit:** 57d011ab796c541cbb9e1282722ad6cd521c8f55 (upstream tag v0.9.3). Vendored tree verified by diff against the tag: byte-identical except the three registered patches
- **Where:** vendor/vela (source, Apache-2.0); apps/web-react node_modules/@luxalgo/vela (npm 0.9.3); packages/openfund-charts (Openfund bridge); apps/web-react/public/assets/vela-workspace.global.min.js (built bundle, mirrored to dist/ and react/)
- **Vendoring method:** Two sources: the npm package is the runtime dependency; vendor/vela is a source copy used by scripts/build-charts.mjs through an esbuild alias for `@luxalgo/vela/plugin` only. Output is bundled by `npm run build:charts`.
- **Local Openfund modifications:** Yes, exactly three files, registered as reversible patches OF-VELA-001 (menu z-index), OF-VELA-002 (no picker badge) and OF-VELA-003 (proprietary studies first) in infra/upstream/patches.json. Every vendored file is checksummed in infra/upstream/vendor-manifest.json.
- **Used by the running application:** yes
- **Tests:** npm run check:upstream; npm run test:browser:charts; npm run test:charts; npm run test:upstream; npm run typecheck
- **Update procedure:** Controlled tool, never by hand: `npm run update:vendor -- --provider vela --to <tag>` (read-only report; --apply only after review), then rebuild and run the tests. See docs/integrations/VELA_UPGRADE.md. 0.10.4 is observed but not adopted (patch conflict).
- **Risks:** Attribution obligation in NOTICE must stay satisfied on every chart screen. Local patches can be lost on update. Vendored tree and npm package could drift apart.

### Vela Pine addon (@luxalgo/vela-pinets)

- **Upstream:** https://github.com/LuxAlgo/Vela-pinets
- **License:** AGPL-3.0-only (npm metadata)
- **Pinned version:** 0.3.2
- **Where:** apps/web-react node_modules/@luxalgo/vela-pinets (npm); apps/web-react/public/assets/openfund-pine-worker.min.js (worker extracted and patched by scripts/build-charts.mjs)
- **Vendoring method:** npm dependency. scripts/build-charts.mjs extracts the embedded worker from dist/index.js and inserts packages/openfund-charts/src/pine-compatibility.mjs; it throws if the upstream layout changes.
- **Local Openfund modifications:** Build-time wrapper OF-BUILD-001 (Pine worker compatibility), registered in infra/upstream/patches.json. No forked source.
- **Used by the running application:** yes
- **Tests:** npm run test:charts; npm run test:browser:charts
- **Update procedure:** Update only with PineTS (same family). The build script's marker checks fail loudly if the worker changes; review the compatibility insertion before adjusting the markers.
- **Risks:** AGPL-3.0 network-use obligations apply to the served bundle; notices are shipped in dist/assets/notices. Confirm obligations with counsel before changing distribution. Build-time string patching is brittle across upstream releases.

### PineTS (Pine Script runtime)

- **Upstream:** https://github.com/LuxAlgo/PineTS
- **License:** AGPL-3.0-only (npm metadata; notices in dist/assets/notices/PineTS-AGPL-3.0.txt)
- **Pinned version:** 0.13.1
- **Where:** apps/web-react node_modules/pinets (npm); bundled into the Vela workspace and Pine worker assets
- **Vendoring method:** npm dependency, exact pin.
- **Local Openfund modifications:** None to the package. Openfund-original Pine sources live in indicators/ and packages/openfund-charts.
- **Used by the running application:** yes
- **Tests:** npm run test:charts
- **Update procedure:** Exact-pin bump in a dedicated PR together with @luxalgo/vela-pinets; run the chart tests and the browser chart regression.
- **Risks:** AGPL-3.0 obligations (see vela-pinets). Exact pin: security fixes are not picked up automatically.

### Gains Network SDK (@gainsnetwork/sdk)

- **Upstream:** https://github.com/GainsNetwork-org/sdk
- **License:** MIT (vendor/gains-sdk/LICENSE)
- **Pinned version:** 1.8.10
- **Source commit:** aa7a05a4919ba6667513c128e6bf5806af0be181 (upstream HEAD observed when vendored)
- **Where:** vendor/gains-sdk
- **Vendoring method:** Source copy only. It is NOT imported by any application, package or script (verified by searching the repository); the build neither compiles nor ships it.
- **Local Openfund modifications:** None. Byte-identical to upstream commit aa7a05a, enforced by the vendor manifest.
- **Used by the running application:** no
- **Tests:** none (not exercised by any build or test)
- **Update procedure:** Do not update until transaction execution is a planned, funded milestone; AGENTS.md keeps Gains execution disabled. When it becomes active: new dependency-governance review, testnet contracts, simulation.
- **Risks:** 6 MB of tracked source that nothing consumes. Stale ABIs could be mistaken for supported integration.

### Gains Network public APIs (market data)

- **Upstream:** https://api.gains.trade/v1/arbitrum (REST + WebSocket)
- **License:** Service terms of the provider (not verified from the repository)
- **Pinned version:** unversioned external service (path /v1)
- **Where:** apps/backend/market-data.js; packages/openfund-gains-adapter; dist/gains-adapter.js (generated mirror)
- **Vendoring method:** None — runtime HTTP/WebSocket calls. Chart acceptance tests use the recorded fixture packages/openfund-charts/test/fixtures/gains-btc-usd.json.
- **Local Openfund modifications:** n/a
- **Used by the running application:** yes
- **Tests:** apps/backend test:gains; node --test apps/backend/test/market-data-contract.test.mjs; npm run check:gains-live (optional, live); npm run test:charts
- **Update procedure:** Contract tests on recorded fixtures (apps/backend/test/fixtures/gains) plus the optional live check; see docs/integrations/GAINS_UPGRADE.md.
- **Risks:** Third-party availability and rate limits. Provider can change payloads without notice.

### LuxAlgo Trade Journal — journal-core only

- **Upstream:** https://github.com/LuxAlgo/trade-journal
- **License:** MIT (third_party/luxalgo-trade-journal/LICENSE)
- **Pinned version:** @luxalgo/journal-core (see packages-core/package.json)
- **Source commit:** 834e7b68f553d1aba0d7777875cdc4622f5a7eb5
- **Where:** third_party/luxalgo-trade-journal/packages-core (TypeScript sources); third_party/luxalgo-trade-journal/dist/index.js (compiled ESM bundle, imported by apps/backend/portfolio.js)
- **Vendoring method:** Source copy of packages/core plus a committed esbuild bundle (`node third_party/luxalgo-trade-journal/build.mjs`). Included in the release payload (scripts/release/build.mjs).
- **Local Openfund modifications:** None to the sources (byte-identical, vendor manifest enforced); the compiled dist/index.js is rebuilt by build.mjs.
- **Used by the running application:** yes
- **Integration status (verified from code):** INTEGRATED, narrowly: only the dependency-free analytics library `journal-core` is used, by the backend Portfolio module, to compute round-trips and metrics from Openfund's own trade rows. The upstream Trade Journal application (apps/web), its importers and any broker/CSV import are NOT vendored and NOT integrated.
- **Tests:** npm --prefix apps/backend run test:all (portfolio.test.mjs)
- **Update procedure:** Re-vendor packages/core from a reviewed upstream commit, rebuild dist/index.js, run backend portfolio tests, update PROVENANCE.md.
- **Risks:** The compiled bundle is committed; ensure it is rebuilt from the recorded commit.

### Directus (CMS)

- **Upstream:** https://github.com/directus/directus
- **License:** BSL 1.1 for the Directus core (inventory note, not legal advice; confirm the licence terms of the pinned image)
- **Pinned version:** 11.9.1
- **Where:** render.yaml (openfund-cms, official Docker image); .github/workflows/release.yml (package and cms jobs); infrastructure/directus/compose.yaml (local); apps/backstage/scripts (schema + seed)
- **Vendoring method:** Official container image pinned by tag; no source in the repository.
- **Local Openfund modifications:** None to Directus. Openfund schema is applied by apps/backstage/scripts/apply_schema.py.
- **Used by the running application:** yes
- **Tests:** Release workflow job 'Directus bootstrap and public permissions'; scripts/release/test-cms-bootstrap.mjs
- **Update procedure:** Handled by the dedicated Directus-upgrade assignment: change every location above in one PR, run the bootstrap job twice (idempotency), back up the CMS database first.
- **Risks:** The version appears in five places; they must change together (check-registry verifies the three pins above). Major upgrades can change the schema API.

### Wallet libraries (wagmi, viem, RainbowKit)

- **Upstream:** https://github.com/wevm/wagmi, https://github.com/wevm/viem, https://github.com/rainbow-me/rainbowkit
- **License:** MIT (npm metadata)
- **Pinned version:** wagmi 2.19.5, viem 2.57.13, RainbowKit 2.2.11 (installed; manifests use caret ranges)
- **Where:** apps/web-react/package.json; apps/backend/package.json (viem for SIWE verification)
- **Vendoring method:** npm dependencies with caret ranges; lockfiles pin the resolved versions.
- **Local Openfund modifications:** None.
- **Used by the running application:** yes
- **Tests:** npm run test:browser:wallet; apps/backend test (siwe.test.mjs)
- **Update procedure:** Grouped minor/patch updates via the scheduled review; major versions (wagmi/RainbowKit/viem move together) in a dedicated PR with the wallet browser tests.
- **Risks:** Wallet SDKs are fast-moving and security-sensitive; some transitive packages are deprecated (for example @metamask/sdk-communication-layer).

### Openfund Protocol (MUX protocol source, dormant)

- **Upstream:** https://github.com/mux-world/mux-protocol
- **License:** GPL-2.0 (packages/openfund-protocol/LICENSE)
- **Pinned version:** revision 0f70a70b9b3410c2ae7209900e5d2521635249d1 (2025-07-14)
- **Source commit:** 0f70a70b9b3410c2ae7209900e5d2521635249d1
- **Where:** packages/openfund-protocol
- **Vendoring method:** Source import. Not part of the application build, deploy or runtime (PROVENANCE.md).
- **Local Openfund modifications:** Documentation and package metadata renamed only; known upstream compile defect documented in PROVENANCE.md.
- **Used by the running application:** no
- **Tests:** none (not exercised by any build or test)
- **Update procedure:** Do not enable or update without the separate protocol roadmap decision.
- **Risks:** GPL-2.0 obligations if ever distributed with the application. Upstream revision does not compile (documented).

### Frontend runtime and build toolchain

- **Upstream:** https://github.com/facebook/react, https://github.com/vitejs/vite, https://github.com/TanStack/query, https://github.com/remix-run/react-router
- **License:** MIT (npm metadata)
- **Pinned version:** see apps/web-react/package.json and package-lock.json
- **Where:** apps/web-react
- **Vendoring method:** npm dependencies, lockfile-pinned (`npm ci`).
- **Local Openfund modifications:** None.
- **Used by the running application:** yes
- **Tests:** npm run typecheck; npm run test:web; npm run build:web
- **Update procedure:** Scheduled grouped minor/patch review; majors one at a time.
- **Risks:** Major jumps (React, Vite) affect the whole frontend.

### Backend runtime dependencies (express, pg, ws, decimal.js)

- **Upstream:** npm registry
- **License:** MIT/ISC family (npm metadata)
- **Pinned version:** see apps/backend/package.json and package-lock.json
- **Where:** apps/backend
- **Vendoring method:** npm dependencies, lockfile-pinned. Money math uses decimal.js.
- **Local Openfund modifications:** None.
- **Used by the running application:** yes
- **Tests:** npm run test:backend
- **Update procedure:** Security patches promptly; everything else in the scheduled grouped review. Never change decimal.js or pg majors without the full engine and economy suites.
- **Risks:** Trading engine, payments and Economy depend on these; keep updates small and fully tested.

### Repository tooling (Playwright, markdownlint, mermaid, jsdom, js-yaml)

- **Upstream:** npm registry
- **License:** MIT/Apache-2.0 family (npm metadata)
- **Pinned version:** see package.json (playwright is range-pinned; CI caches browsers per lockfile)
- **Where:** package.json (root)
- **Vendoring method:** npm devDependencies.
- **Local Openfund modifications:** overrides in package.json for markdownlint (re2js) and micromark-extension-math (katex).
- **Used by the running application:** no
- **Tests:** npm run docs:check; npm run test:release
- **Update procedure:** Scheduled grouped review; a Playwright bump also changes the browser cache key.
- **Risks:** Tooling only; never shipped.
