# ADR 0017 — Payment verification policy, recovery and DePay integration

- **Status:** Accepted (implemented; real-network acceptance and production activation pending)
- **Date:** 2026-11-10
- **Amends:** [ADR 0009](0009-challenge-purchases-and-payment-verification.md)

## Context

The first verifier was written for a direct transfer to the receiver and had
gaps that matter once real money is involved:

- It used the public RPC fallback of the chain library.
- Native-value payments were compared with the USD price as if one wei of ETH
  were one cent of USD, and token decimals defaulted to 18.
- For ERC-20 payments it inspected only the first `Transfer` log and required
  it to run from the payer to the receiver, which cannot match a DePay router
  payment (the router pays out) and could also match unrelated logs.
- RPC failures surfaced as generic errors, and nothing recovered a payment
  that was mined but never submitted.
- The expiry sweeper marks orders `expired` every minute, after which
  `confirmPurchase` refused them, so the documented late-payment grace window
  was unreachable.
- The DePay widget loaded an unpinned external script that the strict CSP
  would have blocked anyway, and never carried the transaction back.

## Decision

1. **Correlation policy.** Verification is a pure function over the
   transaction and receipt (`payment-verification.js`): signer equals the
   authenticated wallet; target is the token or an operator-approved router;
   the amount is the sum of transfers of the approved token to the receiver
   sent by the payer or an approved router. See
   [Verification](../payments/VERIFICATION.md).
2. **USD pricing policy.** Production accepts one approved ERC-20 stablecoin
   priced 1:1. Native value is refused outside non-production test chains.
   Decimals come from the contract and must match configuration if set.
3. **Dedicated RPC, fail closed.** `PURCHASE_RPC_URL` is required in
   production; the RPC's chain id is checked; misconfiguration is a
   non-retryable `payment_misconfigured`.
4. **Finality and reorgs.** Production default of 12 confirmations; the block
   hash of the receipt must still be canonical.
5. **Durable attempts.** `payment_attempts` records every verification with a
   classification and a review state. A background sweep re-verifies
   retryable attempts; operators can look up, re-verify and resolve cases.
   Refunds remain manual and are recorded through the existing payment
   adjustments.
6. **Late payments.** `confirmPurchase` accepts orders in `expired` status
   within the grace window.
7. **DePay.** The UI never treats widget success as confirmation. The widget
   bundle loads only when an https URL and a Subresource Integrity hash are
   configured; the CSP admits only operator-listed https origins. An optional
   signed server callback registers a retryable hint; the sweep proves it
   on-chain.

## Consequences

- Smart-contract wallets (for example Safe) cannot pay, because the signer
  must equal the signed-in wallet. This is explicit and rejected with
  `wrong_sender`.
- Router addresses are operator configuration, not code, so a wrong value
  cannot be shipped silently; the cost is one more setting to verify.
- Anyone who pays through an unapproved aggregator is rejected and the case is
  reviewable, never auto-refunded.
- The schema change is additive. Rolling back to the previous release leaves
  `payment_attempts` unused.
