# Website expansion audit — FAQ, Growth Partner, Tools Center, Learning Center

Audit performed on 2026-11-02 before implementing the four new public sections.
Repository state: `origin/main` at `3a1d8ca`, branch `qwen/website-expansion`.

The expansion brief required a full audit first: do not assume a feature is
missing before checking it, reuse rather than duplicate, and never present an
unimplemented capability as available. This document records what was found,
what was reused, and the gaps the implementation had to close.

## Application structure

- Single React application (`apps/web-react`, Vite, `react-router-dom` hash
  router, output served at `/react/`). No second frontend framework exists.
- Public website pages are "information" pages: `InformationShell` renders the
  landing header/footer (`Chrome`), sets `lang`/`dir`, SEO meta and hreflang
  alternates, and every page registers through `features/information/content.ts`
  (`InfoPage` union + `labels`).
- The terminal is a separate shell (`features/terminal/TerminalShell`) and was
  not modified by this task beyond the header/footer destinations it shares.

## Reused components and conventions

| Need | Reused from |
| :--- | :--- |
| Page shell, header, footer, hero | `features/information/InformationShell.tsx` (`Chrome`, `Hero`, `useInformationLocale`) |
| Design tokens, buttons, cards, accordion, tables | `public/legacy/style.css` + `information.css` (mint `#82e7bd`, bg `#060808`, `--ease-expo`, `.info-notice`, `.formula-block`, `.info-table-wrap`) |
| Bilingual content pattern | `text(en, fa)` from `features/information/content.ts`; Directus parent + `*_translations` + o2m alias |
| CMS fetch contract | `src/cms/client.ts` (typed, published-only, both-locales-or-drop, 20 s cache) |
| Content seeding | `seed_production_content.mjs` conventions (esbuild-loaded TS seeds, natural-key upsert, `--refresh`) |
| Repo-side content with bundled fallback | `src/cms/seed/*` precedent (rulebook/FAQ/home/legal) |
| Session + wallet | `session/useOpenfundSession.tsx` (SIWE), `RainbowConnect` in the shared header |
| Sidebar/TOC, mobile select | `rulebook-layout`/`rulebook-sidebar`/`mobile-contents` CSS patterns |

## Existing FAQ / referral / tools / learning implementations found

- FAQ: a 9-question bilingual seed (`src/cms/seed/faqContent.ts`) rendered inside
  the challenges landing by `legacy/features.js`. No site-wide FAQ page, no
  categories, no search, no deep links.
- Referral/affiliate: **absent everywhere** — no table, route, field, doc or copy.
  The perpetual "Rewards" terminal page is a support stub. The dormant imported
  protocol module contains an upstream `ReferralManager.sol` that is not part of
  the application.
- Tools/calculators: none (closest: the landing challenge builder and the market
  directory search).
- Learning center: none. Editorial precedents: `features/rulebook`,
  `features/transparency`.

## Identified gaps closed by the implementation

1. Four new routes and nav/footer destinations (`faq`, `tools`, `learn`,
   `referral`) plus sub-routes (tool detail, path, lesson, glossary, FAQ
   question link, referral entry `/ref/:code`).
2. A typed bilingual content contract (`src/cms/contentTypes.ts`) shared by the
   repo seeds, the Directus payloads and the pages.
3. New Directus collections (additive, idempotent): `faq_categories`, extended
   `faqs` (slug/category/links/page `faq`), `learning_paths`, `lessons`,
   `glossary_terms`, `tools`, `referral_content` singleton, plus nav/footer/page
   rows. Public read is gated on `status=published`.
4. A content seeder (`seed_website_content.mjs`) with the same idempotency
   contract as the production seeder.
5. A pure calculation engine (`src/data/calculators.ts`, `journalCsv.ts`) with
   coded, locale-neutral validation, and a generic tool renderer.
6. Unicode-aware FAQ/glossary search (`features/faq/search.ts`).
7. A server-authoritative referral attribution backend (`apps/backend/referrals.js`,
   `referral_codes` / `referral_attributions` tables): codes, one-time
   attribution at account creation, self-referral impossible, session-scoped
   summary. Deliberately **no** commission/reward/tier fields.

## Product-truth constraints carried into the content

The audit confirmed (see `docs/product/FEATURE_STATUS.md` and the rulebook):
purchase activation, funded accounts and payouts are not enabled in this
release; the live Prop product is a simulated 100,000 virtual DAI demo; the
Perpetual product is read-only Gains data on Arbitrum One; no proof of reserves,
no independent audit, no liquidity aggregation, and no referral program or
approved reward terms. All four sections state these limits in place rather
than implying availability; challenge figures are always labelled as published
terms of record.

See [the website expansion specification](../website/WEBSITE_EXPANSION.md) for
routes, collection schemas, the referral contract, tests and limitations.
