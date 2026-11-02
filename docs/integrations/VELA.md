# Vela chart integration

**Status: In Progress for complete proprietary-indicator acceptance.** Local implementation is based on `main` `08cb68a`, 2026-11-02. Deployment and independent Pine reference conformance remain unverified.

## Shared workspace

The classic terminal and shared React product frame mount the full **Vela 0.9.3 workspace**: native timeframe/style/indicator controls, drawing toolbar, status line, bottom bar, settings, popovers and keyboard interactions. It remains the existing chart foundation. [build-charts.mjs](../../scripts/build-charts.mjs) builds the vendored sources, the host Pine addon and the source manifest into `window.VelaWorkspace`.

The host installs **@luxalgo/vela-pinets 0.3.2** and **pinets 0.13.1**. Its hosted worker, local-library resolver and original-source manifest serve both Prop and Perpetual. The core remains free of Pine runtime imports. A narrow PAC compatibility adapter uses full secondary execution to avoid an upstream nested-request slice bug. Original algorithms and all five supplied source files remain unchanged.

Open Algo V5, Price Action Concepts and Smart Money Concepts precede all 77 built-ins. Input schemas, settings edits, scene conversion, historical evaluation and live sessions use the official addon and Vela's existing orchestration. See [Pine architecture](../trading/PINE_SCRIPT.md) for the export inventory, exact import transformation, supported constructs and limits.

## Market-data and controller contract

The bar shape remains `{ time, open, high, low, close, volume? }`: epoch milliseconds, ascending open time. Gains supplies OHLC but no volume. The Pine wrapper preserves missing volume as `na`. The provider supplies main candles, subscriptions, market metadata and secondary requests. Additional supported intraday intervals and UTC Monday/calendar-month bars aggregate genuine smaller candles without interpolation.

The [bridge](../../packages/openfund-charts/src/vela-bridge.js) exposes `mount`, `setSymbol`, `setTimeframe`, `setMarket`, `setTheme`, `setLocale`, `resize`, `on`, `chart`, `workspace` and `destroy`. It uses `layout:false`, the Gains provider, seven canonical toolbar intervals, brand theme objects and one worker factory per chart. Current light mode retains the existing host inversion; no redesign is introduced.

`market:changed` synchronizes committed symbols and timeframes with terminal state. Product-specific workspace keys preserve chart/indicator settings; position drawings are excluded from those snapshots. Financial context, Gains wallet reads, Prop execution and account schemas remain unchanged. Controller destruction disconnects resize observation and terminates workers.

## Interaction repairs

Browser reproduction showed that machine re-projection removes the menu positioner's inline z-index after hover. Its isolated stacking context then falls beneath the price canvas, which intercepts clicks. A scoped rule in the menu component preserves stacking. Timeframe and style choices now receive actual pointer clicks. Canonical Pine resolutions prevent lowercase `1m` being displayed as the calendar-month label `1M`.

The legacy symbol handler changed display text but omitted `S.marketId`; the actual selection now commits before dependent chart display refreshes. Its misplaced drawing-restore timer is scoped to the selection handler. Committed interval events update `S.tf`. Loading overlays respect `hidden` and cannot intercept unrelated controls. Unknown provider resolutions no longer silently substitute one-hour data.

## Product branding and license notices

The indicator picker no longer labels native instances VELA. The chart footer link is removed. The shared chart attribution mark is disabled through the public `registerRendererDefaults({attribution:false})` seam; an equivalent visible linked Vela notice appears in terminal status on every chart screen. This honors the checked-in [NOTICE](../../vendor/vela/NOTICE), which explicitly forbids hiding attribution without an equivalent linked notice. It does not use destructive string replacement or CSS hiding of required attribution.

Vela LICENSE/NOTICE remain intact. PineTS and its addon are AGPL-3.0; readable license copies are emitted under public `assets/notices/`. Preserve corresponding-source availability with distribution. The supplied Pine sources are delivered to the browser and are not secret server code.

## Build and validation

The web `prebuild`/`predev` step emits the shared bundle and hosted worker and mirrors authoritative chart/provider adapters to classic and React public paths. Render uses its existing frontend build; no environment variable, secret or resource was added.

Run `npm run test:charts`, `npm run test:browser:charts`, TypeScript/frontend/backend suites, production build, existing browser audit and Blueprint validation. The vendored library retains its typecheck, lint, unit-test and package-build gates. [Delivery evidence](../reviews/vela-pine/DELIVERY.md) records exact outcomes and screenshot provenance. Configuration, local verification and production deployment remain separate claims.

[Indicator usage](../trading/INDICATORS.md) · [Custom extensions](../trading/CUSTOM_INDICATORS.md) · [Upstream source](https://github.com/LuxAlgo/Vela)
