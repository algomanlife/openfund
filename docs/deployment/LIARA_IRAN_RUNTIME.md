# Iran regional runtime on Liara — deployment and operations

The Iran runtime is the **same Openfund release** as Render, running independently on Liara with its own database ([ADR 0032](../decisions/0032-iran-sovereign-regional-runtime.md), [ADR 0033](../decisions/0033-regional-authority-and-synchronization.md)). It is different from the Iran edge ([LIARA_IRAN.md](LIARA_IRAN.md)), which is a proxy to Render.

**Status:** configuration and tests only. Nothing has been provisioned or deployed. Every production step below needs explicit owner approval.

## Topology

| Unit | Liara resource | Roles / notes |
|---|---|---|
| Web + API + website | Docker app `openfund-iran-web` (staging `openfund-iran-staging`) | `OPENFUND_ROLES=http`, `MIGRATE_ON_START=1`. Serves `iran.openfund.cloud`, `iran.openfi.cloud`, `openfi.live`, and the signed peer endpoint `/sync/v1/*` |
| Worker | Docker app `openfund-iran-worker` | `OPENFUND_ROLES=engine,market-data,sync`. No public routes; `/health` and `/ready` only |
| CMS | Docker app `openfund-iran-cms` | Directus 11.17.4 image with a `directus-uploads` disk |
| Database | Liara PostgreSQL 17.x `openfund-iran-db` | Private network only. Claimed `IRAN` on first migration |
| Network | `openfund-iran-net` | Apps and the database. Apps reach each other by app id |

The desired state is in [`infra/liara-iran-runtime/stack.json`](../../infra/liara-iran-runtime/stack.json). The image is [`infra/liara-iran-runtime/Dockerfile`](../../infra/liara-iran-runtime/Dockerfile): one image for web and worker. It refuses to start without `OPENFUND_REGION=IRAN`.

## Environment

Plain values are in `stack.json`. Store the secrets listed below in the Liara app environment only. Never commit them.

| Name | Apps | Notes |
|---|---|---|
| `DATABASE_URL` | web, worker | Private connection string of `openfund-iran-db`. **Never the Render database:** the region fence refuses it anyway |
| `ADMIN_API_TOKEN` | web | Operator API, including `/admin/runtime` and `/admin/regional`. Use a value different from Render's |
| `ALLOWED_DOMAINS` | web | `iran.openfund.cloud,iran.openfi.cloud,openfi.live` (add the staging host on staging) |
| `CORS_ORIGINS` | web | `https://iran.openfund.cloud,https://iran.openfi.cloud,https://openfi.live` |
| `CMS_PUBLIC_URL` | web | Required in production by the runtime config. On the Iran runtime the browser reads content from the same-origin `/cms` path first, so this is only the direct fallback |
| `CMS_SNAPSHOT_ORIGIN` | web | Optional. Where `/cms` fetches published content server-to-server and snapshots it (default `CMS_PUBLIC_URL`). Recommended: the centrally edited GLOBAL Directus (`https://openfund-cms.onrender.com` or its custom domain), or the Iran Directus if content is edited there |
| `REGION_SYNC_KEYS` | web, worker (Iran) **and** Render `openfund` | JSON `{"<kid>":"<secret ≥32 chars>"}`. The same set on both sides. Rotate by adding a new kid, switching `REGION_SYNC_ACTIVE_KID` on both sides, then removing the old kid |
| `REGION_SYNC_ACTIVE_KID` | web, worker, Render | The key id this side signs with |
| `REGION_SYNC_PEER_URL` | Iran: the Render origin (`https://openfund.cloud`). Render: `https://iran.openfund.cloud` | The worker pushes here. Both sides use HTTPS in production |
| `DB_CONNECTION_STRING`, `KEY`, `SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PUBLIC_URL` | cms | As for Render's Directus |
| `LIARA_API_TOKEN` | GitHub environments `liara-iran-runtime-staging` / `liara-iran-runtime` | CI deploy only |

GitHub environment variables: `LIARA_RUNTIME_WEB_APP`, `LIARA_RUNTIME_WORKER_APP`, `LIARA_RUNTIME_PUBLIC_URL`.

On Render, sync stays off until `REGION_SYNC_*` are set **and** an operator enables it (`POST /admin/regional/sync/enable`). Render runs the `sync` role by default; the worker starts only when a peer URL is configured.

## Provision (staging first)

```bash
export LIARA_API_TOKEN=…            # from the owner's vault; never on the command line
node scripts/liara/provision.mjs --env staging          # plan
node scripts/liara/provision.mjs --env staging --apply  # create missing network, db, apps, disks
```

- The tool uses only Liara CLI 9.6.7 commands confirmed by `--help`.
- It never deletes, resizes or overwrites.
- It refuses to apply while any `plan` in `stack.json` is `null`: the owner chooses the Liara plans.
- Production needs `--confirm PROVISION-IRAN-PRODUCTION`.
- It prints the manual steps the CLI cannot perform:
  - secrets;
  - domains and SSL;
  - database backups;
  - disks on existing apps.

## Deploy

Dispatch **Deploy Iran regional runtime (Liara)** with an exact `main` commit, target `staging` and confirmation `DEPLOY-IRAN-RUNTIME`.

The workflow:

