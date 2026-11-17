# Launch parity runbook — owner actions

Ordered actions that only the owner can perform to take the launch-completion
release live. Each step names what to set or click, how to verify it, and what
blocks the next step. Agents prepared and verified everything they are allowed
to; nothing here was executed against production by an agent.

Evidence for the agent-verified parts: [launch parity checklist](LAUNCH_PARITY_CHECKLIST.md),
[CMS rehearsal](../reviews/launch-completion/CMS_REHEARSAL.md).

## CMS upgrade and content application

Production CMS is the `openfund-cms` Render service. The repository already pins
`docker.io/directus/directus:11.17.4` in `render.yaml`; these steps apply that
pin and the content to the live service.

1. **Backup (database and media together).** Follow
   [Directus backup and restore](../backstage/BACKUP_RESTORE.md#logical-backup):
   take a Render snapshot of `openfund-db`, a logical dump
   (`pg_dump --format=custom --no-owner --file=openfund-pre-directus-upgrade.dump "$OPENFUND_DB_URL"`),
   and a copy of the `directus-uploads` disk. Record the dump's SHA-256.
   Do not continue without all three.
2. **Image.** In Render, `openfund-cms` → *Settings* → *Image URL*:
   `docker.io/directus/directus:11.17.4`. Deploy. Directus runs its own
   migrations on start. Verify: `GET <cms>/server/ping` returns `pong` and
   `GET <cms>/server/health` returns `{"status":"ok"}`.
3. **Visual-editor CSP.** `openfund-cms` → *Environment*, set
   `CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC` to
   `'self' https://openfi.cloud https://openfund.cloud https://openfund-our6.onrender.com`
   (add any other origin editors will open). Save and redeploy. Then, in
   Directus *Settings → Visual Editor URLs*, add `https://openfi.cloud/fa/`
   and `https://openfi.cloud/en/` (and the other origins if used).
4. **Schema and seeds.** From a trusted machine with the repository at the
   release tag, Node 26, Python 3 and `npm ci --prefix apps/web-react`:

   ```bash
   DIRECTUS_URL=<cms origin> DIRECTUS_ADMIN_EMAIL=<admin> DIRECTUS_ADMIN_PASSWORD=<secret from your manager> \
     bash apps/backstage/scripts/bootstrap-cms.sh
   DIRECTUS_URL=<cms origin> DIRECTUS_ADMIN_EMAIL=<admin> DIRECTUS_ADMIN_PASSWORD=<secret from your manager> \
     python3 apps/backstage/scripts/seed_interface_content.py
   ```

   Both are idempotent and never overwrite editor values; the interface seed
   creates new rows as drafts only. Read the credentials from your secret
   manager into the environment; never pass them as arguments in shell history.
5. **Selective publish.** In Directus, review and publish only the reviewed
   drafts you want live (fa/en). Leave ar/ru/zh-CN drafts unpublished until a
   native reviewer approves them; the site keeps its reviewed dictionary
   fallback meanwhile.
6. **Gate.** Run the publication gate against production (read-only):

   ```bash
   CMS_PUBLIC_URL=<cms https origin> node scripts/release/check-public-cms.mjs
   ```

   It must print `Production CMS public bilingual health, UI and Home reads passed.`
   Then open the Studio visual editor on `https://openfi.cloud/en/`, click a
   text, and confirm the *Value* popover opens. Rollback: restore the dump and
   media from step 1 and set the image back to the previous tag
   ([rollback limits](../backstage/BACKUP_RESTORE.md#rollback-limits)).
