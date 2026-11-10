# DePay integration (Arbitrum One)

Status: **IMPLEMENTED — LIVE VERIFICATION PENDING** in source on branch
`codex/production-readiness`. It is not deployed, and production purchases
are disabled (`paymentsEnabled: false` on 2026-11-10). This document is the
operator reference for the DePay button, dynamic configuration, callbacks and
events. The vendor specification is
[DePay — Button](https://depay.com/docs/payments/integrate/button/). Where this
page and the vendor page disagree, the vendor page is authoritative and the
code must be corrected.

## Trust model

| Input | Trusted for | Never trusted for |
| --- | --- | --- |
| Browser (DePay button) | Opening the payment UI for an order id | Price, receiver, token, network, payment success |
| DePay configuration request | Which order DePay is about to display (signed by DePay) | Price or receiver: the server answers from its own order |
| DePay callback / event | A **hint**: which transaction to check, for which order (signed by DePay) | Payment confirmation, amount, success |
| Arbitrum RPC (`PURCHASE_RPC_URL`) | Receipt, status, sender, receiver, token, amount, block time, confirmations | — |

Only the on-chain verifier (`payment-verification.js`, called by
`verifyAndConfirm`) moves an order to `paid`. A callback or event never does.

## Network and button

- Arbitrum One (chain `42161`) is the only checkout chain. `paymentsReady()`
  returns false for any other `PURCHASE_PAYMENT_CHAIN`, and the dynamic
  configuration offers only `blockchain: "arbitrum"`.
- The checkout renders the official button with the Arbitrum restriction and
  only the order id as payload:

```html
<div class="DePayButton" label="Pay with DePay"
     integration="<VITE_DEPAY_INTEGRATION_ID>"
     blockchains='["arbitrum"]'
     payload='{"orderId":"<server order uuid>"}'></div>
<!-- bundle: VITE_DEPAY_WIDGET_URL, pinned by VITE_DEPAY_WIDGET_INTEGRITY (SRI) -->
<script>DePayButtons.init({document: document});</script>
```

- The bundle is loaded only when `VITE_DEPAY_WIDGET=1`, an `https` bundle URL,
  its Subresource Integrity hash and the integration id are all configured. The
  vendor's documented bundle is `https://integrate.depay.com/buttons/v13.js`.
  The SRI hash must be computed by the operator from the exact file. The bundle
  origin must also be listed in `CSP_EXTRA_SCRIPT_SRC` (and `CSP_EXTRA_FRAME_SRC`
  if the vendor UI frames). If the configured bundle exposes the widget API
  instead (`DePayWidgets.Payment`), the checkout opens it with the same
  `blockchains: ["arbitrum"]` restriction.
- A 100% coupon order is never sent to DePay. It uses the zero-payment flow
  ([Coupons](COUPONS.md)).

## Endpoints (public, same origin as the application)

The repository serves the API at the application origin (no `/api` prefix).
The routes below exist instead of the brief's suggested `/api/payments/depay/*`
names. All three return **404** unless `DEPAY_VERIFY_PUBLIC_KEY` is set and
purchases are ready. The configuration endpoint also requires
`DEPAY_CONFIG_PRIVATE_KEY`.

| Purpose | Method and path | Authentication |
| --- | --- | --- |
| Dynamic configuration | `POST /purchases/depay/configuration` | DePay `x-signature` over the raw body. Response signed with the Openfund key |
| Callback (successful payment) | `POST /purchases/depay/callback` | DePay `x-signature` over the raw body |
| Events (`attempt`, `processing`, `failed`, `succeeded`) | `POST /purchases/depay/events` | DePay `x-signature` over the raw body |

Production URLs once deployed: `https://openfi.cloud/purchases/depay/…` and
`https://openfund.cloud/purchases/depay/…` (both hosts serve the same
service). Register one host in the DePay dashboard. Both must remain listed in
`ALLOWED_DOMAINS` for wallet sign-in.

### Dynamic configuration

Request: DePay posts the button payload (`{"orderId": "…"}`). The server
verifies the signature, loads the order and answers within DePay's 2-second
limit with exactly:

```json
{"accept":[{"blockchain":"arbitrum","amount":60,"token":"<PURCHASE_PAYMENT_TOKEN>","receiver":"<PURCHASE_PAYMENT_RECEIVER>"}]}
```

`amount` is the order's **net** server price (plan price of record minus a
validated coupon, frozen when the order was created) as a human-readable JSON
number, the format in the vendor documentation. The response body is signed
with `DEPAY_CONFIG_PRIVATE_KEY`, using RSA-PSS with SHA-256, MGF1-SHA-256 and a
64-byte salt. The signature is base64url-encoded without padding and sent in
`x-signature`, with `Cache-Control: no-store`. Unknown, paid, cancelled,
expired, zero-payment and malformed orders are refused (404/409).

### Callback

Body fields used: `blockchain`, `transaction`, `sender`, `receiver`, `token`,
`amount`, `payload.orderId`. Processing:

1. Verify `x-signature` (RSA-PSS / SHA-256 over the raw request bytes; salt
   length recovered from the signature, because DePay's own reference
   verifiers accept any salt length). Invalid → 401.
