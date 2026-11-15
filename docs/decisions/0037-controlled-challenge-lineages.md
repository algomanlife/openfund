# ADR 0037 — Controlled challenge lineages

Status: Accepted for implementation and isolated acceptance.

The named operator uses the existing operator API to issue one entitlement
for each of Instant and Standard. An entitlement is represented by a normal
100% coupon plus a private backend-owned binding to its original plan,
customer ID and wallet address. Checkout uses the existing transactional
coupon lock, zero-payment order, invoice and redemption machinery. The
backend enforces the entitlement binding and single use independently of
editable Directus restrictions.

The purchased challenge carries an immutable `controlledTest` marker and
rule overrides in its snapshot. Phase transitions and manual funded
provisioning inherit it. Catalog values and pre-existing snapshots retain
their original semantics. The account keeps existing risk policy. The
Instant test removes the profitable-day gate while retaining consistency
and minimum profit.

Withdrawal classification derives from the associated challenge. PostgreSQL
keeps the classification immutable and forbids cash settlement evidence on
test rows. Operator review and correspondence use the normal workflow.
The test-only terminal state `simulated_settled` records completion of a
previously reserved virtual debit. It has no external payment verifier or
claim. Commercial reporting omits test payout obligations and verified
payouts. Controlled lineages do not count toward live-market access.

Replication carries the classification in the ordinary challenge and
withdrawal projections. The source owns the controlled lifecycle. Entitlement
issuance and redemption run in the GLOBAL region and the controlled lineage
cannot be handed off to a peer.

[Operator procedures and acceptance](../payments/CONTROLLED_CHALLENGES.md)
