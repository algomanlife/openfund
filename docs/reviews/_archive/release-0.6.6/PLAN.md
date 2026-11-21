# Release 0.6.6 — coordinated two-region plan

Prepared 2026-11-17; verification recorded 2026-11-18 (below). No release has
been published and no production service has been changed. Every step that
changes production needs the owner's approval at that step.

## Contents and current state

v0.6.6 is the `main` commit after this plan's pull request merges. It
contains:

- #135 (canonical domains, Geo-IP language, Iran pricing, two-region
  Backstage status);
- #136 (allow-list redirects, Liara country source, Cloudflare drift check);
- release orchestration: Backstage identity and deploy, the skew report, and
  the exactly-once settlement test.

| Service | Live now (2026-11-17 17:30 UTC) | Notes |
| :--- | :--- | :--- |
| GLOBAL Web/API `openfund` | `a87804a` (v0.6.5, official) | The auto-deploy of `cd057fa` failed its candidate check (gates still running). Correct refusal |
| GLOBAL Backstage `openfund-backstage` | `cd057fa` (unreleased) | Auto-deployed without a gate. It reports no commit (`/health` predates identity) |
| IRAN web `openfund-iran` | `a87804a` (v0.6.5) | Built without `RELEASE_OFFICIAL` (reports `official: false`) |
| IRAN worker `openfund-iran-worker` | `a87804a` (v0.6.5) | Default subdomain still public |
| Cloudflare | policy of #136 | `check-live.mjs`: no drift |

## Verification record (2026-11-18)

