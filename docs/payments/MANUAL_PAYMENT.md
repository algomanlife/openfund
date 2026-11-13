# Manual payment

Status: implemented on branch `agent/claude/checkout-campaign-chart-trading`
(local verification only; **not deployed**, no real payment made).
Decision: [ADR 0028](../decisions/0028-manual-payment-treasury-networks-campaign-chart-english-lotage.md).

The checkout (`/:locale/checkout`) offers two methods on the **same order**:
**Pay with DePay** ([DePay](DEPAY.md)) and **Manual Payment**. Both end in the
same `verifyAndConfirm` → `confirmPurchase` path, so an order is provisioned,
receipted and invoiced exactly once whichever way it is paid.

## What the customer does

1. Choose the challenge and size; the server fixes the price on the order.
2. Choose **Manual Payment**, then a network and settlement token.
3. Send exactly the shown amount of that token to the shown Openfund treasury
   address on that network (copy button and block-explorer link provided).
   - EVM networks: send **from the signed-in wallet**.
   - Solana: put the **order id** (shown, with a copy button) in the SPL Memo.
4. Submit the transaction id (EVM hash or Solana signature).
5. Follow the status on the same page; the receipt appears after the server
   confirms the payment and activates the challenge.

## Where the instructions come from

`GET /purchases/orders/:id` → `payment.manual` = one entry per ready settlement
chain in `PURCHASE_PAYMENT_CHAINS` (receiver, token, optional `tokenSymbol`,
decimals, required confirmations, explorer links) plus the order amount and
memo. These are the same receivers DePay settles into; RPC endpoints are never
returned. The approved treasury receivers are listed in
[Owner setup](OWNER_SETUP.md#treasury-receivers).

## Server verification (`POST /purchases/verify`)

A transaction id is never accepted as proof. The verifier checks, on the chain
the customer selected:

| Check | EVM (`payment-verification.js`) | Solana (`solana-verification.js`) |
|---|---|---|
| Transaction exists and succeeded | receipt `status === success` | `meta.err === null` |
| Finality | `minConfirmations` (production default 12), canonical block | `finalized` commitment |
| Token | Transfer logs of the configured token contract only | balance change of the configured mint only |
| Receiver | logs to the treasury receiver only | receiver's token accounts only |
| Amount | sum ≥ order price in exact base units (on-chain decimals) | same, mint decimals |
| Binding to the order | signed by the customer's sign-in wallet | order id in an SPL Memo |
| Age | mined after the order was created | block time after the order |
| Single use | `UNIQUE (chain_id, tx_hash)` across all orders | same |

Outcomes: `tx_pending` / `tx_not_final` / `rpc_unavailable` are retryable — the
order moves to `payment_detected` (**Verification Pending**) and the recovery
sweep re-checks it; `wrong_token`, `wrong_receiver`, `insufficient_amount`,
`tx_not_successful`, `wrong_sender`, `memo_missing`, `tx_already_used` are
rejected and queued for operator review where money may need returning. The
route is rate limited per client.

## Customer statuses

Display mapping of the order state machine ([Order lifecycle](ORDER_LIFECYCLE.md))
and the latest payment attempt (`checkoutStatus.ts`):

| Shown | Server record |
|---|---|
| Awaiting Payment | `awaiting_payment` |
| Verification Pending | `payment_detected` / latest attempt pending |
| Payment Failed | latest attempt rejected, order still open (resubmit allowed) |
| Payment Confirmed · Challenge Activation Pending | verified, provisioning retry pending |
| Payment Confirmed / Challenge Activated | `paid` / `provisioned` |
| Expired | `expired` (a payment mined within the grace window still pays) |

## Limits

- Transfers from exchanges cannot be matched (EVM: sender; Solana: memo).
- Native coins are never accepted; only the configured settlement token.
- Tests use simulated chain data only (`test/manual-payments.test.mjs`); a real
  low-value payment per network needs owner approval ([Activation](ACTIVATION.md)).
