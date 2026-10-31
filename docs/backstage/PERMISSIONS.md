# Permissions

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
