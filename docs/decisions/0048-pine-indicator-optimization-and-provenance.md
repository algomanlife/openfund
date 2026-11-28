# ADR 0048: Pine indicator optimization, lookahead corrections and provenance

**Status:** Accepted for local implementation; human review, browser
acceptance on a deployed build and the licence decision remain open.

Amends [ADR 0005](0005-proprietary-pine-runtime.md), which kept the supplied
Pine sources unchanged.

## Context

Open Algo V5, Price Action Concepts (PAC) and Smart Money Concepts (SMC) ran
as supplied. Measurements on main @ `1b05a2b9` showed avoidable cost. Open
Algo computed every optional overlay on every bar, and its SMRT Algo
dashboard made five secondary requests. PAC made seven secondary requests by
default. Review also found three behaviour defects:

- PAC previous-period levels read `[high, low]` with `lookahead_on`.
- PAC's Trendline Liquidity threw inside the higher-timeframe order-block
  requests.
- SMC's higher-timeframe fair value gaps read the third candle's final
  high/low before that candle closed.

The owner asked for the dashboard to be removed and for the indicators to be
optimized, corrected and published as open source.

## Decision

1. Edit the indicator sources. Only Open Algo's two import IDs are still
   rewritten at load time.
2. Remove the Open Algo dashboard entirely: its inputs, table and requests.
   Strip its retired input keys from saved workspaces in the bridge
   (`migrateWorkspaceState`).
3. Optimize only where a canonical-model comparison against main shows
   identical chart output for every tested configuration. Allowed techniques:
   - gating on an input, which is constant for a run, so Pine state stays
     consistent;
   - drawing on the last bar only, for objects that were replaced on every bar;
   - single tuple requests;
   - requesting the chart's own series when a feature is off.
4. Correct lookahead as intentional behaviour changes, each with a test that
   fails on main. Use the last completed period, never the forming one.
5. Keep the PAC runtime compatibility patch: without it, PineTS 0.13.1 still
   fails on PAC. Keep Pine v5, and Vela 0.10.6 / vela-pinets 0.3.4 /
   PineTS 0.13.1. No upgrade or v6 migration was required, and none was
   verified as safe.
6. Do not relicense. The owner asserts authorship, but the repository holds
   evidence of third-party origin and no authorship records. The Apache-2.0
   change is prepared in
   [LICENSING.md item 3](../legal/LICENSING.md#pine-indicator-sources).

## Consequences

- Runtime cost falls substantially. Results are in the
  [performance and accuracy report](../reviews/pine-optimization/README.md).
- Default secondary requests: Open Algo 5 → 0, PAC 7 → 3, SMC 0.
- 29 configuration snapshots now guard against unintended output changes;
  regenerating them is a reviewed act.
- PAC levels and SMC higher-timeframe gaps change their timing: they now
  appear once data is complete. Users see levels that no longer move during
  the current period.
- The indicators remain observational; nothing feeds orders, accounts or risk
  controls.
- Licensing for `indicators/` was settled on 2026-11-28 by
  [ADR 0066](0066-indicator-ownership.md): Openfund owns the sources and
  publishes them as open source.
