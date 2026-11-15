# Funded operations and product roadmap delivery checkpoint

The branch is based on `f7ea682c054a24a55b6369077697b953ea534963`, the
verified merge of PR #122. The latest official release observed at the start
was v0.5.0. The public GLOBAL service reported `60d5df9`; this branch is
unreleased.

## Implementation and acceptance

| Requirement | Implementation and evidence |
| --- | --- |
| Funded lifecycle | Approved evaluation provisions a separate funded account. Versioned 7/14/21-day and monthly terms, immutable cycle selection, UTC boundaries, dashboard balances, equity, reservations and recipient were verified locally. New sale terms require activation approval. |
| Trader settlement | Human review, rejection reason, reservation release and finalized matching Arbitrum One DAI evidence. Global receipt claims were exercised against two regional databases. |
| Payout correspondence | Owned request threads, timestamps, unread counts, pagination, appeals and operator outcomes. Isolated API tests cover rejection, ownership, appeal and review. |
| Payout operations | The authorized browser queue supports reply, appeal resolution, approval, rejection and treasury evidence entry. A disposable browser test exercises the actual rejection workflow. |
| Shared accounting | Append-only financial audit, calculation snapshots, IB distribution, receipt evidence and thread history protected by database triggers. |
| IB rewards | Verified qualifying purchase commission freezes attribution. Trader paid status unlocks a separate manual settlement after an approved policy. The isolated test exercises the full progression and receipt reuse rejection. |
| Ordinary referrals | Existing invitation and masked attribution remain. Verified purchases are counted separately. Compensation stays under the applicable approved program. |
| Treasury allocation | 59/41 recognition and proportional refund and chargeback reversals verified in PostgreSQL. Policy registry starts empty; verified inputs determine the base. |
| Expenses | Existing recording and independent verification controls remain. The public report exposes paid and unpaid totals without individual accounting references. |
| Transfer reconciliation | Finalized EVM log ingestion, movement deduplication, internal classification, cursor freshness and balance mismatch detection verified against an isolated database and deterministic chain reader. A real wallet and approved block scope are required. |
| Transparency and Economy | Localized display, aggregate allocations and expenses, payout evidence, transfer reconciliation and separate scenario analysis. |
| Certificates | Existing purchase, approval and verified payment attestation flows retained. No deployment changes. |
| Product identity | About, README, the shared four-quarter roadmap and Whitepaper source distinguish simulation and conditional live access. |
| SIWE and DePay | Read-only [domain audit](../payments/DOMAIN_READINESS.md). Browser-document checkout is reachable on GLOBAL. Live signed login and payment require separately authorized acceptance. |

## Decisions and deployment prerequisites

- Approve the funded UTC cycle rules for new sales and the exact sales cutoff.
- Confirm the 59/41 allocation base. A fee-deducted base also needs an
  authoritative verified fee source. Approve any historical backfill separately.
- Approve the IB settlement asset, chain, delay and attribution corrections.
  The current IB receipt verifier can handle an explicitly selected Arbitrum DAI
  policy. A different network or asset requires its own verified adapter.
- Confirm the authorized payout treasury wallet, RPC, treasury tokens and initial
  reconciliation blocks. The existing production payout wallet was unavailable
  in the reviewed public configuration. Central revenue and treasury reports
  await operational configuration and live reconciliation.
- Approve real-market IB and Coach interaction and public growth targets after Q1.
  External platform integrations remain conditional on licensing and technical access.

## Public research and licensing dependencies

- Topstep's 2025 disclosure reports that 16.8% of started Trading Combines
  qualified to advance and 33.3% of funded-level participants received a
  payout. The measures use different denominators and describe a single
  futures firm. The Openfund scenario inputs remain assumptions.
  [Topstep performance disclosure](https://www.topstep.com/express-funded-account-rules)
- Two Persian-language providers publish withdrawal rules and eligibility
  terms. The reviewed pages gave no comparable evaluated cohort and
  paid-recipient denominators. The scenario assumes no Iran-wide rate.
  [PropAI FAQ](https://propai.ir/faq) ·
  [PropXpro rules](https://fa.propx.pro/wp-content/uploads/2025/09/PropXpro_Trading_Rules_and_Termspropx.pro_.pdf)
- MetaQuotes advertises MetaTrader 5 institutional APIs and white-label
  licensing. Spotware advertises cTrader Open API access for connected
  accounts. Both roadmap items depend on confirming commercial terms,
  approved jurisdictions, testing access, integration and data costs, and
  the intended prop-firm model with providers.
  [MetaQuotes broker platform](https://www.metaquotes.net/en/metatrader5/brokers) ·
  [Spotware Open API](https://www.spotware.com/ctrader/dev-resources/open-api/)
