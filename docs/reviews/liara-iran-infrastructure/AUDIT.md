# Liara Iran infrastructure audit and remediation

- **Date:** 2026-11-17
- **Branch:** `agent/claude/liara-iran-runtime-fixes` (based on `main` `a87804a`)
- **Decision:** [ADR 0042](../../decisions/0042-liara-infrastructure-source-of-truth.md)
- **Source of truth after this change:** [`infra/liara-iran-runtime/stack.json`](../../../infra/liara-iran-runtime/stack.json), checked by `npm run infra:check` (static, in CI) and `npm run infra:check -- --live` (Liara and GitHub).

Statuses: **FIXED** (changed and verified), **BLOCKED** (cannot be completed
from here; cause stated), **REQUIRES OWNER APPROVAL** (an owner setting,
cost or product decision). Every live observation below was made read-only
through the Liara API (`api.iran.liara.ir`) and `gh api` on the date above,
unless the row says a change was made.

## 1. Actual state

### Liara account

| Resource | Live identifier | Detail |
| :--- | :--- | :--- |
| Web / API app | `openfund-iran` | Docker, `standard-plus-g2`, network `staging`, created 2026-11-14. Releases: v1 FAILED, v2 READY, both `a87804a` (v0.6.5), deployed 2026-11-17. No earlier release. Default subdomain off |
| Worker app | `openfund-iran-worker` | Docker, `small-g2`, network `staging`, created 2026-11-17. Releases: v1 UNHEALTHY, v2 READY, both `a87804a`. Default subdomain **on** |
| PostgreSQL | `openfund-iran-db` | `standard-base-g2`, network `staging`, public network off, RUNNING |
| Private network | `staging` | The only network; it is the production network |
| Domains | `iran.openfund.cloud`, `iran.openfi.cloud`, `openfi.live` | On `openfund-iran`, SSL active |
| Domain | `www.openfi.live` | On `openfund-iran`, SSL **not** active |
| Iran CMS | none | Content is read from the GLOBAL Directus through the `/cms` snapshot path |

### GitHub environments

| Environment | Used by | Variables | Protection |
| :--- | :--- | :--- | :--- |
| `liara-iran-runtime` | runtime workflow, production | `LIARA_RUNTIME_WEB_APP=openfund-iran`, `LIARA_RUNTIME_WORKER_APP=openfund-iran-worker`, `LIARA_RUNTIME_PUBLIC_URL=https://openfi.live`; secret `LIARA_API_TOKEN` | branch `main` only; **no required reviewers** |
| `liara-iran-runtime-staging` | runtime workflow, staging | — | **does not exist** |
| `liara-iran-staging` | edge workflow, staging | `LIARA_APP_NAME=openfund-iran`, `LIARA_PUBLIC_URL=https://openfund-iran.liara.run`; secret `LIARA_API_TOKEN` | branch `main` only; **no required reviewers** |
| `liara-iran` | edge workflow, production | — | **does not exist** |
| `production` | Render release deploy | `RENDER_SERVICE_ID`, `RELEASE_PUBLIC_URL`, `RELEASE_CMS_URL` | required reviewer: owner |
| `main - openfund`, `main - openfund-backstage`, `main - openfund-db` | Render | — | Render-managed |

Workflow history: `Deploy Iran edge (Liara)` and `Deploy Iran regional
runtime (Liara)` have **no `workflow_dispatch` runs** and no GitHub
deployments; every run was a pull-request build. The v0.6.5 runtime was
deployed with Liara CLI 9.6.7 from the `v0.6.5` tag (owner-authorized
mission), not through the workflow.

## 2. Discrepancies

