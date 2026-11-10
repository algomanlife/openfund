# ADR 0022 — Arbitrum-only wallet and checkout, coupons and an explicit order lifecycle

- **Status:** Accepted (implementation; production activation pending owner approval)
- **Date:** 2026-11-10
- **Builds on:** [ADR 0009](0009-challenge-purchases-and-payment-verification.md), [ADR 0018](0018-payment-verification-and-recovery.md)

## Context

Prop wallets signed in on Ethereum Sepolia and Perpetual on Arbitrum One. The
payment chain defaulted to Sepolia. DePay's dynamic-configuration request was
answered without verifying DePay's signature, events were not received, there
was no coupon engine, and order state was a four-value `status` that hid
whether a payment was detected, in review or refunded.

## Decision

1. **Arbitrum One (42161) only** for wallet connection, SIWE and checkout. The
   chain lists keep their multi-chain shape (`AUTH_CHAINS`, `WALLET_CHAINS`,
   `CHECKOUT_CHAINS`) for future networks, but nothing else is exposed. The
   Gains market-data integration is unchanged.
2. **Every DePay delivery is authenticated** (`x-signature`, RSA-PSS/SHA-256
   over the raw body, `DEPAY_VERIFY_PUBLIC_KEY`): the configuration request,
   callbacks and the new events route. Deliveries are stored append-only and
   deduplicated. They remain hints. Only the on-chain verifier pays an order.
3. **Coupons are server-side and race-safe.** The coupon row is locked inside
   the order transaction and usage is counted from the redemption ledger.
   Pricing snapshots are immutable. A 100% discount takes a dedicated
   zero-payment path that provisions in the same transaction, with no payment
   row and no commission.
4. **The database owns the lifecycle.** `lifecycle_state` plus a trigger
   validates transitions and appends `purchase_order_events`. The legacy
   `status` is derived, so existing writers keep working unchanged. Refunds
   are states driven by appended adjustments, never edits.

## Consequences

- Existing SIWE sessions stay valid. New sign-ins on Sepolia are rejected
  (`invalid_chain`). Wallets are asked to switch to Arbitrum One.
- Production purchases still need the owner to configure an Arbitrum USD
  stablecoin, receiver, RPC, DePay integration and both DePay keys.
- An ambassador-commission question became explicit and is pending: does a
  100%-coupon order count as the first eligible purchase?
- Tests: `apps/backend/test/commerce.test.mjs` (coupons, zero payment, races,
  lifecycle, DePay signatures, callbacks and events, recovery).

[ADR index](README.md) · [DePay](../payments/DEPAY.md) · [Coupons](../payments/COUPONS.md) · [Order lifecycle](../payments/ORDER_LIFECYCLE.md)
