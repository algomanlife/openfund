# Prop Trading

Openfund Prop Trading combines market discovery, a shared terminal and account review with a persistent simulated execution engine. The current executable account is `free_demo`: one account per authenticated user, funded once with **100,000 virtual DAI**. This is practice accounting in PostgreSQL, not a token balance, capital allocation or funded brokerage account.

## Challenges and account identity

The catalog contains Standard, One-phase, Instant and Free Trial program configurations. Directus edits `challenge_plans`, the same table read by the backend. User challenge records have ownership and lifecycle fields. Catalog terms are not purchase contracts or proof that payment, challenge activation, evaluation enforcement or payouts work. Those workflows remain [planned](../product/FEATURE_STATUS.md).

The Prop wallet sign-in policy uses Ethereum Sepolia (`11155111`). No chain transaction funds the practice account. Product/account context comes from the backend session; clients cannot select another user's account.

## Execution lifecycle

The server supplies execution marks from its own Gains feed; the browser cannot set an execution price. Requests validate market, direction, margin, leverage and protection levels. An owned idempotency key returns the recorded result on retries; a conflicting payload is rejected. Account locks and PostgreSQL transactions protect mutation ordering.

Market orders fill using the documented spread policy. Pending limit/stop orders are monitored by the in-process engine, approximately once per second; crossing the trigger invokes a fresh risk check. Pending orders do not reserve margin. Cancellation, SL/TP updates and closes lock the account before the affected order or position. Monitoring continues while the Node service runs, independently of the browser.

Partial close allocates quantity, margin and opening fee proportionally. A closed slice references `parent_position_id`; the remaining position retains provenance and protection. Ledger settlement and close-request idempotency are atomic. A restart reloads persisted records; this design currently requires a single engine process.