| # | Discrepancy | Root cause | Intended state | Change | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Manifest web app `openfund-iran-web`; live app is `openfund-iran` | The manifest was written before the account existed; the owner reused the edge guide's name | `openfund-iran` (renaming recreates the app) | Manifest, runtime guide, ENVIRONMENT.md | **FIXED** |
| 2 | Manifest network `openfund-iran-net`; live network is `staging` | Same | Keep `staging` and document that it is the production network; staging gets `openfund-iran-staging-net` | Manifest, naming table, stale-id check | **FIXED** (renaming: REQUIRES OWNER APPROVAL, not recommended) |
| 3 | Edge environment `liara-iran-staging` deploys to `openfund-iran`, the production runtime | ADR 0031 guide named the edge production app `openfund-iran`; ADR 0033 reused that app for the runtime | Edge apps are `openfund-iran-edge-staging` / `openfund-iran-edge`; never a runtime app | Edge workflow guard refuses runtime apps (static + live), edge docs renamed, live check flags the variable | Repository **FIXED**; the variable itself **REQUIRES OWNER APPROVAL** (§5) |
| 4 | `liara-iran-staging` vs `liara-iran-runtime-staging` | Not a typo: they belong to two workflows (edge vs runtime). The runtime one was never created, and GitHub would auto-create it unprotected on first use | Both declared in the manifest; staging marked `provisioned: false` | Runtime guard refuses an unprovisioned target, so no deploy can reach an unprotected auto-created environment with empty variables | **FIXED**; creating staging **REQUIRES OWNER APPROVAL** (§5) |
| 5 | Edge production environment `liara-iran` does not exist | Edge never deployed | Declared, dormant | Manifest `legacyEdge`, dormant notice in both edge guides | **FIXED** |
| 6 | Edge docs and the runtime manifest both used `openfund-iran-staging` | Two designs, one name | Runtime staging web keeps `openfund-iran-staging`; edge staging is `openfund-iran-edge-staging` | Edge guides (English and Persian) renamed; scope-disjointness check | **FIXED** |
| 7 | Was `openfund-iran` serving the legacy edge before the runtime deploy? | — | — | Verified: no edge dispatch or deployment ever; the app's only releases are the two v0.6.5 deploys; it showed Liara's application-error page before them | **Verified: no edge was overwritten** |
| 8 | Edge settings `OPENFUND_UPSTREAM_HOST`, `EDGE_PORT` on the runtime web app | Left over from the edge setup guide | Runtime apps carry no edge settings | Removed live (only `infra/liara-iran` reads them); restart re-verified (§4); live check rejects them | **FIXED** |
| 9 | Runtime workflow deployed the worker before the web app | Ordering chosen before `MIGRATE_ON_START` | Web (migrates) first, then worker | Workflow order; static check | **FIXED** |
| 10 | Worker crashed at boot: `CMS_PUBLIC_URL ... required in production` | Manifest listed it for web only | Required for every role | Set live on 2026-11-17; manifest and docs; static check | **FIXED** |
| 11 | First web build on Liara failed: `UNRESOLVED_IMPORT ./brand/seasonal-logo.css` | Liara CLI falls back to the root `.dockerignore`, whose bare `brand` matches nested paths under gitignore rules | Upload filter equals `Dockerfile.dockerignore` | Root `.liaraignore`; equality check | **FIXED** |
| 12 | `liara-iran-runtime` has no required reviewers, although the workflow and docs say it does | Environment created without a rule | Owner as required reviewer on every Liara environment | Live check reports it | **REQUIRES OWNER APPROVAL** (§5) |
| 13 | `OPENFUND_GLOBAL_URL` unset, so the runtime deploy skipped the GLOBAL release comparison silently | Optional variable | Production must prove it serves the GLOBAL release | Production deploy now fails when it is unset | Repository **FIXED**; variable **REQUIRES OWNER APPROVAL** (§5) |
| 14 | Production accepted any releasable `main` commit, and the image always reported `official: false` | Same rule as Render candidates; no build argument for the flag | Production deploys only an official tag, and `/version` says so | `release-source` result gates production; `RELEASE_OFFICIAL` build argument; post-deploy check that both apps' latest ready release is the commit | **FIXED** in the repository. The live v0.6.5 build still reports `official: false` until the next workflow deploy (not redeployed: unreviewed code) |
| 15 | Worker reachable at `openfund-iran-worker.liara.run` (`/health`, `/ready`, `/runtime/status`, `/version` answer; every app, admin, sync and purchase route is 404) | Liara enables the default subdomain on create; `POST /v1/projects/openfund-iran-worker/default-subdomain/disable` returns HTTP 500 (three attempts, with and without a JSON body) | Worker private | Live check and runtime deploy guard fail while it is on | **BLOCKED** (Liara API); owner disables it in the console |
| 16 | `www.openfi.live` attached without SSL (TLS `unrecognized name`) | Domain added, certificate not issued | Either issue SSL or detach | Recorded | **REQUIRES OWNER APPROVAL** (DNS/TLS) |
| 17 | Manifest declared `openfund-iran-cms`; it does not exist | Planned Iran CMS; content currently comes from the GLOBAL CMS snapshot | Declared as `provisioned: false` | Manifest, naming table | **FIXED** |
| 18 | Staging web listed a placeholder domain `<staging host on liara.run>` | Template text | No custom domain; default subdomain `openfund-iran-staging.liara.run` | Manifest | **FIXED** |
| 19 | Runtime guide said nothing was provisioned or deployed; Feature Status said the domains returned 503 | Written before deployment | Current evidence | Guide status, Feature Status | **FIXED** |
| 20 | Iran web process holds no market marks, so order execution is suspended (`stale_price`) | `OPENFUND_ROLES=http` on the web app (specified split); the engine reads in-process marks | Product decision | None (enabling execution is enabling trading in Iran) | **REQUIRES OWNER APPROVAL** |
| 21 | In `GLOBAL_CONNECTED` mode the Iran runtime allows challenge provisioning, trading and withdrawal requests/review against its own database | ADR 0033 design | Product decision before promoting the Iran domains | None | **REQUIRES OWNER APPROVAL** |
| 22 | PR #134 failed *PR description and title* | Missing `## Related PRs` and `## Documentation` sections | Template-complete description | Description updated | **FIXED** |

