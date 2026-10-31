# LuxAlgo Vela — Planned Chart Integration

## Goal

Evaluate use of LuxAlgo Vela charting components within Openfund's trading terminal, using market data compatible with the selected instruments and trading infrastructure.

## Work plan

1. Audit the upstream Vela repository, license, dependency tree, and deployment requirements.
2. Determine which charting and market visualization features are available in the open-source edition.
3. Evaluate a maintained fork only if changes to upstream code are required.
4. Define historical candle and live update adapters for supported markets.
5. Match chart symbols, timestamps, decimals, and trading pairs to Gains-supported markets.
6. Integrate charts into the terminal and validate responsive rendering and performance.
7. Evaluate advanced visualizations only where sufficient underlying data exists.

## Critical market-data limitation

A price oracle or candle feed is not equivalent to a central-limit-order-book depth feed or tick-by-tick aggressor trade data. Footprint, volume-at-price, bid/ask delta, and depth views require appropriate source data. Do not fabricate those metrics from price candles.

## Current status

**Evaluation / planned integration.** The project does not yet claim a completed Vela fork or working Gains-to-Vela adapter.

Upstream reference: https://github.com/LuxAlgo/Vela
Related optional project for evaluation: https://github.com/LuxAlgo/trade-journal
