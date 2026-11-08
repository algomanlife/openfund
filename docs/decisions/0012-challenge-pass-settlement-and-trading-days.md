# ADR 0012 — Challenge pass settlement value and trading-day definition

- **Status:** Accepted (local implementation)
- **Date:** 2026-11-08

## Context

The Rulebook measures profit targets on closed net profit, and a challenge pass
settles every open position at the server mark. The engine passed on the
closed profit before settlement, so an open losing position could be realized
below the target after the pass. Minimum trading days were counted from order
creation dates, which credited a pending order's placement day. Settlement
silently skipped positions in closed markets. The [engine audit](../audits/PROP_ENGINE_AUDIT.md)
reproduced each case.

## Decision

1. `accountMetrics()` exposes `settlement_balance`: the balance after closing
   every open position at the current mark, with exit spread and closing fee.
   It uses the same formula as `#closeTx`.
2. A pass requires closed net profit ≥ target **and**
   `settlement_balance − starting balance ≥ target`, with every open position
   settleable now (fresh mark, open market). Otherwise the pass waits.
3. A trading day is a distinct UTC+3 day with at least one order **fill**,
   counted from root position `opened_at`.
4. A breach is recorded when detected. Positions that cannot be settled at that
   moment are settled by the engine loop with reason `challenge_settlement`
   as soon as their market is tradeable.

Loss limits, percentages, the day boundary and the trailing formula are
unchanged.

## Consequences

The final closed profit of a passed challenge always meets its target. A trader
holding a losing position past the target passes only after it recovers or
closes. No schema migration is needed. Whether the trailing floor should
freeze at breakeven remains an open product decision (audit F6).

[Decisions](README.md) · [Prop Trading](../trading/PROP.md)
