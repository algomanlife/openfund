# Governance documentation

Openfund Hybrid Governance v1.0. The authoritative policy is
[GOVERNANCE.md](../../GOVERNANCE.md); the documents here explain how the policy is
implemented and operated. When a rule appears in both places, GOVERNANCE.md wins.

| Document | Purpose |
|---|---|
| [PROPOSALS.md](PROPOSALS.md) | OFP identifiers, lifecycle, categories, binding versus advisory |
| [COUNCIL.md](COUNCIL.md) | Seats, terms, eligibility, appointment, revocation |
| [ELECTIONS.md](ELECTIONS.md) | Election architecture and its activation gate |
| [VOTING.md](VOTING.md) | Thresholds, integrity rules, signed votes, snapshots |
| [DECISIONS.md](DECISIONS.md) | Results, enforcement, blockers, amendments, implementation evidence |
| [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) | Roles, the permission map and financial isolation |
| [GOVERNANCE_ROADMAP.md](GOVERNANCE_ROADMAP.md) | What is built, what is not active, what is planned |
| [WHITEPAPER_GOVERNANCE.md](WHITEPAPER_GOVERNANCE.md) | Whitepaper chapter and integration plan |

## Where things live

| Concern | Location |
|---|---|
| Rules (pure, tested) | `apps/backend/governance-rules.js` |
| Service, authorization, audit | `apps/backend/governance.js` |
| HTTP routes | `apps/backend/governance-routes.js` (`/governance`, `/admin/governance`) |
| Schema | `apps/backend/schema.sql`, tables prefixed `gov_` |
| Website | `apps/web-react/src/features/governance/` |
| Editorial content | Directus `governance_milestones`, `governance_content_blocks` |

## Run the tests

```bash
createdb openfund_governance_test
DATABASE_URL=postgres:///openfund_governance_test npm --prefix apps/backend run migrate
DATABASE_URL=postgres:///openfund_governance_test npm --prefix apps/backend run test:governance
npm --prefix apps/web-react run test:governance
```

The backend suite needs only an isolated PostgreSQL database. It starts no server.
