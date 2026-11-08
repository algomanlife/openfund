# Audit — Prop trading engine correctness (2026-11-08)

> Scope: the server-side Prop trading engine only (`apps/backend/engine.js`,
> `trading-math.js`, `evaluation.js`, `instruments.js`, the engine's use of
> `market-data.js`, and their tests). No UI, routing, authentication, wallet,
> payment, CMS, Perpetual or deployment code was changed.
> Branch: `claude/prop-engine-audit` from `main` at `0c6a8c9`. Local evidence
> only: an isolated PostgreSQL 17 database and Node 22. Nothing was deployed.

## A. Engine architecture (as implemented)

| Concern | Authority | Notes |
| --- | --- | --- |
| Balances, used margin, realized PnL | `demo_accounts` row, mutated only inside engine transactions | Every change has an append-only `trading_ledger` row with `balance_after` |
| Equity, free margin, unrealized PnL | `accountMetrics()` in `trading-math.js` | One definition shared by engine, state view and evaluation |
| Settlement value (new) | `accountMetrics().settlement_balance` | Balance after closing every open position at the mark, with exit spread and closing fee: exactly what `#closeTx` books |
| Open positions | `trading_positions` (`status='open'`) | Partial-close slices reference `parent_position_id` |
| Execution prices | Server marks from `MarketData` (Gains feed) | The client never submits an execution price |
| Challenge rules | `rules_snapshot` frozen at provisioning; `evaluateRules()` | Pure function; day and trailing state persisted in `challenge_equity_days` and `challenge_trailing` |
| Challenge transitions | `#challengeRiskTx()` inside the caller's account transaction | Challenge row `FOR UPDATE`; status checked `started` before any transition |

Order lifecycle: request → pre-lock validation (market, size, leverage, plan
leverage cap, SL/TP side) → in-process account mutex → `BEGIN` →
`demo_accounts FOR UPDATE` → idempotency re-check → trial and challenge risk
evaluation → free-margin check including the opening fee → order row → market
fill (`#fill`) or pending → post-fill challenge evaluation → `COMMIT`.

Position lifecycle: `open` → (`partial` slice closes) → `closed` | `liquidated`.
Closes happen by user request, SL, TP, per-position liquidation, challenge
settlement, or the free-account zero-equity stop.

Risk evaluation runs: before order acceptance, after every fill, after every
close (manual, SL/TP, liquidation), on each engine-loop pass (about once per
second) for challenge accounts with open positions or a reached time limit,
and on read (`state()`, informational only, never transitions).

Equity definition: `equity = balance + Σ quantity × (mark − entry) × direction`.
`balance` already contains charged opening fees and closed settlements;
unrealized PnL excludes exit spread and closing fee (the Rulebook formula).
Arithmetic is `decimal.js` at 40 significant digits, `ROUND_HALF_UP`;
persisted values are `NUMERIC(24,10)`; API values are rounded to 2 dp for
money and 10 dp for prices and quantities.

## B. Findings

### F1 — P0 · Challenge passed while settlement realized the target away

- **Where:** `evaluation.js` `evaluateRules()`; `engine.js` `#challengeRiskTx()`.
- **Conditions:** closed net profit reaches the target while another position
  is open at a loss.
- **Expected:** the Rulebook measures targets on closed net profit. A pass
  settles all open positions, so the closed profit after that settlement must
  still meet the target.
- **Actual:** the pass used closed profit before settlement. Example (5,000
  account, 10% target): closing a winner brought closed profit to 542.50; the
  pass then settled an open loser at −202.50, finishing at 340.00 closed
  profit, yet the challenge was `passed`.
- **Root cause:** the pass condition ignored the value the settlement would
  realize; settlement also silently skipped positions in closed markets.
- **Correction:** a pass also requires `settlement_balance − start ≥ target`,
  and every open position to be settleable (fresh mark, open market).
  Otherwise the pass waits. Settlement uses the same mark and formula, so the
  final balance is exactly the evaluated value.
- **Evidence:** `engine-audit.test.mjs` "profit target is not passed while
  settlement would realize the target away" (failed before: `actual: 'passed'`;
  after: stays `started`, then passes at 5,640.00 when the loser recovers).

