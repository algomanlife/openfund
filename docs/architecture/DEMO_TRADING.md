# Simulated Prop trading architecture

The maintained product, formulas, fee/spread policy, risk limitations and order lifecycle are documented in [Prop Trading](../trading/PROP.md). This path is retained for existing references.

## Implementation map

| Module | Authority |
| --- | --- |
| `apps/backend/engine.js` | Account funding, orders, position lifecycle, locks, settlement and engine loop (dedicated pool of at most 3 connections for loop work) |
| `apps/backend/trading-stream.js` | `/trading/stream` fan-out: one fresh state computation per account scope shared by all its tabs, session check before every push ([ADR 0027](../decisions/0027-trading-stream-fan-out-and-engine-loop-isolation.md)) |
| `apps/backend/trading-math.js` | Decimal valuation, freshness, fee/spread policy and liquidation thresholds |
| `apps/backend/market-data.js` | Server-owned Gains marks, reconnection and tradeability |
| `apps/backend/portfolio.js` | Owned record queries, net analytics and sampled risk telemetry |
| `apps/backend/products.js` | Isolated product/account routes and private notebook |
| `apps/backend/schema.sql` | NUMERIC records, append-only financial ledger, idempotency and provenance fields |
| `apps/web-react/src/trading/TradingBridge.tsx` | Server state bridge to the shared terminal |

Authenticated Prop accounts use backend authority and SSE. Current product terminals do not fall back to a fabricated anonymous account. Legacy classic assets remain for compatibility but do not redefine the product account contract. Perpetual is a separate read adapter, not this engine.

Run backend regression suites against a dedicated database with `SIM_TEST_MODE=1` only in local tests. See [Development](../development/LOCAL_DEVELOPMENT.md) and [Testing](../development/TESTING.md). Preserve historical ledger rows; migrations are additive and idempotent.

[Trading lifecycle](FLOWS.md#trading-lifecycle) · [Valuation ADR](../decisions/0003-trading-valuation-and-product-wallets.md)
