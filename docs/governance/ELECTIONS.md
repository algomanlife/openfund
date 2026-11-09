# Elections

Policy source: [GOVERNANCE.md](../../GOVERNANCE.md) section 6. **Not active:** no
election is scheduled, and none can become public before management approves its rules.

## Gate

An election is created for one constituency of a planned term whose method is
"elected". It starts as a draft and stays invisible. Public elections are enabled per
election by management approving its rules and voter criteria. Until then the API
refuses to open applications, and the public endpoint lists nothing.

## Stages

| Stage | Who | Rules |
|---|---|---|
| Draft | Administrator | Schedule validated: applications, then voting |
| Rules approved | Management | Required before anything else |
| Applications | Administrator opens | A candidate must hold verified eligibility in the constituency; one application per person |
| Candidates approved | Administrator | At least one approved candidate |
| Voting | Administrator opens | A **voter snapshot** of verified, active, eligible members is stored once; duplicate person references count once |
| Closed or finalized | Administrator | After the deadline; see tie handling |
| Seating | Management | Winners take free seats through the normal appointment checks |

## Voting

One eligible voter has one vote. The vote is final and append-only. Ballots are secret:
the audit trail records that a vote was cast, not its choice. A voter who became
eligible after the snapshot cannot vote.

## Results

Each voter casts one vote and the two candidates with the most votes win the two
seats. A tie for the last seat is **not** broken silently: the election closes with
the tie recorded and management must resolve it. This ballot rule is an
**open decision** (see [GOVERNANCE.md](../../GOVERNANCE.md) section 18).
