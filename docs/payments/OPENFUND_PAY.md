# Openfund Pay — architecture and operations

Openfund's first-party checkout and payment ledger
([ADR 0046](../decisions/0046-openfund-pay.md)).

**Status:** implemented and covered by deterministic tests. **Not released,
not deployed, not accepted.** No real-network payment has been made with it.

## Customer journey

1. Connect the wallet and sign in with SIWE on **Arbitrum One** (unchanged).
2. Choose the challenge, size and coupon. The server freezes the net price in
   the order.
3. Choose a payment method:
   - **Pay with Wallet** (primary);
   - **Manual Transfer** (secondary);
   - **DePay**, only while it is enabled for new payments.
4. **Pay with Wallet:** pick a network. The server returns an *intent*:
   approved token contract, treasury, and the exact base units of the
   **remaining** balance. The page shows the balance and a fee estimate,
   asks to switch the network if needed, and the wallet signs one ERC-20
   `transfer`. The hash is saved in the browser and sent to the server at
   once, so a closed tab loses nothing.
5. The server verifies on-chain and allocates the value
   ([ledger](#ledger-and-accounting)).
6. **Fully paid:** the challenge is activated, the invoice issued and the
   receipt shows every transaction. **Partially paid:** the page shows
   *Payment Partially Received — Remaining X* and *Complete Remaining
   Payment*.

The signer must be the authenticated wallet on any EVM network. A different
connected account is refused before signing. Switching accounts signs the
session out (identity never follows another wallet). Switching networks does
not.

## Components (backend)

| Module | Role |
|---|---|
| `purchases.js` | Orders, intents, submit, customer status, receipt, history; `verifyAndConfirm` (verifier → ledger) |
| `payment-verification.js` / `solana-verification.js` | On-chain proof. `allowPartial` returns a short amount as evidence; RPC failover via ordered URL lists |
| `payment-ledger.js` | Allocation engine, totals, exact arithmetic, payment-method settings |
| `payment-status.js` | Server-authoritative customer status (21 codes) |
| `payment-watcher.js` | Treasury discovery, attribution, 15/20-minute escalation, partial deadlines, metrics |
| `payments-admin.js` | Operator API: overview, search, deposits, association, refunds, settings, metrics |

## Ledger and accounting

| Table | Meaning |
|---|---|
| `payment_intents` | Frozen transfer request per order and chain (remaining balance at creation) |
| `payment_transactions` | Every inbound treasury transaction known (submitted, attested or discovered), unique per chain and hash; order set once |
| `payment_allocations` | `order` / `excess` / `refund` value per transaction; append-only; trigger rejects over-allocation and order mismatch |
| `payment_refund_liabilities` | Money owed back; guarded state machine; destination = verified original payer; unique refund hash |
| `payment_events` | Append-only payment timeline (escalations unique per attempt) |
| `payment_monitor_cursors` | Watcher cursor and single-owner lease per chain, receiver and token |
| `payment_settings` | Runtime method switches (audited in `financial_audit_log`) |

How value is counted and recorded:

- Value is counted in integer micro-USD. Approved stablecoins count 1:1; raw
  units are kept per token.
- `payments` keeps one row per transaction that settled part of an order.
  The invoice total is always the order price, and excess is never revenue.
- **Late payments:**
  - An order with no allocation that expired accepts a payment mined within
    `PURCHASE_LATE_GRACE_MINUTES`, as before.
  - Outside that window, the transaction is recorded against the order with
    an open review (`order_expired`).
  - A released coupon reservation is re-checked against the coupon limits
    (`coupon_unavailable`).
- **Partially paid orders never expire.** After
  `PAYMENT_PARTIAL_BALANCE_HOURS` (default 72) they move to `manual_review`.
  The customer can still complete them.
- A transfer to an order that is already paid or cancelled becomes an excess
  allocation with a `duplicate_payment` or `order_cancelled` liability.

## Discovery and attribution

- **EVM:** `eth_getLogs` reads Transfer(token → treasury) for each configured
  chain.
  - Each run rescans `PAYMENT_WATCHER_REORG_BLOCKS` behind the cursor.
  - Unsettled observations that disappear are marked `reorged`; settled ones
    raise an alert.
  - First start: `watchFromBlock` from the chain configuration, otherwise
    `PAYMENT_WATCHER_BACKFILL_BLOCKS` back from the head.
- **Solana:** `getSignaturesForAddress` on the chain option
  `receiverTokenAccount`. The order is named by the SPL Memo.
- **Attribution order:**
  1. intent hash;
  2. attempt hash (customer TXID or DePay attestation);
  3. Solana memo;
  4. the EVM sender is the SIWE wallet of **exactly one** open order.

  Everything else is `ambiguous` or `unmatched` and goes to Backstage →
  Deposits to review.
- Stronger automatic attribution needs per-order deposit addresses or an
  audited payment contract that emits the order reference. Both involve
  custody or a deployment and need owner approval. They are not implemented.

## Status and escalation

The page shows the server code
(`GET /purchases/orders/:id/payment-status`):

- immediately: what was recorded;
- after 15 minutes: the exact delay reason;
- after 20 minutes: *Payment Requires Review*, with background checking
  continuing. The case is never auto-failed.

Escalations are recorded once per attempt (`status_delayed`,
`escalated_review`) and shown in Backstage.

## Backstage → Payments

Every mutation re-enters the owner password and runs only in GLOBAL. The
backend audits every decision.

- **Overview:** settled, partial, pending, unmatched/ambiguous, rejected,
  overpayments, refund liabilities, delayed cases, provisioning retries,
  watcher lag, alerts, method states.
- **Transaction investigation:** search by order id, wallet, hash, chain,
  method, status and date range. The order view shows ledger totals,
  transactions, attempts, refunds and the full timeline.
- **Deposits to review:**
  - *Associate with order* needs a note and written evidence. The sender rule
    is lifted for that one transaction, but token, receiver, amount and
    finality are still verified. There is no force-confirm.
  - Other actions: *Retry verification*, *Open refund case*, *Close
    investigation* (resolved or ignored).
- **Refund liabilities:** review → approve (re-enter the original payer and
  chain) → record the hash of the refund sent from the treasury → verify it
  on-chain (Transfer from the treasury to the destination of at least the
  liability) → completed. Reject and failed are explicit.
- **Payment methods:** enable or disable wallet, manual and DePay for NEW
  payments, with a reason. Historical verification never stops.

## Metrics and alerts

`GET /admin/payments/metrics` reports counts and ages only: orders by state,
unmatched/ambiguous deposits, pending over 20 minutes, provisioning retries,
RPC failures, median confirmation latency, open refund liabilities and
watcher lag per chain. Alerts:

- `payments_pending_over_20m`
- `provisioning_failed_after_settlement`
- `payment_rpc_unavailable`
- `payment_watcher_behind`
- `payment_reorg_observed`
- `unattributed_deposits`

Watcher and escalation failures also appear in `/admin/operations/metrics` as
`[obs]` events.

## Regions

The watcher, escalation and recovery run only with the `payment-recovery`
role, which is GLOBAL-only (`region.js`). Purchases stay refused in IRAN.

## Deployment, migration and rollback

- **Migration:** `schema.sql` additions are additive and idempotent:
  - new tables;
  - the `partially_paid` lifecycle value and transitions;
  - `purchase_orders.partial_deadline_at`;
  - `payments.amount` widened to `numeric(78,18)`.

  Existing rows are not rewritten.
- **New environment variables** (all with safe defaults; see
  [ENVIRONMENT](../deployment/ENVIRONMENT.md)): `PAYMENT_DEPAY_NEW_PAYMENTS`,
  `PAYMENT_WALLET_ENABLED`, `PAYMENT_MANUAL_ENABLED`,
  `PAYMENT_PARTIAL_BALANCE_HOURS`, `PAYMENT_WATCHER_*`.
- **Before enabling:** set `tokenDecimals` for every wallet-payment chain, a
  dedicated RPC per chain in `PURCHASE_RPC_URLS`, and `watchFromBlock` to
  cover 2026-11-18 so Test B can be found.
- **Rollback:** deploy the previous release. The new tables are ignored by
  older code. An order left in `partially_paid` reads as `pending` to the old
  code (the lifecycle constraint keeps the value), so its received payments
  stay recorded. Reconcile such orders before rolling back. Do not drop the
  new tables: they hold financial evidence.
