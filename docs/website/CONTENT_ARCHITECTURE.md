# Public Website Content Architecture and Ownership

This document describes where every piece of public website text comes from,
who owns it, how it reaches the five public locales and which checks guard it.
It covers the public routes listed in `apps/backend/seo.js`
(`PUBLIC_SITE_ROUTES`), not the trading terminal.

## Locales and direction

| Locale | Direction | Authoring |
| :--- | :--- | :--- |
| `fa` | RTL | Authored in the repository and in Directus |
| `en` | LTR | Authored in the repository and in Directus |
| `ar` | RTL | Translated from the English source |
| `ru` | LTR | Translated from the English source |
| `zh-CN` | LTR | Translated from the English source |

`index.html` sets `lang` and `dir` from the route before first paint;
`src/i18n/locales.ts` (`dirOf`) keeps them in sync after hydration. Brand
names, tickers, prices and the labels `A-Book` and `B-Book` are marked
`dir="ltr"` inside RTL copy and are never translated.

## Content sources

| Source | Path | Reaches the page | Owner |
| :--- | :--- | :--- | :--- |
| Challenges page markup (Persian source) | `apps/web-react/src/pages/landing-body.html` | Bundled with the app | Product content |
| Challenges page dictionary (Persian → English) | `apps/web-react/public/translations.json` | Bundled; also seeded into Directus `ui_messages` | Product content |
| Added-locale dictionaries (English → ar/ru/zh-CN) | `apps/web-react/src/i18n/content/*.json`, `src/i18n/messages/*.ts` | Bundled | Localization |
| Plan catalog | `apps/web-react/src/data/challengePlans.ts` | Bundled; seeded into `challenge_plans` | Product (rules); see [Product Rules](../product/PRODUCT_RULES.md) |
| Rulebook | `apps/web-react/src/features/rulebook/content.ts` | Directus `trading_rules`, derived from the catalog | Product (rules) |
| Home, FAQ, legal, footer, SEO rows | `apps/web-react/src/cms/seed/*.ts` | Directus, seeded by `apps/backstage/scripts/seed_production_content.mjs` and `seed_website_content.mjs` | Product content; legal text requires legal review |
| Whitepaper | `apps/web-react/src/cms/seed/whitepaper/` | Directus, seeded by `seed_whitepaper_content.mjs` (fa/en publication) | Product and governance |
| Market data | Gains Network | Live API reads | Gains (never mixed with editorial content) |

Directus is the editing surface for production content. Seeds are the
repository edition of that content: the seeders only create missing rows
unless `--refresh` is passed, so a repository change to a Directus-backed text
reaches production only after an approved seed refresh.

## Publication rules

- No hosting, infrastructure-provider or release-mechanics notes on public
  pages. Infrastructure is documented only in `docs/deployment/`.
- No development, sample, placeholder or "coming soon" product copy. An
  unconfigured community channel shows its explicit unavailable state.
- No public Team section, team roles or portraits.
- No Instagram promotion button. Telegram and Discord remain; each shows a link
  only when an owner-verified URL is configured at runtime.
- No unverified claims: no office addresses, licensing or regulatory status,
  payout speed, user counts, partnerships or real-capital statements.
- Simulated-account disclosures stay on every page that describes accounts.
- The purchase-availability notice stays while the backend reports
  `paymentsEnabled: false`; `CheckoutHost` replaces it only when purchasing is
  enabled.
- Protocol research (liquidity pool, routing, liquidation optimisation, zero
  spread) is labelled as not active in this release.
- `A-Book` and `B-Book` are written exactly so in every locale.

## Retired content

| Content | Removal | Guard for stale Directus rows |
| :--- | :--- | :--- |
| Team section, team dialog, Team nav and footer links | Removed from markup, navigation, seeds and routes; `#team` and `?section=team` land on Challenges | `team-section` is not a valid footer destination; `renderNavigation` skips retired destinations |
| Office locations legal document (unverified addresses and a hosting note) | Removed from `legalContent.ts` | `RETIRED_LEGAL_DOCS` in `src/cms/client.ts` |
| Instagram promotion button | Removed from the community provider registry | Runtime setting kept for configuration compatibility; renders nothing |
| Desktop and mobile download badges, protocol proposal placeholder | Removed from the Challenges page | Not CMS-backed |
| Hosting provider footer credit | Removed | Not CMS-backed |

The production Directus project still holds rows for the retired footer link
and legal document until an approved cleanup runs. The guards above keep them
off the page in the meantime.

## SEO

- `src/features/loading/seoHead.ts` sets the canonical URL, `hreflang`
  alternates for all five locales (fa/en for the whitepaper), `x-default` and
  `og:locale`, and marks product routes `noindex`.
- `GET /sitemap.xml` and `GET /robots.txt` (`apps/backend/seo.js`) list the same
  public routes for the requesting domain. Each domain is self-canonical.
- Per-page titles and descriptions come from the page's CMS or seed record.

## Checks

| Command | Guards |
| :--- | :--- |
| `npm --prefix apps/web-react run test:content` | Forbidden public copy in all five locales, Team and Instagram removal, A-Book/B-Book labels, disclosures, direction, SEO route parity |
| `npm --prefix apps/web-react run check:product-rules` | Catalog, backend mirror and evaluation engine agreement; launch blockers |
| `npm --prefix apps/web-react run test:i18n` | Every public English source string has ar/ru/zh-CN translations |
| `node --test apps/backend/test/seo.test.mjs` | Sitemap, robots and host validation |

All four run in CI.
