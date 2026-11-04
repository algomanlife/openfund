# Openfund Prop — Research & Evidence Base

**Retrieved:** 2026-11-02 (Asia/Dubai)
**Status:** Internal research register supporting the investor documentation package.
**Classification:** Confidential — internal planning use.

Every figure below carries a provenance tag:

- **[VERIFIED]** — official company page or government/regulator source, fetched 2026-11-02 or dated within the source.
- **[THIRD-PARTY]** — credible industry aggregator/analyst; not an official company disclosure.
- **[ESTIMATE]** — analyst estimate, explicitly flagged; do not present as industry data.
- **[REPO]** — verified from the Openfund repository (implementation evidence).

---

## 1. Evidence Register — Verified Facts

### 1.1 Openfund Prop product & MVP status [REPO]

Source: `github.com/algomanlife/openfund` @ `main`, capability register reviewed 2026-11-02.

**Completed capabilities (implementation evidence in repository):**

- React product shell with EN/FA locales and RTL layouts; shared Vela terminal (Prop + Perpetual adapters).
- Prop virtual account and ledger: server-authoritative simulated execution, market/limit/stop orders, SL/TP, partial close, liquidation, owner-scoped retries (PostgreSQL).
- Decimal-based valuation with fees/spread handling; drawdown telemetry.
- SIWE wallet authentication with first-party sessions (nonce/domain/chain checks).
- Prop portfolio and reporting: positions, order history, fee-aware analytics, CSV export.
- Product journal: private notes, tags, search, import/export.
- Published CMS content and challenge catalog (Directus); challenge account records and catalog selection.
- Render deployment blueprint (API + PostgreSQL 17 + Directus), CI validation.

**Not operational (Planned/Blocked):**

- **Paid activation, evaluation and challenge enforcement** — payment, legal/product facts, assignment and risk-rule engine required; free_demo has no commercial challenge limits.
- **Funded capital, withdrawals, rewards and certificates** — visible capability pages are unavailable states, not operational services.
- Production transparency dashboard uses labelled synthetic fixtures.
- Real wallet/device acceptance for WalletConnect: in progress.
- Live trading execution component of the hybrid model: not implemented; subject to technical, operational and legal validation.

**Published challenge catalog (terms of record, `challengePlans.ts`):**

| Program | Sizes (USD) | Fee (per size) | Phases | Targets | Daily / total loss | Split | Min days | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Standard | 5K/10K/25K/50K/100K | $44/$80/$216/$349/$652 | 2 | 8% + 5% | 5% (or 3%) / 10% static | 80% bi-weekly · 100% monthly* | 3/phase | fee refunded on 4th reward |
| One-phase | 5K/10K/25K/50K/100K | $74/$111/$255/$353/$666 | 1 | 12% | 3% (or 2%) / 12% static | 80% bi-weekly · 100% monthly* | none | — |
| Instant | 5K/10K/25K/50K/100K/200K | $60/$88/$188/$244/$444/$888 | 0 | none | 3% / 5% trailing (locks at BE after +5%) | 95% every 14 days | 7 profitable/30d | 15% consistency; first 3% not payout-eligible |
| Free Trial | 5K–100K | free | 2 | 8% + 5% | 5% / 10% static | none | 3/phase | 14 days/phase; provisioning not implemented |

\* monthly cycle requires 7 profitable days + 35% consistency score. Common terms: no time limit (except trial); daily loss measured on higher of day-start balance/equity, reset 00:00 UTC+3; first payout 14 days after first funded trade; minimum payout request 1% of account size; reference leverage 5×.

**Provenance:** structure, prices and conditions adapted from verified FundingPips research (retrieved 2026-11-01 per repo), rebranded with original copy. **Purchase activation, funded accounts, payout processing and trial provisioning are NOT operational in the current release** — stated plainly in checkout dialog, FAQ and Rulebook.

**Pending owner decisions before commercial launch (from repo):** final fee sanity-check vs cost structure; KYC provider/jurisdictions; payout rail; weekend/news policy; appeals/reset process; 4th-reward refund and "first 3% not eligible" buffer vs treasury model.

### 1.2 Brand system [REPO — Brandbook "Direction A", recommended]

