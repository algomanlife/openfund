# Directus 12 staging evidence

Produced 2026-11-10 on one macOS machine with an isolated PostgreSQL 17.11 cluster (port 5555), throw-away credentials and local upload folders. Directus ran from the exact npm packages `directus@11.9.1` (Node 22.23.4) and `directus@12.6.1` (Node 26.13.0), **not** from the container image: Docker was not installed. No production system was written to.

Seed: application migrations (`apps/backend`), Directus bootstrap, then `apps/backstage/scripts/bootstrap-cms.sh` unchanged; afterwards one FAQ was unpublished and one file uploaded to simulate editorial work. The seeded database was dumped with `pg_dump -Fc` and restored into new databases for each upgrade run.

| File | Directus | Scenario | Result |
| :--- | :--- | :--- | :--- |
| [verify-11.9.1-baseline.json](verify-11.9.1-baseline.json) | 11.9.1 | seeded baseline | 98 of 98 checks pass |
| [verify-12.6.1-clean-install-locked.json](verify-12.6.1-clean-install-locked.json) | 12.6.1 | restored backup, migration timestamps unchanged (treated as a clean install, no grace) | 41 of 76 pass; licence `locked`, Core tier, 43 of 25 collections; admin item reads return `RESOURCE_RESTRICTED` |
| [verify-12.6.1-upgrade-grace.json](verify-12.6.1-upgrade-grace.json) | 12.6.1 | restored backup with migration timestamps moved back 90 days (existing installation) | 51 of 83 pass; licence `grace` (2,592,000 s); data preserved; status-filtered public reads return 403 |

Reproduce with `apps/backstage/upgrade/staging.sh` (see [assessment](../../backstage/DIRECTUS_12_ASSESSMENT.md)). The reports contain check names, outcomes and HTTP statuses only, with no credentials or personal data.

Not covered: the container image, a real licence key, production data volume, Render disk behaviour, and the Persian RTL website rendering against the upgraded CMS (the frontend contract was exercised through the same public API calls the site makes, not through a browser).
