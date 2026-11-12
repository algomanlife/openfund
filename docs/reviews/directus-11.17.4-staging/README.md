# Directus 11.17.4 staging evidence

Produced 2026-11-12 with `apps/backstage/upgrade/staging.sh` on one macOS machine: an isolated PostgreSQL 17.11 cluster (port 5556), throw-away credentials, local upload folders, and the exact npm packages `directus@11.9.1` and `directus@11.17.4` on Node 22.23.4. Docker was not available, so the container image itself was not run. No production system was read or written.

Seed: application migrations, Directus bootstrap and `apps/backstage/scripts/bootstrap-cms.sh` unchanged. The seeded 11.9.1 database was dumped with `pg_dump -Fc`, restored into a new database and upgraded to 11.17.4.

| File | Directus | Scenario | Result |
| :--- | :--- | :--- | :--- |
| [verify-11.9.1-baseline.json](verify-11.9.1-baseline.json) | 11.9.1 | seeded baseline | 98 of 98 checks pass |
| [verify-11.17.4-upgrade.json](verify-11.17.4-upgrade.json) | 11.17.4 | restored backup, 11.17.4 migrations | 103 of 104 checks pass |

The single failing check is the baseline comparison of permission rows. The only changed row is Directus's own built-in "read own user" permission (no Openfund policy), which 11.17.4 extends with the `provider` field. Collections (122), relations (139), roles (3), policies (3) and every item count are identical before and after. All Openfund public, draft, private-table, translation, catalog, Whitepaper, Governance, editing and upload checks pass.

Not covered here: a rehearsal on a restored copy of the **production** database and the container image. Both are required before deployment ([ADR 0020](../../decisions/0020-directus-upgrade-policy.md)).
