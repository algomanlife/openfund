# Directus 12 upgrade assessment

**Status: upgrade to Directus 12 is BLOCKED on a licensing decision. Nothing was upgraded in production, and no production credential, backup or database was touched.**
This page records what was verified from official sources, what a staged rehearsal showed, and what the owner must decide. Evidence was produced on 2026-11-10 against an isolated local PostgreSQL 17 cluster; see [staging evidence](../reviews/directus-12-staging/README.md).

## Verified facts

| Question | Answer | Source |
| :--- | :--- | :--- |
| Latest stable Directus | **12.6.1**, published 2026-11-04 (npm `latest` is also 12.6.1) | [GitHub releases](https://github.com/directus/directus/releases), `npm view directus dist-tags` |
| Latest 11.x | 11.17.4 (2026-04-30); no 11.x release since | GitHub releases |
| Does 12.6 require Node.js 26? | **Yes, from 12.6.0** (12.0–12.5 still ran on Node 22). `engines.node` is `>=26` for `@directus/api` and the 12.6.1 image builds `FROM node:26.13.0-alpine` | [Breaking changes, version 12](https://directus.com/docs/releases/breaking-changes/version-12); `Dockerfile` at tag `v12.6.1` |
| Deployed Openfund CMS version | **Not readable without credentials.** Anonymous `GET /server/info` omits the version. Anonymous `/server/health` returns 200 and `/license` does not exist, which is consistent with a pre-12 build; the repository pins 11.9.1 | read-only public requests to the documented CMS host |
| PostgreSQL | Production database is PostgreSQL 17 (Render). Directus 12.6.1 ran migrations and served requests against PostgreSQL 17.11 in staging | staging run |
| Digests (Docker Hub index) | 11.9.1 `sha256:3692e622c824d5f83b97547361b25d9f9ea2a30792c37520deb6af2733dfd66f`; 12.6.1 `sha256:e1561b5e526e8e7a2ac19b7bb6eab63611dd84a862a8c45b864118768a2baff4`; 11.17.4 `sha256:eb326f679ae847c0a776f93b972761dc2ebe84980e0b9d274a6bc31cd62809f7` | Docker Hub tag API |

The Openfund application keeps targeting Node 22. Only the CMS container needs the newer runtime, so the Node requirement is a non-issue for the app, CI or the Render Node service. It matters only for tooling that runs a Directus npm package locally, and for any CMS extension (none exist in this repository).

## Why 11.9.1 should not stay forever

Directus published security advisories during 2026. Many name `< 12.x` as the vulnerable range and list a 12.x release as the fix; for those the repository has no 11.x patch to move to. Examples relevant to this deployment (public read API, WebSockets disabled):

- GHSA-gwvv-rr68-cmv6 (high): unauthenticated persistent denial of service through the `deep` query parameter, fixed in 12.2.0.
- GHSA-7vcx-mhxq-9j96 (high): image-transform denial of service, fixed in 12.2.0.
- GHSA-fq27-7m2r-q6vm (medium): manual-trigger flows executable by unauthenticated users, fixed in 12.2.0.
- GHSA-95f8-mvw7-gpj9 and GHSA-32cw-mf7w-gpqr: fixed in 12.5.0.

Mitigations already in place: `WEBSOCKETS_ENABLED=false` (covers the WebSocket advisories), a public read-only CORS policy, and no flows. Review the live advisory list before deciding; do not treat this paragraph as a complete audit.

## The blocker: Directus 12 licence enforcement

Directus 12 relicensed from BUSL-1.1 to MSCL-1.0-GPL and enforces entitlements. An unlicensed self-hosted instance is the **Core** tier. Measured from `GET /license` on 12.6.1:

| Entitlement | Core tier | Openfund needs |
| :--- | :--- | :--- |
| Collections | **25** | **43 registered content collections** (plus translation tables) |
| Custom permission rules | **disabled** | Every public read permission filters on `status` (published or active); translation reads filter on the parent status |
| Field-level permissions | **dropped with custom rules** (measured 2026-11-11) | The Commerce Admin policy limits fields on coupon create/update and on order, model and customer reads; on Core the role can no longer create or edit coupons |
| Studio seats | 3 | the number of editors with Studio access (1 in staging) |
| Flows | 5 | none defined in the repository |
| SSO, custom LLMs, AI translations | disabled | not used |

Collections registered with Directus count; database-only tables do not ([licensing overview](https://directus.com/docs/licensing/overview)). The content model in `apply_schema.py` defines 35 collections and bootstrap registers 43 including terminal and site settings. Reducing to 25 would mean redesigning the content architecture, which the repository rules forbid.

### What the staged upgrade did

Four runs against a seeded Directus 11.9.1 (schema, all seeders, an editorial edit, an uploaded file):

| Run | Outcome |
| :--- | :--- |
| 11.9.1 baseline | **98/98 checks pass** |
| 12.6.1, restored backup treated as a clean install (no grace) | Licence status `locked`. `/items/*` returns `RESOURCE_RESTRICTED` even for the admin. **41/76 pass.** |
| 12.6.1, backup aged by 90 days (what an existing production database looks like) | Licence status `grace`, 30 days (`grace_period` 2,592,000 s). Migrations succeeded. **Data fully preserved**: no collection, field, relation, item, file or permission row lost. Admin login, editing, uploads, drafts and permissions work. **But every public read of a status-filtered collection returns 403**, so the website, challenge catalog, Whitepaper, Economy and Governance content would all disappear. **51/83 pass.** |
| `apply_schema.py` on an unlicensed 12 instance | Creating a rule-based permission is refused with `RESOURCE_RESTRICTED`. The script now checks `GET /license` first and stops without changes. |

Interpretation, with its limits:

- Directus fails **closed**: with rules ignored, drafts never leaked. The risk is availability, not exposure.
- The grace behaviour comes from the Directus source (`getCoreGraceExpiresAt`): grace applies only when the oldest migration is at least 24 hours older than migration `20260507A`. A fresh test database is therefore treated as a clean install. The documentation says custom rules are enforced only after the grace period; in the staged grace run they were already not applied for public reads. Treat the documentation as optimistic and the measured result as authoritative for planning.
- Telemetry cannot be disabled on Core (`telemetry_required`). Outbound access to `telemetry.directus.com` is expected.
- **Not verified:** behaviour with a real licence or Open Innovation Grant key, since none was provided. The full suite must be re-run on staging with the key before production.

### Coupon administration on 12.6.1 (2026-11-11)

Rerun on a copy of the coupon acceptance database: migrations succeed and all
commerce data is preserved, but on the Core tier the Commerce Admin can only
list coupons (Create disabled, form read-only, Purchase Orders hidden), new
Studio users are refused above 3 seats, and the public catalog read returns
403. On 11.9.1 the same workflow passes 16/16. Details:
[staging evidence](../reviews/directus-12-staging/README.md).

## Decision required from the owner

| Option | What it means | Verdict |
| :--- | :--- | :--- |
| A. Obtain a licence for the current model | Apply for the [Open Innovation Grant](https://directus.com/oig) (free for organisations under $5M annual revenue and fewer than 50 people; eligibility counts people who log in to the Studio) or buy a plan whose limits cover 43+ collections (the pricing page lists 50 for Team; confirm with Directus in writing that custom permission rules are included) | **Recommended**, then re-run the staging suite with the key |
| B. Stay on 11.x for now | Optionally move to 11.17.4 (still Node 22) as a stepping stone. No new security fixes are published for 11.x | Short-term only; accept the open advisories knowingly |
| C. Re-architect the CMS layer | Fewer collections and no per-row rules, for example Openfund-owned published views | Not recommended; changes the content architecture |

Until A is complete, the repository stays on Directus 11.x. Option B was taken on 2026-11-12: the pin moves to `docker.io/directus/directus:11.17.4` (latest 11.x, BUSL-1.1 like 11.9.1). A restored-backup rehearsal on seeded data passed 103 of 104 checks; the only difference is Directus adding `provider` to its built-in own-profile read permission ([evidence](../reviews/directus-11.17.4-staging/README.md)). Deploying it still needs the production-backup rehearsal and owner approval.

## Compatibility changes included in this branch

These are safe on 11.9.1 and on 12.x, so they can merge before the upgrade:

- `render.yaml`: health check path `/server/ping`. On 12, anonymous `/server/health` returns 403 and Render would mark the service unhealthy and could roll back. `/server/ping` exists on 11.
- `render.yaml`: `IP_TRUST_PROXY=true` explicitly. The 12 default flipped to `false`; the 11 default was `true`, so behaviour is unchanged.
- `apply_schema.py`: licence preflight, as described above.
- `apps/backstage/upgrade/`: repeatable staging harness and the `cms-check.mjs` inventory and verification tool.

Also safe on 11.x and applied on 2026-11-11: the `release.yml` readiness probes use `/server/ping` (production 11.x answers `pong`), and `render.yaml` declares an empty `LICENSE_KEY` secret slot on `openfund-cms`.

Deliberately **not** changed: the image tag in `render.yaml`, `compose.yaml` and the release workflow, `autoDeployTrigger` (stays `off`), and the Node runtime of the application.

## Breaking changes 11.9.1 to 12.6.1 and Openfund impact

Compiled from the official release notes and breaking-changes page.

| Change (version) | Openfund impact | Action |
| :--- | :--- | :--- |
| Licence enforcement, Core limits (12.0.0) | **Blocking** (see above) | Decision A |
| `/server/health` requires a token (12.0.0) | Render health check and `release.yml` curl probes | `/server/ping` (done for Render and `release.yml`) |
| `IP_TRUST_PROXY` default `false` (12.0.0) | Client IP behind Render | Set explicitly (done) |
| Node.js 26 minimum (12.6.0) | CMS image only | Image already ships Node 26.13.0; do not run the npm package on Node 22 |
| Published items in versioned collections are locked; `?version=main` becomes `published` (12.0.0) | Openfund collections do not enable content versioning | Re-check if versioning is enabled later |
| Collection `status` string replaced by an `archived` boolean for **new** collections (12.0.0) | Existing string `status` fields keep working. New Openfund collections keep using string `status` for consistency with the public rules | None |
| WYSIWYG rebuilt on Tiptap (12.2.0) | Editors may be prompted before saving legacy HTML; `<div>` wrappers are stripped on edit | Review rich-text fields before editors save; see runbook |
| Valueless boolean query flags count as true; import file size cap 50 MB (12.2.0) | Seeders send JSON items, not imports | None |
| Update and delete by query enforce read permissions (12.4.0) | The public policy is read-only; the seeders use admin | None |
| Inactive collections reject reads and writes (12.4.0) | A collection goes inactive when the instance is over its collection limit | Part of the licensing decision |
| Flow folders share `directus_folders`; `?filter[type]` needed to list file folders as admin (12.4.0) | Not used | None |
| Stricter `ip_access` validation (12.5.0) | No policy sets `ip_access` | Check `directus_policies.ip_access` before upgrading |
| `CACHE_SCHEMA_MAX_ITERATIONS` removed, sync timeout 60 s (12.5.0) | Not configured | None |
| Docker `CMD` is `docker-entrypoint.cjs`; `pm2-runtime` not on PATH (12.3.0) | `render.yaml` uses the default CMD | None |
| Default telemetry host `telemetry.directus.com` (12.6.0) | Egress allow-list | Allow outbound if restricted |
| OpenAPI `x-metadata` renamed `Metadata` (12.6.0) | No generated clients | None |
| `/utils/hash/*` endpoints removed (12.1.0) | Not used | None |
| Hardened image variants (`-dhi` tags) (12.1.0) | Standard image is sufficient | None |

Warnings seen in staging on both versions: five application tables without a primary key are ignored by Directus (`account_equity_samples`, `gov_election_voters`, `gov_proposal_revisions`, `journal_preferences`, `position_close_requests`) plus `challenge_equity_days`. They are not Studio collections and are unaffected.

## How to re-run the rehearsal

```bash
export NODE22_BIN=/path/to/node22/bin NODE26_BIN=/path/to/node26/bin
apps/backstage/upgrade/staging.sh init
apps/backstage/upgrade/staging.sh seed 11.9.1
apps/backstage/upgrade/staging.sh check 11.9.1
apps/backstage/upgrade/staging.sh backup
apps/backstage/upgrade/staging.sh upgrade 12.6.1 --aged
apps/backstage/upgrade/staging.sh check 12.6.1
apps/backstage/upgrade/staging.sh stop
```

The harness runs Directus from the npm package against a throw-away PostgreSQL cluster because Docker was not available in the authoring environment. It exercises migrations, permissions and the API, but **not** the container image. The image-level rehearsal in the [migration runbook](../deployment/DIRECTUS_MIGRATION_RUNBOOK.md) remains a required step before production.

[Backup and restore](BACKUP_RESTORE.md) · [Migration runbook](../deployment/DIRECTUS_MIGRATION_RUNBOOK.md) · [ADR 0020](../decisions/0020-directus-upgrade-policy.md) · [Directus backstage](README.md)
