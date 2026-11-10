# Database — Architecture, Migrations, Backup & Restore

## Single managed database (deliberate)

`openfund-db` (Render Postgres 17) holds **both** domains in one database:

- **Application tables** (owned by the backend, `apps/backend/schema.sql`):
  `openfund_users`, `auth_nonces`, `auth_sessions`, `challenge_plans`,
  `openfund_challenges`, `demo_accounts`, `trading_orders`, `trading_positions`,
  `trading_events`, `trading_ledger`, `trade_notes`, `audit_log`
- **Governance tables** (`gov_*`, also in `apps/backend/schema.sql`, additive and
  idempotent): terms, seats, memberships, eligibility, roles, proposals,
  revisions, history, comments, voting sessions, votes, conflicts, decisions,
  amendments, implementation log, elections and a hash-chained audit log.
  They reference only `openfund_users` and each other, evidence tables are
  append-only by trigger, and Directus has no permission on them. See
  [governance documentation](../governance/README.md).
- **Directus CMS tables** (`directus_*`, `ui_messages`, `pages`,
  `navigation_items`, `home_content`, `faqs`, `trading_rules`,
  `legal_documents`, `footer_links`, `site_settings`, …)

**Why not two databases?** Directus is the *editing surface* for application
catalog data (notably `challenge_plans` — the commercial catalog of record that
the trading backend also reads). One physical database keeps that a true single
source of truth with no synchronization layer. Logical separation is enforced
by naming and ownership, not by physical isolation. The Directus *public* role
only reads published content collections; all user/trading tables remain
private to the backend service account.

## Migrations

- Version control: `apps/backend/schema.sql` + `migrate.js` (idempotent
  `CREATE TABLE IF NOT EXISTS` / `ALTER` steps; safe to run repeatedly — CI runs
  it twice per build to prove idempotency).
- Deployment flow: `npm run migrate --prefix apps/backend` runs as part of the
  Render `startCommand` **before** the server boots.
- Catalog seed: `seed-plans.js` (idempotent upsert of the challenge catalog).
- CMS schema + content: `apps/backstage/scripts/*` (idempotent; never overwrite
  editorial edits unless `--refresh`).
- Rule: new schema changes MUST go through `schema.sql`/`migrate.js` — never
  hand-ALTER a live database, and never hide migrations inside a frontend build.

## Connection handling

- `pg.Pool` with the Render internal `DATABASE_URL`; pool size defaults
  (suitable at the current scale).
- Health: `GET /health` executes `SELECT 1` (Render health check path).
- Graceful shutdown: `SIGTERM` → engine stop → market-data stop →
  `server.close()` → `pool.end()`.
- Upgrading the Postgres plan is a dashboard operation (live). Region,
  database name and user are immutable after creation.

## Backups

- Render Managed Postgres performs **automatic daily backups** (retention
  depends on plan; verify in the dashboard).
- Manual logical backup (from any machine with the external connection string —
  dashboard → Connect → External URL):

  ```bash
  pg_dump "$EXTERNAL_DATABASE_URL" -Fc -f openfund-$(date +%F).dump
  ```

- Never commit dumps to Git.

## Restore

- Preferred: Render dashboard → database → Backups → restore snapshot
  (creates a new instance; repoint API `DATABASE_URL` and CMS `DB_CONNECTION_STRING` in the blueprint services).
- Logical restore into a fresh database:

  ```bash
  createdb "$RESTORE_URL"
  pg_restore -d "$RESTORE_URL" --no-owner --role=openfund_app openfund-YYYY-MM-DD.dump
  ```

- After restore, run `npm run migrate --prefix apps/backend` (idempotent) and
  the backstage seeders (safe) to align schema/published content.

## Environment isolation

- Production = the blueprint's `openfund-db`.
- CI = an ephemeral `postgres:17` service container (migrations + full test
  suite run against it every PR).
- Local dev = your own Postgres (`infrastructure/directus/compose.yaml` or a
  native install).
- Staging: not provisioned by this blueprint (no paid infra without owner
  approval). To add it, duplicate the blueprint with different names and a
  separate database, and keep staging data isolated from production.

## Least privilege

The blueprint creates one application user (`openfund_app`) used by both the
backend and Directus. Tightening further (separate `directus_app` role with
restricted ownership of `directus_*` only) is a documented future hardening
step — it requires `migrate.js` ownership changes and is not needed at the
current trust boundary.
