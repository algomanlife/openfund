# Openfund Governance v1.0

**Community-Governed Development. Company-Managed Treasury.**

This is the authoritative Governance v1.0 policy for Openfund. Other documents
([docs/governance/](docs/governance/README.md), [ECONOMY.md](ECONOMY.md), the
Whitepaper chapter) explain or implement it and must defer to this file.

## How to read this document

Every rule is labelled by how real it is. Policy and implementation are different things.

| Label | Meaning |
|---|---|
| **Policy** | Approved Governance v1.0 rule. |
| **Built** | Implemented in the application and covered by automated tests on the `feat/hybrid-governance-v1` branch. Not evidence of production use. |
| **Not active** | Nothing is running in production. No council is seated and no election is scheduled. |
| **Open decision** | Needed from company management before the rule can be treated as final. Listed in section 18. |

Governance v1.0 is **not a DAO**. There is no governance token, no tokenomics,
no NFT or staking requirement and no decentralized treasury. No token, challenge
purchase or wallet balance grants governance authority. Votes are recorded by the
Openfund backend; they are not on-chain.

## 1. Governance mission

Openfund is an open-source, community-driven trading and trader-funding ecosystem.
Governance exists so that selected community representatives hold real, enforceable
authority over the non-financial direction of the product, while the company keeps
sole responsibility for money.

## 2. Hybrid governance principles

1. **Open development.** Contributors take part in technical work, proposals, reviews and product direction.
2. **Real community authority.** Approved council decisions are binding inside precisely delegated domains, subject to the limits in section 7 and section 14.
3. **Company-controlled financial operations.** The company retains exclusive authority over commercial policy, treasury, financial commitments, trading capital, investment decisions and operational financial risk.
4. **Auditable.** Every material governance action is recorded and attributable.
5. **No invented activity.** Empty seats, unscheduled elections and unimplemented decisions are shown as exactly that.

## 3. Governance authorities

| Authority | Role |
|---|---|
| **Openfund Community Council** | Binding decisions in delegated, non-financial domains (section 7). |
| **Openfund Company Management** | Financial and commercial decisions (section 8); legal and security duties; appointment of the initial council; approval of election rules; confirmation of resource capacity; documentation of blockers. |
| **Governance reviewers and administrators** | Process roles that run proposals and records. They never hold a council seat and never vote. |

**Built.** Company financial authority is enforced by backend authorization and a
service-level permission map, not by interface text. See
[ROLES_AND_PERMISSIONS.md](docs/governance/ROLES_AND_PERMISSIONS.md).

## 4. Council composition

**Policy.** Ten seats, two for each of five constituencies.

| Constituency | Seats |
|---|---:|
| Verified Brand Ambassadors | 2 |
| Verified Trading Coaches | 2 |
| Community Traders | 2 |
| Funded Traders | 2 |
| Community and Social Media Moderators | 2 |
| **Total** | **10** |

Each seat represents one constituency. A person holds exactly one active voting
seat even when they qualify for several roles.

**Built.** One active seat per account and per management-assigned person reference
is enforced by database unique indexes, so a second wallet of the same person
cannot take a second seat.

## 5. Eligibility

A wallet address alone is not proof of being a unique person. Eligibility is
verified by an authorized reviewer and recorded with an evidence reference; a
self-declaration is never sufficient.

| Constituency | Requirement |
|---|---|
| Brand Ambassador | Approved member of the Openfund Brand Ambassador program. |
| Trading Coach | Independently verified Coach status. Ambassador approval does not imply Coach approval. |
| Community Trader | Verified member of the trading community under documented criteria (**Open decision** A). |
| Funded Trader | Funded Trader status verified by the authoritative trading backend. Self-declared status is not sufficient. |
| Community Moderator | Approved moderator of Openfund community channels or social media communities. |

**Not active.** On the current `main` base there is no approved Ambassador, Coach
or Funded Trader registry that governance can read: Growth Partner codes are a
pre-launch feature and the evaluation engine records simulated stages only.
Eligibility is therefore a management-verified record. A read-only signal about a
user's challenge history is available to reviewers but never qualifies anyone.

