# Payment activation checklist

Purchases stay **disabled in production** until every gate below is satisfied
and management explicitly approves activation. Passing automated tests is
necessary, not sufficient.

## Acceptance status

| Capability | Status |
| --- | --- |
| Receipt/log correlation, amount, replay, finality, reorg, RPC failure | Implemented and tested (deterministic fixtures) |
| Attempt records, recovery sweep, operator investigation API | Implemented and tested (database + HTTP) |
| Checkout resume after refresh, retryable states | Implemented; browser acceptance pending |
| DePay checkout (Buy Challenge → widget → signed callback → verification → challenge) | Implemented; browser-tested end to end with a **stub widget, mock chain and locally signed callbacks** ([acceptance test](../../e2e/test-depay-checkout.cjs)); **awaiting real-network acceptance** |
| DePay router path (`PURCHASE_ROUTER_ADDRESSES`) | Implemented; **awaiting real-network acceptance** |
| DePay server callback hint | Implemented; **awaiting real-network acceptance** (signature format is verified only against locally generated keys) |
| Refund execution | Not automated by design; manual with recorded adjustment |

## Owner-controlled configuration

| Item | Where |
| --- | --- |
| Approved receiver (a multisig, never a hot key) | `PURCHASE_PAYMENT_RECEIVER` |
| Chain and approved USD stablecoin contract | `PURCHASE_PAYMENT_CHAIN`, `PURCHASE_PAYMENT_TOKEN` |
| Dedicated RPC endpoint for that chain | `PURCHASE_RPC_URL` (secret) |
| Official DePay router for that chain | `PURCHASE_ROUTER_ADDRESSES` |
| Confirmation depth (default 12 in production) | `PURCHASE_PAYMENT_MIN_CONFIRMATIONS` |
| DePay integration (created at app.depay.com), widget URL and its SRI hash | `VITE_DEPAY_WIDGET`, `VITE_DEPAY_WIDGET_URL`, `VITE_DEPAY_WIDGET_INTEGRITY`, `VITE_DEPAY_INTEGRATION_ID` |
| DePay dynamic configuration signing key (public half stored at DePay) | `DEPAY_CONFIG_PRIVATE_KEY` |
| Endpoint URLs set on the DePay integration | `https://<host>/purchases/depay/configuration` and `https://<host>/purchases/depay/callback` |
| CSP origins for the widget | `CSP_EXTRA_SCRIPT_SRC`, `CSP_EXTRA_FRAME_SRC` |
| DePay callback public key | `DEPAY_CALLBACK_PUBLIC_KEY` |

Compute the SRI hash from the exact approved bundle:
`curl -s <widget-url> | openssl dgst -sha384 -binary | openssl base64 -A`,
prefixed with `sha384-`. Re-compute it whenever DePay publishes a new bundle;
the widget does not load if the bytes differ.

## Activation gates

1. Automated suites pass in CI (`npm run test:backend`, `npm run typecheck`,
   `npm run test:web`, `npm run validate:blueprint`).
2. Staging or production-like environment configured as above, with
   `NODE_ENV=production` so the production readiness rules apply.
3. **Real-network acceptance, owner-authorized, low value:**
   a. Direct stablecoin transfer to the receiver confirms the order, creates
      exactly one challenge and one invoice.
   b. A DePay router payment (including one that swaps) confirms with the
      configured router address.
   c. A deliberately underpaid payment is rejected and appears in the review
      queue.
   d. Submitting the same hash twice returns the same result.
   e. A payment whose browser request is interrupted is recovered by the sweep.
4. The receiver multisig signers can move funds out, and the refund procedure
   (record via payment adjustment) has been rehearsed.
5. Database backup and restore have been exercised.
6. Legal pages, KYC policy and compliance review are approved.
7. Management gives explicit approval. Only then set
   `PURCHASE_PAYMENT_RECEIVER` on the production service.

Rollback: unset `PURCHASE_PAYMENT_RECEIVER` (purchases stop immediately; paid
orders, invoices and challenges are untouched). The schema change is additive
(`payment_attempts`); the previous release ignores it.
