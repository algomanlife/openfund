# Launch parity runbook — owner actions

Ordered actions that only the owner can perform to take the launch-completion
release **v0.6.5** live. Each step says what to set or click, how
to check it, and what it unblocks. Agents prepared and verified everything
they are allowed to; no step here was executed against production by an
agent, and no production secret was created, requested or seen.

Evidence: [launch parity checklist](LAUNCH_PARITY_CHECKLIST.md),
[CMS rehearsal](../reviews/launch-completion/CMS_REHEARSAL.md),
[release notes](../releases/openfund-0.6.5.md),
[security acceptance](../reviews/release-0.6.5/SECURITY_ACCEPTANCE.md),
[load report](../reviews/release-0.6.5/LOAD_REPORT.md).

## Progress (verified 2026-11-18)

Current state comes from [status](../status/README.md). Steps proven by live
evidence are marked done; the rest are not verified, so they are not claimed.

| Step | State | Evidence |
| :--- | :--- | :--- |
| 1. Review and merge | Done | v0.6.5 merged (#132, #133) |
| 5–6. Release configuration and publication | Done | [v0.6.5](https://github.com/algomanlife/openfund/releases/tag/v0.6.5), commit `a87804a` |
| 7–8. Approve and deploy (Web/API) | Done | `https://openfi.cloud/version`: v0.6.5 `a87804a`, official |
| 7–8. Backstage at the release commit | Not done | Backstage serves unreleased `cd057fa` (auto-deploy); the next release deploys both at one commit |
| 12. DePay and payment configuration | Done | `/purchases/plans`: `paymentsEnabled: true`, seven DePay chains |
| 13. Owner purchase test (real, low value) | **Open** | No genuine production purchase recorded |
| 2–4, 9–11, 14–15 | Not verified here | Owner-side settings without public evidence |

## 1. Review and merge

Review the pull request from `agent/claude/launch-completion`, confirm the
required checks are green, and merge it into `main` (human approval; an AI
review does not count). Everything below assumes the merged `main`.

## 2. Render environment

Set these in the Render dashboard (Blueprint `sync: false` values are never in
Git). Read secrets from your secret manager; never paste them into chat,
tickets or shell history.

### `openfund` (API + website)

| Variable | Value |
| :--- | :--- |
| `NODE_VERSION` | `26` (already in `render.yaml`; confirm Blueprint sync applied it) |
| `ALLOWED_DOMAINS` | `openfund-our6.onrender.com,openfi.cloud,openfund.cloud,iran.openfund.cloud` (every serving host; SIWE compares the exact browser host) |
| `CMS_PUBLIC_URL` | The public CMS origin, e.g. `https://cms.openfi.cloud` (HTTPS, no path). Also makes the site frameable by that origin for visual editing |
| `CSP_EXTRA_FRAME_ANCESTORS` | `https://backstage.openfi.cloud` (Backstage Content preview) |
| `ADMIN_API_TOKEN` | Secret, at least 24 characters; the same value as `BACKSTAGE_BACKEND_TOKEN` |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional public id from cloud.reown.com; list every serving origin in that project (step 11) |
| `PURCHASE_PAYMENT_RECEIVER`, `PURCHASE_PAYMENT_CHAINS` or `PURCHASE_PAYMENT_CHAIN`, `PURCHASE_PAYMENT_TOKEN`, `PURCHASE_PAYMENT_DECIMALS`, `PURCHASE_RPC_URL` / `PURCHASE_RPC_URLS`, `PURCHASE_ROUTER_ADDRESSES`, `PURCHASE_PAYMENT_MIN_CONFIRMATIONS` | Payment connectivity is the owner's responsibility ([ENVIRONMENT.md](ENVIRONMENT.md)). Purchases stay off while the receiver is unset |

### `openfund-cms` (Directus)

| Variable | Value |
| :--- | :--- |
| `CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC` | `'self' https://openfi.cloud https://openfund.cloud https://openfund-our6.onrender.com` |

### `openfund-backstage`

| Variable | Value |
| :--- | :--- |
| `BACKSTAGE_ORIGIN` | `https://backstage.openfi.cloud` |
| `BACKSTAGE_BACKEND_ORIGIN` | The `openfund` service HTTPS origin, e.g. `https://openfi.cloud` |
| `BACKSTAGE_DIRECTUS_ORIGIN` | The CMS HTTPS origin |
| `BACKSTAGE_OWNER` | Your owner identity (2–50 characters of `A-Za-z0-9._@-`) |
| `BACKSTAGE_PASSWORD_VERIFIER` | Output of `node apps/backstage/operations/provision.js` with your password typed on standard input (the password itself is never stored) |
| `BACKSTAGE_BACKEND_TOKEN` | The same secret as `ADMIN_API_TOKEN` |
| `BACKSTAGE_DIRECTUS_TOKEN` | Optional; from step 4. Unset keeps the Content workspace read-only |
| `BACKSTAGE_REAL_SETTLEMENT` | Leave `false` until step 10 |

## 3. CMS upgrade and content application

Production CMS is the `openfund-cms` Render service. The repository pins
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
   migrations on start. Check: `GET <cms>/server/ping` returns `pong` and
   `GET <cms>/server/health` returns `{"status":"ok"}`.
3. **Visual-editor CSP.** Confirm `CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC`
   from step 2 is set and redeploy. In Directus *Settings → Visual Editor
   URLs*, add `https://openfi.cloud/fa/` and `https://openfi.cloud/en/` (and
   the other origins if used).
4. **Schema and seeds.** From a trusted machine with the repository at the
   release tag, Node 26, Python 3 and `npm ci --prefix apps/web-react`:

   ```bash
   DIRECTUS_URL=<cms origin> DIRECTUS_ADMIN_EMAIL=<admin> DIRECTUS_ADMIN_PASSWORD=<from your secret manager> \
     bash apps/backstage/scripts/bootstrap-cms.sh
   DIRECTUS_URL=<cms origin> DIRECTUS_ADMIN_EMAIL=<admin> DIRECTUS_ADMIN_PASSWORD=<from your secret manager> \
     python3 apps/backstage/scripts/seed_interface_content.py
   ```

   Both are idempotent and never overwrite editor values; the interface seed
   creates new rows as drafts only.
5. **Gate.** Run the read-only publication gate:

   ```bash
   CMS_PUBLIC_URL=<cms https origin> node scripts/release/check-public-cms.mjs
   ```

   It must print `Production CMS public bilingual health, UI and Home reads passed.`
   Rollback: restore the dump and media from sub-step 1 and set the image
   back to the previous tag ([rollback limits](../backstage/BACKUP_RESTORE.md#rollback-limits)).

## 4. Backstage content editing (optional)

1. Create the editorial-only role (idempotent; grants only editorial
   collections, no deletes):

   ```bash
   DIRECTUS_URL=<cms origin> DIRECTUS_ADMIN_EMAIL=<admin> DIRECTUS_ADMIN_PASSWORD=<from your secret manager> \
     python3 apps/backstage/scripts/register_backstage_editor.py
   ```

2. In Directus Studio, create a user (for example `backstage-content@<your domain>`)
   with role **Backstage Content Editor**, generate its static token, and
   store that token as `BACKSTAGE_DIRECTUS_TOKEN` on `openfund-backstage`.

## 5. GitHub release configuration

Repository → *Settings* → *Environments* → `production` (owner-only):

- Required reviewers: at least one human owner (the deploy script refuses
  otherwise).
- Variables: `RELEASE_PUBLIC_URL` (e.g. `https://openfi.cloud`),
  `RELEASE_CMS_URL` (CMS origin), `RENDER_SERVICE_ID` (the `openfund`
  service id), and `RELEASE_SIWE_DOMAINS` =
  `openfi.cloud,openfund.cloud,openfund-our6.onrender.com` (the post-deploy
  SIWE gate signs in on each).
- Secret: `RENDER_API_TOKEN`.
- Repository variable `RELEASE_DIRECTUS_URL` = the CMS HTTPS origin (the
  publication gate reads it).

## 6. Publish the release

After the release PR is merged, dispatch **Unified release** on `main` with
the owner-approved version:

```bash
gh workflow run release.yml --repo algomanlife/openfund --ref main -f publish=true -f release_version=0.6.5
```

The allocator places this batch in the 0.6.x line (latest official v0.5.0 plus
`feat:` commits); `requestedVersion()` accepts 0.6.5 inside that new line.
The workflow runs the package, secret, CMS bootstrap and live CMS gates, then
creates the annotated tag `v0.6.5` at the exact `main` commit and a
non-draft, non-prerelease GitHub Release with `openfund-v0.6.5.tar.gz`,
`SHA256SUMS`, `release-manifest.json` (`official: true`), `verification.json`
and `release-status.md`, and builds `ghcr.io/algomanlife/openfund:0.6.5`.
A failed gate publishes nothing. Check:

```bash
gh release view v0.6.5 --repo algomanlife/openfund --json isDraft,isPrerelease,tagName,assets
git ls-remote https://github.com/algomanlife/openfund refs/tags/v0.6.5
```

## 7. Approve production

The publish run calls *Deploy or roll back official release*, which waits on
the `production` environment. Before approving, check:

- [ ] The release is the latest, not a draft or prerelease.
- [ ] Its `release-manifest.json` has `official: true` and
      `verification.status: "passed"`.
- [ ] Render auto-deploy is off for `openfund`.
- [ ] Step 3 (CMS) is complete and the database backup from step 3.1 exists.

Approve in *Actions* → the waiting run → *Review deployments*.

## 8. Deploy and automatic verification

The workflow deploys the release's exact `commitId` to Render, waits for
`live`, then requires `/version` and `/react/release-manifest.json` to match
the release, CMS health, and the live SIWE gate on every
`RELEASE_SIWE_DOMAINS` host (a forged domain must be rejected). Download
`deployment-status` from the run; it must say `"status": "deployed"`.

**Alternative (dashboard):** deploy the tagged commit from Render →
`openfund` → *Manual Deploy → Deploy a specific commit* (the `v0.6.5` tag
commit). `render-build.mjs` finds the official tag, verifies the published
manifest digest and identity, and rebuilds the same payload. Untagged `main`
commits also build again (the 250-commit compare limit that failed the
earlier dashboard deploy is fixed), but they run as unofficial candidates.

## 9. Manual post-deploy check

From a checkout of the release tag with `npm ci --prefix apps/backend`
(the SIWE gate uses the backend's `viem`):

```bash
gh release download v0.6.5 --repo algomanlife/openfund --pattern 'openfund-v0.6.5.tar.gz' --dir /tmp/of-check
mkdir -p /tmp/of-check/payload && tar -xzf /tmp/of-check/openfund-v0.6.5.tar.gz -C /tmp/of-check/payload
RELEASE_CMS_URL=<cms origin> RELEASE_SIWE_DOMAINS=openfi.cloud,openfund.cloud \
  node scripts/release/verify.mjs /tmp/of-check/payload --live https://openfi.cloud
```

Then sign in to Backstage, open *System status* (version and commit), and
open the Inbox on the website with a wallet.

## 10. Enable real settlement recording (after security acceptance)

Only after you accept the [security acceptance](../reviews/release-0.6.5/SECURITY_ACCEPTANCE.md) of payout settlement: set
`BACKSTAGE_REAL_SETTLEMENT=true` on `openfund-backstage` and redeploy it.
This only allows Backstage to *record* a verified on-chain transfer you have
already made; no funds move from Backstage.

## 11. Publish content and optional wallet connectivity

- Publish the reviewed fa/en drafts you want live, from the Backstage
  Content workspace or Directus. Keep ar/ru/zh-CN drafts unpublished until a
  native reviewer approves them; the site keeps its reviewed dictionary
  fallback meanwhile.
- Set `VITE_WALLETCONNECT_PROJECT_ID` on `openfund` if you want mobile
  wallets, then redeploy the same release.

## 12. DePay and payment configuration checklist

Full steps: [owner setup](../payments/OWNER_SETUP.md). The widget is vendored
and served same-origin, so no CSP change is needed by default.

- [ ] `PURCHASE_PAYMENT_CHAINS` (receiver and token per chain),
      `PURCHASE_RPC_URLS`, optional `PURCHASE_ROUTER_ADDRESSES` (DePay router per
      chain); `PURCHASE_PAYMENT_DECIMALS` removed when using the chain list.
- [ ] `DEPAY_VERIFY_PUBLIC_KEY` (DePay's public key from the integration),
      `DEPAY_CONFIG_PRIVATE_KEY` (your key; its public half is stored at DePay).
- [ ] `VITE_DEPAY_INTEGRATION_ID` set; `VITE_DEPAY_WIDGET` unset or `1`;
      `VITE_DEPAY_WIDGET_URL`, `VITE_DEPAY_WIDGET_INTEGRITY`,
      `CSP_EXTRA_SCRIPT_SRC`, `CSP_EXTRA_FRAME_SRC` **not** set.
- [ ] app.depay.com integration: dynamic configuration
      `https://openfi.cloud/purchases/depay/configuration`, callback
      `https://openfi.cloud/purchases/depay/callback`, events
      `https://openfi.cloud/purchases/depay/events` (the
      `/api/payments/depay/{config,callback,events}` aliases also work),
      **Include sent token information** on, domains restricted to the
      serving domains.

Then run the read-only probe (no money, no signatures):

```bash
node scripts/release/purchase-readiness.mjs https://openfi.cloud
```

Every line must be `PASS` (WalletConnect is reported but optional). Each
`FAIL` names the missing variable.

## 13. Owner purchase test (real, low value)

1. Create a temporary coupon in Backstage → *Coupons* so the net price is
   about 1–2 USD (or use the cheapest plan). Activate it.
2. **DePay:** sign in on `https://openfi.cloud/en/checkout`, choose the plan,
   apply the coupon, *Pay with DePay*, pay once. Expect the receipt, a new
   challenge, and a *purchase paid* notification in the Inbox.
3. **Manual EVM:** new order → *Pay manually* → send the exact amount of the
   listed token **from your sign-in wallet** to the listed receiver on the
   listed chain → submit the transaction hash. The order shows
   *Verification Pending* until finality (12 blocks by default), then paid.
4. **Manual Solana:** same, with the **order id as SPL Memo** and the
   transaction signature submitted.
5. Record order ids, transaction ids, `payments.route`, invoice numbers and
   challenge ids in [ACTIVATION.md](../payments/ACTIVATION.md). Revoke the
   coupon.

## 14. Backup and rollback drill

Before the release goes live, prove the production backup restores, using
a read-only source URL and a new local scratch database:

```bash
node scripts/ops/backup-drill.mjs --source "$PROD_READONLY_DATABASE_URL" \
  --scratch postgres://localhost:5432/openfund_restore_drill_$(date +%Y%m%d) --out ./drill
```

`ok: true` means the schema and every table's row count match. Keep the
dump and its SHA-256 as the pre-deploy backup. Rollback of the application:
*Deploy or roll back official release* with `version=v0.5.0` and
`rollback=true` ([ROLLBACK.md](ROLLBACK.md)); the 0.6.5 migration is
additive, so the previous release runs on the migrated database.

## 15. Monitoring

`GET /admin/operations/metrics` (admin token) returns engine-loop lag,
market-feed staleness, failure counters and active alert names. Suggested
log-based alerts on Render (match the service log):

| Alert | Log match | Meaning |
| --- | --- | --- |
| Audit writes failing | `[obs] {"event":"audit_insert_failure"` | Audit rows are not being stored |
| Payment recovery failing | `[obs] {"event":"payment_recovery_failure"` | A paid order may not be provisioning |
| Payments disabled | `[payments] readiness: paymentsEnabled=false` | Settlement configuration incomplete |
| Engine stalled | metrics `alerts` contains `engine_loop_lag` | Risk checks are late (see the load report) |