- Palette: Obsidian `#080B0A` (primary dark), Signal Lime `#C6FF52` (accent), Terminal White `#F4F5EF`; dark surfaces `#101711`, `#171B19`.
- Typography: Ubuntu (Latin, bundled TTFs) + Vazirmatn (Persian, bundled WOFF2). Openfund custom TTFs also bundled.
- Mark: approved SVGs (green/white/black), ViewBox 581×644, clear space ≥ ¼ symbol width, min height 32px, never redraw/alter.
- Voice: clear, measured, no hype; "Rooted in Vision. Open to Possibility." (recommended master tagline, pending approval).
- Brandbook status: strategic and visual proposal, pending approval — the package labels it accordingly.

---

## 2. Competitor Benchmarking

### 2.1 Challenge pricing matrix [THIRD-PARTY — Pipster.io database, verified 2026-09-28]

100K account headline comparison (USD-equivalent where EUR listed):

| Firm | 2-Step 100K | 1-Step 100K | Instant 100K | Refund policy |
| :--- | :--- | :--- | :--- | :--- |
| FTMO | €540 | €499 | — (Instant acct exists) | refunded with first Reward (2-step) |
| FundedNext | $549.99 | $569.99 | — | 2-step: with 1st reward; 1-step: with 3rd reward |
| The5ers | $405 | $329 (Pro Growth) | — | 70% with first payout (High Stakes) |
| FundingPips | $652 | $666 | $444 | 2-step: 4th reward |
| Alpha Capital | $527 | $477 | $457 | not refunded |
| E8 Markets | — | $488 | — | not refunded |
| Goat Funded | $628 | $530 | $815 | 4th payout |
| **Median (database)** | **$538** | **$509** | — | — |

Full per-size pricing for the five focus firms:

- **FTMO (EUR) [VERIFIED pricing structure via Pipster; model terms via ftmo.com]:** 2-step: 10K €89, 25K €250, 50K €345, 100K €540, 200K €1,080. 1-step: 10K €79, 25K €199, 50K €319, 100K €499, 200K €999. Targets 10%/5% (2-step) or 10% (1-step); daily loss 5% (2-step) / 3% (1-step); max loss 10%; min 4 trading days/phase (2-step); split 80% rising to 90% via scaling. FTMO marketing: **"$650M+ paid in rewards"** [VERIFIED, ftmo.com retrieved 2026-11-02]. New consistency rule (orders on/after 12 Oct 2026): best day ≤ 50% of total profit.
- **FundedNext [VERIFIED via fundednext.com package-comparison, retrieved 2026-11-02]:** Stellar 2-step ($6K–$200K; 8%/5% targets; 10% static max loss; 5% daily; 5 min days; up to 95% share; refund with 1st reward; 15% performance reward from challenge phase). Stellar 1-step (10% target; 6% max; 3% daily; 2 min days; up to 95%; refund 3rd reward; first payout 5 business days). Stellar Lite (lowest entry). Stellar Instant ($2K–$20K; 6% trailing; up to 80%). Prices [THIRD-PARTY Pipster]: 2-step 25K $199.99, 50K $299.99, 100K $549.99, 200K $1,099.99.
- **The5ers [VERIFIED via the5ers.com, retrieved 2026-11-02]:** High Stakes 2-step: 5K $35, 10K $69, 25K $176, 50K $249, 100K $405; targets 10%/5% (page shows 8%/5% in one table — internal discrepancy noted); 5% daily; 10% max; 80% split rising to 100%. Hyper Growth 1-step: 10% target, 6% stop-out, 50%→75%→100% split, account doubles per 10% milestone to $4M. Bootcamp 3-step (cheapest entry, mandatory stop-loss). Payouts bi-weekly, $150 minimum.
- **FundingPips [REPO research, retrieved 2026-11-01]:** 2-step Standard $44–$652 (8%/5%; 3% or 5% daily; 10% static); 1-step Flex $74–$666 (12%; 12% static); Zero instant $60–$888 (5% trailing, 95% every 14 days, 7 profitable days/30d, 15% consistency, first 3% buffer). Refund on 4th reward (2-step). Free 14-day trial exists (terms unverified). Source tier: third-party (official pages blocked, HTTP 403/429).
- **Topstep (futures) [VERIFIED via help.topstep.com, retrieved 2026-11-02]:** subscription model, not one-time fee: 50K $49/mo, 100K $99/mo, 150K $199/mo (standard path) with $149 one-time activation per Express Funded Account, or no-activation path at $95/$149/$229/mo. Resets cost the monthly fee. Referral 15% / affiliate 20% discounts. **Futures prop (CME sim-to-live) — different model class from forex/CFD evaluation firms.**
- Apex Trader Funding: futures evaluation; [THIRD-PARTY Track360 est.] 150K–180K traders, $50–70M est. revenue.

