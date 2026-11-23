# 0052 — Site search and search analytics

- **Status:** Accepted (2026-11-23)
- **Scope:** website, terminal header, backend, Backstage, Directus
- **Item:** batch 2, D

## Context

The site had no search. Visitors look for rules, help articles, whitepaper
chapters, developer docs and markets across five locales, two scripts and two
regions. Persian queries arrive with Arabic letters (U+064A yeh, U+0643 kaf), ZWNJ,
diacritics and three digit systems. The owner wants to see what people search
for, without collecting personal data.

## Decision

1. **One core, two callers.** `packages/site-search` holds normalization,
   tokenizing, ranked matching (prefix, substring, synonyms, a typo budget of
   one edit from four letters and two from eight), highlight ranges and query
   masking. The backend and the web app import the same module, so analytics
   see the query exactly as the browser searched it.
2. **Published-only index per region.** `GET /search/index?locale=` returns
   the index for one locale: Directus rows read with fixed
   `status = published` queries through the CMS snapshot path (the public role
   decides visibility; the last-known-good snapshot answers when the CMS is
   down), the public routes and developer docs from
   `apps/backend/search-sources.json`, and market symbols. It never contains
   user, account, wallet or terminal data. Each region builds its own index
   from its own snapshot, so IRAN serves its own. The index is rebuilt when
   its inputs' hash changes (checked at most once a minute) and revalidated
   with an ETag. `search-sources.json` is generated from the web app's route
   table, menu labels and developer docs by `scripts/search/build-sources.mjs`
   (`--check` in CI), because the Iran image is built from the release
   archive and must not read files outside `apps/backend`.
3. **Search runs in the browser.** The palette (`Ctrl/⌘+K`, `/`, or the
   header button beside the theme toggle) and `/:locale/search` load the
   index lazily on first use. The results page has filter tabs, 20 results
   per page and is `noindex`. When the backend cannot answer, a bundled index
   of the public pages (menu labels and descriptions) is used and labelled.
4. **Editors own synonyms and suggestions.** Directus collections
   `search_synonyms` (groups of terms) and `search_suggestions` (route and a
   label per locale), published rows readable by the public role, reach every
   region through the snapshot. Backstage writes them from the analytics
   dashboard behind the owner gate.
5. **Anonymous analytics.** `POST /search/events` adds to
   `search_query_stats (day, locale, query)` counters: searches, searches with
   results and clicks. E-mails, wallets, hashes and phone numbers are masked
   before storage and queries are capped at 80 characters. No IP, wallet,
   user id, cookie or user agent is read or stored. Rows older than twelve
   months are deleted daily. The Backstage dashboard (`siteSearch`) shows
   totals, a daily trend, top, zero-result and no-click queries, filters by
   date, locale and text, a CSV export, and one-click "add synonym or
   suggestion".

## Consequences

- No third-party search service and no new dependency; the index for one
  locale is a few hundred entries and searching it in the browser is
  instantaneous.
- Analytics are per region: the dashboard reads the GLOBAL backend. IRAN
  counts stay in the IRAN database.
- A new public page appears in search when it gets a menu label in
  `features/information/content.ts` and the sources are regenerated.