## 3. Changes

Repository (this branch, nothing merged or deployed):

- `infra/liara-iran-runtime/stack.json`: GLOBAL, IRAN production, IRAN
  staging and legacy edge in one manifest with GitHub environments,
  `provisioned` state and live identifiers.
- `scripts/liara/check-infra.mjs` + `scripts/liara/test/check-infra.test.mjs`:
  static, live and guard checks; `npm run infra:check`.
- `.github/workflows/deploy-liara-iran-runtime.yml`: runtime guard,
  web-before-worker, official tag and `OPENFUND_GLOBAL_URL` required for
  production, post-deploy commit check, `RELEASE_OFFICIAL`. The guard and
  the upload filter come from the workflow's own revision, so a rollback to
  a commit that predates them (for example `v0.6.5`) is still checked and
  still uploads `apps/web-react/src/brand`.
- `.github/workflows/deploy-liara-iran.yml`: edge guard (also from the
  workflow revision); dormant notice.
- `.github/workflows/ci.yml`: checker tests and static check.
- `infra/liara-iran-runtime/Dockerfile`: `RELEASE_OFFICIAL` build argument.
- `.liaraignore`.
- Docs: runtime guide (naming table, checks, deploy order), edge guides
  (dormant, edge app ids), ENVIRONMENT.md, Feature Status, ADR 0042, CHANGELOG.

Live (owner-authorized infrastructure mission):

| Date | Resource | Change |
| :--- | :--- | :--- |
| 2026-11-17 | `openfund-iran-worker` | Created (network `staging`, `small-g2`); env set; v0.6.5 deployed |
| 2026-11-17 | `openfund-iran-worker` | `CMS_PUBLIC_URL` added; redeployed |
| 2026-11-17 | `openfund-iran` | v0.6.5 deployed (migrated `openfund-iran-db`) |
| 2026-11-17 | `openfund-iran` | `OPENFUND_UPSTREAM_HOST`, `EDGE_PORT` removed; restart verified |

No resource was deleted, renamed or recreated. DNS was not changed. Render
was not touched.

## 4. Tests and verification

| Check | Result |
| :--- | :--- |
| `node --test scripts/liara/test/check-infra.test.mjs scripts/liara/test/provision.test.mjs` | 22/22 pass (16 checker, 6 provisioner). Covers: wrong environment name, staging aimed at production apps or network, edge aimed at a runtime app, public or migrating worker, worker deployed first, missing guard steps (a comment does not count), stale or missing doc identifiers, upload-filter drift, Render database host, worker default subdomain or domains, deployed commit ≠ approved release, edge settings on runtime apps, missing or unprotected GitHub environments |
| `npm run infra:check` | Pass |
| `npm run infra:check -- --live --expect-commit a87804a…` | 5 findings, all listed above as #3, #12, #13 (two), #15; everything else matches, including both apps on `a87804a` |
| `node scripts/liara/provision.mjs --env production` (plan only) | Every existing resource reported `exists`; nothing would be created except the declared Iran CMS, which is blocked until a plan is chosen |
| `node scripts/liara/provision.mjs --env staging` (plan only) | Would create network `openfund-iran-staging-net`; blocked until plans are chosen |
| `verify-runtime.mjs --url https://openfi.live --region IRAN --expect-commit a87804a… --expect-version 0.6.5 --compare-with https://openfi.cloud` (after the restart) | All 13 checks pass |
| `iran.openfund.cloud`, `iran.openfi.cloud`, `openfi.live` | `/health`, `/ready`, `/runtime/status`, `/version`, home page and `/cms` content: 200 over valid TLS |
| Purchases on Iran | Refused, 503 `purchases_global_region_only` |
| Worker | `/ready`: engine running, 496 markets, fresh marks; logs `[region] IRAN, roles: engine, market-data, sync` |
| `npm run docs:check`, `npm run validate:blueprint` | Pass |
| `actionlint` on the three workflows | No errors (pre-existing shellcheck notes only) |
| `scripts/liara/test/edge-contract.test.mjs` locally | Needs the edge container; fails with `fetch failed` identically on unmodified `main`. CI builds and runs it |
| Runtime image build with `RELEASE_OFFICIAL` | Not run locally (Docker daemon not running); the runtime workflow's PR job builds and boots it |

