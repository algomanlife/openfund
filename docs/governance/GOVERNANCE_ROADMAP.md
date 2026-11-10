# Governance roadmap

This page separates what exists from what is planned. It promises no dates.

## Built (local verification, not in production use)

- Backend rules, schema, service, RBAC and audit trail
- OFP proposals, lifecycle, discussion and feedback
- Council terms, seats, eligibility, appointment and revocation
- Voting with quorum, thresholds, recusal, snapshots and optional signed evidence
- Decision records, amendments, implementation tracking and blockers
- Election architecture, gated on management approval
- Public Governance page, proposal pages, council workspace
- Directus editorial collections and a bundled fallback

## Not active

- No council term exists and no member is seated
- No election is scheduled
- No proposal has been voted on
- Directus editorial collections have not been applied to a live instance by this work

## Required before production activation

1. Management reviews GOVERNANCE.md and settles the open decisions in section 18.
2. Run `npm run migrate --prefix apps/backend` on staging, then production. The migration is additive and idempotent.
3. Set `ADMIN_API_TOKEN` (already required for the admin API). No new environment variable is introduced.
4. Run `apps/backstage/scripts/apply_schema.py` against Directus and publish the editorial rows.
5. Management creates the initial term, verifies eligibility with evidence, appoints members with recorded name consent, and activates the term. Appointments are published.
6. Grant reviewer and administrator roles to people who are **not** council members.
7. Acceptance test with real wallets on staging: sign in, vote with and without a signature, and confirm the read-only view for non-members.
8. Review the security checklist in [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md).

## Planned

- Whitepaper governance chapter in the Whitepaper app (see [WHITEPAPER_GOVERNANCE.md](WHITEPAPER_GOVERNANCE.md))
- First constituency elections, once management approves rules and voter criteria
- Registries for ambassadors, coaches and funded traders that governance can read as evidence

## Not planned

On-chain or token governance. It is an optional research direction only, and would need
its own approved and audited design.
