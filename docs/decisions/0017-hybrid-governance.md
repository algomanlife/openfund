# ADR 0017 — Hybrid governance

- **Status:** Accepted for implementation; not in production use
- **Date:** 2026-11-09
- **Policy source:** [GOVERNANCE.md](../../GOVERNANCE.md)
- **Note on numbering:** ADR 0015 covers economy and ADR 0016 covers the structured Whitepaper; hybrid governance uses 0017.

## Context

Openfund is open source and community driven, but it operates a company treasury and
trader-funding commerce. The owner asked for real, enforceable community authority
over non-financial product direction without any community control of money, and
explicitly not a DAO or token.

## Decision

1. **Two authorities.** A ten-seat Community Council decides delegated, non-financial domains. Company management keeps exclusive financial and commercial authority.
2. **Off-chain, backend-authoritative.** Governance records live in PostgreSQL (`gov_*`). There is no token, no on-chain vote and no wallet balance weighting. A wallet signature is optional extra evidence, not a transaction.
3. **Reuse identity.** The existing SIWE session identifies users. Council authority is derived from an active seat; no API grants it. Management acts through the existing `ADMIN_API_TOKEN` gate.
4. **Isolation by construction.** Governance code imports no financial module, its tables reference only `openfund_users`, reserved powers are advisory by a CHECK constraint, and decisions are records, never instructions. Tests assert each of these.
5. **Evidence is append-only.** Votes, decisions, history, implementation logs and the audit trail are protected by triggers. The audit log is hash-chained.
6. **Quorum and thresholds are fixed numbers.** Quorum 7, ordinary approval 6, amendment approval 7, always of the full council. Vacancies and recusals never lower them; a vote is refused when fewer than seven members are seated.
7. **Editorial content only in Directus.** Milestone wording and content blocks are Directus rows with bundled fallbacks. Directus has no access to `gov_*`.

## Consequences

- Approval is not implementation: implementation needs an evidence link, and only management can record a blocker.
- Eligibility is a management-verified record because no ambassador, coach or funded-trader registry exists on this base. Reviewers must verify before appointment.
- Contract-wallet signatures are unsupported for signed votes (session votes still work).
- The election ballot rule, amendment sign-off and several defaults are open decisions listed in GOVERNANCE.md section 18.
- Production activation requires management appointments, eligibility records, a migration run and Directus schema application. See [GOVERNANCE_ROADMAP.md](../governance/GOVERNANCE_ROADMAP.md).

## Alternatives considered

- **DAO or token governance.** Rejected: unwanted financial and legal surface and not requested.
- **Governance inside Directus.** Rejected: editorial permissions must never be able to forge a vote.
- **Automatic execution of approved decisions.** Rejected: any automated financial effect needs a separate audited design.