**Positioning of Openfund's published fees:** Openfund's Standard ($44–$652) and One-phase ($74–$666) sit **at/below the FundingPips benchmark and below the FTMO/median 100K price ($538)**; Instant ($444 @100K) is mid-market (peers: FundingPips $444, Alpha $457, Goat $815; several peers price instant 100K at $2,000–$4,500).

### 2.2 Firm scale estimates [THIRD-PARTY — Track360.io, July 2026; no audited counts published]

| Firm | Est. traders | Est. revenue | Split | Model |
| :--- | :--- | :--- | :--- | :--- |
| FTMO | 380K–450K | $180–210M | 80–90% | 2-phase challenge + profit split |
| FundedNext | 250K–320K | $110–140M | up to 95% | multiple challenge formats |
| The 5%ers | 180K–220K | $65–85M | up to 100% (scaling) | instant + scaling |
| Apex | 150K–180K | $50–70M | 100% first tranche, then 90% | futures |
| Topstep | 120K–150K | $45–60M | 100% first tranche, then 90% | futures |

Top 5 firms hold ~62% of trader acquisition. 60–65% of firms are US-headquartered/founded. MetaTrader-only firms fell from ~85% (2023) to <30% (2026).

### 2.3 Evaluation funnel & payout statistics [THIRD-PARTY — Track360, July 2026]

- Challenge pass rate: 5–14% (12.3% across Track360-tracked programs); Phase 1 pass 25–35%, Phase 2 30–45% of Phase 1 passers.
- Funded traders receiving ≥1 payout: ~45% of funded; ~7% of all challenge buyers ever paid; consistent long-term traders 1–3% of buyers.
- 60–70% of failures caused by drawdown violations, not missed targets.
- **30–40% of failed buyers repurchase within 90 days** (repeat-revenue driver).
- Median first payout $1,000–$4,000 (on $50K–$200K accounts, 5–10% first-cycle profits).
- Advertised splits 2026 standard: 80–90% (up from 70–80% in 2022); weekly/on-demand payouts standard at top-10 firms.
- Revenue mix: challenge fees 42%, profit-split economics 38%, affiliate commissions 15%, white-label/tech 5% [ESTIMATE].

### 2.4 Customer acquisition economics [THIRD-PARTY — Track360]

- Affiliates drive 40–50% of new challenge purchases.
- CPA $40–$80 per purchase, or 10–25% revenue share; hybrids growing.
- Effective cost per funded trader: $325–$650.
- Referred customers average 1.6–2.1 purchases in year one.

---

## 3. Market Sizing

**No authoritative TAM for retail prop trading exists.** All circulating figures are analyst estimates. Building blocks:

- Industry revenue: **~$850M 2026 (+45% YoY)**, $585M 2025, $460M 2024, $340M 2023, $230M 2022, $130M 2021 [THIRD-PARTY Track360 estimate].
- ~12M challenge purchases annually at ~$250 average fee → ~$3B gross fee flow [ESTIMATE — includes repeat purchases and unrecovered gross billings; not revenue].
- ~2.1M active funded traders globally [ESTIMATE].
- ~120–150 active firms in 2026 (down from 220+ peak in 2023); 80–100 ceased operations Feb 2024–late 2025 (~40% of peak) [THIRD-PARTY, FinanceMagnates-based].
- Search interest in prop firms rose ~607% 2020–2024, flattening 2025.

**Bottom-up SOM logic for the Openfund Prop model (planning framework):** at 12M annual purchases industry-wide and $850M recognized revenue, a 0.1%–0.3% share of purchase volume in years 3–5 (12K–36K purchases/yr at $150–$250 blended fee) corresponds to ~$2M–$8M annual challenge revenue — the base/optimistic cases of the financial model. Conservative case assumes sub-0.05% share. **These are planning assumptions, not market claims.**

---

## 4. Regulatory Environment

