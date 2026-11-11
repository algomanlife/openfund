# Challenge payment verification and recovery

This page is the operating contract for how Openfund decides that a challenge
has been paid. It supersedes the verifier description in
[ADR 0009](../decisions/0009-challenge-purchases-and-payment-verification.md)
where they differ; the decision record is
[ADR 0018](../decisions/0018-payment-verification-and-recovery.md).

**Status.** Implemented and covered by deterministic receipt fixtures and
database tests. **Not yet accepted on a real network**: no mocked chain test is
evidence of real payment acceptance. See [Activation](ACTIVATION.md).

## Principles

1. The backend on-chain verifier is the only authority. A DePay widget
   success message, a browser callback, a DePay server callback or an
   operator typing a hash never confirm a payment by themselves.
2. Pricing, receiver, chain and token come from the server. The frontend
   cannot change any of them.
3. Native coin is never converted to USD. Production accepts exactly one
   approved ERC-20 stablecoin (priced 1:1 to USD by policy; a depeg is an
   operational incident handled by disabling purchases).
4. Money received is never silently dropped: every outcome that is not a
   clean confirmation is recorded and reviewable.

## Payment-correlation policy

A transaction pays an order only if all of the following hold.

| Check | Rule | Failure code |
| --- | --- | --- |
| Receipt | Mined and `status = success` | `tx_not_successful` |
| Signer | `tx.from` equals the signed-in wallet. Smart-contract wallets are not supported | `wrong_sender` |
| Target | The transaction calls the approved token contract (direct transfer) or an address in `PURCHASE_ROUTER_ADDRESSES` | `unapproved_contract` |
| Asset | Only `Transfer` logs emitted by the approved token contract count | `wrong_token` |
| Recipient | Only transfers whose recipient is the merchant receiver count | `wrong_receiver` |
| Sender of the transfer | Only transfers sent by the payer or an approved router count, so unrelated third-party transfers cannot satisfy an order | `transfer_not_from_payer` |
| Amount | The **sum** of the counted transfers is at least the order price in token units. Units use the token's on-chain `decimals()` | `insufficient_amount` |
| Timing | Block timestamp is not earlier than the order (5 minute skew allowance) | `tx_too_old` |
| Uniqueness | `UNIQUE (chain_id, tx_hash)` across the whole system | `tx_already_used` |
| Finality | At least `PURCHASE_PAYMENT_MIN_CONFIRMATIONS` confirmations (production default 12) | `tx_not_final` (retryable) |
| Canonical chain | The receipt's block hash still matches the chain at that height | `tx_reorged` (retryable) |

The first `Transfer` log is never assumed to be the payment. Logs flagged
`removed` are ignored. Overpayment is accepted and the case is opened for
review.

### Routed payments (DePay Payment Router)

DePay pays the merchant through its router contract, and can swap the payer's
input asset into the approved token first. The transaction therefore targets
the router, not the token. Add the **official router address for the
configured chain** to `PURCHASE_ROUTER_ADDRESSES`; the verifier then counts
the router's payout to the receiver and ignores the input-token legs.

Router addresses are not hardcoded in this repository. Take them from the
DePay deployments page (`https://depay.com/docs/payments/protocol/deployments`)
and confirm them on a block explorer before configuring. DePay documents
mainnets only; there is no testnet router, so a router-path acceptance test
needs a real, low-value mainnet payment.

### Configuration is validated at verification time

- A dedicated RPC endpoint per payment chain (`PURCHASE_RPC_URLS`, or the
  legacy `PURCHASE_RPC_URL`) is required in production. There is no public-RPC
  fallback. Each EVM RPC's `eth_chainId` must equal the chain it is configured for in
  `PURCHASE_RPC_URLS`.
- `PURCHASE_PAYMENT_DECIMALS` is optional. When set it must equal the
  contract's `decimals()`; a mismatch fails closed (`payment_misconfigured`).
  When unset the contract value is used. The previous silent default of 18
  decimals is gone.
