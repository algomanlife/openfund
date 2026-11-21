# Pine indicator optimization: performance and accuracy report

Branch `agent/claude/optimize-pine-indicators`, base `main` @ `1b05a2b9`.
Decision record: [ADR 0048](../../decisions/0048-pine-indicator-optimization-and-provenance.md).
All results below come from local runs. Nothing here has been deployed or
accepted in production.

## Method

- **Engine:** the same `@luxalgo/vela-pinets` 0.3.4 / PineTS 0.13.1 code
  that the browser runs inside `openfund-pine-worker`, run in-process in
  Node 26.13.0 on an Apple M4 (10 cores) with `--expose-gc`.
  - CPU time is in-process time, the equivalent of worker CPU time.
  - Main-thread blocking is out of scope here: the browser computes in the
    worker.
- **Fixture:** `syntheticBars(seed=7)`
  ([fixtures.mjs](../../../packages/openfund-charts/bench/fixtures.mjs)).
  - 1-minute bars starting 2026-01-05 00:00 UTC.
  - Repeating uptrend, downtrend, volatile and flat regimes; the flat regime
    includes zero-range candles.
  - No volume, like the Gains feed.
  - Secondary timeframes are UTC-aligned aggregations of the same bars.
- **Before/after:** both runs use the same machine and fixtures.
  `--ref 1b05a2b9` reads the baseline sources from git. Raw data:
  [bench-baseline.json](bench-baseline.json) and
  [bench-after.json](bench-after.json).
- **Reproduce:** `npm run bench:charts -- --ref <sha> --out file.json`.
- **Live mode:** a PineTS stream over a mutable bar array, the same provider
  contract as vela-pinets, polled every 5 ms.
  - Each of 20 cycles sends one mark update and then opens one new candle.
  - Wall time for a mark update includes a fixed ~1 s wait inside PineTS's
    stream loop, so its **CPU** time is reported instead.
  - New-candle latency is wall time.

## Results

#### Open Algo V5

| Metric | Bars | Before | After | Change |
| --- | ---: | ---: | ---: | ---: |
| Initial calculation (ms, median of 3) | 500 | 307 | 115 | −63% |
| Initial calculation (ms, median of 3) | 2000 | 1075 | 370 | −66% |
| Initial calculation (ms, median of 3) | 5000 | 2610 | 871 | −67% |
| Initial calculation (ms, median of 3) | 10000 | 5029 | 1688 | −66% |
| CPU time, initial (ms) | 10000 | 5955 | 2174 | −64% |
| Peak heap growth (MB) | 10000 | 508 | 153 | −70% |
| Drawings: lines/labels/boxes/tables | 10000 | 0/50/0/1 | 0/50/0/0 | |
| Secondary requests | all | 5 | 0 | |
| Prepare/compile (ms) | 10000 | 69 | 47 | |
| Live tick CPU p50/p95 (ms) | 2000 | 12/132 | 3.9/79 | −66% |
| Live new-candle latency p50/p95/p99 (ms) | 2000 | 16/21/21 | 10/12/12 | −34% |
| Live stream start (ms) | 2000 | 1078 | 427 | −60% |
| Heap growth after 40 live updates (MB) | 2000 | 3.9 | 2.3 | |

#### Price Action Concepts

| Metric | Bars | Before | After | Change |
| --- | ---: | ---: | ---: | ---: |
| Initial calculation (ms, median of 3) | 500 | 267 | 138 | −48% |
| Initial calculation (ms, median of 3) | 2000 | 1693 | 540 | −68% |
| Initial calculation (ms, median of 3) | 5000 | 4663 | 1288 | −72% |
| Initial calculation (ms, median of 3) | 10000 | 7100 | 2588 | −64% |
| CPU time, initial (ms) | 10000 | 8249 | 3037 | −63% |
| Peak heap growth (MB) | 10000 | 301 | 206 | −32% |
| Drawings: lines/labels/boxes/tables | 10000 | 473/460/18/2 | 473/460/18/2 | |
| Secondary requests | all | 7 | 3 | |
| Prepare/compile (ms) | 10000 | 61 | 42 | |
| Live tick CPU p50/p95 (ms) | 2000 | 19/149 | 14/101 | −23% |
| Live new-candle latency p50/p95/p99 (ms) | 2000 | 18/25/25 | 20/21/21 | +9% |
| Live stream start (ms) | 2000 | 1910 | 658 | −66% |
| Heap growth after 40 live updates (MB) | 2000 | -76.9 | -16.9 | |

#### Smart Money Concepts

| Metric | Bars | Before | After | Change |
| --- | ---: | ---: | ---: | ---: |
| Initial calculation (ms, median of 3) | 500 | 62 | 54 | −13% |
| Initial calculation (ms, median of 3) | 2000 | 264 | 228 | −13% |
| Initial calculation (ms, median of 3) | 5000 | 691 | 645 | −7% |
| Initial calculation (ms, median of 3) | 10000 | 1751 | 1492 | −15% |
| CPU time, initial (ms) | 10000 | 2133 | 1835 | −14% |
| Peak heap growth (MB) | 10000 | 138 | 144 | +5% |
| Drawings: lines/labels/boxes/tables | 10000 | 500/500/5/0 | 500/500/5/0 | |
| Secondary requests | all | 0 | 0 | |
| Prepare/compile (ms) | 10000 | 25 | 24 | |
| Live tick CPU p50/p95 (ms) | 2000 | 2.9/70 | 3.7/45 | +28% |
| Live new-candle latency p50/p95/p99 (ms) | 2000 | 8.4/13/13 | 10/12/12 | +19% |
| Live stream start (ms) | 2000 | 330 | 305 | −8% |
| Heap growth after 40 live updates (MB) | 2000 | -54.6 | -35.0 | |

