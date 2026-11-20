# Openfund Pine sources

Three Pine Script v5 indicators and two local libraries. They run unchanged in
syntax inside the shared Vela workspace through the official PineTS worker
addon. Nothing is translated into JavaScript.

| Kind | File | Catalog name | Inputs |
| --- | --- | --- | --- |
| Indicator | [Open algo v5.pine](Open%20algo%20v5.pine) | Open Algo V5: Buy/Sell signals, Smart Trail, TP/SL levels, optional S/R, Supply/Demand, Market Structure, trend lines, reversals, ribbons, retest zone | 76 |
| Indicator | [pac v1.pine](pac%20v1.pine) | Price Action Concepts: internal/swing structure, BOS/CHoCH, multi-timeframe order blocks, liquidity, equal highs/lows, previous-period levels, structure scanner | 49 |
| Indicator | [smc-v1.pine](smc-v1.pine) | Smart Money Concepts: internal/swing structure, order blocks, equal highs/lows, fair value gaps, multi-timeframe levels, premium/discount zones, alerts | 52 |
| Library | [Overlayslibrary.pine](Overlayslibrary.pine) | Supplies `getSmartTrail` to Open Algo | — |
| Library | [sdk.pine](sdk.pine) | Kernel functions; imported by Open Algo but unused | — |

Only the three indicators are selectable. They lead the catalog, start
disabled and are observational: no signal is connected to orders, accounts,
risk limits or payouts. TP/SL drawings are chart annotations, not orders.

## Behaviour changes in the optimization pass (November 2026)

Measured and verified in [docs/reviews/pine-optimization](../docs/reviews/pine-optimization/README.md).

- **Open Algo:** the former SMRT Algo dashboard is removed. That covers its
  three inputs, its table and the five higher-timeframe requests it needed.
  Saved workspaces that still carry `enableDashboard`, `locationDashboard` or
  `sizeDashboard` load normally: the bridge strips those keys
  (`migrateWorkspaceState`). Disabled overlays no longer compute, and
  objects that were redrawn on every bar are drawn on the last bar only. The
  chart output is otherwise identical.
- **Price Action Concepts:** previous day/week/month levels use the last
  *completed* period. The old `lookahead_on` request of `[high, low]` read the
  forming period's final values on history and its running values live.
  Trendline Liquidity no longer crashes when the multi-timeframe order blocks
  are enabled. Default secondary requests fall from 7 to 3.
- **Smart Money Concepts:** fair value gaps on a higher timeframe are
  confirmed when the third candle closes (`lookahead_off`). Before, the
  candle's final high/low was read at its first chart bar. Gaps on the chart
  timeframe, the default, are unchanged.

## Local dependencies

`localizeOpenAlgo` changes exactly two import IDs in memory:

```pine
import openfund/Overlayslibrary/1 as LAF
import openfund/sdk/1 as kernels
```

These are resolver keys served from an allowlisted source map, not
filesystem paths or published libraries. The original import declarations
stay in the source file. No external library is fetched; unknown modules and
unexpected import declarations fail explicitly. The only imported symbol in
use is `LAF.getSmartTrail(10, 4, 8)`, returning
`[series float line1, series float Fib2, series string state]`.

## Data limits

The Gains candle feed has no traded volume. The adapter passes volume as Pine
`na`; it is never invented or set to zero, so volume-based values (PAC's
order-block volume figures, Open Algo's VWMA filter option) are unavailable. Higher timeframes are
standard OHLC aggregation of genuine Gains candles.

## Licence and provenance

**Unresolved.** The owner states that these sources are owner-controlled and
should be open source. The repository does not yet contain evidence that every
file is wholly owner-authored, and several files carry signs of third-party
origin:

- `smc-v1.pine` declares *CC BY-NC-SA 4.0* with "© Openfund". That is a
  non-commercial ShareAlike licence. Its structure and comments closely
  resemble a widely published third-party Smart Money Concepts script that is
  distributed under the same licence.
- `pac v1.pine` has no licence header. Its title says "Open source" and its
  scanner shows "SDK © Algoman.life". "Price Action Concepts" is also the
  name of a commercial third-party product.
- `sdk.pine` describes itself as a kernel library for Nadaraya–Watson
  estimators, in the wording of a published third-party library.
- Open Algo originally imported libraries named `ayvaliktrading/...`.

Until the owner provides authorship records or the original upstream
licences, no file here is relabelled, and the existing CC BY-NC-SA notice
stays. The prepared change, which applies Apache-2.0 only to the files proven
owner-authored, is in [the licensing record](../docs/legal/LICENSING.md#pine-indicator-sources).
The PineTS runtime (AGPL-3.0-only) and Vela (Apache-2.0 with NOTICE) have
their own terms, independent of these sources.

## Tests

```bash
npm run test:charts
```

Covers 29 configuration snapshots, the dashboard removal and migration,
lookahead regressions, independent calculation checks and live-stream
convergence. Run `npm run test:browser:charts` against a running frontend
for real browser rendering. `npm run bench:charts` reproduces the benchmark.
See also the [runtime architecture](../docs/trading/PINE_SCRIPT.md),
[catalog and settings](../docs/trading/INDICATORS.md) and the
[extension procedure](../docs/trading/CUSTOM_INDICATORS.md).
