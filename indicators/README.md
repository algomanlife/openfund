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

## Ownership and licence

Openfund owns these three indicators and two libraries and publishes them as
open source (owner decision, 2026-11-28,
[ADR 0066](../docs/decisions/0066-indicator-ownership.md)).

| File | Licence |
| --- | --- |
| `Open algo v5.pine`, `pac v1.pine`, `Overlayslibrary.pine`, `sdk.pine` | Apache-2.0, "Copyright 2026 Openfund" ([LICENSE](LICENSE)) |
| `smc-v1.pine` | CC BY-NC-SA 4.0, "© Openfund", as stated in the file |

Keep each file's header when you copy or change it. The PineTS runtime
(AGPL-3.0-only) and Vela (Apache-2.0 with NOTICE) have their own terms,
independent of these sources. The earlier provenance review is kept as a
[historical record](../docs/legal/history/PINE_PROVENANCE_REVIEW_2026-11.md).

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
