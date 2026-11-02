# Openfund proprietary Pine sources

These five user-supplied Pine v5 files entered `main` at `890781f`. The implementation preserves them byte-for-byte; generated runtime source is separate.

| Kind | File | Catalog name / purpose |
| --- | --- | --- |
| Indicator | [Open algo v5.pine](Open%20algo%20v5.pine) | Open Algo V5; signals, optional overlays, Smart Trail and dashboard; 79 inputs |
| Indicator | [pac v1.pine](pac%20v1.pine) | Price Action Concepts; internal/swing structure, liquidity, order blocks and scanner; 49 inputs |
| Indicator | [smc-v1.pine](smc-v1.pine) | Smart Money Concepts; structure, order blocks, equal highs/lows and optional gaps/levels; 52 inputs |
| Library | [Overlayslibrary.pine](Overlayslibrary.pine) | Eight overlay/metric exports; supplies the used `getSmartTrail` function |
| Library | [sdk.pine](sdk.pine) | Four Nadaraya–Watson kernel exports; the imported alias is unused in the supplied indicator |

Only the first three are selectable. The catalog keeps this order, followed by all existing built-ins. Inputs, defaults, plots and drawing settings remain in the original source.

## Local dependencies

`localizeOpenAlgo` changes exactly two import IDs in memory:

```pine
import openfund/Overlayslibrary/1 as LAF
import openfund/sdk/1 as kernels
```

These are Pine import identifiers resolved by the host's allowlisted source map, not filesystem paths or externally published libraries. Original imports remain in the preserved source. No external library fetch occurs. Unknown/missing modules and unexpected original import declarations fail explicitly.

The only accessed imported symbol is `LAF.getSmartTrail(10, 4, 8)`. Its local signature is `(int ATRPeriod, int ATRFactor, int smoothing)` and its return is `[series float line1, series float Fib2, series string state]`. There are no imported types or constants. `kernels` has no symbol accesses. Mapping the unused alias to `sdk` preserves that absence; this is not a claim of equivalence to unpublished external library contents.

## Execution and verification

The shared Vela workspace uses the official Pine worker addon, a narrowly scoped PAC runtime compatibility fix and the existing Gains provider. Never translate these sources into guessed formulas. Volume is unavailable from the current candle feed; the adapter preserves Pine `na`, so volume-based outputs may remain unavailable.

Run `npm run test:charts` and `npm run test:browser:charts` after installing root and web dependencies. The browser suite needs a running frontend; use `CHART_TEST_LIVE=1` for genuine market captures. See [runtime architecture and export inventory](../docs/trading/PINE_SCRIPT.md), [catalog/settings](../docs/trading/INDICATORS.md), [extension procedure](../docs/trading/CUSTOM_INDICATORS.md) and [delivery evidence](../docs/reviews/vela-pine/DELIVERY.md).
