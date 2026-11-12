# ADR 0024 — Hybrid footprint chart (Gains price, Hyperliquid order flow)

- **Status:** Accepted (implementation; deployment pending owner approval, flag off by default)
- **Date:** 2026-11-12

## Context

Traders asked for a footprint (volume-at-price by aggressor side) on the
terminal chart. Gains Network is the authoritative price and candle source
for the terminal and the trading engine, but Gains publishes no executed
aggressor trades: its oracle marks and depth figures cannot produce a
footprint, and [AGENTS.md](../../AGENTS.md) forbids inferring footprint data
from oracle feeds. Hyperliquid publishes every executed trade with its
aggressor side on a public WebSocket, including HIP-3 markets for gold,
silver and major FX pairs.

## Decision

- Gains stays the only source of the chart's price, candles, market list
  and of everything the trading engine, accounts and payments use.
- Hyperliquid executed trades feed the footprint only, read-only. They are
  combined with the Gains chart in the chart's renderer layers and nowhere
  else. No Hyperliquid value can reach the engine, a position, PnL, drawdown
  or evaluation: the footprint module imports none of them and exposes no
  write endpoint (enforced by a backend test).
- Footprint rows keep their exact Hyperliquid price. They are never shifted
  onto the Gains price. A per-market price compatibility validator compares
  the last trade of each bar with the Gains close, against limits derived
  from measured basis data. The footprint is shown, flagged or hidden; prices
  are never adjusted.
- One backend service per process ingests trades over ONE shared upstream
  WebSocket, stores exact one-minute per-price slices (integer price units and
  size lots), serves history for any chart timeframe by summing those slices,
  and fans live slices out over Server-Sent Events.
- The Vela integration uses only the public plugin SDK: a `footprint` chart
  type with a data engine and renderer layer (Mode A), and a
  `footprint-overlay` native indicator with its own layer (Mode B). No vendored
  Vela file is modified. Settings persist inside the existing per-wallet chart
  workspace ([ADR 0023](0023-per-wallet-chart-workspaces.md)).
- `FOOTPRINT_ENABLED` (default off) gates the whole feature on the server and,
  through the public runtime config, in the browser.

## Consequences

- History exists only from the moment the service starts capturing trades.
  Hyperliquid's only official historical fills are in a requester-pays S3
  bucket. Importing them needs owner-provided AWS credentials and a format
  check against real files. Until then, older bars show no footprint and
  capture gaps are recorded, never filled.
- A Gains market without a verified Hyperliquid market shows the footprint
  as unsupported. The candle chart is unaffected.
- Additive schema (`footprint_minutes`, `footprint_gaps`), optionally in a
  dedicated database. Rollback: set `FOOTPRINT_ENABLED=0` (no deploy needed),
  or deploy the previous release; the tables are then unused.

[Footprint integration](../integrations/FOOTPRINT.md)
