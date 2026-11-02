# ADR 0005: Original Pine source execution in the shared terminal

**Status:** Accepted for local implementation; release acceptance remains open.

## Context

Three supplied Pine v5 indicators require original calculation/state semantics, local library resolution and rich drawing output. Vela 0.9.3 provides a scripting port and native indicators but no Pine engine. Rewriting formulas or substituting simplified indicators would violate the product contract.

## Decision

Use the official pinned Pine addon in a hosted worker, with an allowlisted source resolver and reproducible import-ID transformation. Keep original source files unchanged. Add source studies before native catalog entries while retaining native order and add/remove index consistency. Persist chart settings per product and exclude account position drawings.

Use PineTS's existing full-script secondary path for the supplied PAC script because its nested request is incorrectly truncated by the optimizer. Keep this compatibility fix separate from the indicator algorithm and guard worker generation against package drift. Preserve unavailable volume as Pine `na`; derive additional timeframes only by standard OHLC aggregation of genuine provider candles.

Remove optional native badges and chart footer branding. Reposition the NOTICE-required linked attribution to terminal status through public renderer defaults. Preserve all third-party notices and ship Pine runtime license copies.

## Consequences

Both products share one chart/runtime implementation without changing financial authority. Worker computation keeps menus responsive. PAC secondary execution costs more than slicing. Original Pine/lookahead behavior and provider history/volume limits remain; local tests are not an independent universal Pine conformance certificate. AGPL runtime distribution and corresponding-source obligations accompany any release.

[Architecture](../trading/PINE_SCRIPT.md) · [Validation evidence](../reviews/vela-pine/DELIVERY.md)