#### All three together

| Bars | Before wall (ms) | After wall (ms) | Change | Before requests | After requests |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 1176 | 589 | −50% | 12 | 3 |
| 2000 | 3593 | 1452 | −60% | 12 | 3 |
| 5000 | 8943 | 3194 | −64% | 12 | 3 |

### Against the targets

| Target | Open Algo | PAC | SMC |
| --- | --- | --- | --- |
| ≥30% less initial calculation | Met (−63 to −67%) | Met (−48 to −72%) | **Not met** (−7 to −15%) |
| ≥25% less incremental calculation | Met (tick CPU −66%, candle −34%) | Partly (tick CPU −23%; new-candle latency unchanged within noise) | **Not met** (p50 within noise; p95 −36%) |
| Dashboard-only requests eliminated | Met (5 → 0) | — | — |
| No significant memory regression | Peak heap −70% | −32% | +5% (not investigated further) |

SMC's profile shows no script-level hotspot; its time is spread across
PineTS's per-bar runtime overhead. The remaining gain would need runtime
work, not script changes.

The CPU and latency figures are single-machine medians. Mark-update CPU p50
values of 3–4 ms are within noise.

## Accuracy and equivalence

**Differential checks against main.** These compare two implementations, so
they are not an independent reference.
[compare.mjs](../../../packages/openfund-charts/bench/compare.mjs) compares
canonical models: ids are removed, drawings are compared as multisets, floats
are rounded to 10 significant digits, and colours are ignored only on points
with no value.

- **Open Algo:** 13 configurations, from defaults to everything on, at 2,000
  bars. Identical, except that the dashboard table is gone and one TP1
  breakout label is now kept. Main lost that label to PineTS's object
  eviction, caused by its per-bar TP/SL churn.
- **PAC:** 9 configurations at 1,500, 3,000 and 6,000 bars. Identical,
  except:
  - Trendline Liquidity no longer throws (it crashed on main).
  - The previous-period levels are corrected.
  - At 6,000 bars two configurations keep 3–4 old structure lines that main
    evicted at the 500-line limit. Nothing else is lost.
- **SMC:** 7 configurations at 3,000 bars. Identical.

**Independent checks.** These are computed separately in JavaScript, in
[indicators.test.mjs](../../../packages/openfund-charts/test/indicators.test.mjs):

- The Open Algo trend channel matches an independent least-squares fit over
  the last 150 closes (relative tolerance 1e-6).
- PAC PDH/PDL equal the previous UTC day's aggregated high/low at four
  intraday cut points. They are anchored at the exact bar that set them.
- SMC higher-timeframe gaps never use a 5-minute candle that has not closed
  at the cut point.
- Missing volume reaches Pine as `na`; this test already existed.

The lookahead and liquidity tests fail on main.

**Live and static.** Streaming 6 mark updates and 3 new candles ends in
exactly the model of a fresh static run for:

- Open Algo with TP/SL, trend lines and S/R on;
- PAC defaults and PAC previous-day levels across a UTC day boundary;
- SMC higher-timeframe gaps.

So no stale or duplicated drawings build up. PAC Trendline Liquidity differs
between live and static on main as well as here; this is a known,
pre-existing limitation.

**Not available.** No TradingView reference output exists in the repository,
so authoritative parity with the reference Pine runtime is not claimed.
Real-time Gains (live provider) runs were not part of this report: every
result above uses deterministic fixtures.

## Intended behaviour corrections

| Indicator | Before | After | Visible effect |
| --- | --- | --- | --- |
| PAC previous day/week/month levels | `[high, low]`, `lookahead_on`, recovered via `valuewhen(..., 1)` | Last completed period, `[high[1], low[1]]` | Levels stay put during the current period. On main, a freshly loaded chart showed no PDH/PDL until two day boundaries were loaded, and a "previous week" level came from inside the current week |
| PAC Trendline Liquidity with MTF order blocks | Threw, so the indicator stopped | Runs | Feature usable |
| SMC higher-timeframe gaps | Third candle's final high/low at its first chart bar | Last completed candle (`lookahead_off`) | Same boxes in full history; each now appears when its third candle closes |

## Findings not changed (owner decision needed)

- **Open Algo TP/SL distances are fixed price amounts** (500/1000/1500 ×
  the "Risk Management" multiplier; SL 750 ×), not relative to price or ATR.
  They suit BTC-scale prices and are far too large or too small elsewhere.
  The strong-signal distances (`float tp1Dist = ...` inside
  `if valid_Sbull or valid_Sbear`) declare new local variables and never
  take effect. Fixing either changes every TP/SL drawing.
- The `signalStyle == "Pro V3"` branch is unreachable (no such option).
- Pivot-based structure (all three indicators) is confirmed `n` bars late
  and drawn back at the pivot bar. That is a structural delay, not future
  data.

## Runtime and integration

- The PAC compatibility patch is still required: without it PAC fails on
  PineTS 0.13.1 (`Cannot read properties of undefined`).
- No dependency upgrade and no Pine v6 migration was made. v6 support for
  every construct in use was not verified in this runtime.
- Worker lifecycle, generation handling and cancellation are unchanged: the
  bridge terminates engines on destroy, and Vela owns cancellation.
