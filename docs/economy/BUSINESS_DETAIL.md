# Business model in detail

Moved verbatim from the README on 2026-11-21. The summary is in
[Business model](BUSINESS_MODEL.md); the approved model is [ECONOMY.md](../../ECONOMY.md).

The approved model is recorded in [ECONOMY.md](../../ECONOMY.md) and summarised in
[Business model](BUSINESS_MODEL.md). No revenue, profitability or
growth figures have been published, and none are implied here.

## Challenge sales and revenue

**Challenge sales.** Openfund sells one-time evaluation fees for simulated
challenge accounts. Prices come from the plan catalog in the CMS; the server,
never the browser, prices every order. The previously recorded catalog is
retained below for business context; current fees and availability must be read
from the [published catalog](https://openfi.cloud/purchases/plans), which was
not re-probed in this documentation update:

| Model | Structure | Account sizes | Evaluation fee |
| --- | --- | --- | --- |
| Free Trial | Practice account | 5k – 100k | Free |
| Standard | Two-phase evaluation (8% + 5% targets, 10% max loss) | 5k – 100k | $44 – $652 |
| One-phase | Single target, one rule set | 5k – 100k | $74 – $666 |
| Instant | Funded from day one | 5k – 200k | $60 – $888 |

**Purchase lifecycle.** Order (server price, optional coupon) → payment
(Openfund Pay in v0.8.0: direct wallet payment or manual transfer;
v0.7.0's earlier flow used DePay or manual transfer with a TXID) → on-chain verification of token,
receiver, sender, amount and finality → atomic provisioning of exactly one
challenge account and one invoice. No client message, callback or event marks
an order paid on its own. Every state change is recorded. See
[Order lifecycle](../payments/ORDER_LIFECYCLE.md) and
[Payment verification](../payments/VERIFICATION.md).

**Revenue recognition principles.** Net collected revenue is gross sales minus
coupon discounts minus refunds, recognised from the verified settlement amount
on chain. Internal 100% test coupons are excluded from revenue and reported
separately. Ambassador commissions are an acquisition cost, recorded as
obligations.

**Costs.** Ambassador commissions, coach compensation (once live trading
exists), trader rewards under published plan rules, refunds and infrastructure
(Render, PostgreSQL, Directus, RPC providers).

## Challenge and funded-account lifecycle

The business lifecycle covers plan discovery, wallet sign-in, checkout,
verified payment, account provisioning, evaluation, final review, funded-demo
activation, reward requests and settlement evidence. Each step has its own
record and acceptance boundary.

| Stage | What is recorded | Who decides |
| --- | --- | --- |
| Select a program | Model, size and server-priced order; optional coupon | Published catalog and backend pricing |
| Pay and recover an order | Attempts, transactions, partial/excess amounts, verification and refund liabilities | On-chain verifier and operator investigation |
| Activate a challenge | One challenge account and invoice for the verified order; frozen rule snapshot | Atomic backend provisioning |
| Trade and evaluate | Orders, positions, fees, equity observations, targets, loss limits, trading-day/time conditions | Server engine and evaluation rules |
| Final-pass review | Eligibility and review decision | Authorized operator; passing an earlier phase is not a final funded approval |
| Funded-demo activation | Separate account and frozen reward terms | Approved product policy and backend lifecycle |
| Request a reward | Eligibility, distributable amount, selected cycle, reservations and recipient | Reward engine and human review |
| Settle and attest | Finalized transfer evidence, audit and eligible certificate | External treasury process plus backend receipt verification |

Controlled test challenges are wallet-bound entitlements with deliberately
isolated test rules and simulated settlement. Their results do not establish
ordinary commercial purchase or payout acceptance.
[Controlled procedures](../payments/CONTROLLED_CHALLENGES.md) ·
[Funded delivery](FUNDED_DELIVERY.md).

## Funded rewards, IB participation and treasury

The versioned policy for eligible new activations uses these shares of the
**same distributable profit**, with an immutable selected cycle:

| Cycle | Trader | Attributed eligible IB | Retained by Openfund when there is no eligible IB |
| --- | ---: | ---: | ---: |
| 7 days | 75% | 25% | 25% |
| 14 days | 85% | 15% | 15% |
| 21 days | 90% | 10% | 10% |
| Monthly | 100% | 0% | 0% |

Policy activation for new sales, UTC boundaries, eligibility and historical
account treatment follow the versioned backend policy; existing frozen terms
are not silently rewritten. The eligible IB share is distinct from the
purchase-referral commission. A contingent IB allocation becomes eligible
for its own reviewed settlement after a verified trader payment; this is
not an automatic treasury transfer.

The treasury recognition journal separately allocates **59% to treasury and
41% to operations** under an approved eligible revenue base and cutoff.
Refunds/chargebacks reverse that allocation proportionally. This sales
allocation is not the trader/IB profit split and is not evidence that funds
have already moved.

| Financial view | Meaning and source |
| --- | --- |
| Sales and paying customers | Verified paid orders and aggregate purchase records |
| Treasury balances | On-chain native/token balances with timestamped reads; per-network balances are not automatically revenue |
| Trader/partner liabilities | Approved or recorded unpaid obligations, tracked separately from cash |
| Expenses | Evidence-backed invoice/receipt/contract records with independent verification |
| Gross treasury value | Latest valid priced asset snapshot |
| Allocatable capital | Gross value less obligations, reserves and allocations/open margin under the documented anti-double-counting rules |
| Public transparency | Aggregates and verified payout evidence; no private per-trader histories |

Snapshot refresh is configurable within the documented 60–120 minute window,
defaulting to 90 minutes. Failed reads retain labelled stale values; missing
prices, reserves or configuration produce unknown/unverified capital.
Company costs are entered as verified records; provider billing APIs are not
claimed to be connected.

Real-market allocation is conditional on verified free capital, risk controls
and explicit activation. The documented $500,000 threshold does not mean
live Gains execution currently exists.
[Settlement policy](FUNDED_SETTLEMENT.md) ·
[Treasury and allocation](TREASURY.md) ·
[Live-market access](LIVE_MARKET_ACCESS.md).

## Economy and governance

| Program | Approved rule | Status |
| --- | --- | --- |
| **Brand Ambassador (IB)** | 10% of the referred customer's **first** eligible confirmed purchase, on the net amount after discounts, recognised at verified payment. Eligibility: 50,000+ followers on Instagram or YouTube plus an active second platform; approval by company management | Implemented, not production-active |
| **Verified Trading Coach** | 10% of distributable **realised** net profit from eligible live trades, after trading and execution costs; never on simulated or unrealised PnL | Implemented, inactive until live trading exists |
| Customer referral discount (20%) | **Proposed**, not approved, not active | — |
| Real-capital profit-sharing tiers | **Pending decision** | — |

**Governance.** Hybrid Governance v1.0: *community-governed development,
company-managed treasury*. A ten-seat Community Council holds binding
authority over delegated, non-financial domains through proposals and votes.
Company management keeps exclusive control of the treasury and every financial
decision. It is not a DAO: there is no governance token, and votes are recorded
off-chain. Role-based administration separates content editors, commerce
administrators and operators.

[ECONOMY.md](../../ECONOMY.md) · [GOVERNANCE.md](../../GOVERNANCE.md) · [Partner programs](PARTNER_PROGRAMS.md) · [Treasury](TREASURY.md)
