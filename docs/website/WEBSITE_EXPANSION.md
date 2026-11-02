# Website expansion specification — FAQ, Growth Partner, Tools Center, Learning Center

Implementation record for the four public sections added on 2026-11-02
(branch `qwen/website-expansion`). The [audit](../research/WEBSITE_EXPANSION_AUDIT.md)
documents what was reused and why. Persian is the default locale (`fa`), English
mirrors every string, and all pages render through the shared
`InformationShell`/`Chrome` so no second visual system exists.

## Routes

| Route | Page |
| :--- | :--- |
| `/:locale/faq` | FAQ hub: search, category sidebar with counts, accordions, expand/collapse all |
| `/:locale/faq/q/:key` | One question opened and scrolled to (shareable deep link) |
| `/:locale/tools` | Tools index (grouped: sizing / risk / analysis) |
| `/:locale/tools/:slug` | Calculator page (10 tools, one renderer) |
| `/:locale/learn` | Learning Center landing (5 path cards) |
| `/:locale/learn/paths/:slug` | Path detail with ordered lesson list |
| `/:locale/learn/lessons/:slug` | Lesson: TOC from h2 blocks, reading progress, prev/next, takeaways, related terms/tools |
| `/:locale/learn/glossary` (+ `/:slug`) | Glossary search, letter index, expandable definitions |
| `/:locale/referral` | Growth Partner page with the session-scoped dashboard |
| `/:locale/ref/:code` | Referral entry: attaches `of_ref` (30-day cookie) and routes to the gateway |

The header navigation groups FAQ / Tools / Learn / Growth Partner under one
"Resources" dropdown (landing `.nav-account` pattern, flat inside the mobile
menu). Footer links and the CMS navigation/footer whitelists cover the same
destinations. Language switching preserves the destination because the toggle
only rewrites the `/:locale/` prefix.

## Content architecture

- Repo seeds are the source of record: `src/cms/seed/faqSiteContent.ts` (6
  categories, 43 questions), `src/cms/seed/learning/path{A..E}.ts` (5 paths ×
  5 lessons), `glossary.ts` (40 terms), `toolsCopy.ts` (10 tool prose entries),
  `referralContent.ts`.
- `src/cms/contentTypes.ts` is the single typed contract (bilingual fields,
  locale-neutral ASCII math, paired-list invariants).
- Directus collections (additive, idempotent in `apply_schema.py`):
  `faq_categories`, `faqs` + slug/category/links/page `faq`, `learning_paths`,
  `lessons` (m2o path, `blocks` JSON per locale), `glossary_terms`, `tools`
  (prose only), `referral_content` singleton with a `program_state`
  (prelaunch/live) switch. Public policy reads published rows only.
- `seed_website_content.mjs` upserts by natural key; `--refresh` overwrites
  editorial edits intentionally.
- The app renders CMS content when available and otherwise falls back to the
  bundled seeds, showing a visible "bundled copy" pill (FAQ toolbar) — an
  unavailable content service is never mistaken for live editorial content.

The calculators' input fields, result keys and formulas are code-owned
(`src/data/toolCatalog.ts`, `calculators.ts`) because they are unit-tested;
Directus only rewords the prose around them.

## Tools Center

Ten tools, deterministic and browser-side, never connected to orders, wallets
or uploads: position size, leverage/margin, liquidation estimate, perpetual
PnL (numeric break-even solve), funding, risk/reward, risk of ruin (diffusion
approximation with documented assumptions), prop drawdown (published plan
terms, static and trailing with the Instant breakeven lock), consistency rule,
and a CSV journal analyzer (RFC-4180 parser, Persian/Arabic-Indic digits,
derived PnL, skipped-row reporting; the file never leaves the device).
Validation errors are locale-neutral codes localized in
`features/tools/messages.ts`.

## Growth Partner and referral attribution

The program is pre-launch. The public page states that attribution works today
and that reward terms (rate, qualifying event, window, settlement, caps, the
written agreement) are undecided; the dashboard separates live columns from
pending ones and the copy contains no percentage or amount presented as an
offer.

Backend contract (`apps/backend/referrals.js`, tables in `schema.sql`):

- `referral_codes` — one code per wallet identity, unambiguous alphabet,
  issued lazily by `GET /referral/summary` (session-scoped).
- `referral_attributions` — written once, at account creation, from the
  `of_ref` cookie; `UNIQUE(referred_user_id)` prevents re-attribution, a
  `CHECK` plus the owner lookup prevents self-referral, later sign-ins can
  never re-attribute. Attribution failures never break sign-in.
- `GET /referral/summary` returns the code, the attributed list (masked
  addresses) and the caller's own attribution. There are no commission,
  reward-balance or payout fields, and the payload carries
  `programState: 'prelaunch'`.

## Tests

- `apps/web-react/test/website-expansion.test.mjs` (node --test): 47 tests —
  all ten calculators (normal, boundary, invalid, zero/negative, long/short,
  fee and funding treatment, precision), CSV edge cases, search
  normalization, content integrity (categories, unique keys, resolvable
  cross-references, paired locales, no invented reward figures), selectors.
- `apps/backend/test/referral.test.mjs`: 18 tests — code issuance,
  one-time attribution, re-sign-in idempotence, self-referral, unknown codes,
  session scoping. Wired into `test:all`; `test:website` wired into
  `test:web` and CI.
- Verified locally: `npm run typecheck`, `npm run test:web` (64 tests),
  `npm run test:all` (183 checks, isolated database instance),
  `npm run validate:blueprint`, `npm run docs:check`.

## Limitations

- Reward terms, qualifying events and settlement for the Growth Partner
  program are business decisions that remain open; nothing in the code
  implies them.
- Challenge figures used by the drawdown and consistency tools are the
  published terms of record; activation, funded accounts and payouts are not
  enabled in this release, and the live demo account does not enforce them.
- Risk-of-ruin is a statistical estimate under stated assumptions (independent
  trades, constant edge, fixed-fraction sizing) — never a guarantee.
- Liquidation prices are approximations; the venue decides the real value.
- Lesson glossary cross-references were pruned to the 40 published terms
  during integrity testing; extending the glossary would restore more links.
