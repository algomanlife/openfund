# Permissions

## v0.4.1 public-read correction

The public v0.4.0 CMS returned 403 for the frontend's `ui_messages`
translation query on 2026-11-07. A disposable Directus 11.9.1 database showed
that direct reads of draft translation rows were also possible when translation
table permissions were unfiltered. The v0.4.1 schema script now ensures the
parent alias, grants it to the existing public read policy where needed, and
narrows public read on all translation tables to published parents. In the
disposable test, the published parent and its two translations remained
readable, while a draft translation probe became invisible. Production policy
has not yet been migrated or rechecked. Apply only after backup/schema review.

The historical section below describes the older intended permission model;
the public production policy is not yet verified against this correction.

## Whitepaper collections

`apply_schema.py` grants the public policy read access to published
`whitepaper_documents`, `whitepaper_chapters`, `whitepaper_datasets` and
`whitepaper_references`, and to their translation rows only when the parent is
published. Writing remains administrator-only. Production has not yet been
migrated with these collections.

## Current state (operational now)

| Role / policy | Access |
| :--- | :--- |
| **Administrator** (local admin) | full Data Studio access — schema, content, users, settings |
| **Public policy** | read-only on published content: `ui_messages`, `navigation_items`, `pages`, `site_settings` (+ translation tables, filtered `status = published`) |

Security rules enforced today:

- **No tokens in the frontend.** The React app uses the unauthenticated public
  read endpoint only. Admin tokens exist only in local scripts / server-side.
- **Drafts are private.** The public policy carries a `status = published`
  condition on every content collection.
- Local credentials live in `infrastructure/directus/.env` (gitignored);
  `.env.example` documents the keys.

## Planned (not yet active — no fake access until the backend exists)

| Role | Scope | Blocked on |
| :--- | :--- | :--- |
| Content Manager | landing + terminal content, media | media library wiring |
| Translator | fa/en translation values only | field-level permissions rollout |
| Publisher | draft → publish / unpublish | workflow review step |
| Support | approved user records | Openfund backend (Phase 6+) |
| Risk Manager | evaluation/risk records | Openfund backend |
| Finance | withdrawal records | Openfund backend |

Business records (challenge accounts, evaluation progress, payouts) will be
**administered** through Directus but **authored** by the future Openfund
backend — Directus never independently calculates prop-evaluation results, and
sensitive state changes will require authenticated, audited backend services.
No unrestricted direct editing of financial/trading records.