- Production purchases are offered only when receiver, token and RPC are all
  configured (`paymentsEnabled` stays `false` otherwise).

## DePay checkout flow

1. The customer picks a plan and size and presses **Buy Challenge**. The
   server creates an order at the catalog price (or resumes the pending one).
2. The page loads the widget bundle (https URL pinned by a Subresource
   Integrity hash) and calls `DePayWidgets.Payment({ integration, payload: { orderId } })`.
   The browser never supplies a chain, token, amount or receiver.
3. DePay asks `POST /purchases/depay/configuration` with the payload. The
   server answers from the order and its configuration —
   `{ accept: [{ blockchain, amount, token, receiver }] }` — signed with
   `DEPAY_CONFIG_PRIVATE_KEY` (RSA-PSS, SHA-256, base64url, `x-signature`),
   within DePay's two-second limit. Only payable orders are answered.
4. The customer pays in the widget.
5. DePay calls `POST /purchases/depay/callback`. The signature is verified
   against `DEPAY_VERIFY_PUBLIC_KEY` (formerly `DEPAY_CALLBACK_PUBLIC_KEY`), the call is acknowledged with 200
   immediately and the transaction hash is registered as an attempt for the
   sender's open order (the order id from the payload is used when present).
6. The on-chain verifier decides (all rules above). If the chain is not
   ready the recovery sweep keeps retrying; a rejection is shown to the
   customer and queued for operators.
7. One database transaction creates the payment, invoice and exactly one
   challenge. The checkout, which polls the order, shows *Payment
   successful* and the challenge appears in the Dashboard.

The widget's own success event is not documented for the browser and is
never used. A redelivered callback is harmless (same result).

## Lifecycle and recovery

Every verification the customer, the recovery sweep or an operator triggers
is stored in `payment_attempts` (`pending`, `rejected` or `confirmed`).

| Situation | Behaviour |
| --- | --- |
| Receipt not available yet | `tx_pending`, retryable; the sweep re-checks every minute for 24 hours |
| Not enough confirmations | `tx_not_final`, retryable |
| RPC unavailable | `rpc_unavailable`, retryable; never treated as a payment verdict |
| Reorg detected | `tx_reorged`, retryable |
| Customer closed the page after paying | The checkout stores the submitted hash and resumes after a refresh; the sweep verifies it without the browser |
| Wallet paid but the hash was never submitted | An optional signed DePay server callback registers the reported hash as a retryable **hint**; the sweep proves it on-chain. Configure `DEPAY_VERIFY_PUBLIC_KEY`. Signed DePay events are handled the same way ([DePay](DEPAY.md)) |
| Order expired before the payment was mined | Accepted if mined within `PURCHASE_LATE_GRACE_MINUTES` after expiry; otherwise rejected as `late` for manual reconciliation |
| Application restart mid-verification | Provisioning is one database transaction; attempts are durable and the sweep resumes them |
| Same hash submitted twice or concurrently | One payment, one invoice, one challenge; repeats return the same result |

### Cases that open an operator review

`underpayment`, `wrong_token`, `wrong_receiver`, `late`, `duplicate` and
`overpayment`. Wrong sender, reverted and other rejections are recorded but do
not move funds to Openfund.

## Operator workflow

All endpoints use the admin service token and a named operator in
`X-Admin-Actor`.

1. `GET /admin/payments/lookup?orderId=…&txHash=…` shows the order, confirmed
   payments and every attempt.
2. `GET /admin/payments/attempts?review=open` lists cases awaiting review;
   `?retryable=1` lists payments stuck on a chain condition.
3. `POST /admin/payments/attempts/:id/reverify` re-runs the authoritative
   verification (recovers "paid on chain, never provisioned").
4. `POST /admin/payments/attempts/:id/review` with a `note` resolves the case.
5. **Refunds are never automatic.** After a refund is executed by an
   authorized signer, record it as a payment adjustment through the economy
   admin API with the settlement reference. Resolving a review does not move
   funds.

Every operator action is written to the append-only `financial_audit_log`.