## 5. Owner actions (exact)

1. **Worker subdomain (#15):** Liara console → `openfund-iran-worker` →
   settings → turn off the default subdomain. Then
   `curl -s -o /dev/null -w '%{http_code}' https://openfund-iran-worker.liara.run/health`
   must not return 200.
2. **Required reviewers (#12, #3):** Settings → Environments →
   `liara-iran-runtime` and `liara-iran-staging` → Required reviewers: the
   owner. Keep deployment branches `main`.
3. **GLOBAL comparison (#13):**

   ```bash
   gh variable set OPENFUND_GLOBAL_URL --env liara-iran-runtime --repo algomanlife/openfund --body https://openfund.cloud
   ```

4. **Edge staging environment (#3):** point it at the edge's own app (or
   delete the environment while the edge stays dormant):

   ```bash
   gh variable set LIARA_APP_NAME --env liara-iran-staging --repo algomanlife/openfund --body openfund-iran-edge-staging
   ```

   ```bash
   gh variable set LIARA_PUBLIC_URL --env liara-iran-staging --repo algomanlife/openfund --body https://openfund-iran-edge-staging.liara.run
   ```

5. **IRAN staging (#4):** choose Liara plans for the staging database and
   apps in `stack.json`, run `node scripts/liara/provision.mjs --env staging --apply`,
   set the secrets it lists, create `liara-iran-runtime-staging` with a
   required reviewer and the variables the live check names, then set
   `"provisioned": true`. Until then, a production workflow deploy cannot
   produce its required staging evidence.
6. **`www.openfi.live` (#16):** issue SSL in the Liara console, or detach it.
7. **Product decisions (#20, #21):** whether Iran executes orders (web role
   with market data, or another design) and which operations Iran allows,
   before announcing the Iran domains.

Then run `npm run infra:check -- --live`; it must report no problems.

## 6. Synchronization status

Not configured and not enabled. `/sync/v1/*` answers 404 on both
`openfi.live` and `openfi.cloud`. Neither Render nor Liara has
`REGION_SYNC_KEYS`, `REGION_SYNC_ACTIVE_KID` or `REGION_SYNC_PEER_URL`, and
no account ownership has moved. Prepared: separate databases (verified by
host), the region fence, the signed endpoint (inert without keys), and the
outbox/inbox tables, which are part of `schema.sql` and were applied when the
web app migrated `openfund-iran-db` at start-up.

Activation needs the owner's explicit approval after a verified backup of
both databases and a reconciliation dry run:

1. Generate one key set `{"<kid>":"<secret, 32+ chars>"}` in the owner's vault.
2. Set the same `REGION_SYNC_KEYS` and `REGION_SYNC_ACTIVE_KID` on Render
   `openfund` and on both Liara apps.
3. `REGION_SYNC_PEER_URL`: Liara → `https://openfund.cloud`; Render →
   `https://iran.openfund.cloud`.
4. Operator call on each side: `POST /admin/regional/sync/enable`.
5. Watch `GET /admin/regional` (outbox, inbox, discrepancies) before any
   account handoff.

## 7. Remaining risks

- Until owner actions 1–4 are done, the live check fails, and the runtime
  production workflow refuses to deploy. This is intended.
- The production network is named `staging`. The manifest and checks prevent
  staging from using it, but the name can mislead people reading the console.
- The live v0.6.5 Iran build reports `official: false` although it is the
  `v0.6.5` tag commit; the next workflow deploy corrects it.
- The Iran domains are live and public while trading on Iran is suspended
  and sync is off; anything a visitor does there is recorded only in
  `openfund-iran-db` until sync is approved and enabled.
