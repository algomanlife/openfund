# Openfund Backstage — Directus CMS

## v0.4.1 bootstrap procedure

Install the frontend lockfile with Node 22 (`npm ci --include=dev --prefix
apps/web-react`). On a **new** Directus database, first verify a backup and
schema state, then provide `DIRECTUS_URL`, `DIRECTUS_ADMIN_EMAIL` and
`DIRECTUS_ADMIN_PASSWORD` through the process environment/secret manager and
run `apps/backstage/scripts/bootstrap-cms.sh`. Do not put passwords in command
arguments or commit them. The command applies schema/public permissions, then
editorial, catalog, website expansion and terminal seeds, and finally
registers backend-owned tables. Re-running without `--refresh` preserves
existing editorial rows; `--refresh` is an explicit overwrite and must not be
used as a routine production deploy step. The CMS image alone does not run
these repository scripts automatically. Routine API deployments do not seed
Directus. Validate public published reads and both languages after bootstrap.

The procedure was exercised against a disposable fresh Directus 11.9.1 and
PostgreSQL 17 database on 2026-11-07. This exposed an empty Home singleton
that returned default status without a saved record; the seed now checks its
ID. After that correction, Home fa/en rows were publicly readable and the
final rerun created or updated no content. A draft translation probe was
hidden after the permission correction. Production migration and full content
coverage remain unverified; do not infer them from this local test.

**Directus is the official centralized backstage, headless CMS and administrative
interface of Openfund.** All editable user-facing text of the landing page and
the trading terminal (Persian + English) is managed in the Directus Data Studio.

- Local Data Studio: **http://localhost:8055** (admin login via `infrastructure/directus/.env`)
- Public content API: unauthenticated read of **published** items only
- The React app fetches translations in one request and falls back to the
  bundled static files whenever the backstage is unreachable

## Where things live

| Piece | Location |
| :--- | :--- |
| Deployment (Docker + Postgres) | `infrastructure/directus/compose.yaml` |
| Local (no-Docker) environment | `infrastructure/directus/.env` (gitignored) |
| Schema initialization (idempotent) | `apps/backstage/scripts/apply_schema.py` |
| Content seeding (idempotent) | `apps/backstage/scripts/seed_content.py` |
| Terminal i18n extraction | `apps/backstage/scripts/terminal-i18n.json` (generated) |
| CMS client (typed) | `packages/cms-client/` → bundled at `apps/web-react/src/cms/client.ts` |
| React wiring | `apps/web-react/src/pages/{Landing,Terminal}.tsx` + `legacy/locale.js` + `legacy/terminal.js` bridges |

## Quick start (local, no Docker)

1. PostgreSQL 17 running (`brew services start postgresql@17`), DB `openfund_cms` created.
2. `infrastructure/directus/.env` — local-only credentials + `CORS_ENABLED=true`.
3. Start Directus (Node 22 required):

   ```bash
   cd infrastructure/directus
   PATH=/opt/homebrew/opt/node@22/bin:$PATH \
     ~/openfund-backstage/node_modules/.bin/directus start
   ```

4. `python3 apps/backstage/scripts/apply_schema.py` — collections, relations, public permissions.
5. `python3 apps/backstage/scripts/seed_content.py` — imports the CURRENT fa/en content (298 landing strings + 186 terminal labels + navigation + pages + settings).
6. `node apps/backstage/scripts/seed_website_content.mjs` — FAQ hub, Learning Center, tool prose and the Growth Partner singleton (`--refresh` overwrites edits).
6. React app (`cd apps/web-react && npm run dev`) → http://localhost:5173/
7. Open http://localhost:8055, edit any `ui_messages` value, **refresh the React page** — the change appears.

## Docs

- [Website expansion spec](../website/WEBSITE_EXPANSION.md) — FAQ, Learning Center, tools and referral collections
- [Content model](CONTENT_MODEL.md) — collections, fields, translation pattern
- [Local setup](LOCAL_SETUP.md) — prerequisites, exact commands, troubleshooting
- [Translations](TRANSLATIONS.md) — how fa/en flows from Directus into the pages
- [Permissions](PERMISSIONS.md) — roles, public policy, security rules

## Editing content (the point of all this)

Open **ui_messages** in the Data Studio:

- each row = one user-facing string; **label** = friendly name, **section** = the page area
- edit the **fa** and **en** translation values — both languages render live after a page refresh
- landing keys ARE the Persian source text (do not rename `key`); terminal keys are stable ids
- drafts never render — set status back to `published` when done

## Status (2026-11-01)

- ✅ Directus 11.9.1 + PostgreSQL 17 (local, brew — Docker compose provided)
- ✅ Schema + public read-only permissions
- ✅ Seeded: 484 ui_messages (298 landing + 186 terminal), 10 navigation items, 2 pages (SEO), site settings
- ✅ React pages read published content; live edit verified end-to-end (edit in Data Studio → refresh → visible)
- ✅ Silent fallback when the backstage is down (static translations; page stays fully usable)
- 🔜 Media management, navigation-driven rendering, page-builder blocks, editorial roles (Translator/Publisher) — see the roadmap in [PERMISSIONS.md](PERMISSIONS.md)
