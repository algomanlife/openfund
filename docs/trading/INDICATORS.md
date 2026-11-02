# Terminal indicators

Both Prop and Perpetual use the same catalog, engine factory and renderer. Financial accounts and product adapters remain separate.

## Catalog

The Indicators dialog lists **Open Algo V5**, **Price Action Concepts**, then **Smart Money Concepts** at the start of its Openfund catalog. All 77 built-ins follow in their existing alphabetical order. Active instances appear in a separate on-chart card. Library files are never registered as indicators. Search uses the displayed catalog names; clicking a row adds an instance, and the trash button removes it. Multiple instances are intentionally supported; the catalog itself contains no duplicates.

The three proprietary entries start disabled. Their preserved sources declare 79, 49 and 52 inputs respectively. Double-click an indicator's chart legend title to open settings, or hover its title and use the gear. Vela's settings UI receives the runtime input schema, including source options, groups, bounds and defaults. Original source titles/shorttitles and drawing styles are retained; the picker uses the requested product names.

## Rendering and lifecycle

PineTS calculates original source; the addon translates output to Vela series, fills, backgrounds, candle colors, lines, labels, boxes, polylines and tables. It does not execute orders. The workspace orchestrator recalculates after market switches and settings edits; the worker maintains live series state between ticks. The chart receives actual Gains candles and provider-backed secondary requests.

Indicator instances, edited values, market, style and renderer preferences persist in product-specific `of-chart-v2-*` keys. Position drawings are removed from that workspace snapshot; existing symbol drawing persistence remains owned by the terminal. The financial/account adapters are not persisted by this feature. Storage-denied environments continue without durable reload support.

## Data and runtime limits

Gains supplies OHLC without volume. Pine receives missing volume as `na`, never invented zero volume. Volume-dependent components cannot become fully functional without a genuine volume source. Weekly/monthly and additional supported intraday requests aggregate actual smaller candles in UTC, without interpolating missing bars. Available history bounds warm-up and higher-timeframe coverage.

These indicators contain source-defined lookahead and historical behavior. Their names do not imply non-repainting output. Local differential tests establish unchanged behavior under the selected runtime, not universal equivalence to another Pine platform. Unsupported resolutions and module names produce clear errors/warnings; there is no one-hour fallback.

[Pine architecture](PINE_SCRIPT.md) · [Custom indicators](CUSTOM_INDICATORS.md) · [Terminal](TERMINAL.md) · [Validation evidence](../reviews/vela-pine/DELIVERY.md)