- **CFTC v. MyForexFunds (Aug–Nov 2023):** ~$310M in fees from ~135,000 customers alleged [VERIFIED, CFTC]. December 2025: firm cleared a legal hurdle to restart [THIRD-PARTY, Bloomberg 2025-12-08]. Core lesson: misrepresenting simulated performance as real trading and using customer fees for firm trading triggered fraud action — Openfund's honest-labelling posture directly addresses this.
- **MetaQuotes withdrew MT4/MT5 from US-facing prop firms (Feb 2024)** [THIRD-PARTY, FinanceMagnates] — platform independence (own terminal) is a strategic asset.
- **No dedicated prop-trading license exists in any major jurisdiction as of 2026**; Singapore/UAE/Curaçao registrations serve as de facto compliance tier [THIRD-PARTY].
- **Canada:** no dedicated prop-firm regime located; classification of simulated evaluations + contractual rewards (vs securities/derivatives dealing) **requires professional Canadian legal advice**. Marketing claims subject to Competition Act; PIPEDA privacy; FINTRAC AML likely not triggered unless handling/ transmitting funds for others — payout rails design determines this. Ontario court receivership precedent exists for a prop firm with US legal problems [THIRD-PARTY, Wealthprofessional.ca].

---

## 5. Canada Establishment

### 5.1 Corporate establishment [VERIFIED — Corporations Canada, ised-isde.canada.ca, fees page updated 2025-05-06, retrieved 2026-11-02]

- Federal incorporation (CBCA, online): **$200, 1 business day**; express +$100 (4 hours). NUANS name search is built into online filing.
- Annual return: **$12/year** online.
- Extra-provincial registration required in each province of operation (provincial fees additional; e.g. Ontario registration via ServiceOntario).
- Director residency: no federal Canadian-residency requirement for directors; 25% of directors must be resident Canadians **if the corporation has fewer than four directors** (CBCA s. 105(3)) — **verify current text with counsel**.
- Federal vs provincial: federal name protection Canada-wide; provincial simpler/cheaper single-province. Recommendation in package: **federal incorporation** for the planned multi-province/international footprint.

### 5.2 Tax [VERIFIED — CRA, page updated 2026-10-21]

- Federal: general net rate **15%**; CCPC small-business rate **9%** on first $500K (provincial limit varies).
- Ontario: 2.2% lower / 11.5% higher rate (lower rate reduced from 3.2% effective July 1, 2026) → combined small-business ~11.2% (9% + 2.2%).
- GST/HST registration threshold: **$30,000** worldwide taxable revenue over four consecutive quarters [VERIFIED standard; confirm with accountant]. Digital services to non-Canadian customers are generally zero-rated exports — place-of-supply rules require professional confirmation.
- Tax filing: T2 corporate return annually; GST/HST filing cycles per registration.

### 5.3 Start-up Visa Program — current status [VERIFIED — Canada.ca, page dated 2026-07-21; IRCC notice 2025-12-19]

- **The Start-up Visa Program is closed to new applications as of December 31, 2025 (11:59 p.m.).** Canada.ca page status: **"Paused"** — only applicants holding a **valid 2025 commitment certificate** from a designated organization may apply, **by June 30, 2026**. Closed to all other applications.
- SUV optional work-permit intake halted effective Dec 19, 2025 (extensions for those already in Canada with SUV permits excepted).
- Self-Employed Persons Program pause extended "until further notice."
- IRCC states these measures "set the foundation for the transition to a **new, targeted pilot program for immigrant entrepreneurs**," with details to come in 2026. **No name, criteria, or launch date published.**
- Alternative pathways (Intra-Company Transfer, provincial entrepreneur streams, employer-specific work permits) exist with their own conditions; all require case-specific immigration advice.

**Documentation rule:** the investor package presents the SUV as **closed to new applications with a successor pilot announced but not yet launched**, and never presents it as a currently open pathway. Immigration eligibility is separate from business viability.

### 5.4 Banking & payments [REQUIRES PROFESSIONAL ADVICE]

- Corporate account opening for a foreign-founded startup: standard Canadian banks require in-person/identity verification; fintech-friendly alternatives (Wise Business, Simplii etc.) vary — no reliable public fee schedule; flag as operational planning item.
- Card acceptance for digital services via Stripe/PayPal available in Canada; **trading-adjacent businesses are commonly classified high-risk MCC** — processor approval and rolling reserves are realistic risks; alternative processors and payout rails (for trader rewards) need provider due diligence. KYC provider, payout rail and payout fees are explicitly open decisions in the Openfund repo.