`main` = `77e8ff65935c0fb5fc18f056a0522b3c9e8468fb` (PR #139 merge). No open
pull requests; #138 is closed and superseded by #136. Tag `v0.6.6` does not
exist.

**Equity-sampling deadlock (CI run 44153284877).** Cause: the sampler's
regional fence trigger took `FOR SHARE` on `account_ownership` and only then,
in the deferred foreign-key check at statement end, `FOR KEY SHARE` on the
parent `demo_accounts` row; `DELETE FROM demo_accounts` holds the parent row
and its `ON DELETE CASCADE` then needs the `account_ownership` row. #139 takes
`FOR KEY SHARE` on the parent first and returns no sample when the account is
gone. `test/equity-sampling-locks.test.mjs` forces the interleavings with real
row locks and `pg_blocking_pids` (no sleeps or retries):

| Case | Result (PostgreSQL 17.11, disposable cluster) |
| :--- | :--- |
| Pre-fix statement vs deletion (control) | `40P01` every run; server log: sampler waits `FOR KEY SHARE` on `demo_accounts`, deleter `DELETE FROM demo_accounts` waits on the sampler |
| Deletion first, fixed engine | sampler waits on the parent before any ownership lock; deletion commits; `state()` returns `risk: null`; no rows left |
| Sampling first, fixed engine | deletion waits on the sampler's `FOR KEY SHARE`; sampler commits; cascade removes risk, samples and ownership |
| Fenced ownership | sampling still rejected with `account_not_writable_in_region` |

Repetitions: lock test 25/25; `equity-sampling.test.mjs` 20/20; both together
15/15 against the database of a running server (HTTP, engine and market-data
roles live); `test:engine` 3/3 (45 tests). Every one of the 45 deadlocks in the
server log came from the pre-fix control; none involved the fixed statement.
`npm run test:backend` with the server booted as in CI: exit 0 (479 node:test
passes, 347 assertion passes, 0 failures). `npm run test:release`: 34/34.

**Locale.** PR candidate run 44161092542: `test:browser:website` 642 checks,
`test:browser:locale` 2,654/2,654 checks over five shards (fa, en, ar, ru,
zh-CN; desktop and mobile). Additional local check: back-to-back selector
changes with no settling between them (three sequences) end on the last
locale's route, `lang`/`dir`, stored preference, one hero and one footer
portal, and survive reload (16/16).

**Live state.** Render `openfund` and Backstage serve `a87804a` and
`cd057fa`; auto-deploy is off on `openfund`, `openfund-backstage` and
`openfund-cms` (Render CLI). Liara `openfund-iran` and `openfund-iran-worker`
have `defaultSubdomain: false`. The web app still has `OPENFUND_ROLES=http`
and lacks `PUBLIC_ORIGIN`, `CANONICAL_ALIAS_HOSTS` and `GEO_FALLBACK_LOCALE`;
the worker matches `stack.json`. The `production` GitHub environment has the
required reviewer but not `RENDER_BACKSTAGE_SERVICE_ID` or
`RELEASE_BACKSTAGE_URL`, which `deploy.mjs` requires. `stack.json` staging is
still `provisioned: false` with no plans, and the `liara-iran-runtime-staging`
environment does not exist.

**Workflow inputs.** `release.yml` takes `publish` and `release_version`;
the branch is the dispatch ref (`--ref main`), not an input.

## Owner actions before release

1. **Render dashboard:** set auto-deploy off on `openfund` **and**
   `openfund-backstage` (Settings → Build & Deploy → Auto-Deploy: Off). The
   deploy script refuses to run until both are off.
2. **GitHub `production` environment variables:**
   - `RENDER_BACKSTAGE_SERVICE_ID`: the `openfund-backstage` service ID (in
     the Render dashboard URL, `srv-…`).
   - `RELEASE_BACKSTAGE_URL`: `https://backstage.openfi.cloud`.
3. **Backups:** a manual backup of Render `openfund-db` and of Liara
   `openfund-iran-db`. Record both backup IDs here.
4. **IRAN deploy path (decision).** The runtime workflow's production target
   requires a verified staging run, and IRAN staging is not provisioned. One
   of these is needed:
   - **A:** provision IRAN staging (choose plans in `stack.json`, `provision.mjs --apply`, create `liara-iran-runtime-staging`), then use the workflow; or
   - **B:** approve a one-time operator CLI deploy with the same guards (§3B), as for v0.6.5.

## 1. Validate (read-only)

```bash
gh pr checks <this PR> --repo algomanlife/openfund            # all required green, then merged
```

```bash
node scripts/release/regions-status.mjs                         # baseline (expected: Backstage identity unavailable)
```

```bash
node scripts/cloudflare/verify-public.mjs && node scripts/cloudflare/check-live.mjs --from-file <fresh snapshot>
```

```bash
LIARA_API_TOKEN=… npm run infra:check -- --live                 # expected: only the worker subdomain finding
```

## 2. Publish (owner dispatch)

```bash
gh workflow run release.yml --repo algomanlife/openfund --ref main -f publish=true -f release_version=0.6.6
```

The package gates run on the exact commit and then create tag `v0.6.6`, the
GitHub Release and `release-manifest.json`. Record the tag's commit `<sha>`.

## 3A. GLOBAL (production approval)

The chained **Deploy or roll back official release** job waits for the
`production` reviewer. It:

1. refuses if either Render service auto-deploys;
2. deploys Web/API at `<sha>` and verifies `/version` and the frontend
   manifest;
3. deploys Backstage at `<sha>` and verifies `/health` `commit == <sha>`;
4. checks CMS health and runs the SIWE smoke test;
5. reports the release identity of both regions (evidence; IRAN is still
   on v0.6.5 at this point).

## 3B. IRAN (after GLOBAL is verified)

Liara environment, from the reviewed `stack.json` (production web), applied
once. The secrets stay as they are.

- `OPENFUND_ROLES=http,market-data`
- `PUBLIC_ORIGIN=https://openfi.live`
- `CANONICAL_ALIAS_HOSTS=www.openfi.live,iran.openfund.cloud,iran.openfi.cloud`
- `GEO_FALLBACK_LOCALE=fa`

Workflow path (option A):

```bash
gh workflow run deploy-liara-iran-runtime.yml --repo algomanlife/openfund --ref main -f target=production -f commit=<sha> -f staging_run_id=<run> -f confirm=DEPLOY-IRAN-RUNTIME
```

Operator path (option B, only with owner approval). Run from a checkout of
tag `v0.6.6`, with `.liaraignore` from `main`:

1. `node scripts/liara/check-infra.mjs --guard runtime --target production --web openfund-iran --worker openfund-iran-worker`
2. `liara deploy --app openfund-iran … --build-arg SOURCE_COMMIT=<sha> --build-arg RELEASE_VERSION=0.6.6 --build-arg RELEASE_OFFICIAL=true`. Wait for `/ready` on the web app before the next step.
3. The same for `openfund-iran-worker` with `liara.worker.json`.
4. `node scripts/liara/verify-runtime.mjs --url https://openfi.live --region IRAN --expect-commit <sha> --expect-version 0.6.6 --target production --compare-with https://openfi.cloud`
5. `node scripts/liara/check-infra.mjs --guard runtime --target production --web openfund-iran --worker openfund-iran-worker --expect-commit <sha>`

## 4. Accept

```bash
node scripts/release/regions-status.mjs --expect-commit <sha>      # no skew on any service
```

```bash
node scripts/cloudflare/verify-public.mjs --iran-aliases          # iran.* now 301 to https://openfi.live
```

Further checks:

- `GET https://openfi.live/ready`: `marketData.execution` is
  `available_for_fresh_markets` (Iran pricing).
- `GET https://openfi.live/runtime/ingress` and
  `https://openfund-our6.onrender.com/runtime/ingress` from a known public
  IP. Record which `hopsFromRight` position equals that IP; this sets
  `GEO_CLIENT_HOP` for the later Liara country source.
- Backstage System view: both regions on `<sha>`, both ready.
- `LIARA_API_TOKEN=… npm run infra:check -- --live --expect-commit <sha>`.

Stays off: the Iran geographic redirect, financial sync and Liara country
detection. ADR 0044 is the next phase.

## Rollback

| Layer | Action |
| :--- | :--- |
| GLOBAL Web/API + Backstage | Dispatch **Deploy or roll back official release** with `version=v0.6.5`, `rollback=true`. Both services go to `a87804a`. Backstage v0.6.5 has no `/health` commit, so it is accepted only with Render's confirmation of that exact commit |
| IRAN web + worker | Liara rollback to the previous release (v0.6.5 `a87804a`; both apps keep it in their release list), or the §3B path with `v0.6.5`. Restore the previous env (`OPENFUND_ROLES=http`, without the canonical settings) only if the rollback is caused by them |
| Database | Migrations are additive: v0.6.5 runs on the v0.6.6 schema. Restore a backup only for data damage, never for a code rollback |
| Cloudflare | Rule IDs and previous values: `infra/cloudflare/README.md` |

A failed or partial deploy report is never a successful release. Record the
outcome per service here.
