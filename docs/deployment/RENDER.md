> Release policy update: use the [unified release runbook](RELEASES.md). The API service now disables commit auto-deploy and verifies a published release tag before building. Earlier setup examples below describe the original foundation and must not bypass the approved release workflow.

> v0.4.1 stabilization (unpublished): configure `CMS_PUBLIC_URL` on the existing
> `openfund` service as the public HTTPS CMS origin (prefer
> `https://cms.openfi.cloud`). The service serves it through
> `/react/runtime-config.js`; the release bundle no longer embeds it. Render's
> source checkout need not have a Git remote named `origin`: the build verifies
> the tag and release through GitHub before rebuilding and comparing hashes.
> Do not run production CMS bootstrap as part of a routine API deploy. First
> verify a database backup and schema delta, then run the documented
> [single bootstrap procedure](../backstage/README.md) through an approved
> administrative environment. Existing content is kept unless `--refresh` is
> explicitly requested. Confirm `ui_messages` public translations and draft
> isolation afterward. The older setup details below are historical.

# Render Deployment — Architecture & Operations

Openfund deploys as **Infrastructure as Code** from this repository via a Render
Blueprint (`render.yaml`, root). Applying the Blueprint is a reviewed manual operation. Both `openfund` and `openfund-cms` have automatic deploys disabled. CI validates this configuration but does not apply it.

## Service graph

```text
                        ┌──────────────────────────────┐
  browser ──────────────▶│ openfund (Node web service) │
                        │  • React app at /             │
                        │  • backend API (SIWE, demo    │
                        │    engine, SSE, portfolio)    │
                        │  • Gains market data (server) │
                        └───────┬──────────────┬───────┘
                     DATABASE_URL│              │ build-time
                                ▼              ▼ (https://cms-host)
                    ┌────────────────┐   ┌───────────────────┐
                    │ openfund-db    │   │ openfund-cms      │
                    │ Postgres 17    │◀──│ Directus 11.17.4  │
                    │ (managed)      │   │ (official image)  │
                    └────────────────┘   │ uploads on disk   │
                                         └───────────────────┘
```

| Resource | Render type | Why |
| :--- | :--- | :--- |
| `openfund-db` | Managed Postgres 17 (0.1c-256mb) | the single persistent store — application tables (users, sessions, challenges, trading engine, portfolio) AND Directus CMS tables. One database **on purpose**: Directus is the editing surface for catalog tables (`challenge_plans`), so splitting it would create a second source of truth. |
| `openfund-cms` | web service from the official `directus/directus:11.17.4` image | editorial content, challenge catalog editing, media. `KEY`/`SECRET` auto-generated; admin credentials prompted at first apply; uploads on a persistent 5GB disk. |
| `openfund` | Node web service | the whole product surface: builds the React app (`apps/web-react`), runs the backend (`apps/backend`), serves the app same-origin from the site root with a browser-history SPA fallback (HttpOnly session cookies stay first-party; `/react/` permanently redirects to `/`). |

### Deliberate non-services (documented decisions)

- **No separate frontend static site** — the app is served by the API service
  same-origin. This keeps cookie auth first-party (no cross-origin CORS+credentials
  surface) and preserves the current architecture. Splitting later (static site +
  `VITE_BACKEND_URL`) is a config-only change.
