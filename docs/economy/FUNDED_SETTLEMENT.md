# Funded reward settlement

The existing withdrawal review endpoint records funded reward payments after an
operator sends DAI from the configured treasury wallet. The request binds the
customer wallet at submission. Approval records the named operator. After
approval, the recording operator supplies the transaction hash through the
existing review API. The backend verifies Arbitrum One, successful execution,
canonical and finalized block evidence, and exactly one matching DAI transfer
from the configured treasury to the bound recipient for the approved amount.
The [DAI contract](https://arbiscan.io/token/0xda10009cbd5d07dd0cecc66161fc93d7c9000da1)
uses 18 decimal places.

The withdrawal and append-only financial audit record commit together.
A unique index prevents recording the same verified hash twice within the
owning database. The signed regional sync and handoff already carry the
withdrawal row. GLOBAL owns the claim registry. IRAN reserves the transaction hash and
withdrawal ID over the signed peer connection before recognizing settlement.
If the authority is unreachable, the withdrawal remains approved. A lost
reply can be retried with the same withdrawal and hash. Claims cannot be
reassigned, including when the remote settlement needs reconciliation.

New payout certificates require finalized payment evidence. The public
report shows explorer links only for verified receipts, using the settlement
chain recorded with each receipt. Historical operator-paid amounts remain
visible in accounting totals. Historical approvals created before recipient
and operator capture require explicit reconciliation before settlement.

## Policy for new activations

| Cycle | Trader | Eligible attributed IB | Openfund without eligible IB |
| --- | ---: | ---: | ---: |
| 7 days | 75% | 25% | 25% |
| 14 days | 85% | 15% | 15% |
| 21 days | 90% | 10% | 10% |
| Monthly | 100% | 0% | 0% |

The public Economy scenario estimates trader and IB obligations from the
same profit pool. Its modeled 59% treasury and 41% operating allocations
use sales less modeled refunds. They do not post journal entries.

Fixed-day boundaries are 7, 14 or 21 UTC days from activation. Monthly
boundaries repeat the activation day and time in UTC. If a month lacks that
day, its last day applies. The next month uses the original anniversary.
The next request opens at the first boundary after the prior live request.
The backend freezes the new catalog on eligible funded accounts and locks
selection before account activation. Until the owner approves the sales
terms and sets `FUNDED_PAYOUT_V1_FROM`, existing catalog terms apply.

## Policy decisions still open

- Approve activation of the monthly UTC anniversary policy for new purchases.
- Confirm competing IB attribution precedence and the settlement asset,
  network, minimum and schedule. Eligible payout participation is the
  remainder of the same distributable profit after the trader share. A
  separate settlement becomes eligible after verified trader payment.
- Confirm the eligible purchase revenue base for the 59/41 allocation.
- Confirm real-market IB eligibility, rates and interaction with Coach
  compensation. Real-market connectivity requires separate authorization.
- Approve any external publication of provisional Q2–Q4 growth targets.
