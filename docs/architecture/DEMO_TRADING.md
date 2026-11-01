# Demo trading platform — architecture & rules

## What it is

Every authenticated Openfund user gets **one free demo trading account with
100,000 virtual DAI**. Trading is simulated **server-side** on live Gains
Network market data: server-authoritative execution, persistent positions,
orders, SL/TP and liquidation monitoring that keeps running with the browser
closed. No blockchain transactions, no real funds — the DAI balance is
virtual accounting collateral.

## Architecture

```text
browser (React terminal)                 Openfund backend (Node 22)
┌──────────────────────────┐             ┌──────────────────────────────────┐
│ Vela chart + Gains marks │             │ market-data.js                   │
│ TradingBridge (SSE)  ←───────────────── │  REST /markets /prices           │
│  window.__ofServerTP     │   /trading/* │  WS prices (ping/pong, seq-gap)  │
│  positions/orders/       │   SSE stream │  → authoritative marks (+ tests) │
│  account panels          │             │ engine.js (1 s loop)             │
│ legacy client engine only│             │  orders → fills → ledger         │
│ for unauthenticated (demo)│             │  pending / SL / TP / liquidation │
└──────────────────────────┘             │  decimal.js money math           │
                                         │ PostgreSQL (NUMERIC 24,10)       │
                                         └──────────────────────────────────┘
```

- The frontend NEVER submits execution prices and never computes authoritative PnL.
- The engine monitors open positions **independently of any browser** (1 s loop).
- Live updates reach the terminal via SSE (`/trading/stream`) — only actual
  state changes are pushed.

## Account rules (v1)

- Free registration; exactly ONE `free_demo` account per user (DB UNIQUE).
- Funding: a single auditable `demo_funding` ledger event of 100,000.00 DAI,
  atomic with account creation, idempotent, concurrent-safe.
- No deposits, no withdrawals, no resets, no refills; suspended users cannot trade.
- All trades stay associated with their original account permanently.

## Execution simulation rules (documented assumptions)

Gains' public API provides prices/metadata but not execution parameters —
these assumptions are explicit, configurable, and NOT claimed as Gains parity:

| Rule | Value | Class |
|---|---|---|
| Opening fee | per asset class on notional: BTC/ETH 0.035%, crypto 0.05%, forex 0.012%, fallback 0.06% (stocks/indices/commodities) | A (doc) / B fallback |
| Closing fee | same tier on the **initial** notional (margin × leverage) — "fees are always applied on the initial position size" | A (doc) |
| Fixed spread | applied to the mark on execution: BTC/ETH 0.005%/side, most crypto 0%, forex 0.005%, commodities 0.02%, fallback 0.01% (long opens above mark and closes below it; short mirrored) | A (doc) / B fallback |
| Limit/Stop fill | at the trader's target price, no extra spread | B (documented) |
| Position size | notional = leverage × collateral; fees do NOT shrink the size (v10 behaviour — charged separately) | A (v10 changelog) |
| Liquidation | margin + unrealized ≤ 10% of margin (`SIM_MAINT_PCT`) — more conservative than Gains' per-class threshold tables | B (documented) |
| Liquidity/skew impact | NOT simulated — depth/OI state is not in the public API | C |
| Funding/borrowing | NOT simulated in v1 (v10 needs on-chain accumulator state) | C |
| Stale-price rejection | marks older than 5 s are refused for execution | — |

Sources: docs.gains.trade/gtrade-leveraged-trading/fees-and-spread · docs.gains.trade v10 changelog.

## PnL / margin formulas (decimal.js, NUMERIC(24,10) storage)

```text
notional   = margin × leverage
quantity   = notional / execution_price
long pnl   = quantity × (mark − entry)
short pnl  = quantity × (entry − mark)
net pnl    = gross − close fee              (open fee charged at fill)
balance    = balance + net pnl              (margin reserved, then released)
equity     = balance + Σ unrealized
free margin = balance − used margin
```

## Order types

- **Market** (long/short, margin, leverage, optional SL/TP) — immediate fill
- **Limit / Stop** (long/short) — pending until the mark crosses the target,
  margin re-validated at trigger, cancellable
- Position management: close, SL/TP update (server-validated against the mark)
- Idempotent submissions (`Idempotency-Key`); duplicate requests return the
  original result — no double execution

## Price integrity & safety

- Freshness check before every execution; unknown/closed markets rejected.
- Per-account async locks + row-level `FOR UPDATE` inside transactions.
- Ownership enforced per request (session-joined queries).
- Append-only ledger with `balance_after` — reconciliation is a test.
- Engine restart recovery: all state lives in PostgreSQL; the loop simply
  resumes. Feed outages: stale marks block execution (documented limitation:
  no tick replay, triggers fire on the first fresh mark after recovery).

## Frontend integration

`apps/web-react/src/trading/TradingBridge.tsx` exposes `window.__ofServerTP`
(an adapter with the same surface as the legacy client demo engine). On
`of-trading-ready` the terminal swaps its provider to the server bridge;
unauthenticated visitors keep the clearly-labelled client-side demo.

## Testing

- `apps/backend/test/trading.test.mjs` — **52/52**: funding (exact 100k,
  idempotent, concurrent), long/short PnL+fees, margin/leverage/SL-TP sanity
  rejections, limit/stop triggers, SL/TP execution, liquidation, duplicate
  submission, ownership isolation, suspension, ledger reconciliation.
- `e2e/test-trading-e2e.js` — **17/17**: the full acceptance scenario
  (connect → SIWE → 100k account → BTC/USD long → live PnL → close → history →
  reconnect/restore → Directus admin inspection → no on-chain tx).
- Short positions and multi-market coverage run in the engine suite (any
  Gains market works — 488 loaded dynamically).
- Deterministic prices via the `SIM_TEST_MODE=1` injection seam (never on in
  production).
