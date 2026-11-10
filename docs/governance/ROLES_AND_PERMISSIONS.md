# Roles and permissions

Authorization is enforced in the service layer (`assertCan` in
`apps/backend/governance.js`) against the permission map in
`apps/backend/governance-rules.js`. Routes and the interface cannot bypass it.

## Roles

| Role | How it is held |
|---|---|
| Public visitor | No session. Read-only |
| Community member | Authenticated, active account (SIWE session cookie) |
| Proposal author | Derived: the account that created the proposal |
| Council representative | Derived: an active, unexpired membership in a seat. Never stored as a role |
| Community moderator | Row in `gov_roles` granted by management |
| Governance reviewer | Row in `gov_roles` granted by management |
| Governance administrator | Row in `gov_roles` granted by management; includes reviewer |
| Company management | Request authorized by `ADMIN_API_TOKEN` on `/admin/governance/*`; named by the `X-Actor` header for audit |

A person can hold several non-exclusive roles. A council seat is one per person.
Reviewers and administrators cannot hold a seat, and seated members cannot be made
reviewers or administrators.

Identity reuses the existing wallet session. The browser never supplies a wallet
address as proof; the server resolves the account from the HttpOnly session cookie.

## Permission map

| Action | Roles |
|---|---|
| Create and edit own proposal, comment | Community member (author for edits) |
| Declare a conflict, vote | Council representative (derived) |
| Review proposals, open voting, finalize, void, review conflicts, record implementation | Reviewer, administrator, management |
| Moderate comments | Moderator, reviewer, administrator, management |
| Manage eligibility, create terms, run elections, amend decisions, read the audit log | Administrator, management |
| Appoint, revoke memberships, activate terms, grant roles, approve election rules, confirm capacity, mark Blocked | Management only |

## Financial isolation

Governance has no financial permission at all.

- Governance modules import no trading, purchase, payout or treasury module (tested).
- Governance SQL does not reference any financial table (tested).
- Governance tables reference only `openfund_users` and each other (tested).
- Requests containing financial-shaped fields (amount, price, commission, payout, treasury, risk limit, contract address and similar) are rejected with HTTP 400.
- A full lifecycle test asserts that purchases, payments, withdrawals, demo accounts, challenge plans and referral codes are unchanged.
- Directus holds editorial rows only (milestone wording, content blocks) and has no access to `gov_*` tables. Editorial permission can never forge a vote or edit a financial record.
- The admin API is disabled until `ADMIN_API_TOKEN` is set and exposes no financial endpoint.

## Security notes

- Rate limits apply to proposal, comment, conflict and vote endpoints.
- Input is validated and length-limited; links must be HTTPS; user text is rendered as text by React.
- Pagination limits are validated.
- Session cookies are HttpOnly and SameSite=Lax.
