# Decisions and enforcement

Policy source: [GOVERNANCE.md](../../GOVERNANCE.md) sections 12 and 14.

## Recording

Finalizing a voting session writes one decision with the outcome (approved, rejected
or unresolved), whether it is binding, the rationale, the full tally and the actor.
The decision and its session are then immutable by trigger.

## Corrections

A decision is never edited. A correction is an amendment record with a reason of at
least 10 characters and the corrected content. Amendments are shown with the decision
and audited. Only administrators and management can add one.

## Implementation

Approval does not equal implementation. After approval a reviewer or management records
Implementation scheduled, then In progress, then Implemented. **Implemented requires an
HTTPS evidence link.** Each step is appended to the implementation log.

## Blockers

When a binding decision cannot be implemented because of financial limits, security,
legal obligations, operational protections, risk controls, licensing or capacity, only
**company management** can mark it Blocked. The record needs:

- a documented reason (20 characters or more);
- evidence (a reference such as a review or legal opinion);
- a future next-review date.

Blocked items appear on the public Decisions section with this information. They can
return to In progress or be archived by management.

## What a decision never does

A decision is a record. The governance code has no write access to treasury, trading,
orders, balances, prices, commissions, payouts, risk limits or contracts. Requests
that carry financial-shaped fields are rejected, and tests assert that a full
governance lifecycle leaves every financial table unchanged. Any future automatic
execution needs a separate approved and audited authorization design.
