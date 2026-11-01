# Round 10 — Production Content Overhaul + Complete CMS Migration

- **Branch:** `qwen/content-overhaul` (from `origin/main` @ `9bf351a`, PR #19 merged)
- **Date:** 2026-11-01
- **Scope:** (A) production content overhaul — verified commercial catalog, bilingual
  copy, prototype-language removal, RTL/mobile fixes; (B) complete migration of the public
  content layer to the existing Directus CMS with live editing.

## A. Commercial catalog (terms of record)

The challenge catalog was replaced with the researched, adopted specification
(provenance: `docs/research/FUNDINGPIPS_PROGRAMS.md`, retrieved 2026-11-01):

| Program | Sizes | Fee | Phases · target | Daily / total loss | Split | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| استاندارد / Standard | 5K–100K | $44–$652 | 2 · 8% + 5% | 5% (or 3%) / 10% static | 80% · 100% monthly* | 3 min days/phase; fee refunded on 4th reward |
| تک‌مرحله‌ای / One-phase | 5K–100K | $74–$666 | 1 · 12% | 3% (or 2%) / 12% static | 80% · 100% monthly* | no min days |
| آنی / Instant | 5K–200K | $60–$888 | 0 (funded day one) | 3% / 5% trailing (locks at BE after +5%) | 95% / 14 days | 7 profitable days/30d; 15% consistency; first 3% buffer |
| تست رایگان / Free Trial | 5K–100K | free | 2 · 8% + 5% | 5% / 10% static | none | 14 days/phase; one at a time; no conversion |

\* monthly cycle: 7 profitable days + 35% consistency. Common: no time limit, higher-of
day-start balance/equity daily basis with 00:00 UTC+3 reset, first payout 14 days after the
first funded trade, min request 1% of size, plan leverage 5×.

NOT adopted (documented, never fabricated): 2-Step Pro / 2-Step Flex (pricing unverifiable —
official pages blocked), weekly/on-demand payout cycles, per-platform lot caps, platform
restrictions. Honest publication boundaries preserved everywhere: purchases, funded accounts,
payouts and trial provisioning are stated as not-yet-active — never implied operational.

**Single source of truth:** `challenge_plans` — the SAME PostgreSQL table the backend reads,
now registered in Directus as the editing surface. The landing builder, comparison table,
checkout dialog, FAQ numbers, Rulebook catalog table and the backend seed all render from it.
The frontend validates every fetched plan (`assertPlansValid`); invalid rows never render.

## B. CMS migration

New collections (existing Directus extended — no second CMS): `home_content` (+translations),
`faqs` (+translations), `trading_rules` (+translations), `legal_documents` (+translations),
`footer_links` (+translations); `challenge_plans` registered; `pages`/`navigation_items`
reused; `ui_messages` extended to 412 strings (every landing string).

- **Frontend:** `src/cms/client.ts` — typed, validated, cached (20s) public read-only
  fetchers. Home/Rulebook/Markets render from Directus; the landing receives
  plans/FAQs/legal/footer via `window.__of*` before its legacy scripts boot; features.js
  renders them with DOM-built nodes (no CMS HTML, whitelisted link destinations).
  **No hardcoded marketing fallback remains** — CMS-unavailable states are explicit.
- **Admin experience:** grouped collections, bilingual translation rows, status workflow
  (draft/published/archived — drafts filtered at the public API), Directus revisions for
  rollback, file fields for illustrations. See `docs/backstage/ADMIN_GUIDE.md`.
- **Live updates:** edits appear on the next page load — no rebuild/deploy (verified).

## Content quality

- Persian rewritten in professional contemporary copy; English held to the same standard.
- Prototype language removed: «هزینهٔ نمونه»، «اهرم نمونه»، «پرداخت امن · فعال‌سازی آنی»
  (a false claim), «پلن‌های نمونه», fabricated team personas → role cards, stale FAQ
  numbers → catalog-accurate copy. Accurate simulated-trading disclosures preserved.
- FAQ expanded to 9 catalog-accurate items (Carrot-style coverage); Rulebook rewritten with
  full commercial coverage (22 sections + catalog table); legal section versioned in CMS.

## Bug fixes found by the RTL/responsive audit

- Landing route-locale change without the toggle left the DOM untranslated (URL said /en,
  page showed fa) — the landing now re-runs the legacy translation pipeline on param change.
- 375px header/footer overflow (wallet chip + unwrapped EN footer links) — fixed.
- `Number(null) → 0` in the CMS client dropped the Instant/Free-Trial plans — fixed.

## Test evidence

| Suite | Result |
| :--- | :--- |
| `test:plans` (catalog integrity, legacy bridge, backend sync) | 5/5 |
| `test:information` (rulebook seed content) | 6/6 |
| `test:markets` | 6/6 |
| `npx tsc --noEmit` · `vite build` | clean |
| `e2e/test-cms-migration.js` — all 17 mandatory CMS checks (live edits, unpublish, drafts, permissions, no-rebuild, Gains independence, transparency untouched) + RTL/responsive + terminal regression | **35/35** |
| `e2e/test-content-overhaul.js` — bilingual copy, catalog-driven builder/FAQ/legal/footer, honest claims, prototype-language sweep, RTL/LTR 375/1440, terminal + transparency regressions | **104/104** |

Screenshots: `docs/reviews/content-overhaul/screenshots/` (fa/en, CMS live-edit states).

## Known limitations

1. Purchase activation, funded accounts, payouts, KYC and trial provisioning remain
   unplanned-engine territory — presented as published terms, never as active features.
2. 2-Step Pro / 2-Step Flex not in the catalog (unverifiable pricing) — decision list in
   `docs/research/OPENFUND_CHALLENGE_CATALOG.md` §4.
3. The classic `dist/` site is not CMS-connected; `/react/` is the authoritative website.
4. Directus must be reachable for content (explicit error states when down; Gains market
   data, trading and auth are unaffected).
