# Quality Assurance Report — Openfund Prop Investor Package

**Version 1.0 · 2026-11-03 · Internal (09_Quality_Assurance)**

---

## 1. Financial model (Openfund_Prop_Financial_Model.xlsx)

| Check | Result |
|---|---|
| Worksheets delivered | 29 / 29 required (plus dashboard) |
| Live formulas | 6,749 |
| Recalculation errors (LibreOffice full recalc) | **0** |
| Formula consistency across 60 monthly columns | Verified (row-consistent formulas; no mid-row edits) |
| Scenario switching (Conservative/Base/Optimistic) | Functional — all three tested end-to-end; Conservative honestly returns "Insufficient" verdicts |
| Funding selector (50/75/100K) | Functional; sufficiency verdicts recompute |
| Cash-flow reconciliation | PASS (ending cash = Σ net CF + funding, < $1) |
| Annual blocks = monthly sums (revenue, EBITDA) | PASS |
| Program mix and size weights sum to 100% | PASS |
| Payout-to-revenue control band (15–70%) | PASS (Base: 48% 5-year average) |
| Use-of-funds total | PASS (100%) |
| No circular references | Confirmed by recalculation engine |
| Scenario Analysis sheet | Annualized closed-form, launch-month-corrected, catalog-fee basis; labelled as approximation — monthly grid is authoritative |

**Key Base-scenario outputs (quoted consistently across all documents):**
5-year net revenue $3,318,997 · 5-year EBITDA +$162,472 · trader payouts $1,604,144 (48% of revenue) ·
EBITDA break-even month 4 (post-launch) · trough cash need incl. reserve $24,515 · Y5 purchases 9,423 ·
Y5 active funded accounts 1,025 · cash EOY Y5 $217,412.

## 2. Pitch decks (EN + FA)

| Check | Result |
|---|---|
| Slides | 15 / 15 required narrative slides, both languages; **no team slide** (founder confidentiality) |
| Structural QA (qa_pptx) | EN: valid, 0 errors, 0 warnings · FA: valid, 0 errors, 0 warnings |
| Visual QA (rendered grids) | Verified: brand palette (Direction A), native charts render, authentic product screenshots, FA mirrored RTL columns and right-to-left flow arrows with left arrows |
| Charts | Native editable OOXML charts (market growth column chart; revenue/payouts/EBITDA line chart) |
| Facts | Identical to the model (scenario table, KPIs, catalog) |

## 3. Documents (business plan, revenue model, executive summary)

| Check | Result |
|---|---|
| Business plan length | EN ≈23 pages, FA ≈25 pages (27 required sections + appendices) |
| Executive summary length | 3 pages per language (target 2–3) |
| Revenue model doc | 5 pages per language, 13 required analytical areas covered |
| Persian RTL | Proper `bidirectional` paragraphs, RTL tables, Vazirmatn typography; rendered and visually verified |
| PDF export | LibreOffice conversion verified for all 12 document files |
| Placeholder scan | None (xxxx/lorem/ipsum/TODO) |
| No `\n` in paragraphs, dual table widths | Enforced via builder |

## 4. Public documentation

| Check | Result |
|---|---|
| Responsive + accessible | Fluid type, sticky nav, single-column mobile, contrast-checked palette |
| RTL Persian version | `dir="rtl"`, Vazirmatn, mirrored callouts/tables |
| Confidentiality boundary | **PASS — automated scan: no confidential financial-forecast terms, no investor terms, no funding figures, no LTV/CAC, no EBITDA, no use-of-funds content in public pages** |
| Accuracy | Only repository-verifiable claims; purchase-activation status disclosed; SUV status accurate |

## 5. Cross-document consistency

All financial figures were generated from the same extracted model outputs (Base scenario)
programmatically — the same JSON facts feed the decks, plans, revenue model and summaries.
Spot-checks confirmed consistent presence of the canonical figures ($3.32M, $24.5K, 1,025,
48%, $652, $200, 11.2%, SUV 2025-12-31) across the package. The Excel model remains the
single source of truth; where exports cannot recalculate, regenerate after model changes.

## 6. Scope discipline

| Rule | Status |
|---|---|
| Openfund Perpetual excluded from business model/forecasts | PASS (verified across all documents) |
| No founder names, biographies, team slides, cap tables | PASS |
| No invented traction/revenue/partnerships/licenses | PASS (MVP status from repo capability register) |
| Canadian incorporation presented as planned | PASS |
| Start-up Visa presented as closed (2025-12-31) | PASS |
| Regulatory claims qualified (professional advice required) | PASS |

## 7. Disclosed limitations

1. **FundingPips terms** were verified via third parties (official pages returned HTTP 403/429);
   flagged for re-verification before commercial decisions.
2. **Firm revenue/trader counts** are unaudited analyst estimates (Track360, July 2026);
   no authoritative industry dataset exists and none is claimed.
3. **Tax treatment** is a simplified monthly accrual at the 2026 combined small-business rate
   (11.2%); GST place-of-supply and timing optimisations require professional advice.
4. **Scenario Analysis / Sensitivity sheets** are annualized approximations (labelled);
   the monthly grid is authoritative.
5. **Brandbook status**: Direction A is a recommended proposal pending approval — the package
   preserves those labels rather than presenting them as approved.
6. **Contact line in decks** reads "Openfund founding group (details confidential)" — replace
   with public contact details when authorised.
7. **Payment processor / payout rail / KYC provider** are open decisions (repo backlog);
   cost assumptions use high-risk-MCC bands.

## 8. Render/inspection evidence

- Excel: formula_refresh full recalculation × 4 runs (final: 0 errors).
- Decks: rendered slide grids inspected (EN/FA), structural QA clean.
- DOCX: sample pages rendered and inspected (cover, body, tables, RTL pages).
- Public pages: rendered PDFs inspected (EN/FA).

**Overall verdict: package passes all validation gates; limitations above are disclosed, none blocking.**
