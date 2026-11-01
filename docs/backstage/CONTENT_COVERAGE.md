# Content Coverage Report — CMS Migration (2026-11-01)

Every in-scope public content element, its React component, its Directus collection/field,
both language statuses and the verified rendering path. Transparency is **excluded** by
mandate (shared chrome only); the terminal trading UI keeps its own i18n pipeline
(`ui_messages` namespace `terminal`, pre-existing).

Legend: F = fa content, E = en content, P = publication control, ✔ verified by E2E
(`e2e/test-cms-migration.js` 35 checks + `e2e/test-content-overhaul.js` 104 checks).

## Home (`/features/home/Home.tsx`)

| Element | Collection.field | F | E | P | Verified |
| :--- | :--- | ✔ | ✔ | ✔ | headline/description/CTA edits via Directus API appear on reload ✔ |
| Headline | home_content.translations.headline | ✔ | ✔ | status | ✔ |
| Supporting line | …sub | ✔ | ✔ | status | ✔ |
| Prop product title/desc/CTA | …prop_title/prop_description/prop_cta | ✔ | ✔ | status | ✔ (live-edit check #2) |
| Perpetual title/desc/CTA | …perpetual_title/… | ✔ | ✔ | status | ✔ |
| CTA destinations | home_content.prop_cta_destination / perpetual_cta_destination (whitelist) | ✔ | — | status | ✔ |
| Illustrations | home_content.prop_image / perpetual_image (Directus Files; empty → bundled asset) | ✔ | — | ✔ | upload+swap check #7 ✔ |
| SEO title/description | …seo_title/seo_description | ✔ | ✔ | status | rendered into document head ✔ |
| Honest execution note | …note | ✔ | ✔ | status | ✔ |

## Trading Challenges landing (`/pages/Landing.tsx` + legacy runtime)

| Element | Source | F | E | Verified |
| :--- | :--- | ✔ | ✔ | ✔ |
| Every static string (hero, sections, buttons, dialogs, footer text, legal text, desktop note) | ui_messages (412 strings seeded; editable fa+en) | ✔ | ✔ | ofT pipeline, EN route checks ✔ |
| Plan catalog: presets, prices, targets, loss limits, splits, min days, refund | challenge_plans.configuration (same table as the backend) | ✔ | ✔ | price-edit consistency check #3 ✔ |
| Builder labels/values | app.js renders from window.__ofPlans (CMS) | ✔ | ✔ | ✔ |
| Challenge detail tables + comparison | features.js from window.__ofPlans | ✔ | ✔ | ✔ |
| Checkout dialog summary | app.js from window.__ofPlans | ✔ | ✔ | ✔ |
| FAQ items (9 + add/remove/reorder) | faqs + faq_translations | ✔ | ✔ | checks #5/#6/#12 ✔ |
| Legal section (6 documents) | legal_documents + translations | ✔ | ✔ | check #9 ✔ |
| Footer quick links | footer_links + translations (whitelisted destinations) | ✔ | ✔ | check #8 ✔ |
| CMS-unavailable state | explicit error message — no fictional fallback | ✔ | ✔ | by construction (no fallback arrays exist) |

## Markets (`/features/markets/Markets.tsx`)

| Element | Collection | F | E | Verified |
| :--- | :--- | ✔ | ✔ | ✔ |
| Hero title/subtitle/description + SEO | pages (slug `markets`) + page_translations | ✔ | ✔ | seeded; rendered ✔ |
| Status labels, search, categories | code UI strings (functional, bilingual inline) | ✔ | ✔ | ✔ |
| Instruments & live prices | **Gains Network only** — never Directus | — | — | check #15 ✔ (488 instruments, live stream) |

## Rulebook (`/features/rulebook/Rulebook.tsx`)

| Element | Collection | F | E | Verified |
| :--- | :--- | ✔ | ✔ | ✔ |
| 22 sections: title/paragraphs/formula/explanation/tables | trading_rules + trading_rule_translations | ✔ | ✔ | section-edit check #4 ✔ |
| Section order & anchors | trading_rules.sort / section_key | ✔ | — | ✔ |
| Review-status pill (current/draft/planned) | trading_rules.review_status | ✔ | — | ✔ |
| Challenge-configurations catalog table | challenge_plans (derived — cannot disagree with landing) | ✔ | ✔ | ✔ |
| Page intro/SEO | pages (slug `rulebook`) | ✔ | ✔ | ✔ |

## Shared chrome (all pages)

| Element | Collection | Verified |
| :--- | :--- | ✔ |
| Navigation labels/visibility (4 items, fixed order) | navigation_items (public_header; route whitelist) | ✔ |
| Footer links | footer_links (destination whitelist) | check #8 across React + landing ✔ |
| Footer/legal static strings | ui_messages | ✔ |
| Language switch, theme, wallet, mobile menu | code (functional chrome) | RTL/LTR sweep ✔ |

## Transparency (excluded by mandate)

Internal sample data, charts, metrics and copy are **unchanged** (check #14 ✔).
Only the shared header/footer (above) are CMS-driven on that page.

## Publication workflow & permissions

- Status field (draft/published/archived) on every content collection; drafts filtered at
  the public-API permission level (checks #12/#13 ✔).
- challenge_plans uses active/inactive (the backend's own contract).
- Public role: read-only, published-only, on content collections; private tables 403;
  anonymous writes 403 (checks #16/#16b ✔).
- Content edits verified to appear **without a rebuild** (check #17 + every edit check).

## Live-update strategy

All CMS reads go through `src/cms/client.ts` (typed, validated, 20s in-memory cache; the
landing invalidates its cache on every boot). Content edits therefore appear on the next
page load / navigation — no Vite build, no deploy.