## 6. Terms and elections

**Policy.** A council term lasts six months. Members may seek re-election.

**Initial council.** For the first term, company management may nominate and appoint
the council through a transparent process. Each appointment is published with the
representative, constituency, term start and end, appointment method and governance
status. An appointed council is never presented as community-elected.

**Later councils.** Eligible members of each constituency elect their own
representatives. An election supports candidate applications, eligibility checks,
candidate approval, start and end dates, a voter eligibility snapshot, one vote per
eligible voter, results, audit records, finalization and seat allocation.

**Built.** The election architecture exists and is gated: no election is visible or
open until management approves its rules. **Not active.** No election is scheduled.
Details: [ELECTIONS.md](docs/governance/ELECTIONS.md).

## 7. Delegated authority

**Policy.** Council decisions are binding in these domains.

- **Product development priorities:** prioritization of approved feature requests, indicators selected for development, community-requested interface improvements, non-financial usability, documentation priorities, accessibility.
- **Community policies:** participation rules, contribution guidelines, community events within an approved non-financial scope, moderation standards, education priorities, engagement initiatives.
- **Open-source development:** contribution priorities, documentation, suggested technical enhancements, community-requested developer tools, collaboration initiatives.
- **Roadmap participation:** priorities among technically feasible initiatives that fit a development capacity envelope that company management approved beforehand.

Binding authority does not authorize the council to create unapproved budgets.

## 8. Reserved company powers

**Policy.** The following are never subject to a binding council vote.

- Treasury transfers and treasury wallet authorization
- Company investments, real market capital deployment, financial reserves
- Company revenue distribution, trader payouts, financial settlements
- Ambassador commission rates, coach profit-sharing rates, challenge prices
- Financial risk limits, liquidity deployment
- Commercial contracts, company salaries
- Production smart-contract deployments that affect company assets

Community members may submit recommendations on these topics. They are always
labelled **Advisory — Non-Binding**.

**Built.** The proposal category decides the class. A reserved category can only be
advisory, in the service code and in a database CHECK constraint, so a request
cannot change it. See [PROPOSALS.md](docs/governance/PROPOSALS.md).

## 9. Proposal lifecycle

**Policy.** A proposal is an Openfund Proposal (OFP) with a permanent identifier
such as OFP-0001, generated by the backend. States: Draft, Discussion, Submitted,
Under Review, Voting, Approved, Rejected, Implementation Scheduled, In Progress,
Implemented, Blocked, Archived.

**Built.** A validated state machine allows only the declared transitions and checks
the actor's role for each one. History and revisions are kept. After voting opens,
the category, classification, voting rules and eligibility snapshot cannot change.
A material amendment needs a new revision and a new voting cycle.

Full detail: [PROPOSALS.md](docs/governance/PROPOSALS.md).

## 10. Voting thresholds

**Policy.**

| Rule | Value |
|---|---|
| Council size | 10 members, one vote each |
| Options | Approve, Reject, Abstain |
| Ordinary meeting quorum | 7 participating members |
| Ordinary binding approval | At least 6 affirmative votes from the full 10-seat council |
| Constitutional governance amendment | At least 7 affirmative votes from the full council |

An abstention is participation, not an affirmative vote. A proposal cannot pass
unless the affirmative threshold is met. Vacancies, abstentions and recusals never
lower the threshold or the quorum. If they make the threshold unreachable, the
proposal stays unresolved or is rescheduled under an explicitly approved procedure;
the numbers are never silently redefined.

**Built.** Votes are final once cast. Duplicate votes, votes after the deadline,
votes from expired, revoked or suspended members, and unauthorized votes are
rejected. Details: [VOTING.md](docs/governance/VOTING.md).

## 11. Conflict-of-interest policy

**Policy.** Members disclose relevant conflicts. A recused member cannot vote on that
proposal.

**Built.** A member records a conflict declaration with a reason. A reviewer decides
on recusal and the decision is recorded. A pending recusal request blocks that
member's vote until it is reviewed. A recusal never reduces the 6-of-10 or 7-of-10
threshold.

