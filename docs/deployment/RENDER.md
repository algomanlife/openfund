# Render Deployment — Architecture & Operations

Openfund deploys as **Infrastructure as Code** from this repository via a Render
Blueprint (`render.yaml`, root). First application is a reviewed manual operation. After provisioning, `openfund` uses the configured `autoDeployTrigger: commit`; CMS automatic deploy is off. CI validates this configuration and does not apply it.

## Service graph

```text
                        ┌──────────────────────────────┐
  browser ──────────────▶│ openfund (Node web service) │
                        │  • React app at /react/       │
                        │  • backend API (SIWE, demo    │
                        │    engine, SSE, portfolio)    │
                        │  • Gains market data (server) │
                        └───────┬──────────────┬───────┘
                     DATABASE_URL│              │ build-time
                                ▼              ▼ (https://cms-host)
                    ┌────────────────┐   ┌───────────────────┐
                    │ openfund-db    │   │ openfund-cms      │
                    │ Postgres 17    │◀──│ Directus 11.9.1   │
                    │ (managed)      │   │ (official image)  │
                    └────────────────┘   │ uploads on disk   │
                                         └───────────────────┘
```

| Resource | Render type | Why |
| :--- | :--- | :--- |
| `openfund-db` | Managed Postgres 17 (0.1c-256mb) | the single persistent store — application tables (users, sessions, challenges, trading engine, portfolio) AND Directus CMS tables. One database **on purpose**: Directus is the editing surface for catalog tables (`challenge_plans`), so splitting it would create a second source of truth. |
| `openfund-cms` | web service from the official `directus/directus:11.9.1` image | editorial content, challenge catalog editing, media. `KEY`/`SECRET` auto-generated; admin credentials prompted at first apply; uploads on a persistent 5GB disk. |
| `openfund` | Node web service | the whole product surface: builds the React app (`apps/web-react`), runs the backend (`apps/backend`), serves the app same-origin at `/react/` (HttpOnly session cookies stay first-party; hash routing needs no SPA fallback). |

### Deliberate non-services (documented decisions)

- **No separate frontend static site** — the app is served by the API service
  same-origin. This keeps cookie auth first-party (no cross-origin CORS+credentials
  surface) and preserves the current architecture. Splitting later (static site +
  `VITE_BACKEND_URL`) is a config-only change.
- **No separate worker/cron** — the demo engine loop, SSE fan-out and Gains
  market-data connections all run inside the API process (`engine.start(1000)`,
  `marketData.bootstrap()`). There is currently no queue, no scheduled job, and no
  state that a second instance must own. When evaluation automation arrives,
  move it to a Background Worker with a lock/lease (documented in ROLLBACK.md ops
  notes); the engine module boundaries already support it.
- **No Key Value / Redis** — nothing requires it today.
- **No custom Dockerfiles** — the Node services use Render's native Node runtime;
  Directus uses the official image. A repo `.dockerignore` exists for any future
  custom build contexts.

## First deployment (runbook)

1. **Prerequisites**: a Render account (workspace owner), this GitHub repository
   connected, and secrets ready to enter:
   - `openfund-cms` → `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PUBLIC_URL`
     (`https://<cms-host>`, the generated onrender.com host is fine)
   - `openfund` → `VITE_WALLETCONNECT_PROJECT_ID` (optional — full remote wallet
     list), `CORS_ORIGINS` (only if adding extra origins)
2. **New → Blueprint** in the Render dashboard, select this repo. Render parses
   `render.yaml` and prompts for the `sync: false` values above. Costs are shown
   before creation (three small paid resources: Postgres + 2 services).
3. Render provisions `openfund-db` first, then the two services
   (blueprint dependencies are inferred from the env references).
4. Watch the service logs:
   - `openfund` starts with `node migrate.js` (idempotent schema), then
     `server.js`; `/health` must return `{ok:true}`.
   - `openfund-cms` responds on `/server/health`.
5. **Initialize Directus** (once, from a machine with network access to the CMS):

   ```bash
   cd apps/backstage/scripts
   python3 apply_schema.py        --url https://<cms-host> --email … --password …
   python3 seed_content.py        --url …
   node seed_production_content.mjs --url … --email … --password …
   python3 seed_terminal_content.py --url …
   ```

   (Seeding is idempotent — re-running never overwrites editorial edits unless
   `--refresh` is passed.)
6. **Custom domain** (optional): point your verified custom hostname at the `openfund` service
   and set `ALLOWED_DOMAINS` is auto-derived from the service host — after adding
   a custom domain, add it to the service env (`ALLOWED_DOMAINS`) so SIWE domain
   validation accepts it.

## Day-2 operations

- **Deploys**: `openfund` has `autoDeployTrigger: commit` (deploys on merge to
  `main`). `openfund-cms` is `off` — deploy the CMS only deliberately
  (`Manual Deploy → Deploy latest commit`), since it is the data plane.
- **Authenticated blueprint validation** (CI does this when
  `RENDER_API_TOKEN` is set as a repo secret):
  `render blueprint validate ./render.yaml`
- **Offline structural validation**: `npm run validate:blueprint`
- **Logs**: Render dashboard → service → Logs. The backend logs SIWE failures,
  engine tick errors and market-data state without tokens or PII.
- **Scaling**: the API service is single-instance by design (in-memory engine
  state). Do not scale `openfund` horizontally without extracting the engine to
  a worker. Postgres plan can be upgraded in the dashboard (plan changes are
  live; region/name/user cannot change after creation).

## Restart & recovery behavior

- Engine state is persisted in Postgres (`trading_*` tables); a service restart
  reloads accounts/positions from the database on first use.
- Gains connections reconnect with exponential backoff (both browser and
  server side); stale marks are rejected by the engine.
- Directus restarts safely; uploads live on the persistent disk.
- SIGTERM → graceful shutdown (engine stop, market-data stop, pool end).

## Limitations of the current plan tier (documented, by design)

- `0.1c-256mb` Postgres: a small configured database plan; measure capacity and confirm current provider limits before evaluation traffic.
- Persistent disk (5GB) on `openfund-cms`: cannot downsize later; S3-compatible
  storage can replace it via `DIRECTUS_STORAGE_*` env vars without code changes.
- Resource plans and billing are defined by the Blueprint and current Render account. Check current provider limits before applying; the configured services use paid starter plans.

### Integration audit corrections (2026-11-02)

The three-resource graph is unchanged. All resources explicitly use Frankfurt;
internal DB connection strings require a shared region. Directus 11.9.1 needs
`DB_CLIENT=pg` plus `DB_CONNECTION_STRING`. Browser-facing CMS and SIWE values
reference `RENDER_EXTERNAL_HOSTNAME`, not Render's private `host` property. Web
builds explicitly include devDependencies. The API is pinned to one instance for
the existing engine/SSE loop. The validator now checks these relationships.
These are configuration repairs; this PR does not apply the Blueprint or modify
production resources. Existing service region changes must follow Render's
migration procedure if an already-provisioned service is in another region.

Sources: [Render Blueprint](https://render.com/docs/blueprint-spec),
[Directus database configuration](https://directus.com/docs/configuration/database),
[Directus 11.9.1 database source](https://github.com/directus/directus/blob/v11.9.1/api/src/database/index.ts).
