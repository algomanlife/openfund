# Openfund Prop — Investor Documentation Package

**Version 1.0 · November 2026 · Confidential (except 06_Public_Documentation)**

A complete, investor-grade documentation system for **Openfund Prop** — the proprietary-trading
business unit of the Openfund ecosystem — prepared for pre-seed fundraising (USD 50–100K under
evaluation), Canadian establishment planning, and internal financial planning.

Every financial figure in every document derives from a single source of truth:
`03_Financial_Model/Openfund_Prop_Financial_Model.xlsx` (Base scenario unless labelled),
a 29-worksheet, 60-month model with 6,749 live formulas, zero recalculation errors, and
scenario/funding selectors that recompute the entire workbook.

---

## Directory contents

### 01_Pitch_Deck/ — Investor presentation (confidential)
| File | Audience | Purpose |
|---|---|---|
| `EN/Openfund_Prop_Pitch_Deck_EN.pptx` (+ `.pdf`) | Pre-seed investors, accelerators | 15-slide narrative: thesis, problem, solution, MVP status, hybrid model, market, competition, differentiation, revenue model, GTM, financial outlook, Canada, funding, roadmap. Fully editable PPTX with native charts; no team slide (founder confidentiality). |
| `FA/Openfund_Prop_Pitch_Deck_FA.pptx` (+ `.pdf`) | Persian-speaking investors | Same facts and figures, fully adapted with RTL layout, right-to-left flow diagrams, Vazirmatn typography and authentic Persian business language. |

### 02_Business_Plan/ — Full business plan (confidential)
| File | Audience | Purpose |
|---|---|---|
| `EN/Openfund_Prop_Business_Plan_EN.docx` (+ `.pdf`) | Investors, accelerators, advisors | 27 required sections plus 10 appendices (full fee catalog, Y1–Y3 monthly detail, segment P&L, sensitivity grid, assumptions register, competitor profiles, glossary, GTM and operations detail, brand application, investor FAQ). ≈23 pages. |
| `FA/Openfund_Prop_Business_Plan_FA.docx` (+ `.pdf`) | Persian stakeholders | Full Persian adaptation (not a mechanical translation), RTL layout, identical figures. ≈25 pages. |

### 03_Financial_Model/ — The single source of truth (confidential)
| File | Audience | Purpose |
|---|---|---|
| `Openfund_Prop_Financial_Model.xlsx` | Founders, investors (diligence), advisors | 29 worksheets: dashboard, assumptions & controls (scenario + funding selectors), benchmarks, catalog, acquisition, sales, funnel, payouts (cohort-based), refunds, live-trading allocation & P&L, marketing, infra, opex, Canada, revenue, unit economics, P&L (segmented hybrid accounting), cash flow, reserves, break-even, funding requirements, use of funds, scenario analysis, sensitivity, KPIs, sources, validation. English-only by design. Blue = input, black = formula, green = cross-sheet link, yellow = controls. |

### 04_Revenue_Model/ — Business & revenue model analysis (confidential)
| File | Audience | Purpose |
|---|---|---|
| `EN/Openfund_Prop_Revenue_Model_EN.docx` (+ `.pdf`) | Investors, analysts | Business Model Canvas, revenue architecture, per-purchase economics, funnel, reward-liability controls, acquisition economics, opex structure, hybrid capital allocation, unit economics, sustainability, concentration risks, sensitivity, growth opportunities. |
| `FA/Openfund_Prop_Revenue_Model_FA.docx` (+ `.pdf`) | Persian stakeholders | Full Persian adaptation with identical figures. |

### 05_Executive_Summary/ — Concise overview (confidential)
| File | Audience | Purpose |
|---|---|---|
| `EN/Openfund_Prop_Executive_Summary_EN.docx` (+ `.pdf`) | First-contact investors, advisors | 3-page summary: concept, market, differentiation, hybrid model, MVP status, revenue model, Canada strategy, funding range, milestones, risks. |
| `FA/Openfund_Prop_Executive_Summary_FA.docx` (+ `.pdf`) | Persian first-contact readers | Full Persian adaptation. |

### 06_Public_Documentation/ — Website-ready overview (**PUBLIC**)
| File | Audience | Purpose |
|---|---|---|
| `EN/Openfund_Prop_Public_Overview_EN.html` (+ `.pdf` + `assets/`) | Website visitors | Responsive, accessible public business overview: about, mission, problem, approach, evaluation model, product architecture, technology & risk, responsible operations, vision, roadmap. Contains **no** confidential forecasts, investor terms or internal thresholds. |
| `FA/Openfund_Prop_Public_Overview_FA.html` (+ `.pdf`) | Persian website visitors | Same content fully adapted, RTL layout, Persian typography. |

### 07_Research_and_Sources/ — Evidence base (internal)
| File | Audience | Purpose |
|---|---|---|
| `RESEARCH_AND_EVIDENCE_BASE.md` | Founders, diligence | Competitor benchmarking, market sizing, Canada establishment (fees, tax, Start-up Visa status), regulatory timeline, full source register with URLs and retrieval dates, planning-assumption derivations. |

### 08_Brand_Assets/ — Brand system (internal)
| Contents | Purpose |
|---|---|
| `logos/` (approved SVG marks) · `typography/` (Ubuntu + Vazirmatn + Openfund fonts) · `Openfund-brandbook.zip` (source brandbook) · `screenshots/` (authentic product screenshots used in deliverables) | All deliverables apply Brandbook Direction A: Obsidian `#080B0A`, Signal Lime `#C6FF52`, Terminal White `#F4F5EF`. |

### 09_Quality_Assurance/ — QC report (internal)
| File | Purpose |
|---|---|
| `QC_REPORT.md` | Validation results: model formula QA, structural deck QA, visual checks, cross-document consistency, confidentiality boundaries, disclosed limitations. |

---

## How to use

- **Change a financial assumption**: open the Excel model → `Assumptions & Controls` → edit any blue cell (or the scenario/funding selectors in C4/C5) → the whole workbook recomputes. Downstream documents quote the Base scenario; regenerate or re-verify figures after material changes.
- **Switch scenarios**: `Assumptions & Controls!C4` (Conservative / Base / Optimistic) and `C5` (50/75/100K funding). The Funding Requirements sheet recomputes sufficiency verdicts.
- **Publish the public page**: upload the `06_Public_Documentation/<LANG>` folder as-is (fonts load from Google Fonts; the mark is in `assets/`).
- **Persian documents**: right-to-left layout and Vazirmatn typography are embedded in the DOCX/PPTX; figures are identical to the English editions by construction.

## Scope discipline (by instruction)

- The **Openfund Perpetual (DeFi) product is excluded** from all business models, forecasts and propositions.
- **Founder and team details are confidential** — no names, biographies, headcounts, ownership or cap tables anywhere.
- **No invented traction**: MVP status follows the repository's capability register; planned capabilities are labelled as planned.
- **Canadian incorporation is presented as planned, not completed.** The Start-up Visa Program is presented as closed to new applications (since 2025-12-31) with a successor pilot announced but not launched.
- All industry statistics are third-party analyst estimates, labelled as such; no authoritative market dataset is claimed.
