# Openfund Economy

This is the evolving canonical reference for Openfund's economic principles and
decisions. It records **only business policies that have been approved**. Anything
discussed but not finalized is labelled **Proposed**, and planning figures are
labelled **Assumption**. Nothing in this file changes any financial execution logic.

**Authority.** Commercial, financial and treasury decisions belong to Openfund
company management. See [Governance authority](#governance-authority) and
[GOVERNANCE.md](GOVERNANCE.md).

## Status legend

| Label | Meaning |
|---|---|
| **Approved** | A policy decided by company management. |
| **Proposed** | Discussed, not final. It must not be implemented or advertised as active. |
| **Assumption** | A planning figure or scenario. It is not company performance. |
| **Definition** | A term as used in this document. |

## Business model

**Definition.** Openfund sells challenges: paid, simulated evaluations in which a
trader trades a simulated account under published rules. A trader who passes may
enter simulated funded trading and earn rewards defined by the rules. Rewards are
obligations of the company measured on simulated results. Potential real-market
capital allocation is a separate, gated program (see
[Real Capital Program](#real-capital-program)).

Simulated trader reward obligations and actual realized market profit are different
things and are never added together.

## Revenue

**Definition.**

| Term | Meaning |
|---|---|
| Gross sales | Price of challenges ordered and paid, before any deduction. |
| Discounts | Reductions granted at purchase. No discount is active today (see [Ambassador economics](#ambassador-economics)). |
| Refunds | Money returned to a customer, including chargebacks. |
| Commissions | Amounts owed to partners such as ambassadors. They are an acquisition cost, recorded as obligations. |
| Net collected revenue | Gross sales minus discounts minus refunds. |

The accounting treatment of these terms is subject to management and accountant
confirmation. Real revenue figures are published only from operational records;
see [docs/product/FEATURE_STATUS.md](docs/product/FEATURE_STATUS.md).

## Ambassador economics

**Approved.**

- Commission rate: **10%**.
- Applies to the referred customer's **first eligible purchase only**. Later purchases earn nothing.
- Commission is **recognized immediately after verified payment**.
- Ambassador approval is controlled by company management.

**Proposed.** A 20% customer referral discount was discussed as a marketing policy.
It is **not approved as a binding commercial rule and is not active.** Checkout logic
and prices are unchanged by this document.

## Coach economics

**Approved.**

- Coach share: **10%**, applied to **distributable realized net profit from eligible live trades**.
- Coach approval is independent of ambassador approval.

Because live trading is not enabled, no coach revenue exists today.

## Trader rewards

**Definition.** Trader rewards are obligations that arise from the published
evaluation and funded-simulation rules. They are measured on simulated account
results. They are not realized market profit, are not paid from market gains, and
must be reported separately from any realized profit of real-capital trading.

## Treasury

**Definition.** Treasury reporting distinguishes these quantities and never merges
them:

| Quantity | Meaning |
|---|---|
| Gross treasury assets | Everything held, before any deduction. |
| Outstanding obligations | Amounts owed, such as trader rewards and partner commissions. |
| Operational reserves | Amounts set aside by management for operations. |
| Risk reserves | Amounts set aside by management against losses. |
| Allocated capital | Capital already committed to real-market allocations. |
| Available allocatable capital | Gross assets minus obligations, reserves and allocated capital. |

Treasury balances are not governance data and are never writable from governance.

## Real Capital Program

**Approved.** The program threshold is **$500,000 of Available Allocatable Company
Capital**.

This is a company-level figure after obligations and reserves. It is not the gross
wallet balance, not gross sales and not a balance a trader must hold. Reaching the
threshold makes allocation possible; each allocation remains a separate management
decision.

## Governance authority

**Approved.** Commercial, financial and treasury decisions remain under Openfund
company management. This includes treasury, financial obligations, challenge pricing,
revenue model, ambassador commissions, coach financial compensation, marketing and
operating budgets, capital allocation, real trading capital, risk limits, trader
payouts, liquidity, financial settlements, commercial partnerships and legal and
security responsibilities.

The Community Council has **advisory influence only** on financial policy and no
unilateral financial authority. Community recommendations on these topics are
labelled "Advisory — Non-Binding". The governance system cannot transfer funds,
create obligations, change prices, rates, balances or risk limits, or execute
transactions. See [GOVERNANCE.md](GOVERNANCE.md) sections 8 and 14.

## Economic assumptions

Planning assumptions are not company performance. Examples:

- Sales projections, including hypothetical scenarios in the range of **$350K to $400K** of sales. These are scenarios for planning, **not actual or historical revenue**.
- Ambassador productivity.
- Industry payout ratios.
- Operational expenses.
- Marketing conversion scenarios.

No assumption is a forecast, a commitment or a statement of results.

## Decisions pending

| Item | State |
|---|---|
| 20% customer referral discount | Proposed, not active |
| Trader profit-share tiers for real-capital trading | Not approved in this document |
| Treasury wallet, operational reserves and risk reserves | Management configuration still required |

## Implementation notes

On the `main` base of this branch, the referral feature is the pre-launch Growth
Partner invite code, which carries no commission. The commission ledger, treasury
snapshots and live-funding control plane described in the economy documentation live
on the unmerged branch `feat/economy-transparency-ambassador-live-funding`. This file
describes approved policy, not what is deployed. Check the feature status register
for implementation state.

## Change history

Each future economic policy amendment adds a row with every column filled.

| Date recorded | Policy version | Decision owner | Reason | Effective date | Related document |
|---|---|---|---|---|---|
| 2026-11-09 | 0.1 | Openfund company management | Foundational structure; records ambassador commission 10%, first eligible purchase only, recognized after verified payment | Not recorded in source; management to set | [GOVERNANCE.md](GOVERNANCE.md) |
| 2026-11-09 | 0.1 | Openfund company management | Records coach share 10% of distributable realized net profit from eligible live trades | Not recorded in source; management to set | [GOVERNANCE.md](GOVERNANCE.md) |
| 2026-11-09 | 0.1 | Openfund company management | Records Real Capital Program threshold of $500,000 Available Allocatable Company Capital | Not recorded in source; management to set | [GOVERNANCE.md](GOVERNANCE.md) |
| 2026-11-09 | 0.1 | Openfund company management | Records that the 20% referral discount is proposed and not active | Not applicable | [GOVERNANCE.md](GOVERNANCE.md) |
