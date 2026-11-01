# Audit — Demo Trading Platform (100,000 DAI)

> Audit date: 2026-11-01 · Branch: `qwen/demo-trading` (stacked on `qwen/wallet-identity`, PRs #8/#10 pending)
> **RESUME FILE for the demo-trading task.** Continue from the first unchecked item.

## Subsystem status (before this task)

| # | Subsystem | Status | Evidence |
|---|---|---|---|
| 1 | React/Vite app + terminal page | **Working & tested** | E2E 18/18 dev+build; terminal renders, language/theme work |
| 2 | Vela chart workspace | **Working & tested** | Full workspace on real candles; NOTICE attribution |
| 3 | Gains market data (CLIENT side) | **Working & tested** | browser adapter `dist/gains-adapter.js`: 488 markets REST, WS ~90 upd/s, ping/pong, seq-gap resubscribe |
| 4 | Gains market metadata | **Working (client)** | per-market maxLeverage, funding, OI, spread, CLOSED state; no hardcoded list |
| 5 | RainbowKit + SIWE auth + users | **Working & tested** | backend `/auth/*` 22/22 + session E2E 11/11; one wallet = one user (UNIQUE) |
| 6 | PostgreSQL | **Working** | openfund_users / challenges / plans / sessions / nonces / audit; Directus-tracked |
| 7 | Directus backstage | **Working** | CMS (489 strings, live edit) + user admin views; public policy private on identity tables |
| 8 | **Server-side market data** | **Missing** | Gains feed lives only in the browser — the backend has no prices (blocks server-side execution) |
| 9 | **Persistent demo accounts** | **Missing** | no demo_account table; the 100k credit does not exist |
| 10 | **Server trading engine** | **Missing** | `dist/terminal-data.js` TradingProvider is a client-side demo engine — positions/PnL exist only in browser memory, lost on refresh |
| 11 | Terminal trading panels | **Partial (client-sim only)** | account/positions/orders/history panels render from the client engine — fake persistence, no server authority |
| 12 | Ledger / decimal accounting | **Missing** | floats in the client engine; no ledger, no idempotency |
| 13 | Live updates (server→client) | **Missing** | prices live client-side; account/positions never update from a server |

## Gaps → implementation plan (matches master-prompt priorities)

1. **Server market-data service** (`apps/backend/market-data.js`): REST bootstrap (/markets, /prices) + WS prices channel with the verified protocol → authoritative in-memory marks with staleness tracking. Test seam: inject synthetic prices.
2. **Schema** (`schema.sql` extension): `demo_accounts` (unique one free_demo per user, NUMERIC(24,10)), `trading_orders`, `trading_positions`, `trading_ledger` (append-only, balance_after), `trading_events` (engine audit + price evidence). decimal.js for all money math.
3. **Funding**: on first SIWE login → atomic, idempotent account creation + single `demo_funding` ledger event of exactly 100,000 DAI (DB constraint prevents duplicates; concurrent-safe).
4. **Engine** (`engine.js`): market/limit/stop orders, SL/TP updates, close, liquidation monitoring — loop over server marks, transactional updates, idempotency keys, stale-price rejection, ownership checks. Documented simulation assumptions (fees/spread/liq rules — Gains does not publish execution params).
5. **API + SSE stream**: `/trading/*` routes (auth-guarded) + `/trading/stream` SSE pushing account/positions/orders near-real-time.
6. **Terminal bridge**: when authenticated, the legacy panels read from the backend (server-authoritative); the client demo engine remains only for unauthenticated visitors (clearly labelled).
7. **Directus**: trading tables tracked, financial fields readonly, public NO permission.
8. **Tests**: engine unit tests (with synthetic prices) + the 17-step acceptance scenario E2E + regressions.

## Documented simulation assumptions (Gains does not provide these)

| Parameter | Assumption | Rationale |
|---|---|---|
| Execution price | server mark price at processing time (no slippage) | deterministic, auditable; no tick data exists |
| Opening/closing fee | 0.05% of notional each side (configurable `SIM_FEE_PCT`) | Gains fee metadata is not part of the public API — clearly marked assumption |
| Liquidation | position closed when `margin + unrealized ≤ 10% of margin` (maintenance level, configurable) | standard prop-demo convention; NOT claimed Gains parity |
| Limit/Stop trigger | mark crosses the target (no wick data) | marks are the only authoritative price stream |
| Funding | not simulated in v1 (shown `—`) | funding rates exist but accrual semantics are chain-specific |

## Progress checklist (resume)

- [x] Phase 0 — this audit
- [x] 1. Server market-data service (market-data.js: REST bootstrap + WS with verified protocol, seq-gap resync, 60 s REST resync, staleness)
- [x] 2. Trading schema + funding (schema.sql: NUMERIC(24,10), UNIQUE one free_demo per user; 100k single ledger event, atomic + concurrent-safe)
- [x] 3. Trading engine (engine.js: market/limit/stop, SL/TP, liquidation, decimal.js, idempotency, per-account locks, 1 s loop browser-independent)
- [x] 4. Trading API + SSE (auth-guarded /trading/*, SSE pushes state changes only)
- [x] 5. Terminal UI bridge (TradingBridge → window.__ofServerTP; terminal swaps provider on of-trading-ready; async submit/close/cancel/SLTP)
- [x] 6. Directus (demo_accounts/positions/orders/ledger tracked, ALL financial fields readonly, public policy: no permission — verified)
- [x] 7. Tests: engine suite 52/52 · acceptance E2E 17/17 · regression 18/18 + r6 9/9 + session 11/11 (dev AND build)
- [x] 8. Docs: DEMO_TRADING.md, README, CHANGELOG, FEATURE_STATUS, TECH_STACK
- [x] 9. PR (this branch → qwen/wallet-identity)
