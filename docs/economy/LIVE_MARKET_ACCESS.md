# Live Market Access

Live Market Access is separate from simulated funded accounts. It allocates Openfund-owned capital to selected traders for execution on real markets. The code is the control plane. **Real execution and real transfers are not enabled.**

## Capital threshold

The program has capacity only when **Available Allocatable Capital ≥ $500,000** and the financial position is `verified` (see [Treasury](TREASURY.md)). It never uses the gross wallet balance. When the inputs are incomplete, capacity is `unknown`. Reaching the threshold makes allocation possible but activates nothing. Each allocation is a management action, and its amount must also fit within the available capital at that moment. Allocations are serialized by an advisory lock.

## Trader eligibility

Eligibility is computed only from system records, never from what a trader declares:

1. **First account:** the earliest paid purchase passed every evaluation stage, reached the funded account of record, and has **≥ 10 paid withdrawals** (`withdrawal_requests.status='paid'`) on that account.
2. **Second account:** a later paid purchase of **exactly 2×** the first size that passed evaluation and has **≥ 5 paid withdrawals**.
3. **Coach:** an active relationship with an active approved coach who has verified the trader.
4. **Final approval:** the backend re-checks eligibility at decision time. Management approves and must explicitly select a tier.

The funded account of record is the final evaluation stage that passed. A two-phase purchase continues in the stage-2 row the engine creates when stage 1 passes. The current engine provisions no separate funded row, and withdrawals are requested against the passed account. Instant accounts have no evaluation stage, so they do not satisfy "passed evaluation". This definition needs management confirmation before production use.

## Profit split

| Tier | Trader | Coach | Openfund |
|---|---:|---:|---:|
| Standard | 70% | 10% | 20% |
| Advanced | 80% | 10% | 10% |
| Elite | 85% | 10% | 5% |

These tiers are candidates, not approved policy. No tier is applied by default: approval is refused (`tier_selection_required`) until an administrator selects one. Database constraints enforce a coach share of exactly 10 and a total of exactly 100.

## Order flow and risk controls

1. The trader submits a live order with an idempotency key.
2. In one transaction, the backend locks the allocation, checks approval, allocation status and adapter, rolls the daily equity marker, and runs [`checkLiveOrder`](../../apps/backend/economy-math.js).
3. The external adapter call happens outside the transaction. Its outcome is recorded as `open`, `rejected` or `reconcile_required`. An unknown outcome is never assumed to be a fill.
4. A close returns a verified result: realized PnL, trading fees and execution costs. A failed close keeps the trade open, or marks it for reconciliation.

**Risk controls,** which are independent of the simulation engine (left unchanged):

- **Drawdown limits:** daily and maximum drawdown default to the funded account's rules snapshot. Administrators can only tighten them.
- **Worst case:** an isolated position can lose its full collateral through gaps, liquidation or slippage. An order is admitted only if all open collateral, plus this order's collateral and estimated fees, fits above both drawdown floors. A 3% or 5% account limit is therefore never treated as a cap on exchange losses.
- **Caps:** maximum leverage, total notional exposure and open positions apply to each allocation.
- **Circuit breaker:** a drawdown breach after a realized result halts the allocation. Management can halt, resume or close it.

## Settlement

When a trade is finalized, in one transaction and exactly once:

- **Trade and allocation:** realized PnL, fees and costs are recorded on the trade. Allocation equity and the circuit breaker are updated.
- **Profitable trades:** if distributable profit (PnL − fees − costs) is above zero, one `profit_share_allocations` row is written, plus `settlement_records` for the trader and the coach. The rows are unique per share and role. Rounding residue goes to Openfund so the parts always sum exactly.
- **Losses:** no share is created.

The settlement worker claims rows with `FOR UPDATE SKIP LOCKED`:

- **Success:** the row becomes `completed` with a transaction hash or reference.
- **Errors:** the row becomes `failed` and is retried, up to 5 attempts in total. After that it moves to `reconcile_required`.
- **Stuck rows:** a row left in `processing` for more than ten minutes goes to `reconcile_required` and is never retried automatically, because a transfer may already have happened.
- **Reconciliation:** operators complete it with evidence through `/admin/live/settlements/:id/reconcile`.

## Adapters and activation

| Variable | Values |
|---|---|
| `LIVE_EXECUTION_ADAPTER` | `none` (default; orders refused), `sandbox` (fills at the server mark, collateral-capped loss, labelled non-monetary), `gains` (reserved; returns `adapter_unavailable`) |
| `LIVE_SETTLEMENT_ADAPTER` | `none` (default; settlements stay pending), `sandbox` (labelled non-monetary reference) |

Both sandbox adapters are refused when `NODE_ENV=production`. Gains on-chain execution needs these items, none of which this change provides:

- an approved signer or custody design for the company wallet;
- supported testnet contracts;
- transaction simulation;
- receipt and event reconciliation;
- a security review;
- explicit management activation.

The order ticket currently lives on the Live Market Access page. Integrating it into the shared terminal as a separate product context is a follow-up.
