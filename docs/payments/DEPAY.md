# DePay integration (multi-chain payments)

Status: **IMPLEMENTED — REQUIRES OWNER CONFIGURATION AND LIVE VERIFICATION.**
The dedicated checkout and the vendored widget ([ADR 0026](../decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md)) are on branch
`agent/claude/depay-checkout-chart-ux` (not merged, not deployed).
The code is on `main` and deployed with v0.4.4 (commit `67cc812`), but
production purchases stay disabled until the owner configures the settlement
chains and the DePay integration below. No real payment has been verified.
The vendor specification is
[DePay — Button](https://depay.com/docs/payments/integrate/button/). Where this
page and the vendor page disagree, the vendor page is authoritative and the
code must be corrected.

## Two separate chain policies

| Concept | Policy | Where it is enforced |
| --- | --- | --- |
| **Wallet authentication** (SIWE sign-in, wallet profile) | Arbitrum One only, chain `42161` | `server.js` `AUTH_CHAINS`; `apps/web-react/src/wallet/config.ts` |
| **Payment** (DePay checkout) | Every settlement chain the owner configures in `PURCHASE_PAYMENT_CHAINS` | `purchases.js` `paymentChains()`; dynamic configuration; chain-aware verifiers |

The authentication chain is never used as a payment constraint. The Openfund
session is a server cookie that is independent of the wallet's current
network, so DePay may switch the wallet to another chain (or use a separate
Solana wallet) without signing the customer out. Test `M6` asserts that
authentication stays Arbitrum-only while payments are multi-chain.

## Trust model

| Input | Trusted for | Never trusted for |
| --- | --- | --- |
| Browser (DePay button) | Opening the payment UI for an order id | Price, receiver, token, network, payment success |
| DePay configuration request | Which order DePay is about to display (signed by DePay) | Price or receiver: the server answers from its own order |
| DePay callback / event | A **hint**: which transaction to check, for which order (signed by DePay) | Payment confirmation, amount, success |
| Chain RPC of the payment chain (`PURCHASE_RPC_URLS`) | Receipt or signature status, receiver, settlement token, amount, block time, finality | — |

Only the chain verifier (`payment-verification.js` for EVM chains,
`solana-verification.js` for Solana, called by `verifyAndConfirm`) moves an
order to `paid`. A callback or event never does.

## Supported networks

DePay lists these networks on
[Supported blockchains](https://depay.com/docs/payments/supported/blockchains)
(checked 2026-11-11): Ethereum, BNB Smart Chain, Polygon, Avalanche, Gnosis,
Arbitrum, Optimism, Base, World Chain and Solana. Openfund maps each to a
verifier:

| DePay identifier | Network | Chain id in Openfund | Verifier |
| --- | --- | --- | --- |
| `ethereum` | Ethereum | 1 | EVM receipt + ERC-20 `Transfer` log |
| `bsc` | BNB Smart Chain | 56 | EVM |
| `polygon` | Polygon PoS | 137 | EVM |
| `avalanche` | Avalanche C-Chain | 43114 | EVM |
| `gnosis` | Gnosis | 100 | EVM |
| `arbitrum` | Arbitrum One | 42161 | EVM |
| `optimism` | Optimism | 10 | EVM |
| `base` | Base | 8453 | EVM |
| `worldchain` | World Chain | 480 | EVM |
| `solana` | Solana | 501 (internal id) | Solana JSON-RPC: finalized signature, SPL settlement-mint balance delta to the receiver |

The identifiers `ethereum`, `bsc`, `polygon`, `solana`, `gnosis`,
`avalanche`, `arbitrum`, `optimism` and `base` appear in DePay's own button
example. **`worldchain` does not appear in the DePay pages read on
2026-11-11**: confirm the identifier in the DePay dashboard before adding a
World Chain entry.

Supporting a network does not mean every token on it converts. DePay decides
which payer tokens it can route into the configured settlement token. Openfund
only requires that the **settlement** token, receiver and amount are correct
on the payment chain.

## Configuration (Render, service `openfund`)

```json
PURCHASE_PAYMENT_CHAINS=[
  {"blockchain":"arbitrum","token":"<USDC on Arbitrum>","receiver":"<merchant address>","routers":["<DePay router on Arbitrum>"]},
  {"blockchain":"base","token":"<USDC on Base>","receiver":"<merchant address>","routers":["<DePay router on Base>"]},
  {"blockchain":"solana","token":"<USDC SPL mint>","receiver":"<merchant owner key>"}
]
PURCHASE_RPC_URLS={"arbitrum":"https://…","base":"https://…","solana":"https://…"}   (secret)
```

- `token` is the **settlement** token the merchant receives on that chain (for
  Solana, the SPL mint). Only approved USD stablecoins may be used, because
  the amount is priced 1:1 in USD.
- `receiver` is a public address. Optional per entry: `tokenDecimals` (must
  equal the contract), `minConfirmations` (default 12 in production),
  `routers` (approved DePay router contracts on that chain).
- A chain is offered only when it is complete. In production that means
  receiver, token and a dedicated RPC endpoint. Incomplete entries are
  ignored, and an unsupported identifier is logged and skipped.
- Without `PURCHASE_PAYMENT_CHAINS` the legacy single-chain variables
  (`PURCHASE_PAYMENT_RECEIVER`, `_CHAIN`, `_TOKEN`, `_DECIMALS`,
  `PURCHASE_RPC_URL`, `PURCHASE_ROUTER_ADDRESSES`) define one chain. They exist
  for compatibility and should not be used for new configuration.

## Checkout page and widget

The checkout is the dedicated page `/:locale/checkout`
(`apps/web-react/src/features/purchase/CheckoutPage.tsx`, [ADR 0026](../decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md)):
wallet, challenge model, account size, server quote and coupon, customer
email (required for the receipt) and name, review, **Pay with DePay**, live
payment status and the verified receipt. The challenge builder hands its
selection to it. `?order=<id>` resumes an open order or shows a paid order's
receipt, also after a refresh, a wallet disconnect or a later visit, and the
purchase history links every order to it.

**Pay with DePay** creates (or reuses, by idempotency key) the server-priced
order and opens the official widget with the documented managed integration
([DePay widget](https://depay.com/docs/payments/integrate/widget/)):

```js
DePayWidgets.Payment({ integration: '<VITE_DEPAY_INTEGRATION_ID>', payload: { orderId: '<server order uuid>' },
  sent, succeeded, validated, failed, closed, critical, error })
```

- The bundle is the official `@depay/widgets@13.0.45` UMD build, vendored and
  served same-origin with an SRI hash generated by
  `scripts/upstream/vendor-depay-widgets.mjs`. No CDN, CSP exception or
  hand-computed hash is needed. It loads on the first click; one widget
  instance is open at a time.
- Openfund passes **no** `accept`, `allow`, `deny`, `blockchains` or token
  list. DePay decides which wallets, networks and payer tokens can pay
  (converting into the settlement token where its routing allows). The
  networks are the settlement chains the dynamic configuration returns, never
  the Arbitrum sign-in chain.
- The client callbacks only update the page (submitted, network accepted,
  failed on chain, window closed). The order is paid only by the signed
  callback or event plus on-chain verification. The page learns the outcome
  by polling, so a delayed or offline completion is shown on the next visit.
- A 100% coupon order is never sent to DePay. It uses the zero-payment flow
  ([Coupons](COUPONS.md)).
- Without an integration id the page offers the manual fallback (server
  receiver address plus transaction-hash verification from the signed-in
  wallet).

## Endpoints (public, same origin as the application)

All three return **404** unless `DEPAY_VERIFY_PUBLIC_KEY` is set and at least
one payment chain is ready. The configuration endpoint also requires
`DEPAY_CONFIG_PRIVATE_KEY`.

| Purpose | Method and path | Authentication |
| --- | --- | --- |
| Dynamic configuration | `POST /purchases/depay/configuration` | DePay `x-signature` over the raw body. Response signed with the Openfund key |
| Callback (successful payment) | `POST /purchases/depay/callback` | DePay `x-signature` over the raw body |
| Events (`attempt`, `processing`, `failed`, `succeeded`) | `POST /purchases/depay/events` | DePay `x-signature` over the raw body |
| Receipt (customer) | `GET /purchases/orders/:id/receipt` | Openfund session; owner only. Built from the order, the verified `payments` row, the invoice and the challenge; DePay's `sent_token`/`sent_amount` are labelled as reported |

### Dynamic configuration

DePay posts the button payload (`{"orderId": "…"}`). The server verifies the
signature, loads the order and answers within DePay's 2-second limit with one
`accept` entry per ready chain:

```json
{"accept":[
  {"blockchain":"arbitrum","amount":60,"token":"<settlement token>","receiver":"<receiver>"},
  {"blockchain":"base","amount":60,"token":"<settlement token>","receiver":"<receiver>"}
]}
```

`amount` is the order's **net** server price (plan price of record minus a
validated coupon, frozen when the order was created) as a human-readable JSON
number. The body is signed with `DEPAY_CONFIG_PRIVATE_KEY` (RSA-PSS, SHA-256,
MGF1-SHA-256, 64-byte salt, base64url without padding) in `x-signature`, with
`Cache-Control: no-store`. Unknown, paid, cancelled, expired, zero-payment and
malformed orders are refused (404/409).

### Callback and events: order correlation

1. Verify `x-signature`. Invalid → 401.
2. Resolve the chain from `blockchain`. A chain that is not configured is
   recorded as ignored and never paid.
3. The order is identified **only** by `payload.orderId`, which originated in
   Openfund's signed configuration. It must be an open, payment-required order
   created in the last 24 hours. A wallet address is never used to find an
   order, so a payment from an unrelated wallet cannot attach to another
   customer's order, and the payer may use any wallet on any configured chain.
4. A retryable `payment_attempts` row is registered (unique per order, chain
   and transaction), the order moves to `payment_detected`, and the delivery
   is stored once in `depay_events` (deduplicated by body hash).
5. The service answers 200 only after the delivery is durably recorded. A
   database failure answers 500 so DePay retries (25 retries over about 21
   days).
6. The chain verifier runs immediately and again from the recovery sweep
   while the result is retryable (not mined, not final, RPC unavailable,
   reorg).

Customer-submitted transaction ids (the manual fallback) are EVM only and
still require the customer's own signed-in wallet as sender.

### Source token versus settlement

DePay's `token` and `amount` describe what the **receiver gets**. The payer's
original token and amount are sent only in `sent_token` and `sent_amount`,
when **Include sent token information** is enabled in the integration.
Openfund records:

| Column (`payments`) | Meaning | Trust |
| --- | --- | --- |
| `blockchain`, `chain_id` | Payment chain | Verified |
| `token_address`, `amount`, `to_address` | Settlement token, base-unit amount, receiver | Verified on chain |
| `source_token`, `source_amount` | Payer's original token and amount from `sent_token` / `sent_amount` | Reported by DePay, accounting reference only |

Revenue is recognised from the verified settlement amount, never from the
reported source amount.

## Idempotency and recovery

- `UNIQUE (chain_id, tx_hash)` on `payments`: one transaction pays at most one
  order. EVM hashes are compared lower-case; Solana signatures are
  case-sensitive and use their own chain id, so ids never collide across
  chains.
- `UNIQUE (purchase_order_id, chain_id, tx_hash)` on `payment_attempts`.
- `confirmPurchaseTx` runs in one transaction that locks the order row. It
  writes the payment, flips the order to `paid → provisioned`, provisions
  exactly one challenge, writes one invoice, consumes the coupon and records
  the commission decision, or writes nothing.

## Dashboard settings (app.depay.com) — owner checklist

Nothing below has been verified in the dashboard; this task had no dashboard
access.

| Setting | Value |
| --- | --- |
| Integration type | Payment **Widget** (managed integration; the same integration id) |
| Integration ID | `a42b60b9-ab0a-422e-ad3c-a5580d8ba64d` as provided by the owner. Confirm it is the active integration, then set `VITE_DEPAY_INTEGRATION_ID` on Render |
| Configuration | **Dynamic**. Endpoint `https://openfi.cloud/purchases/depay/configuration` |
| Dynamic configuration public key | Public half of `DEPAY_CONFIG_PRIVATE_KEY` (generate below) |
| Callback URL | `https://openfi.cloud/purchases/depay/callback` |
| Include sent token information | **On** (fills `source_token` / `source_amount`) |
| Events URL | `https://openfi.cloud/purchases/depay/events` |
| Restrict domains | `openfi.cloud`, `openfund.cloud` (each subdomain separately if used) |
| Accepted networks and tokens | The same chains, settlement tokens and receivers as `PURCHASE_PAYMENT_CHAINS` |
| DePay Verify public key | Copy into Render `DEPAY_VERIFY_PUBLIC_KEY` |

Render values to set on `openfund`: `PURCHASE_PAYMENT_CHAINS`,
`PURCHASE_RPC_URLS` (secret), `DEPAY_VERIFY_PUBLIC_KEY`,
`DEPAY_CONFIG_PRIVATE_KEY` (secret) and `VITE_DEPAY_INTEGRATION_ID`. With the
vendored widget, `VITE_DEPAY_WIDGET_URL`, `VITE_DEPAY_WIDGET_INTEGRITY`,
`CSP_EXTRA_SCRIPT_SRC` and `CSP_EXTRA_FRAME_SRC` are not needed;
`VITE_DEPAY_WIDGET=0` turns the widget off.
The `VITE_DEPAY_*` and `VITE_WALLETCONNECT_PROJECT_ID` values are read at runtime by `/runtime-config.js` (`apps/backend/runtime-config.js`), not baked into the build; a restart or redeploy applies them.

Key generation (operator workstation, never in the repository):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out depay_config_private.pem
openssl rsa -pubout -in depay_config_private.pem -out depay_config_public.pem
```

## Acceptance evidence

Local, 2026-11-12, branch `agent/claude/depay-checkout-chart-ux`:

- `apps/backend/test/commerce.test.mjs` 31/31, including K1 (customer details,
  verified receipt, owner-only), K2 (late `attempt`/`processing`/`failed`
  never downgrade a paid order) and K3 (a provisioning failure after a proven
  payment is retried by the sweep and issues exactly one challenge).
- `e2e/test-depay-checkout.cjs` 40/40 (stub widget, mock chain, locally
  signed callbacks): builder → checkout page → Pay with DePay → one order, one
  widget, no network/token restriction passed → underpayment rejected →
  refresh mid-payment resumes → verified receipt → redelivery idempotent →
  revisit by link → tampered bundle blocked.
- The **real** vendored widget was opened in Chromium under the production
  CSP: SRI passed, `DePayWidgets.Payment` mounted the DePay dialog, and the
  widget requested `public.depay.com/configurations/<integration id>`. DePay
  answered **403** from `localhost`, so the widget showed "Unable to load
  payment configuration". The integration's domain restriction and the closed
  production configuration endpoint are the expected causes; both are owner
  settings below.

Automated, against real PostgreSQL with a simulated chain verifier (so **not**
evidence of a real payment): `apps/backend/test/commerce.test.mjs`.

| Requirement | Test |
| --- | --- |
| Arbitrum-only wallet login | `M6`, `test/siwe.test.mjs` |
| Payment not forced to Arbitrum; every configured chain offered | `P2`, `M1` |
| Non-Arbitrum EVM payment (Base) from another wallet, verified on Base | `M2` |
| Non-EVM chain (Solana) verification, case-sensitive ids | `M4`, `M5` |
| Unsupported network handling | `M3`, `D3` |
| Source token versus settlement accounting | `M2` |
| Purchase activation | `M2`, `D2`, `Z1` |
| Invalid signature rejected | `D2`, `D6` |
| Duplicate callbacks processed once | `D2`, `D4` |
| Missing or mismatched transaction rejected | `D3`, `M3`, `test/payment-verification.test.mjs` |
| Multi-chain reconciliation, no cross-chain id collision | `M4` |

The final acceptance step needs owner approval: one small real payment on a
non-Arbitrum chain through the deployed button, then the transaction id,
order id and verifier result recorded here. Until then the subsystem stays
**IMPLEMENTED — REQUIRES LIVE VERIFICATION**.
