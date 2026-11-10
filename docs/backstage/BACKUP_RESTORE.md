# Directus backup and restore

Directus keeps **everything that matters in the shared PostgreSQL database** (schema metadata, permissions, content, translations, file records) plus **uploaded media on the `directus-uploads` disk**. Both must be captured together; a database backup without the matching media (or the reverse) is an inconsistent backup.

This guide was exercised on a throw-away PostgreSQL 17 cluster with `pg_dump -Fc` and `pg_restore` (see [staging evidence](../reviews/directus-12-staging/README.md)). It has **not** been run against production: no production credentials or backups were provided.

## What to capture

| Item | Where | How |
| :--- | :--- | :--- |
| Database | Render Postgres `openfund-db` (shared by the app and Directus) | Render managed backup or snapshot **and** a logical dump |
| Media | Render disk `directus-uploads` mounted at `/directus/uploads` | Copy the disk contents (disk snapshot, or `tar` over a shell on the service) |
| Schema snapshot | Directus API | `GET /schema/snapshot` as an admin, saved to a private location |
| Version facts | the running service | image tag and digest, `GET /server/info` as admin, `SELECT version FROM directus_migrations ORDER BY timestamp DESC LIMIT 1` |
| Environment | Render dashboard | Names and non-secret values only; `KEY` and `SECRET` must be kept in the secret manager. Losing `SECRET` invalidates sessions, losing `KEY` can invalidate stored encrypted values |

Never commit dumps, snapshots or keys. Dumps contain user wallet addresses, orders and payment records because the app tables share the database.

## Logical backup

Use a dedicated read-only role and a connection string supplied through the environment, never on the command line history:

```bash
export PGCONNECT_TIMEOUT=15
pg_dump --format=custom --no-owner --file=openfund-pre-directus-upgrade.dump "$OPENFUND_DB_URL"
shasum -a 256 openfund-pre-directus-upgrade.dump > openfund-pre-directus-upgrade.dump.sha256
```

Record the size, the checksum and the row counts of the Directus tables you care about. The `inventory` command in [`cms-check.mjs`](../../apps/backstage/upgrade/cms-check.mjs) records collections, fields, relations, permissions, item counts and file count without secrets:

```bash
DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... \
  node apps/backstage/upgrade/cms-check.mjs inventory --url https://<cms-host> --out inventory-before.json
```

## Restore into a new database (rehearsal and recovery)

Always restore into a **new, empty** database first. Never restore over the live database as a rehearsal.

```bash
createdb openfund_restore_test
pg_restore --no-owner --dbname=openfund_restore_test openfund-pre-directus-upgrade.dump
```

Point a staging Directus of the **same version as the backup** at it, copy the media into its uploads directory, start it and run:

```bash
DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... \
  node apps/backstage/upgrade/cms-check.mjs verify --url http://127.0.0.1:8055 --baseline inventory-before.json
```

A restore is accepted only when every check passes. Starting a **newer** Directus on a restored copy is the upgrade rehearsal; migrations run forward only.

## Rollback limits

- Directus migrations are **forward only**. After a newer Directus has migrated a database, an older Directus must not be started against it. Rolling back the CMS means restoring the pre-upgrade database dump **and** the matching media.
- Restoring the dump also restores the application tables that share the database. Anything written by the Openfund backend between the backup and the restore (orders, purchases, journal entries, governance records) is **lost**. For that reason the production migration is performed in a maintenance window with the backend writes paused or the window kept short, and the backup is taken immediately before.
- Prefer item-level recovery for editorial mistakes: Directus **Revisions** can restore individual items without any database restore.
- Media added after the backup is not in the dump. Keep the pre-upgrade disk snapshot until the new version is accepted.

## Restore drill record

| Date | Environment | Result |
| :--- | :--- | :--- |
| 2026-11-10 | Local PostgreSQL 17.11, seeded Directus 11.9.1 | `pg_dump -Fc` then `pg_restore` into a new database; Directus 12.6.1 was started against the restored copy and the baseline comparison found no lost collection, field, relation, item count, file or permission row |
| Production | not performed | requires owner approval and credentials |

[Migration runbook](../deployment/DIRECTUS_MIGRATION_RUNBOOK.md) · [Assessment](DIRECTUS_12_ASSESSMENT.md) · [Database](../deployment/DATABASE.md) · [Rollback and recovery](../deployment/ROLLBACK.md)
