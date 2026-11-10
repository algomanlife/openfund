# Directus upgrade tooling

Version-controlled, Openfund-owned helpers for rehearsing and verifying a Directus upgrade. Nothing here changes Directus itself.

| File | Purpose |
| :--- | :--- |
| `cms-check.mjs` | `inventory` writes a secret-free snapshot of collections, fields, relations, roles, policies, permissions, item counts and file count. `verify` asserts the Openfund contract (public vs draft, private tables denied, challenge catalog, Whitepaper, Governance, translations, admin, editing cycle, file upload, optional baseline comparison). Exit code 1 on any failure. |
| `staging.sh` | Builds an isolated PostgreSQL cluster, seeds an old Directus with the real bootstrap, takes a backup, restores it into a new database, starts the new Directus and runs the checks. Does not need Docker. |
| `docker-compose.staging.yml` | Same rehearsal with the production **image**. Not executed by the authors (no Docker available); run it before production. |

Credentials are read only from `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` (or `DIRECTUS_ADMIN_TOKEN`). The tool deletes the temporary draft row and file it creates and never edits existing rows. Point it at production only for read-mostly verification during an approved window.

See [Directus 12 assessment](../../../docs/backstage/DIRECTUS_12_ASSESSMENT.md) and the [migration runbook](../../../docs/deployment/DIRECTUS_MIGRATION_RUNBOOK.md).
