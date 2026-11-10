# Directus production migration runbook and rollback checklist

**This runbook has not been executed.** It applies to a future, owner-approved upgrade of the production `openfund-cms` service. Do not start it until every item under "Preconditions" is checked. The current blocker is the Directus 12 licence decision in the [assessment](../backstage/DIRECTUS_12_ASSESSMENT.md).

Target values used below (re-verify on the day): Directus **12.6.1**, image `docker.io/directus/directus:12.6.1`, index digest `sha256:e1561b5e526e8e7a2ac19b7bb6eab63611dd84a862a8c45b864118768a2baff4`. Current: **11.9.1**, `sha256:3692e622c824d5f83b97547361b25d9f9ea2a30792c37520deb6af2733dfd66f`.

## Preconditions

- [ ] Owner decision recorded: licence or Open Innovation Grant obtained (option A) and the key stored in the Render secret store as `LICENSE_KEY`. `PUBLIC_URL` is an absolute `https://` URL, because licence activation rejects relative values.
- [ ] Staging rehearsal with the **real licence** passed `cms-check.mjs verify --baseline` with zero failures, using a restored copy of a recent production backup, with the **container image** (not only the npm package).
- [ ] Production version confirmed by an admin: image tag and digest from the Render dashboard, `GET /server/info`, last row of `directus_migrations`.
- [ ] Review of `directus_policies.ip_access`: every entry is an address, `a-b` range or numeric CIDR (12.5.0 rejects malformed values and fails every request for that policy).
- [ ] Studio users counted (seat limit) and registered collections counted (limit) against the licence.
- [ ] Egress to `telemetry.directus.com` permitted.
- [ ] Window announced; editors told to stop editing; backend traffic expectations agreed (see rollback limits in [backup and restore](../backstage/BACKUP_RESTORE.md)).
- [ ] The upgrade change set is merged on a reviewed branch: image tag (or digest), `release.yml` probes changed from `/server/health` to `/server/ping`, `infrastructure/directus/compose.yaml` updated, documentation version references updated.

## Backup (immediately before)

1. [ ] `pg_dump --format=custom` of `openfund-db`, checksum recorded, copy stored off Render.
2. [ ] Render managed snapshot taken; disk snapshot of `directus-uploads` taken.
3. [ ] `cms-check.mjs inventory` saved as `inventory-before.json`; `GET /schema/snapshot` saved.
4. [ ] Restore of this exact dump into a scratch database verified (see [backup and restore](../backstage/BACKUP_RESTORE.md)).

## Migration

1. [ ] Keep `autoDeployTrigger: off`. Change the image in `render.yaml` and apply it through the normal reviewed Blueprint sync; do not edit the live service by hand.
2. [ ] Watch the deploy logs. The container runs `bootstrap` (which applies migrations) then the server. Expect `Applying ...` lines and `Done`. Any migration error: stop and go to Rollback.
3. [ ] `GET /server/ping` returns `pong`. `GET /server/health` without a token returns 403 on 12 (expected).
4. [ ] Admin login works. `GET /license` shows status `active` (or `grace` while a key is being applied) and **usage within limits**.
5. [ ] Run, from a trusted machine with credentials in the environment:

   ```bash
   node apps/backstage/upgrade/cms-check.mjs inventory --url https://<cms-host> --out inventory-after.json
   node apps/backstage/upgrade/cms-check.mjs verify --url https://<cms-host> --baseline inventory-before.json
   ```

   `verify` creates and deletes one temporary draft row and one temporary file. It never edits existing rows.
6. [ ] Do **not** re-run `bootstrap-cms.sh --refresh`. Re-running without `--refresh` is idempotent and only adds missing records; `apply_schema.py` now aborts if the instance is not licensed for the content model.
7. [ ] Check the website: Home, challenge catalog (plans), Whitepaper, Economy, Governance, FAQ and legal pages in Persian and English, and the Persian RTL layout, against the public site served by the new CMS.
8. [ ] Editors' acceptance: edit and publish one test change, upload one image, confirm a draft stays invisible, then revert the test change through Revisions.

## Acceptance criteria

All must hold: zero failed checks in `verify`; item counts, collections, fields, relations and permission rows not below the baseline; public reads return only published or active rows; drafts not readable anonymously; private application tables return 403 anonymously; the Render health check is green on `/server/ping`; no new error pattern in the Openfund backend logs; editors accepted.

## Rollback

Decide quickly and early; every minute after the migration widens the data-loss window for application writes.

| Trigger | Action |
| :--- | :--- |
| Migration fails or the service never becomes healthy | Redeploy the previous image tag, then restore the database dump into the production database **only if** migrations had partially run (Directus 11 cannot start on a partly migrated 12 schema) |
| `verify` fails, public site broken, licence locked | Same as above. If the only failure is the licence state, applying a valid key is faster than a rollback |
| Editorial regression found later | Use Directus Revisions for items; do not roll back the platform |

Rollback steps:

1. [ ] Announce and pause editing. Stop the CMS service.
2. [ ] Restore the pre-upgrade dump into the database (Render restore or `pg_restore`) and the pre-upgrade uploads snapshot. The application tables roll back with it; export any application writes made since the backup first if they must be re-applied.
3. [ ] Redeploy the previous image tag and digest.
4. [ ] Re-run `verify --baseline inventory-before.json` and the website checks.
5. [ ] Write the incident note: trigger, time, data written between backup and restore.

## Post-upgrade

- [ ] Update the upstream dependency registry (`docs/integrations/UPSTREAM_DEPENDENCIES.md`, added by the upstream-isolation change): installed version, last upgrade date, compatibility result, evidence links.
- [ ] Update the version references listed in the [assessment](../backstage/DIRECTUS_12_ASSESSMENT.md): README, Blueprint comment, architecture and deployment pages, `compose.yaml`, `release.yml`.
- [ ] Review Studio-only changes: Tiptap rich-text prompts, new AI settings (leave AI disabled), `directus_settings` read scope for any non-admin App Access policy (12.2.0 note).
- [ ] Keep the pre-upgrade dump and disk snapshot for the retention period agreed with the owner.

[Assessment](../backstage/DIRECTUS_12_ASSESSMENT.md) · [Backup and restore](../backstage/BACKUP_RESTORE.md) · [Rollback](ROLLBACK.md) · [Render runbook](RENDER.md) · [Releases](RELEASES.md)