- **No separate worker/cron** — the demo engine loop, SSE fan-out and Gains
  market-data connections all run inside the API process (`engine.start(1000)`,
  `marketData.bootstrap()`). The process opens at most 13 database connections
  (API pool 10, engine-loop pool 3; [ADR 0027](../decisions/0027-trading-stream-fan-out-and-engine-loop-isolation.md)).
  Stream scopes and the engine loop are process-local, so `numInstances` must
  stay 1 until the coordination in the
  [capacity optimization report](../reviews/capacity-2026-11-13/REPORT.md#horizontal-scaling-proposal) exists. There is currently no queue, no scheduled job, and no
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
   - `openfund-cms` responds on `/server/ping` (public liveness; `/server/health` needs an access token on Directus 12).
5. **Initialize Directus** (once, from a machine with network access to the CMS):

   ```bash
   cd apps/backstage/scripts
   ./bootstrap-cms.sh https://<cms-host> <admin-email> '<admin-password>'
   ```

   One repeatable, idempotent command. It runs the full sequence in
   dependency order: `apply_schema.py` → `seed_content.py` →
   `seed_production_content.mjs` → `seed_terminal_content.py` →
   `register_user_tables.py` (Data Studio views with financial fields
   read-only). Re-running never overwrites editorial edits unless
   `--refresh` is passed as the fourth argument. Recovery from a
   half-completed bootstrap: re-run the same command (each step is
   independently idempotent).
6. **Set the operational admin token** (recommended before opening
   withdrawals): set `ADMIN_API_TOKEN` on the `openfund` service to a long
   random secret — this enables the `/admin/*` operational API (user
   directory, challenge directory, withdrawal review; constant-time bearer
   auth, fully disabled while unset).
7. **Custom domain** (optional): add the verified hostname to the `openfund`
   service, then add it to the Blueprint's `ALLOWED_DOMAINS` list
   (comma-separated) so SIWE domain validation accepts it. Validate the
   Blueprint before syncing it. See [Production domains](#production-domains).

## Production domains

One `openfund` service serves every public hostname. No second application
or environment exists for a domain.

| Hostname | Role | Observed (2026-11-08; `/version` re-checked 2026-11-10) |
| --- | --- | --- |
| `openfi.cloud` | Existing production domain | Cloudflare-proxied, Google Trust Services certificate, `/version` matched v0.4.1 on 2026-11-08; matched v0.4.4 (`c1cb707`) on 2026-11-10 |
| `openfund.cloud` | Second production domain; `RELEASE_PUBLIC_URL` for deploy verification | Same service; `/version` matched v0.4.4 (`c1cb707`) on 2026-11-10 |
| `www.openfi.cloud`, `www.openfund.cloud` | Redirect-only | `301` to the matching root domain, path preserved |
| `openfund-our6.onrender.com` | Render default host | Same service |
| `cms.openfi.cloud` | Directus (`openfund-cms`) | Separate CMS service |

Neither root domain redirects to the other; both stay canonical for their own
visitors. HTTP redirects to HTTPS and responses carry HSTS.

**Sessions and origins.** The session cookie is host-only (`HttpOnly`,
`Secure`, `SameSite=Lax`, no `Domain` attribute). Each domain therefore keeps
its own browser session against the same accounts database; cookies are never
shared across the two root domains. The frontend calls the API on the same
origin, so no `CORS_ORIGINS` entry is needed for either domain, and the
mutation-origin check accepts same-origin requests. Live trading updates use
Server-Sent Events (`/trading/stream`), not WebSockets.

**Required setting.** Wallet sign-in (SIWE) compares the message domain with
`ALLOWED_DOMAINS`. A 2026-11-11 production probe reproduced `POST /auth/verify`
returning `400 invalid_domain` for both `openfi.cloud` and `openfund.cloud`;
the effective Render value contained only `openfund-our6.onrender.com`. The
Blueprint now declares the complete list on the `openfund` service:

```
ALLOWED_DOMAINS=openfund-our6.onrender.com,openfi.cloud,openfund.cloud
```

The Blueprint validator fails if either public host is removed or if the
variable is changed back to `fromService`. The source fix alone does not
change the running service: deploy only after approval, then inspect the
effective value and repeat the HTTPS SIWE and real-wallet acceptance tests.

**Verification checklist** (both root domains): DNS resolves through
Cloudflare; the certificate covers the root and `www`; `http://` → `https://`;
`www` → root with the path kept; `/health` returns `{"ok":true}`; `/version`
reports `matched` with the released commit; `/react/` loads; a SIWE probe no
longer returns `invalid_domain`; a real wallet sign-in succeeds on each domain.
Cloudflare SSL mode must stay Full (strict) so Cloudflare-to-Render traffic is
encrypted and no redirect loop occurs.

## Day-2 operations

- **Deploys**: Both services have `autoDeployTrigger: off`. Publishing a
  stable release through **Unified release** chains the `openfund` deploy:
  after production approval it deploys the release's exact commit and verifies
  the live manifest ([ADR 0013](../decisions/0013-release-driven-production-deployment.md)). Deploy `openfund-cms` only after the backup and schema review for
  its own image or migration.
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
