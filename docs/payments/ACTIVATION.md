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

## Production state (verified 2026-11-13)

Read-only, commit `6587b75` live on both hosts. Same variable state as below
(no settlement chain; `PURCHASE_PAYMENT_DECIMALS=18` is still set). New
evidence: the official widget, opened on `https://openfi.cloud` in Chromium,
loads (SRI and CSP pass) and DePay POSTs to
`https://openfi.cloud/api/payments/depay/config`, which returned 404, so DePay
answered the widget with 500 ("Unable to load payment configuration!"). The
branch `agent/claude/depay-checkout-activation` serves that URL; the owner
steps are in [Owner setup](OWNER_SETUP.md).

## Production state (verified 2026-11-12)

Read-only checks against `https://openfi.cloud` and `https://openfund.cloud`
(both serving `4e1ca3d`, deployed manually 2026-11-12 06:14 UTC) and the
Render service `openfund` (variable **names** and whether a value is set; no
value was printed or changed):

| Check | Result |
| --- | --- |
| `GET /purchases/plans` | `paymentsEnabled: false`, `payment: null` |
| `/runtime-config.js` | `depayWidget: false`, empty `depayWidgetUrl`, `depayWidgetIntegrity`, `depayIntegrationId` |
| `POST /purchases/depay/configuration`, `/callback`, `/events` (unsigned) | `404 not_found`: by design, these stay closed until at least one settlement chain is complete |
| Set on Render | `DEPAY_CONFIG_PRIVATE_KEY`, `DEPAY_VERIFY_PUBLIC_KEY`, `VITE_DEPAY_INTEGRATION_ID`, `PURCHASE_PAYMENT_CHAIN=42161`, `PURCHASE_PAYMENT_DECIMALS`, `PURCHASE_LATE_GRACE_MINUTES` |
| **Not set on Render** | `PURCHASE_PAYMENT_CHAINS`, `PURCHASE_RPC_URLS`, `PURCHASE_PAYMENT_RECEIVER`, `PURCHASE_PAYMENT_TOKEN`, `PURCHASE_RPC_URL`, `PURCHASE_ROUTER_ADDRESSES`, `VITE_DEPAY_WIDGET`, `VITE_DEPAY_WIDGET_URL`, `VITE_DEPAY_WIDGET_INTEGRITY`, `CSP_EXTRA_SCRIPT_SRC`, `CSP_EXTRA_FRAME_SRC`, `VITE_WALLETCONNECT_PROJECT_ID` |
| `PURCHASE_PAYMENT_MIN_CONFIRMATIONS` | declared but empty (production default 12 applies) |

Consequences:

- No settlement chain is complete (no receiver, token or RPC), so purchases
  and the DePay endpoints are off. This, not application code, is why
  Challenge purchases do not work in production.
- With only the legacy `PURCHASE_PAYMENT_CHAIN=42161` and no
  `PURCHASE_PAYMENT_CHAINS`, an activation would be single-chain (Arbitrum
  One). Set `PURCHASE_PAYMENT_CHAINS` to offer the intended networks; wallet
  sign-in stays Arbitrum One regardless.
- The widget no longer depends on CSP or bundle variables: the vendored
  bundle is same-origin and SRI-pinned at build time ([ADR 0026](../decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md)).
  `VITE_DEPAY_INTEGRATION_ID` (already set on Render) enables it once a
  settlement chain is complete.
- Without `VITE_WALLETCONNECT_PROJECT_ID` only browser-extension (injected)
  wallets can connect; mobile WalletConnect wallets cannot reach checkout.

Local acceptance on the same code (Node 22, isolated database, stub widget,
mock chain): `test:browser:purchase` 17 passed, `test:browser:depay` 31
passed, `test:browser:wallet` 32/32. A wallet network change does not end the
SIWE session (`useOpenfundSession` logs out only on disconnect or an address
change). No real payment has been made; gate 3 below is still open.

## Owner-controlled configuration

| Item | Where |
| --- | --- |
| Approved receiver (a multisig, never a hot key) | `PURCHASE_PAYMENT_RECEIVER` |
| Settlement chains, approved USD stablecoin and receiver per chain | `PURCHASE_PAYMENT_CHAINS` (JSON) and `PURCHASE_RPC_URLS` (secret); see [DePay](DEPAY.md) |
| Dedicated RPC endpoint for that chain | `PURCHASE_RPC_URL` (secret) |
| Official DePay router for that chain | `PURCHASE_ROUTER_ADDRESSES` |
| Confirmation depth (default 12 in production) | `PURCHASE_PAYMENT_MIN_CONFIRMATIONS` |
| DePay integration (created at app.depay.com) | `VITE_DEPAY_INTEGRATION_ID` (the widget bundle is vendored and SRI-pinned, [ADR 0026](../decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md); `VITE_DEPAY_WIDGET_URL` / `_INTEGRITY` only for an external override) |
| DePay dynamic configuration signing key (public half stored at DePay) | `DEPAY_CONFIG_PRIVATE_KEY` |
| Endpoint URLs set on the DePay integration | `https://<host>/purchases/depay/configuration`, `https://<host>/purchases/depay/callback` and the events URL `https://<host>/purchases/depay/events` |
| CSP origins for the widget | None for the vendored same-origin bundle (verified in Chromium under the production CSP). `CSP_EXTRA_SCRIPT_SRC` / `CSP_EXTRA_FRAME_SRC` only for an external override. `connect-src` already allows `https:`/`wss:` |
| DePay Verify public key (signs configuration requests, callbacks and events) | `DEPAY_VERIFY_PUBLIC_KEY` (legacy name `DEPAY_CALLBACK_PUBLIC_KEY`) |
| Checkout chains | Every complete entry in `PURCHASE_PAYMENT_CHAINS` (EVM networks and Solana). Wallet sign-in stays Arbitrum One only; payment is not tied to it |

The vendored bundle's SRI hash is generated by
`node scripts/upstream/vendor-depay-widgets.mjs --update` (which checks the
npm registry's sha512 integrity first). Only an external override bundle
needs a hand-computed hash: `openssl dgst -sha384 -binary bundle.js | openssl base64 -A`,
prefixed with `sha384-`, from a file saved in a browser (the DePay CDN answers
non-browser clients with HTTP 403).

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
