# Rollback & Deployment Safety

## Deployment model

| Service | Trigger | Rollback unit |
| :--- | :--- | :--- |
| `openfund` (API + web) | after a stable release is published, the chained deploy job (production approval) deploys its exact commit; commit auto-deploy is `off` ([ADR 0013](../decisions/0013-release-driven-production-deployment.md)) | any earlier published release tag |
| `openfund-cms` (Directus) | manual only (`off`) | image tag pinned in `render.yaml` (11.17.4; previous 11.9.1) + snapshot/backup |
| `openfund-db` (Postgres) | migrations run in the API startCommand | idempotent, additive-first migrations |

## Rolling back the application

1. Dispatch **Deploy or roll back official release** on `main` with the
   last known-good tag and `rollback=true`. It deploys that release's exact
   commit and verifies the live manifest. Without `rollback=true` the workflow
   refuses any tag older than the latest release.
2. In an emergency, Render dashboard → `openfund` → **Deploys** → a previous
   live deploy → **Rollback** redeploys that commit. Run the workflow
   afterwards so the deployment record and identity checks match.
3. A forward fix ships as a new reviewed release; never move a published tag.
4. The frontend is rebuilt as part of the same service rollback — no separate
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

## Iran edge (Liara)

The Iran edge holds no state. Roll it back by dispatching **Deploy Iran edge
(Liara)** with an earlier edge commit, take it offline by stopping the Liara
app, and switch country routing off with its Cloudflare redirect rule. An
application rollback on Render applies to the edge automatically. See
[Iran edge on Liara](LIARA_IRAN.md#staging-deploy-verify-and-roll-back).

## Database rollback

1. Dashboard → `openfund-db` → **Backups** → restore (creates a new instance).
2. Repoint `DATABASE_URL` (API) and `DB_CONNECTION_STRING` (CMS) to the restored instance.
3. Run `npm run migrate --prefix apps/backend` once against it (idempotent).
4. For point-in-time content recovery, prefer Directus item-level Revisions
   over a database restore — it is surgical and always available.

## Failure playbook

| Symptom | First checks |
| :--- | :--- |
| `openfund` unhealthy (`/health` 503) | logs → `SELECT 1` failing means Postgres outage: dashboard → database status; the service recovers automatically when the DB returns |
| Deploys succeed but app blank | `VITE_DIRECTUS_HOST` present in the deploy env? CMS service up? (`/server/ping`) |
| SIWE login fails in prod (`invalid_domain`) | every serving hostname must be in `ALLOWED_DOMAINS` — see [Production domains](RENDER.md#production-domains) |
| Trading engine errors in logs | usually Gains feed gaps (logged, non-fatal); persistent failures → check market-data status line in logs |
| Directus 502 on first apply | database not ready yet — Render restarts automatically; verify `openfund-db` state |

## What we deliberately never automate

- Blueprint apply (new/changed infra) — manual, reviewed.
- CMS deploys — manual.
- Production database resets/replaces — manual, owner-approved only.
