# ADR 0009 — Challenge Purchases, Server-Side Payment Verification and Financial History

- **Status:** Accepted (local implementation; production payment activation pending explicit approval)
- **Date:** 2026-11-03

## Context

Openfund sells prop-trading challenges. The commercial catalog (`challenge_plans`, prices
inside `configuration.priceUsd`) was already published and seeded, and `openfund_challenges`
already existed as the account record that `accountDirectory()` and the products router
consume — but **no production code created challenge records**; checkout dialogs stated
plainly that purchasing was not enabled. The Phase 1 assignment required: wallet-based
profiles (editable name/avatar), challenge selection and purchase with backend-controlled
pricing, DePay checkout, server-side blockchain payment verification, exactly-once
challenge provisioning, purchase/payment history, downloadable invoices, and withdrawal
requests — without duplicating the trading engine, account model, wallet integration, or
visual system.

Hard constraints (repository rules): no hardcoded production payment destination, no
invented pricing, no production payment activation without explicit approval, additive
idempotent migrations, no changes to unrelated Perpetual/trading functionality.

## Decision

1. **Purchases provision `openfund_challenges` rows — nothing else.** A confirmed payment
   inserts exactly one challenge record (status `created`, purchased `account_size_usd`,
   `purchase_order_id` provenance). The existing account directory and product scoping
   (`?account=<challenge uuid>` with ownership check) already consume these rows, so the
   Dashboard, journal and product pages light up without touching the trading engine or
   `demo_accounts` (whose `UNIQUE (user_id, account_type)` stays unchanged). Challenge
   evaluation/rule enforcement remains future work; a purchased challenge is a record, not
   an enforced evaluation.
2. **Server-priced orders.** `POST /purchases/orders` snapshots the price from
   `challenge_plans.configuration` at order time (idempotency per user+key, 1-hour
   expiry). The frontend never supplies a price.
3. **Payment destination is an env var, never data.** `PURCHASE_PAYMENT_RECEIVER`
   (plus optional chain/token config). While unset, every purchase endpoint reports
   `purchases_disabled` and the UI keeps the honest "not enabled" copy. The receiver
   address is public information, but a production activation requires entering an
   approved value — satisfying the no-hardcoded-destination and no-activation rules.
4. **Server-side on-chain verification with viem (no new dependencies).** The user
   submits a transaction hash; the backend checks receipt success, sender = session
   wallet, receiver = configured address (native value or ERC-20 `Transfer` log from
   payer to receiver), amount ≥ order price (exact decimal-string unit conversion —
   float math would lose precision above 2^53), and block timestamp within the implemented order-time tolerance (five minutes before order creation is accepted).
   `UNIQUE (chain_id, tx_hash)` makes each on-chain payment usable exactly once
   system-wide; the provisioning transaction (payment row + order paid + challenge +
   invoice) is atomic and replay-safe.
5. **DePay is an optional, configuration-gated widget.** The checkout panel loads the
   DePay widget bundle only when `VITE_DEPAY_WIDGET=1` and `VITE_DEPAY_WIDGET_URL` are
   set, and always builds it from backend-provided order data. Manual payment
   instructions + transaction-hash submission remain the default, verified path — no
   unverified external bundle ships by default.
6. **Invoices are dependency-free PDFs.** `apps/backend/invoice-pdf.js` renders a
   single-page A4 invoice (Helvetica, English/latin numerals — a financial document of
   record; app localization is unaffected). Number labels include the year, but allocation uses a single PostgreSQL sequence: gaps are possible and numbering does not reset yearly.
7. **Withdrawals are requests, not payouts.** `withdrawal_requests` records
   user-submitted requests (optionally linked to an owned challenge); review/approval
   stays with the operator. The UI replaces the placeholder capability page.
8. **Profile editing extends the existing identity.** `PATCH /auth/profile` updates
   `display_name` (1–60 chars) and `avatar_url` (https URL or ≤256 KB image data URL);
   the wallet identity itself is immutable, preserving one-wallet-one-user.
9. **Legacy landing stays untouched.** The challenges page's own runtime (app.js /
   features.js) is never edited; a React `CheckoutHost` intercepts the existing summary
   dialog's confirm button and re-labels the legacy copy only when the backend reports
   payments enabled.
10. **Test seams mirror the existing pattern.** `/internal/confirm-order` (SIM_TEST_MODE
    + test database, same gate as `price-inject`) lets unit and browser E2E suites drive
    the full purchase lifecycle without a chain; the browser E2E uses the established
    disposable EIP-6963 signer pattern.

## Consequences

- Purchase lifecycle is fully testable locally and in CI; a real on-chain verification
  against a live network remains untested until a payment destination is approved.
- Wallet auto-reconnect races (observed in E2E after reload-based route changes) are
  tolerated in tests by re-signing in; not a product defect.
- `seed-plans.js` and the production content seeder use different `configuration` key
  spellings for daily-loss fields (`maxDailyLossPct` vs `dailyLossPct`). Purchase code
  only reads `accountSizesUsd`/`priceUsd` (identical in both) — the mismatch affects
  only CMS-rendered plan details and is recorded as a finding, not silently changed.
- Invoice PDFs are minimal; a design pass (branding, Persian) can follow without schema
  changes.
- Existing verifier limits remain production gates, not claims of payment parity: native
  units are compared with a USD-denominated catalog price without a conversion rate;
  the ERC-20 path selects the first Transfer log; explicit finality/reorg acceptance
  is not established. The optional widget maps non-Arbitrum networks to `ethereum`,
  including default Sepolia; live network compatibility is unverified. Preserve
  receiver/widget gates until these conditions receive approved acceptance.
- `accounts.js` marks purchased challenge records read-only and `products.js` rejects
  challenge execution. No funded capital, evaluation or payout is implied by provisioning.