1. Builds the image and boots it as IRAN against a disposable PostgreSQL, with no route to Render.
2. Runs `scripts/liara/verify-runtime.mjs`.
3. After the environment's reviewers approve, deploys the worker, then the web app.
4. Verifies the live URL: the region must be `IRAN` (not proxied), the commit must match, and purchases must be refused.

Production needs the same commit's successful staging run id.

**Rollback:** dispatch again with the previous verified commit. Liara keeps the running release if a build fails. Schema changes are additive, so the previous release runs on the newer schema.

## First activation (owner-supervised)

1. Provision, deploy and smoke-test staging.
2. **Warm the content snapshot while connected.** Open every public page in every locale once on the Iran host. For example, run `TEST_FRONTEND_URL=https://<iran host> EXPECT_CONTENT=1 node e2e/test-iran-isolation.cjs` and the website navigation suites against it. Then check that `GET /cms/items/home_content?fields=*,translations.*` answers 200. An Iran Directus is optional; to use one instead, bootstrap it from the repository seeds (`apps/backstage/scripts/bootstrap-cms.sh`) and point `CMS_SNAPSHOT_ORIGIN` at it.
3. Set `REGION_SYNC_*` on both sides.
4. Enable sync on each side: `POST /admin/regional/sync/enable` with `{"confirm":"ENABLE-REGIONAL-SYNC","reason":"…"}`. Enabling performs the initial state transfer: it briefly locks the financial tables for the snapshot.
5. Watch `GET /admin/regional` until both outboxes drain.
6. Run `POST /admin/regional/reconcile`. It must complete with 0 mismatches.
7. Only then attach production domains (below). Country routing stays off until approved.

No existing account changes region in this process. Moving an account is a separate, explicit handoff ([ADR 0033 §2](../decisions/0033-regional-authority-and-synchronization.md#handoff-protocol)).

## Domains and TLS

| Domain | Records (exact targets come from the Liara console of `openfund-iran-web`) | Where |
|---|---|---|
| `iran.openfund.cloud` | CNAME to the Liara app target. TXT ownership. CNAME `_acme-challenge.iran` | Cloudflare `openfund.cloud`, **DNS-only (grey cloud)** |
| `iran.openfi.cloud` | as above | Cloudflare `openfi.cloud`, DNS-only |
| `openfi.live` | ALIAS/A for the apex, TXT ownership, `_acme-challenge` CNAME | Liara DNS (zone on Liara nameservers) |

- Do not change the nameservers of `openfund.cloud` or `openfi.cloud`.
- TLS is Let's Encrypt through DNS-01 on Liara. Renewal needs international connectivity, and a certificate lasts 90 days.
- During a long outage, cold DNS resolution of these names is **not guaranteed**: their TLD servers are outside Iran. See [ADR 0033 §6](../decisions/0033-regional-authority-and-synchronization.md#6-dns-and-tls).
- Moving `iran.openfund.cloud` from the edge app to `openfund-iran-web` is an owner action. The Persian notice on GLOBAL describes the edge, so update its copy at the same time. The IRAN runtime already hides it.

### Country routing (prepared, disabled)

Cloudflare, zone `openfund.cloud`. A Single Redirect rule that applies only to top-level document navigations:

- Expression: `(ip.src.country eq "IR" and http.request.method eq "GET" and any(http.request.headers["sec-fetch-dest"][*] eq "document") and not starts_with(http.request.uri.path, "/admin") and not starts_with(http.request.uri.path, "/sync/"))`
- Target: dynamic `concat("https://iran.openfund.cloud", http.request.uri.path)` with the query string kept, status 302.
- **Activate only with owner approval** and after the production smoke test. API, DePay and sync traffic is never redirected.

## Backups and restore

- Liara PostgreSQL has daily automatic backups plus a manual backup in the console. Downloading a backup and restoring it are console actions; they are not automated here.
- Before production, run one drill:
  1. Take a manual backup.
  2. Restore it into a staging database.
  3. Run `migrate.js` with `OPENFUND_REGION=IRAN`. The claim must already be `IRAN`.
  4. Boot staging on it and run `verify-runtime.mjs`.
  5. Run `POST /admin/regional/reconcile`.
- A restored database is behind its peer. After a restore:
  - local events newer than the backup are lost;
  - the peer may still hold events for it.

  Put the region in `RECOVERY` and reconcile before reopening. Treat every discrepancy as a manual review.

## Operations

| Task | Endpoint (admin token + `X-Admin-Actor`) |
|---|---|
| Dashboard | `GET /admin/regional` (region, mode, release, engine/market-data, sync queues, peer, ownership, discrepancies, reviews) |
| Readiness | `GET /ready` (public): database and region; market-data status for information only |
| Mode | `GET/POST /admin/runtime[/mode]` (ADR 0032) |
| Reconcile | `POST /admin/regional/reconcile`, then `GET /admin/regional/reconciliation/:id` |
| Discrepancies | `GET /admin/regional/discrepancies`, `POST …/:id/acknowledge` |
| Dead letters | `POST /admin/regional/outbox/:eventId/retry` |
| Account handoff | `POST /admin/regional/accounts/:id/release` (owner), `…/accept` (target), `…/cancel-release`, `…/unquarantine` |

Persian operator guide: [IRAN_RUNTIME_MODES.fa.md](../operations/IRAN_RUNTIME_MODES.fa.md).
