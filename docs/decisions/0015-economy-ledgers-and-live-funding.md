# ADR 0015 — Economy ledgers, partner programs and Live Market Access control plane

- **Status:** Accepted (local implementation; treasury configuration, reserve policy, tier policy and real execution pending management decisions)
- **Date:** 2026-11-09

## Context

Openfund needed a public, verifiable economy report instead of the synthetic transparency fixture. It also needed a reviewed Brand Ambassador program with a 10% first-purchase commission, an independent Verified Trading Coach role, and a program allocating company capital to selected traders on real markets. Each had to be built on existing purchase, evaluation and withdrawal records, without changing the evaluation engine or enabling any real transfer or order.

## Decision

1. **The backend database is the financial source of truth.** All records are additive tables written only by the backend. Decisions go through the existing token-authorized admin API, with a mandatory named actor and an append-only `financial_audit_log`. Directus may read these tables but never writes them.
2. **Commission recognition is part of payment confirmation.** It runs in the same transaction, behind a savepoint so that it never blocks provisioning. Idempotency comes from partial unique indexes, and corrections are append-only reversals.
3. **Capital is `Unknown` unless every input is verified.** The inputs are an on-chain treasury snapshot priced only by Chainlink, explicit reserves, and obligations from single source tables. Live allocation requires a verified position of at least $500,000.
4. **The profit split is never defaulted.** Candidate tiers exist, but approval requires an explicit administrator selection. The coach share is a constraint (10%).
5. **Execution and payout are adapters, and both default to `none`.** Only non-monetary sandbox adapters are implemented, and they are refused in production. Real Gains execution remains disabled, as [AGENTS.md](../../AGENTS.md) requires.
6. **Eligibility uses the final passed evaluation stage as the funded account of record,** because the engine provisions no separate funded row. This is documented as a policy assumption.

## Consequences

- Public figures are accurate from the first record and show zeros or `Unknown` rather than samples.
- The program cannot allocate capital until management configures the treasury, sets reserves and enables an execution adapter.
- Real execution and settlement need separate, security-reviewed adapters and testnet acceptance.
- Refund handling is new: `payment_adjustments` records refunds and chargebacks without editing payments.
