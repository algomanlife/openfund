# ADR 0033: Certificates attest existing server events

Status: Proposed; implemented on the refinement branch, pending human review.

## Context

Purchase, challenge completion and payout certificates need independently
verifiable provenance without creating another financial or identity authority.
A displayed pass or approved withdrawal is insufficient evidence.

## Decision

Use the existing backend and PostgreSQL. Reconcile certificates lazily on the
session-owned certificate list after the user confirms the one-time public
holder name (or wallet fallback). Read only paid/provisioned purchases,
operator-approved final passes and recorded completed payouts. Never accept
issuance amounts, source events or status from a browser. Serialize by identity
and enforce one certificate per type/event. Freeze holder and event snapshots;
retain append-only issuance/revocation history. Random public serials are
identifiers, not authorization tokens for private data.

Keep anonymous verification rate-limited and restricted to approved presentation
fields. Revoked lookups do not reveal the old holder/financial snapshot. Existing
operator authorization permits audited revocation and future-name corrections;
it does not permit rewriting issued snapshots. Directus edits template wording,
not eligibility, identity, financial facts or certificate status.

Render the approved emblem and packaged font through browser canvas for reliable
Persian shaping. Encode real current-origin QR verification links with `qrcode`
(MIT). Export identical high-resolution PNG and raster PDF representations. The
server lookup remains the current-validity authority; a downloaded copy may have
been revoked since it was exported.

## Consequences

No trading, payout or purchase rules change. No new service, secret or infrastructure
is required. Issuance occurs at the next authenticated certificate-list visit,
not synchronously during payment/evaluation settlement. This avoids coupling
financial mutations to optional presentation output. Unconfirmed holders have no
public certificate until they consent to the public identity choice.

Exports require a capable browser and the existing font asset. PDFs preserve
appearance and QR readability but do not provide searchable text/vector output.
Production rollout and genuine financial-event acceptance remain separate gates.

[API, editing and acceptance evidence](../reviews/final-refinement/certificates.md)
