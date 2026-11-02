# Rollback & Deployment Safety

## Deployment model

| Service | Trigger | Rollback unit |
| :--- | :--- | :--- |
| `openfund` (API + web) | auto on merge to `main` (`autoDeployTrigger: commit`) | any previous commit — Render keeps deploy history |
| `openfund-cms` (Directus) | manual only (`off`) | image tag pinned in `render.yaml` (11.9.1) + snapshot/backup |
| `openfund-db` (Postgres) | migrations run in the API startCommand | idempotent, additive-first migrations |

## Rolling back the application

1. Render dashboard → `openfund` service → **Deploys** → pick the last known-good
   deploy → **Rollback** (Render redeploys that exact commit).
2. Or from Git: revert the offending commit on `main` — the revert itself
   triggers a fresh deploy. Prefer the dashboard rollback when time matters.
3. The frontend is rebuilt as part of the same service rollback — no separate
   rollback exists or is needed.

## Rollback safety properties (by design)

- **Migrations are additive-first**: `schema.sql` uses `IF NOT EXISTS` and never
  drops data. A code rollback against a newer schema is safe because new tables
  are simply unused. Breaking column changes require a documented two-phase
  rollout (add column → migrate data → remove old) — follow that convention.
- **Engine state lives in Postgres**, not in memory or the container disk: a
  rollback/restart reloads accounts, positions and ledger from the database.
- **SIGTERM handling**: Render drains connections before replacing the process;
  the backend stops the engine loop, market-data feeds, HTTP server and the pg
  pool in order.
- **Browser resilience**: the frontend reconnects the Gains WebSocket with
  backoff and re-fetches CMS content on the next load; SSE streams reattach.
- **CMS (data plane) is manual-only**: app deploys can never touch the content
  service; content edits are versioned in Directus revisions with one-click
  item-level rollback.

## Database rollback

1. Dashboard → `openfund-db` → **Backups** → restore (creates a new instance).
2. Repoint `DATABASE_URL` (both services) to the restored instance.
3. Run `npm run migrate --prefix apps/backend` once against it (idempotent).
4. For point-in-time content recovery, prefer Directus item-level Revisions
   over a database restore — it is surgical and always available.

## Failure playbook

| Symptom | First checks |
| :--- | :--- |
| `openfund` unhealthy (`/health` 503) | logs → `SELECT 1` failing means Postgres outage: dashboard → database status; the service recovers automatically when the DB returns |
| Deploys succeed but app blank | `VITE_DIRECTUS_HOST` present in the deploy env? CMS service up? (`/server/health`) |
| SIWE login fails in prod | `ALLOWED_DOMAINS` follows the service host — after adding a custom domain, add it to the env var |
| Trading engine errors in logs | usually Gains feed gaps (logged, non-fatal); persistent failures → check market-data status line in logs |
| Directus 502 on first apply | database not ready yet — Render restarts automatically; verify `openfund-db` state |

## What we deliberately never automate

- Blueprint apply (new/changed infra) — manual, reviewed.
- CMS deploys — manual.
- Production database resets/replaces — manual, owner-approved only.