### F2 — P1 · Post-fill evaluation ignored the opening fee

- **Where:** `engine.js` `submitOrder()`.
- **Actual:** the post-fill `#challengeRiskTx` received the account row read
  before `#fill`, so the opening fee and new used margin were invisible. A
  breach caused by the fee was not detected in the order transaction (the loop
  caught it about one second later), and stale values were written to the day
  record.
- **Correction:** re-read the locked account row after the fill. The order
  response carries `challenge_transition` when the order itself ended the
  challenge, and the settled position view.
- **Evidence:** "post-fill evaluation includes the opening fee" (before:
  `started`; after: `failed` with recorded equity 4,997.50 against a 4,998.00
  floor).

### F3 — P1 · Minimum trading days counted order creation days

- **Where:** `evaluation.js` `countTradingDays()`.
- **Actual:** days were taken from `trading_orders.created_at` of filled
  orders. A pending order placed on one day and filled on another credited the
  placement day, so `minTradingDays` could be satisfied with fewer real
  trading days.
- **Correction:** count distinct UTC+3 days of root position `opened_at` (the
  fill time); partial-close slices are excluded. No schema change.
- **Evidence:** "minimum trading days count fill days" (before: `passed` with
  one real fill day against a two-day minimum; after: `started`).

### F4 — P1 · Breach settlement could leave open positions on a closed account

- **Where:** `engine.js` `#settleChallengeTx()` and `loop()`.
- **Actual:** a position whose market was closed (fresh mark, `isOpen=false`)
  was skipped by settlement and never revisited by challenge logic; it stayed
  open on a `closed` account with reserved margin.
- **Correction:** the breach is still recorded at detection (a touch is a
  breach). New `#settleOrphans()` in the engine loop finishes the settlement
  with reason `challenge_settlement` once the market is tradeable, recording
  `challenge_settlement_completed`. The F1 change keeps a pass from occurring
  while any position is unsettleable.
- **Evidence:** "breach with an untradeable market records the failure and
  settles the orphan later" (before: position still open after the loop;
  after: settled, balance 4,645.00, books reconciled).

### F5 — P2 · Risk view reported a daily limit the engine does not enforce

- **Where:** `engine.js` `state()` challenge risk view.
- **Actual:** `risk.daily_limit` was the starting size × daily %, while
  enforcement uses the day basis (higher of opening balance and opening
  equity) × daily %.
- **Correction:** `daily_limit` uses the day basis; additive fields
  `daily_threshold` and `maximum_threshold` (static floor or trailing floor)
  expose the enforced equity floors. No frontend code reads these fields.
- **Evidence:** "state risk view reports the enforced daily limit" (before:
  `250.00`; after: `300.00` on a 6,000 basis).

### F6 — Open product decision · Trailing drawdown "locks at breakeven"

The Rulebook says the Instant 5% trailing limit "locks at breakeven once the
account is 5% in profit". The implementation computes
`floor = max(start × 0.95, peak − 5% × start)` and raises it to at least the
start once the peak reaches +5%. With the published values (limit and lock
both 5%) the lock never changes the result, and the floor keeps trailing above
breakeven (peak 108,000 → floor 103,000 on 100,000). If the intended rule is
the common "floor freezes at the starting balance", current behavior fails
accounts the published terms would keep. This was **not changed**: it is a
business-policy interpretation, and the existing suite pins the present
behavior. `engine-rules.test.mjs` documents the current floor values. A
product decision is required.

## C. Verification matrix

