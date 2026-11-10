# Voting

Policy source: [GOVERNANCE.md](../../GOVERNANCE.md) section 10. Rules live in
`apps/backend/governance-rules.js`; the service applies them in transactions.

## Rules

| Rule | Value |
|---|---|
| Members | 10, one vote each |
| Options | Approve, Reject, Abstain |
| Quorum | 7 participating members |
| Ordinary approval | 6 or more approvals out of the full council |
| Governance amendment | 7 or more approvals out of the full council |

Abstentions count as participation. Vacancies and recusals never lower the quorum or
the threshold.

## Outcome

| Situation | Outcome |
|---|---|
| Quorum reached and approvals at or above the threshold | Approved (can finalize early) |
| Quorum can no longer be reached | Unresolved |
| The threshold can no longer be reached | Rejected, or Unresolved if quorum was also missed |
| Deadline passed, quorum met, threshold not met | Rejected |
| Deadline passed, quorum not met | Unresolved |

An unresolved proposal returns to Under Review, and a new voting session is the
rescheduling procedure (open decision D).

## Opening a vote

A reviewer or management opens voting for a proposal in Under Review. The service
checks the window (1 minute to 30 days) and, for binding capacity-bound proposals,
the confirmed capacity. It refuses to open a vote when fewer than 7 members are seated,
so the quorum is never quietly redefined.

**Snapshot.** At opening, the seats and members, the term and the proposal revision
are stored with a hash. The voting rules, window and snapshot are then immutable,
protected by a database trigger. A member appointed after the snapshot cannot vote in
that session. A member who is revoked, expired, suspended or recused after the
snapshot also cannot vote, because voting re-checks live state.

## Integrity

| Threat | Control |
|---|---|
| Duplicate vote | Unique constraints per session and seat and per session and user; the first vote is final |
| Vote after the deadline, or before opening | Time window checked in the transaction |
| Unauthorized vote | Seat in the snapshot plus active membership plus active account |
| Role escalation | Council authority is derived from membership; no API can grant it |
| Vote tampering | Votes are append-only by trigger; results are immutable |
| Replay of a signed request | Single-use, per-user, per-session, expiring nonce |
| Concurrent duplicates | Exactly one succeeds |

## Signed votes (optional evidence)

Before voting, a member can ask for a challenge for a specific choice. The server
returns a text that names the domain `openfund-governance-v1`, the proposal, session,
seat, wallet, choice, nonce and expiry, and states that it authorises no transaction.
The member signs it with their wallet. Verification recovers the signer locally
(no network, no fee) and requires it to equal the account's wallet. The nonce is
consumed atomically.

Limits: only externally owned account signatures are supported. A vote by an
authenticated session without a signature is equally valid. This is an off-chain
database vote, not an on-chain or decentralized one.

## Privacy while open

Public output shows only the participation count while voting is open. Individual
choices appear with the final result.