---

## 6. Source Register

| # | Source | URL | Retrieved | Claims supported |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Openfund repository (GitHub) | github.com/algomanlife/openfund | 2026-11-02 | Product catalog, MVP capability status, brand assets, pricing provenance, pending decisions |
| 2 | Openfund Brandbook (repo archive) | repo: brand/brandbook/Openfund-brandbook.zip | 2026-11-02 | Palette, typography, mark rules, voice |
| 3 | FTMO Trading Objectives | ftmo.com/en/trading-objectives | 2026-11-02 | 1/2-step & instant objectives, consistency rule, $650M+ rewards stat |
| 4 | FundedNext package comparison | fundednext.com/package-comparison | 2026-11-02 | Stellar 1/2-step/Lite/Instant rules & splits |
| 5 | The5ers challenge programs | the5ers.com/challenge-programs-… | 2026-11-02 | High Stakes/Hyper Growth/Bootcamp rules |
| 6 | Topstep pricing & payment FAQ | help.topstep.com (article 14289835) | 2026-11-02 | Futures subscription pricing, activation, resets |
| 7 | Pipster evaluation-costs database | pipster.io/research/evaluation-costs | 2026-11-02 (data verified by source 2026-09-28) | Per-size fees for FTMO/FundedNext/The5ers/FundingPips/8 other firms; medians |
| 8 | Track360 prop trading statistics 2026 | track360.io/blog/prop-trading-industry-statistics-2026 | 2026-11-02 (source published 2026-07-18) | Market size series, firm estimates, pass/payout rates, affiliate economics, industry structure |
| 9 | Canada.ca Start-up Visa | canada.ca/…/start-visa.html | 2026-11-02 (page dated 2026-07-21) | SUV paused; closed to new applications; 2025-commitment exception to June 30 2026 |
| 10 | IRCC notice: immigration measures for entrepreneurs | canada.ca/…/immigration-measures-entrepreneurs.html | 2026-11-02 (notice 2025-12-19) | SUV closure date/work-permit halt/successor pilot statement |
| 11 | Corporations Canada fees | ised-isde.canada.ca/site/corporations-canada | 2026-11-02 (updated 2025-05-06) | Incorporation $200, annual return $12, express options |
| 12 | CRA corporation tax rates | canada.ca/…/corporation-tax-rates.html | 2026-11-02 (updated 2026-10-21) | 9%/15% federal; provincial rates |
| 13 | IMI Daily (SUV coverage) | imidaily.com | 2026-11-02 (article 2025-12-20) | Corroboration of SUV closure/2026 replacement |
| 14 | Bloomberg | bloomberg.com (2025-12-08) | 2026-11-02 | MyForexFunds restart hurdle |
| 15 | Track360 market analysis report | track360.io/blog/prop-trading-industry-report-2026-market-analysis | fetch failed (402) — figures not used | — |

**Limitations register:** FundingPips official pages blocked (429/403) — terms via third-party, must be re-verified before commercial decisions (per repo discipline). Firm revenue/trader counts are unaudited analyst estimates. No official market-size authority exists. Canada prop-firm securities classification: no definitive public guidance located — professional advice required. Banking/high-risk MCC specifics unverified.

---

## 7. Planning Assumptions Derived (inputs to the financial model — adjustable, not facts)

- Blended average challenge fee: ~$180–$220 (Openfund mix skews to Standard/One-phase mid sizes; Instant adds 200K $888 tail).
- Pass-rate family: Phase-1 pass ~25–30%; Phase-2 pass ~35–40% of P1 passers; blended program pass 8–12%.
- Funded activation: ~85–95% of passers activate.
- Share of funded receiving any payout: ~40–50%; average first payout $1,200–$2,500 (Openfund sizes 5K–100K).
- Repeat purchase rate of failed buyers within 90 days: 30–40%.
- Affiliate share of sales: 35–50%; commission 10–15% of fee revenue (below industry 10–25% band midpoint).
- Refund/chargeback exposure: 2–6% of fee revenue (4th-reward refunds booked when triggered; instant model buffers reduce early payout exposure).
- Payment processing: 3.5–5% + fixed fee (high-risk MCC band).
- Payout-to-revenue ratio: output/control metric, target ceiling informed by industry profit-split economics (revenue mix: challenge fees 42% vs split economics 38%) — not a fixed percentage assumption.
