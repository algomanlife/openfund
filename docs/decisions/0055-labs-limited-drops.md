# 0055 — Labs: limited challenge drops

- **Status:** Accepted (2026-11-23)
- **Scope:** backend (purchases, plan validation, public API), website (Labs page, checkout, Challenges menu), Backstage plan administration
- **Item:** batch 3, M

## Context

The owner wants to publish occasional small batches of challenges with
experimental rules: a numbered drop with limited inventory, a sale window and
a limit per wallet. Displayed rules must equal enforced rules, and a drop must
never be oversold. No first drop is defined: the owner publishes it.

## Decision

1. **A drop is a plan.** It is published through the existing Backstage plan
   administration (`/admin/console/plans/publish`) with a `lab` block in the
   configuration JSON (an example shape, not a published drop):

   ```json
   "lab": { "number": 1, "inventory": 50, "perWalletCap": 3,
            "saleStartsAt": "2026-12-01T12:00:00Z", "saleEndsAt": null }
   ```

   `packages/plan-validation` (`configurationProblems`) checks the block:
   - whole-number drop number (1–9999) and inventory (1–100000);
   - per-wallet cap 1–5;
   - ISO sale start, and an optional end after the start;
   - no unknown fields, not free.

   Publishing refuses a drop number already used by another plan
   (`409 lab_number_taken`). Everything else (sizes, prices, rules) is an
   ordinary plan, so a purchased account keeps the drop's frozen rules
   snapshot.
2. **Engine parity.** A rule the evaluation engine does not enforce is
   refused for every plan, not just drops, instead of being published and
   silently ignored:
   - an end-of-day trailing maximum loss (`trailingEodLockPct`, or a
     `drawdownMode` other than `static` or `trailing`);
   - a cap on the total number of payouts (`maxPayoutCount`);
   - a minimum daily profit for a day to count as a trading day
     (`minTradingDayProfitPct`).

   A cap on each payout's amount is already enforced (`payoutCapPct`,
   `rewards.js`). Adding any of the refused rules later means implementing it
   in `evaluation.js` with tests and removing it from `UNENFORCED_RULES`.
3. **Inventory without a counter.** A drop's units are paid orders plus live
   reservations, counted in the order-creating transaction under a
   `FOR UPDATE` lock on the plan row (`labReserveTx`). Two buyers can never
   take the last unit. A reservation is:
   - a pending order;
   - an expired order still inside the late-payment grace
     (`PURCHASE_LATE_GRACE_MINUTES`);
   - an order that is part-paid or under payment review, because it can
     still be paid.

   After that window the unit returns to the drop by itself, with no
   decrement or release job that could drift. The same lock enforces the
   per-wallet cap (`lab_wallet_cap`) and the sale window (`lab_not_open`,
   `lab_closed`, `lab_sold_out`).
4. **Status** is computed, never stored: `coming_soon` before the window,
   `sold_out` once paid units reach the inventory, `closed` after the window
   or when the plan is retired, otherwise `open`.
5. **Catalog separation.** `GET /purchases/plans` hides drops, so the
   objectives page, comparison, campaigns and revenue model never show them.
   Checkout asks for one drop with `?lab=<slug>`. `GET /labs` returns:
   - current drops (open or coming soon);
   - previous drops that sold (with the real number sold);
   - the standard plans the tightness gauges compare against.

   It carries counts only, never buyer identities.
6. **Page.** `/:locale/labs`:
   - hero with line-art glassware, slowly turning molecules and rising
     bubbles;
   - a capsule card with the drop number, an "experimental, limited" label
     and the price;
   - tightness gauges against the standard plans' range, the real inventory
     bar (sold and reserved), and a countdown to the window edge;
   - a quantity selector bounded by the per-wallet cap and the available
     units, and a checkout link; each account is its own order, and checkout
     offers the next one;
   - the drop's rules on the trading-objectives cards (ADR 0054);
   - an archive with a "sold out" stamp, and a FAQ with the simulated-demo
     disclaimer.

   With no drop published, the page says so and sells nothing. The Challenges
   menu has a Labs tile whose badge names the open drop.

## Consequences

- Inventory accuracy follows the order table, so expiry, cancellation and
  late payment need no extra bookkeeping.
- The plan row lock serializes orders for one drop only; other plans are
  unaffected.
- Three rule types the owner asked for are unavailable until the engine
  enforces them; the Labs FAQ says why.
