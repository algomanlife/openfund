# Openfund Challenge Catalog — adopted specification

- **Decided:** 2026-11-01 (production content correction round — the catalog below is now the
  published Openfund specification, replacing the earlier provisional 3-plan draft)
- **Canonical code source:** `apps/web-react/src/data/challengePlans.ts`. The landing builder,
  the challenge comparison table, the FAQ, the Rulebook and the backend seed
  (`apps/backend/seed-plans.js`) all render from this one catalog.
- **Provenance:** program structure, prices and conditions adapted from the verified
  FundingPips research in `FUNDINGPIPS_PROGRAMS.md` (retrieved 2026-11-01), rebranded for
  Openfund with original copy. No competitor wording or naming appears publicly.

## 1. Published Openfund catalog (terms of record)

| Program | Sizes (USD) | Fee (per size) | Phases | Targets | Daily / total loss | Split | Min days | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| استاندارد / Standard | 5K / 10K / 25K / 50K / 100K | $44 / $80 / $216 / $349 / $652 | 2 | 8% + 5% | 5% (or 3%) / 10% static | 80% bi-weekly · 100% monthly* | 3 / phase | fee refunded on 4th reward |
| تک‌مرحله‌ای / One-phase | 5K / 10K / 25K / 50K / 100K | $74 / $111 / $255 / $353 / $666 | 1 | 12% | 3% (or 2%) / 12% static | 80% bi-weekly · 100% monthly* | none | — |
| آنی / Instant | 5K / 10K / 25K / 50K / 100K / 200K | $60 / $88 / $188 / $244 / $444 / $888 | 0 | none | 3% / 5% trailing (locks at BE after +5%) | 95% every 14 days | 7 profitable / 30d | 15% consistency; first 3% not payout-eligible; floating-loss cap |
| تست رایگان / Free Trial | 5K / 10K / 25K / 50K / 100K | free | 2 | 8% + 5% | 5% / 10% static | none | 3 / phase | 14 days per phase; one at a time; no conversion, no reward |

\* monthly cycle requires 7 profitable days + 35% consistency score.
Common: no time limit (except the trial); daily loss measured on the higher of day-start
balance/equity, reset 00:00 UTC+3; first payout 14 days after the first funded trade;
minimum payout request 1% of account size; plan leverage up to 5×.

**Publication status:** these are the terms of record shown on the landing and Rulebook.
Purchase activation, funded accounts, payout processing and trial provisioning are NOT
operational in the current release — stated plainly on the checkout dialog, the FAQ and
the Rulebook (never implied otherwise).

## 2. Not adopted — and why (no fabrication)

| Item | Status | Reason |
| :--- | :--- | :--- |
| 2-Step Pro program | not published | all conditions verified except **pricing** (official pages blocked; no third-party source with prices) — cannot publish a purchasable program without a fee |
| 2-Step Flex program | not published | only "12% drawdown, up to 95% split" verified; targets/prices unavailable |
| Weekly 60% / on-demand 90% payout cycles | not published | secondary help-center claims, weakest verification; bi-weekly + monthly adopted instead |
| 10% "Swing" weekend add-on | not published | Openfund does not sell add-ons; weekend policy stays with the final funded agreement |
| 20-lot per-trade cap | not adopted | platform-specific enforcement (MT5/cTrader/Match-Trader), not applicable to the Openfund terminal |
| Trial platform restriction (MT5-only) | not adopted | Openfund's trial, when live, runs in the Openfund terminal |

## 3. Free Trial — published specification

Included in the catalog (see table). Conditions: 14 calendar days per phase, Standard
challenge rules, one active trial at a time, blocked while holding an active paid
challenge, no reward requests, no conversion to a paid evaluation or funded account.
**Provisioning is not implemented** — it activates with the commercial launch; the public
copy says exactly that.

## 4. Decisions still awaiting the owner (before commercial launch)

1. Final price sanity-check of the adopted fees against Openfund's own cost structure.
2. KYC provider, documents, jurisdictions.
3. Payout rail (currency/network), payout fees, taxes.
4. Weekend-holding and news-window policy on funded accounts.
5. Appeals/reset process and termination policy.
6. Whether the 4th-reward refund and the "first 3% not eligible" buffer match Openfund's
   treasury model.