| Component | Status | Test coverage | Findings |
| --- | --- | --- | --- |
| Order execution | PASS | Validation rejects (zero size, fractional leverage, plan cap, margin, SL side, unknown/stale market) leave balances unchanged; idempotency replay and conflict | — |
| Position accounting | PASS | Long/short hand values incl. BTC spread; partial close; 60-step seeded randomized sequence with reconciliation after every step | — |
| Realized PnL | PASS | Exact close values; ledger sum = balance; closed net − fees = balance − funding | — |
| Unrealized PnL | PASS | Hand values; independent equity oracle each randomized step; stale aggregation → unknown | — |
| Equity | PASS | Same as above | — |
| Balance | PASS | Ledger reconciliation invariant | — |
| Margin | PASS | Used margin = Σ open margin; free margin; liquidation price hand value | — |
| Daily drawdown | PASS | Above/at/below floor (pure); basis share; aggregated positions; overnight basis carry-over; fee-caused breach | F2, F5 fixed |
| Overall drawdown | PASS (static) · NOT VERIFIED (trailing lock intent) | Static above/at/below through a live position; trailing floor values and breach | F6 open |
| Challenge evaluation | PASS | Exact/exceeded/floating-only target; violation overrides target; min days; stage 2 target; Instant no pass; expiry; deferral; repeated evaluation no-op; existing 48-check lifecycle suite | F1, F3 fixed |
| Stop loss / take profit | PASS | Long SL with gap (fills at mark), short TP, no double execution across loop passes | — |
| Concurrency | PASS (single database, two engine instances) | 10 concurrent orders over two `Engine` instances fill exactly 4; 6 concurrent closes realize once | Multi-process loop coordination NOT VERIFIED |

Commands (Node 22.23.4, isolated database `openfund_engine_audit_test_20261108`):

- `npm run test:engine --prefix apps/backend` — 31 passed, 0 failed.
- Before the fixes the first 13 tests of the new suite showed 8 passed, 5 failed (F1–F5).
- `npm run test:all --prefix apps/backend` against a `SIM_TEST_MODE=1`
  backend on private port 8297 — every suite passed, 0 failed, 0 skipped
  (including the existing 48-check evaluation suite).
- `npm run validate:blueprint` and `npm run docs:check` — passed.

## D. Code changes

| File | Reason |
| --- | --- |
| `apps/backend/trading-math.js` | `settlement_balance` in `accountMetrics()` (F1) |
| `apps/backend/evaluation.js` | Pass requires settlement profit ≥ target (F1); fill-day trading days (F3) |
| `apps/backend/engine.js` | Settleability and settlement value for evaluation (F1); post-fill re-read and `challenge_transition` (F2); `#settleOrphans()` (F4); enforced limits in the risk view (F5) |
| `apps/backend/test/engine-audit.test.mjs` | New DB-backed engine suite (18 tests) |
| `apps/backend/test/engine-rules.test.mjs` | New pure boundary suite (13 tests) |
| `apps/backend/package.json` | `test:engine`, included in `test:all` (CI runs it) |

Tests use synthetic `XSOL/USD`, `XAVAX/USD` and `XBTC/USD` symbols so a
concurrently running backend with a live feed cannot price test accounts.

## E. Remaining limitations (verified behavior vs assumptions)

- **Sampling, not continuous enforcement.** Equity is evaluated on events and
  about once per second. A dip and recovery between samples is not observed;
  "touching once" is enforced at sample resolution.
- **Stale or closed feeds defer enforcement.** With any open position lacking
  a fresh mark, evaluation is deferred and orders are blocked by unknown free
  margin; a breach that recovers before marks return is not recorded.
- **Settlement at the mark.** Breach settlement closes at the current mark with
  spread and fee, so realized losses can exceed the limit after gaps. No
  guaranteed stop price.
- **Single engine process.** In-process mutexes plus row locks keep the books
  consistent across instances (tested), but two engine loops are not
  coordinated; horizontal scaling still requires the design noted in the
  [strategy](../product/STRATEGY.md).
- **Mark-based triggers.** SL/TP and pending orders trigger on the mark, not
  bid/ask; fills apply the documented spread policy.
- **No currency conversion or non-unit contracts.** `instruments.js` rejects
  them explicitly.
- **Trailing lock intent (F6)** requires a product decision.

## F. Readiness

**CONDITIONALLY READY** for the simulated (virtual USD) challenge scope: no
known open critical defect after F1–F4, with the open F6 policy decision and
the limitations above. This is local verification only; it is not evidence of
deployed acceptance, multi-process operation or live-feed behavior.

[Prop Trading](../trading/PROP.md) · [ADR 0012](../decisions/0012-challenge-pass-settlement-and-trading-days.md) · [Feature Status](../product/FEATURE_STATUS.md)
