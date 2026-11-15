# Funded operations and product roadmap delivery checkpoint

The branch is based on `f7ea682c054a24a55b6369077697b953ea534963`, the
verified merge of PR #122. The latest official release observed at the start
was v0.5.0. The public GLOBAL service reported `60d5df9`; this branch is
unreleased.

## Scope and verification

| Requirement | Evidence and remaining acceptance |
| --- | --- |
| Funded lifecycle | Reused evaluation pass, operator review, linked funded account, frozen rules and separate starting balance. Existing catalog v3 tests cover the transitions. |
| Trader payout workflow | Reused the review endpoint, reservation and reversal. Captures the owned recipient and named approver and requires a finalized matching DAI transfer for new funded settlement. Verified using isolated database and receipt fixtures. |
| Ledger | Reused trading ledger, withdrawal state and financial audit. The receipt and financial event commit together. Duplicate receipt hashes are rejected within one database. Independent-region transaction exclusion remains open. |
| Certificates | Reused the historical purchase and approval triggers. New payout issuance and public settlement evidence require verified payment. Existing certificates remain immutable. |
| Treasury and Economy | Added conservative, base and stress inputs for funded conversion, IB liability, existing debt and modeled 59/41 coverage. These are planning outputs. Verified actual treasury balances and new purchase allocation journals are outside this checkpoint. |
| Product roadmap | Added a four-quarter shared source for the website and Whitepaper seed. README and repository roadmap point to it. The 2,000 registrations figure is a Q1 target. Planned platform connections depend on licensing and security. |
| Product identity | Updated the README to describe the prop firm's funded programs, rewards and technology. A broader homepage and whitepaper rewrite is still open. |
| Localization | New roadmap and Economy source copy includes Persian, English, Arabic, Russian and Simplified Chinese. Local browser checked the Persian roadmap and English Economy route. Full language review remains open. |
| SIWE and DePay | Read-only [domain check](../payments/DOMAIN_READINESS.md). Merchant and signed browser flows remain unverified. |
| Database migration | Additive withdrawal fields and a unique verified-hash index. Applied twice in isolated PostgreSQL. |
| Verification | Targeted rewards, certificate, Economy and roadmap tests, certificate browser tests and local UI evidence. The official release and deployment are separate from these checks. |

## Open implementation and decisions

- Activate the 7/14/21-day and monthly schedule after defining the monthly
  UTC boundary and grandfathering. Existing funded rules still control
  eligibility. Complete the funded dashboard and payout-specific messaging,
  unread indicators, appeals and operator queue.
- Extend the shared journal for IB payout entitlements, attribution evidence
  and independently reconciled human settlement. Confirm competing code
  precedence, payout asset/network/schedule, commission base and purchase
  eligibility before enabling new financial behavior.
- Implement 59/41 revenue recognition and expense reporting after confirming
  the eligible revenue base. Add reconciled on-chain transfer ingestion and
  collect comparable outcome data for the forecast methodology.
- Verify configured payout treasury, live receipt handling and end-to-end
  regional consistency. Confirm the real-market IB policy and Coach
  interaction separately.
- Keep provisional secondary-quarter growth estimates for owner review.
  Verify commercial licensing before promising external platform access.

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
