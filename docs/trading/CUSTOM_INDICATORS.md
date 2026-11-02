# Adding custom indicators

Keep source, dependency resolution, runtime compatibility, catalog registration, calculations, rendering and saved settings separate. Extend the shared chart package once for both products. Never copy financial state into an indicator engine.

1. Add the original `.pine` file under [indicators](../../indicators/README.md), preserving provenance and license terms. Inspect all imports, source inputs, historical state, requests and rendering constructs.
2. Add only necessary libraries to the resolver allowlist in [pine-sources.mjs](../../packages/openfund-charts/src/pine-sources.mjs). Use valid Pine import identifiers resolved by the runtime. Unknown dependencies must fail clearly. Validate exports/signatures against every alias access.
3. Import the source in [workspace-entry.ts](../../packages/openfund-charts/src/workspace-entry.ts) and add a catalog entry. Preserve the first three proprietary entries and the built-in order. Libraries never enter the manifest. Start new entries disabled unless a separately approved default requires them.
4. Execute the original source on captured OHLC and real provider-backed secondary data. Confirm inputs, nonempty calculated series/drawings, live changes and data availability. Add a targeted regression that fails without the feature. Runtime compatibility patches require an exact reproducer and a calculation-preserving fallback; do not invent formulas.
5. Test add/remove, settings, theme, symbol/interval switches, reload, product separation and responsive menus using actual browser clicks. Verify computed visibility and output; a catalog name is insufficient.
6. Build and run the checks below. Update source inventory, feature status, roadmap and delivery evidence. Document unsupported constructs and missing upstream data explicitly.

```bash
npm ci
npm ci --include=dev --prefix apps/web-react
npm run test:charts
npm run typecheck
npm run test:web
npm run build:web
npm run test:browser:charts
npm run validate:blueprint
npm run docs:check
```

The browser command defaults to a local frontend at port 5197 and controlled market fixtures. Set `TEST_FRONTEND_URL` for another frontend. Set `CHART_TEST_LIVE=1` for live Gains acceptance and screenshots; network/provider availability then becomes part of the result. See [testing](../development/TESTING.md) for the isolated backend and existing browser audit suite.

Install vendored Vela's development dependencies separately to run its `typecheck`, `lint`, `test -- --maxWorkers=2` and `build` gates. Do not add the Pine dependency to the Vela core; it belongs to the host web application. Preserve upstream licenses and a visible linked Vela notice wherever a chart renders.

[Pine architecture](PINE_SCRIPT.md) · [Indicator catalog](INDICATORS.md) · [Delivery evidence](../reviews/vela-pine/DELIVERY.md)