See [Trading lifecycle](../architecture/FLOWS.md#trading-lifecycle) and [implementation](../../apps/backend/engine.js).

## Valuation and risk

`trading-math.js` uses Decimal arithmetic (precision 40); persisted financial values use PostgreSQL NUMERIC. For the current simulation:

```text
notional = margin × leverage
quantity = round_down(notional / entry execution price, instrument size precision)
gross PnL = quantity × (mark − entry) × direction
balance = initial virtual funding + ledger settlements − charged fees
equity = balance + gross unrealized PnL
free margin = max(0, equity − used margin)
```

Opening validation also caps usable margin by cash balance minus used margin and includes the opening fee. Unrealized profit does not create additional reusable cash collateral. Missing or older-than-five-second marks produce unknown valuation fields and block unsafe execution. Leverage is bounded using market metadata and account checks.

Fee percentages on margin × leverage are BTC/ETH **0.035%**, other crypto **0.05%**, forex **0.012%**, and fallback **0.06%**, per side. Spread percentages are BTC/ETH **0.005%**, other crypto **0%**, forex **0.005%**, commodities **0.02%**, and fallback **0.01%**. These are repository simulation policy, not current venue fees. [Source](../../apps/backend/trading-math.js).

Liquidation solves the simulation's maintenance condition using executable exit spread and closing fee; default maintenance collateral is 10% of margin (`SIM_MAINT_PCT`). Limit fills retain their target-price bound; stop orders use the fresh executable mark plus spread after crossing, including gaps. There is no depth-based slippage, stop-gap execution guarantee, funding or borrowing accumulator, multi-collateral settlement, or Gains v10 contract parity.

## PnL, drawdown and reporting

Open-position gross PnL uses current marks. The server's estimated exit PnL accounts for closing spread and fee; opening fees were already charged to balance. Round-trip portfolio `net_pnl` deducts both opening and closing fees. The legacy close-settlement database field is preserved and exposed separately as `close_settlement_pnl`; historical ledger rows are not rewritten.

Daily/max drawdown uses persisted observations of fresh equity, UTC day boundaries and an explicit measurement start (`since`). Missing historical peaks are not reconstructed. Free-demo accounts have no assigned commercial challenge loss limits; limits remain null rather than implying enforcement.

The [Portfolio and Journal](PORTFOLIO_JOURNAL.md) provide position/order history, performance analysis, exports and private decision records. Financial balances remain authoritative in the ledger, not in a reconstructed historical equity series.

## Challenge evaluation

Challenge accounts trade through the same engine. `evaluation.js` applies the frozen rules snapshot inside the account transaction before order acceptance, after each fill and close, and on each engine-loop pass:

```text
daily floor   = day basis × (1 − daily %),  day basis = max(opening balance, opening equity), day starts 00:00 UTC+3
static floor  = starting balance × (1 − maximum %)
breach        = equity ≤ floor (touching is a breach)
pass          = closed profit ≥ target AND settlement balance − starting balance ≥ target
                AND trading days ≥ minimum AND no violation AND all positions settleable now
settlement balance = balance + Σ (exit PnL at mark with spread − closing fee)
trading day   = distinct UTC+3 day with at least one order fill
```

A breach closes positions at the server mark, cancels pending orders and closes the account; a position whose market is closed is settled by the loop once tradeable. Evaluation defers while any mark is stale. Enforcement is sampled (events and about once per second), not tick-continuous. Findings and limitations: [engine audit](../audits/PROP_ENGINE_AUDIT.md) · [ADR 0012](../decisions/0012-challenge-pass-settlement-and-trading-days.md).

[Capability register](../product/FEATURE_STATUS.md) · [Architecture](../architecture/ARCHITECTURE.md)

## Free Trial and instrument scope update

See [Unified accounts](UNIFIED_ACCOUNTS.md) for the separate zero-equity permanent stop and new virtual-USD funding. `instruments.js` validates the USD-quoted linear contract model, supported market categories, unit contract size, quantity precision, instrument minimums and leverage maximum. Non-USD quotes requiring conversion or non-unit contract sizes fail explicitly. This is a virtual USD CFD model, not exchange futures lots, physical commodity contracts, or a Gains-contract replica. Independent decimal constants cover both directions in crypto, forex, stocks, indices and commodities.

## Engine rules summary

(Moved from the root README so the README stays an entrypoint.)

- **Orders:** market, limit and stop orders with idempotency keys,
  pre-trade validation (market, size, leverage and plan caps, SL/TP side) and
  a free-margin check that includes the opening fee.
- **Positions:** linear virtual-USD contracts; partial closes are slices of a
  root position. Spread and fee tiers come from `trading-math.js`.
- **PnL:** unrealized `qty × (mark − entry) × direction`; realized PnL books
  exit spread and the closing fee. Every balance change has a ledger row.
- **Daily drawdown:** floor `basis × (1 − daily %)`, with basis the higher of
  the day-opening balance and equity at 00:00 UTC+3. Touching the floor is a
  breach.
- **Overall drawdown:** static `start × (1 − max %)` or trailing (Instant
  plans) from peak equity.
- **Evaluation:** target on closed net profit, which must also hold after
  settling every open position at the current mark; minimum trading days by
  fill day; time limits; two-phase progression.
- **Risk enforcement:** on every fill and close and on each loop pass. A
  breach closes positions at the mark; positions in closed markets settle
  once tradeable.
- **v0.4.2 corrections:** five defects fixed (P0 pass while settlement
  realized the target away; post-fill fee blind spot; trading days by order
  date; orphan positions after breach; misreported daily limit) with 31 new
  checks in `npm run test:engine --prefix apps/backend`.
- **Open policy decision:** the Rulebook's Instant trailing limit "locks at
  breakeven", but with the published 5%/5% values the floor keeps trailing
  above breakeven. The behavior is unchanged from v0.4.1, deterministic and
  pinned by tests; a product decision is still required before it can be
  treated as matching the Rulebook.

[Engine audit](../audits/PROP_ENGINE_AUDIT.md) ·
[ADR 0012](../decisions/0012-challenge-pass-settlement-and-trading-days.md) ·
[Prop guide](../trading/PROP.md)