2. A different blockchain is recorded as `ignored:other_chain`. A receiver or
   token that differs from the server configuration is recorded with the
   mismatch and still sent to the verifier, which classifies it for review.
3. Order identity: `payload.orderId` must be an open, paid-for order of the
   wallet that sent the transaction. Without an order id, only that wallet's
   most recent open order is matched.
4. A retryable `payment_attempts` row is registered (unique per order and
   transaction), the order moves to `payment_detected`, and the delivery is
   stored once in `depay_events` (deduplicated by body hash).
5. The service answers 200 only after the delivery is durably recorded. A
   database failure answers 500, so DePay retries (25 retries over about 21
   days).
6. The on-chain verifier runs immediately and again from the recovery sweep
   while the condition is retryable (not mined, not final, RPC unavailable,
   reorg).

### Events

Same signature and fields plus `status`. `attempt` and `failed` are
recorded only. `processing` and `succeeded` with a transaction register the
same hint as a callback. Only `succeeded` triggers immediate verification.
Events may arrive repeatedly or out of order. A transition happens only from
an earlier state (for example `awaiting_payment` → `payment_detected`), and no
event marks an order paid.

## Idempotency and recovery

- `UNIQUE (chain_id, tx_hash)` on `payments`: one transaction pays at most one
  order.
- `UNIQUE (purchase_order_id, chain_id, tx_hash)` on `payment_attempts`:
  duplicate callbacks and events do not multiply work.
- `confirmPurchaseTx` runs in one database transaction that locks the order
  row (`FOR UPDATE`). It writes the payment, flips the order to
  `paid → provisioned`, provisions exactly one challenge, writes one invoice,
  consumes the coupon and records the commission decision, or writes nothing.
  A replay returns the existing result.
- Recoverable provisioning: when provisioning fails, the whole transaction
  rolls back, the attempt stays `pending` and retryable, and
  `recoverPendingPayments` retries it. No partial purchase is ever committed.

## Dashboard configuration report (app.depay.com)

Values that are not verified are marked as such. Nothing here is fabricated.

| Item | Required value | Status on 2026-11-10 |
| --- | --- | --- |
| Integration name | Operator's choice | **Not verified**: no dashboard access from this task |
| Integration ID | Operator's active integration | `a42b60b9-ab0a-422e-ad3c-a5580d8ba64d` was cited by the owner. It is **not** set in the Render service (`VITE_DEPAY_INTEGRATION_ID` absent), and it has not been confirmed as the active integration. **BLOCKED — EXTERNAL CONFIGURATION REQUIRED** |
| Allowed blockchain | Arbitrum only | Enforced in code: button attribute, server `accept`, `paymentsReady()` |
| Accepted token contracts | One approved USD stablecoin on Arbitrum One (`PURCHASE_PAYMENT_TOKEN`) | **Not configured** on Render. The owner must choose the token. The code accepts exactly one configured token |
| Receiving wallet address | `PURCHASE_PAYMENT_RECEIVER` (public address, Arbitrum One) | **Not configured** (purchases disabled by design until approved) |
| Dynamic configuration endpoint | `https://<host>/purchases/depay/configuration` | Implemented, not deployed |
| Callback URL | `https://<host>/purchases/depay/callback` | Implemented, not deployed |
| Events URL | `https://<host>/purchases/depay/events` | Implemented, not deployed |
| Authorized domains | `openfi.cloud`, `openfund.cloud` (plus the onrender host if used) | **Not verified** in the dashboard |
| Openfund public key (Dynamic Configuration) | Public half of `DEPAY_CONFIG_PRIVATE_KEY` | `DEPAY_CONFIG_PRIVATE_KEY` is **not set** on Render, so no key pair is in use. Generate a new pair (see below), register the public half, and store the private half only as a Render secret |
| DePay Verify public key | `DEPAY_VERIFY_PUBLIC_KEY` from the integration's Verify section | **Not set** on Render |
| Payment router | DePay router address on Arbitrum One in `PURCHASE_ROUTER_ADDRESSES` | **Not configured**. Without it, router-routed payments are rejected as `unapproved_contract` |
| RPC | Dedicated Arbitrum One endpoint `PURCHASE_RPC_URL` | **Not configured** (required in production) |

Key generation (operator workstation, never in the repository):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out depay_config_private.pem
openssl rsa -pubout -in depay_config_private.pem -out depay_config_public.pem
```

Before replacing any existing dashboard key, confirm whether its private half
is held anywhere. The 2026-11-10 audit found none configured on Render.

## Acceptance evidence

Automated (in-process, real PostgreSQL, simulated chain verifier, so **not**
evidence of a real payment): `apps/backend/test/commerce.test.mjs` cases
D1–D6 and `test/payment-verification.test.mjs`. These cover signature
rejection, the signed response format, price, discount, wrong chain, receiver
and amount, duplicate and retried callbacks, out-of-order events, database
failure, missing and expired orders, RPC failure and recovery.

The live acceptance step still to do: one real Arbitrum payment through the
deployed button. Report its transaction hash, order id and verifier result,
with the receiver and wallet redacted as needed. Until then the subsystem
stays **IMPLEMENTED — LIVE VERIFICATION PENDING**.
