# Openfund CMS — Administrator Guide

Directus at **http://localhost:8055** (admin login from `infrastructure/directus/.env` /
local dev default `admin@openfund.dev`). Everything below is editable **without touching
source code** — changes appear on the website on the next page load (no rebuild, no deploy).

## Golden rules

1. **Two languages, one record.** Every content item has a `fa` and an `en` translation
   row — edit both. A record with a missing translation is skipped by the website
   (incomplete content is never shown as final).
2. **Status = publication.** `draft` is invisible to the public, `published` is live,
   `archived` disappears. Directus keeps the full editing history (revisions) for rollback.
3. **Prices and plan terms are commercial records.** `challenge_plans` is the SAME table
   the trading backend reads — edit carefully (see *Pricing* below).
4. Market prices and instruments come from Gains Network, never from the CMS.

## Where things live

| What you want to edit | Collection |
| :--- | :--- |
| Home headline / product texts / CTAs / SEO | `home_content` (singleton, fa+en) |
| Home illustrations | `home_content` → `prop_image` / `perpetual_image` (Directus Files) |
| Any landing string (hero, sections, buttons, footer text) | `ui_messages` (search the Persian text) |
| Challenge programs: prices, targets, loss limits, splits | `challenge_plans` → `configuration` (JSON) |
| FAQ items (add / edit / reorder) | `faqs` |
| Rulebook sections (edit / add / reorder / publish) | `trading_rules` |
| Legal disclosures & disclaimers | `legal_documents` |
| Footer links | `footer_links` |
| Navigation labels / visibility | `navigation_items` (location `public_header`) |
| Page SEO titles & descriptions | `pages` |

## Common tasks

- **Edit homepage content** — open `home_content`, edit the fa and en translation rows,
  save. Reload the site. (CTA destinations are chosen from a fixed list — challenges or
  terminal.)
- **Change an image** — upload the file under File Library (SVG/PNG/WebP), then select it
  in `home_content`. If the field is empty the bundled illustration is used.
- **Edit challenge descriptions / FAQs** — `faqs`: edit or create rows (question + answer
  per language), set `sort` for order, `status: published` to go live.
- **Update approved pricing** — `challenge_plans` → the plan's `configuration` JSON:
  `priceUsd` (per size), `phase1TargetPct`/`phase2TargetPct`, `dailyLossPct`,
  `maxTotalLossPct`, `drawdownMode` (`static`/`trailing`), `profitSplitPct`, etc.
  The website validates the record before showing it — an invalid plan disappears
  (by design) rather than rendering wrong numbers. Changing `status` to `inactive`
  removes the program from the public site.
- **Update trading rules** — `trading_rules`: each row is a section (`section_key` is the
  anchor). Paragraphs are a list; tables are JSON `{caption, columns[], rows[][]}` per
  language; `review_status` drives the Current/Draft/Planned pill. Reorder with `sort`.
- **Edit footer links** — `footer_links`: label per language; `destination` must be one of
  the whitelisted values (arbitrary URLs are never rendered).
- **Edit disclaimers** — `legal_documents` (version + effective date supported).
- **Publish changes** — set `status: published`. Unpublish with `draft`/`archived`.
- **Review content history** — open any item in Directus; the sidebar shows **Revisions**
  with a one-click rollback.

## Publication workflow

`draft → published → archived` on every content collection. Draft content is filtered out
by the public API permissions, so it can never leak to the website. Scheduled publishing
and approval roles can be enabled later with Directus flows/policies — the data model is
ready.

## Safety

- The public website only has **read** access, and only to `published`/`active` records of
  the content collections. Private tables (users, challenges, sessions) are 403 to the
  public — verified by automated probes.
- The CMS can never write trading balances, sessions or risk state — those live in the
  backend engine, which owns its own tables.
- Link destinations are validated against a fixed whitelist in the frontend; the CMS
  cannot inject arbitrary URLs or HTML.
