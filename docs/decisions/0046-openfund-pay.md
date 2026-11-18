# ADR 0046 — Openfund Pay: first-party payments, ledger, discovery and refunds

- **Status:** Proposed (implemented on branch `agent/claude/openfund-pay`; review, release and owner acceptance pending)
- **Date:** 2026-11-18
- **Builds on:** [ADR 0018](0018-payment-verification-and-recovery.md) (verification policy), [ADR 0022](0022-arbitrum-checkout-coupons-order-lifecycle.md) (Arbitrum sign-in, coupons, order lifecycle).

## Context

Two genuine purchases on 2026-11-18 (v0.7.0) did not activate a challenge
([incident report](../payments/INCIDENT_2026-11-18.md)):

- **DePay:** DePay delivered 10.638 USDC on Arbitrum for a 10.80 order. The
  verifier measured it correctly and rejected it as `insufficient_amount`.
  The product then had no path to complete the balance, and the checkout kept
  showing "Verification Pending".
- **Manual transfer:** no matching inbound transfer was found. Openfund also
  cannot see a payment until the customer submits a hash.

DePay also announces that its services stop on 2026-12-31, so new purchases
cannot keep depending on it.

## Decision

1. **One settlement engine for every method** (`payment-ledger.js`). The chain
   verifier proves a transaction first (token contract, receiver, sender rule,
   finality, canonical block). The ledger then allocates the verified value
   under row locks in one database transaction:
   - `order` covers the remaining balance;
   - `excess` is the part above the order total, recorded as a refund
     liability;
   - `refund` is a whole deposit returned without an order (operator action).

   Allocations are append-only, are guarded by database triggers so they
   never exceed the transaction's value, and belong to one order, which is set
   once. The challenge, invoice and commission are provisioned exactly once,
   when allocations reach the frozen order price.
2. **Valuation:** approved USD stablecoins count 1:1, in integer micro-USD.
   Raw units are stored per token and never summed across tokens. No floating
   point is used.
3. **Partial payments are evidence, not rejections.** `partially_paid` is a
   new lifecycle state. It never expires. After `PAYMENT_PARTIAL_BALANCE_HOURS`
   it moves to operator review. Received funds are never dropped.
4. **Direct wallet payment** (`/purchases/orders/:id/intents`,
   `/purchases/intents/:id/submit`):
   - The server freezes the transfer: token, treasury and exact base units of
     the remaining balance, on any configured EVM chain.
   - The wallet signs one ERC-20 `transfer`. There are no approvals, swaps or
     custody.
   - Payment network and sign-in chain are independent. The signer must still
     be the SIWE wallet, so a changed account is refused.
5. **Discovery without a TXID** (`payment-watcher.js`):
   - Every inbound treasury transfer is recorded before any attribution
     decision.
   - Attribution happens only when it is unambiguous: an intent, an attempt,
     a Solana memo, or a sender who is the SIWE wallet of exactly one open
     order.
   - Ambiguous and unmatched deposits wait for an operator.
   - A shared treasury cannot attribute more than this. Per-order deposit
     addresses or a reference-emitting payment contract would need custody
     and an audited contract, and both stay out of scope until the owner
     approves them.
6. **Refunds are never automatic.** They follow
   `refund_due → refund_review → refund_approved → refund_sent →
   refund_confirmed`, with `refund_rejected` and `refund_failed`. Approval
   re-states the original payer and chain. The outgoing transfer is verified
   on-chain.
7. **DePay** stays off for new payments unless the runtime switch enables it.
   Historical callbacks, events and recovery are unchanged.
8. **Status** is derived on the server from separate dimensions
   (transaction, settlement, order, challenge, refund), with escalation after
   15 and 20 minutes and no automatic failure.

## Consequences

- `payments` keeps one row per settling transaction, so an order may have
  several. Consumers that assumed one row were reviewed: receipt (latest row
  plus full ledger), history, economy inflows (counted per paid order).
- Native-coin, swap and arbitrary-token payments are explicitly unsupported.
- A sender with several open orders, a payment from an exchange or from
  another wallet always needs an operator.
- Real-network acceptance is still required
  ([checklist](../payments/ACTIVATION.md)).