## 12. Decision enforcement

**Policy.** An approved binding decision must be implemented unless a genuine
blocker exists (financial limits, security, legal obligations, critical operational
protections, established risk controls, software licensing, or approved resource
capacity). When one exists, management documents the specific reason, the evidence
and the next review date. Management cannot arbitrarily ignore a valid binding
decision. Every exception is recorded.

**Built.** Approval does not mean implementation. The record moves through
Implementation Scheduled, In Progress and Implemented; Implemented requires an
evidence link. Only company management can mark a proposal Blocked, and the
reason, evidence and a future review date are mandatory. Council decisions produce
documented development tasks or policy outcomes. They never execute anything. See
[DECISIONS.md](docs/governance/DECISIONS.md).

## 13. Transparency requirements

**Policy.** Appointments, proposals, discussions, decisions, blockers and results
are public, except personal information that has not been approved for publication.

**Built.** The public Governance page shows the real council state, proposals,
open votes, decisions and blockers. A member name is shown only with recorded
consent. While a vote is open, only participation counts are public; individual
choices are published with the final result. Community feedback is clearly separated
from council votes.

## 14. Security exceptions

Community votes cannot override financial limits, security requirements, existing
legal obligations, critical operational protections, established risk controls,
software licensing obligations or approved resource capacity.

Governance must not become an attack surface for financial operations. A council
decision must not, and the code cannot, automatically move treasury funds, modify
balances, change trader allocations, deploy contracts, execute live trades, alter
challenge risk rules, change payout formulas or modify financial permissions. Any
future automated execution requires a separately approved and audited authorization
design.

## 15. Amendment process

**Policy.** Changes to this document are constitutional and need at least 7
affirmative votes from the full council.

**Open decision** B: whether company management must also approve a constitutional
amendment before it takes effect, and the minimum public discussion period. Until
management decides, an amendment is published as a proposal and this document is
only changed by a reviewed pull request that records the council result.

## 16. Accountability

- Every governance action is written to an append-only audit trail that is hash-chained, so tampering is detectable.
- Finalized votes and decisions are immutable. A correction is a separate, reasoned amendment record.
- Council members and governance staff are different people. A governance reviewer or administrator cannot hold a seat, and a seated member cannot be made a reviewer or administrator.
- Appointments, revocations and role changes by company management are audited and attributed to a named actor.

## 17. Governance evolution

On-chain or token-based governance is an optional research direction. It is **not**
an existing capability and **not** planned. Any future version needs its own approved
and audited design and can never reach company funds without separate authorization.
See [GOVERNANCE_ROADMAP.md](docs/governance/GOVERNANCE_ROADMAP.md).

## 18. Open decisions for company management

These items are implemented with a conservative default and are not final policy.

| Id | Decision needed | Current default |
|---|---|---|
| A | Documented eligibility criteria for Community Traders, and the approved moderator and ambassador registries governance should read | Management-verified record with an evidence reference |
| B | Amendment sign-off and minimum discussion period | Pull request recording the council result; no minimum enforced |
| C | Election ballot rule | One vote per voter, top two candidates take the two seats, a tie for the last seat is never broken silently |
| D | Rescheduling procedure when quorum or threshold is unreachable | The proposal returns to Under Review and a new voting session is opened by a reviewer |
| E | Voting window limits | Between 1 minute and 30 days |
| F | Who confirms the capacity envelope for binding roadmap and priority proposals | Company management, per proposal |
| G | Public display name consent wording for council members | Name shown only when consent is recorded |

## Related documents

[Governance documentation index](docs/governance/README.md) ·
[ECONOMY.md](ECONOMY.md) ·
[Feature status](docs/product/FEATURE_STATUS.md) ·
[ADR 0017](docs/decisions/0017-hybrid-governance.md) ·
[CONTRIBUTING.md](CONTRIBUTING.md) ·
[Repository governance](docs/development/REPOSITORY_GOVERNANCE.md) (who reviews, merges and releases code; separate from this product governance)
