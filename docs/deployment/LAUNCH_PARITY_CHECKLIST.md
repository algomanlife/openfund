# Launch parity checklist

Status of every launch-completion task (branch `agent/claude/launch-completion`,
2026-11-16/17). `Done` means implemented and verified locally with the
evidence shown. `Blocked (owner)` means only an owner action remains,
described in the [runbook](LAUNCH_PARITY_RUNBOOK.md). Nothing here is deployed.
Out-of-scope issues are in the
[findings register](../reviews/launch-completion/OUT_OF_SCOPE_FINDINGS.md).

## Phase 0 — Baseline (before any change, `main` at `00a470f`)

| Suite | Result |
| :--- | :--- |
| `npm run docs:check` | Pass |
| `npm run test:release` | Pass (17) |
| `npm --prefix apps/backstage test` | Pass (2) |
| `npm --prefix apps/web-react run typecheck` | Pass |
| `npm run test:web` | Pass |
| `npm --prefix apps/backend run test:all` | Pass (347 integration assertions, 17 node:test files) with a booted test server, CI pattern |

## Phase 1 — Repository truth and release integrity

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Release manifest runtime derived from `render.yaml` and `engines.node` | Done | `scripts/release/manifest.mjs` `runtimePins()`; `scripts/release/test/runtime-pins.test.mjs` |
| `engine-strict=true` | Done | `.npmrc`; `npm ci` green on Node 26 for root, backend, web-react, backstage |
| Stale status docs corrected | Done | `docs/product/FEATURE_STATUS.md`, `docs/backstage/UNIVERSAL_VISUAL_EDITING.md`, ADR 0038 |
| ADR numbering collision | Reported only | Findings #1 |
| Next release version allocated | Done | `node scripts/release/plan.mjs` → `0.6.0` |

## Phase 2 — CMS 11.17.4 rehearsal and content

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Disposable 11.17.4 + PostgreSQL 17, schema and seeds twice, idempotent | Done | [CMS rehearsal](../reviews/launch-completion/CMS_REHEARSAL.md) |
| Public fa/en reads; whitepaper from CMS | Done | CMS rehearsal |
| `CHILD_SRC` value determined | Done | CMS rehearsal; `docs/deployment/ENVIRONMENT.md` |
| Visual-editing protocol on 11.17.4 | Done | `apps/backstage/upgrade/visual-editing-check.mjs` 10/10; site `frame-ancestors` defect fixed |
| Owner runbook for the production CMS upgrade | Done | Runbook §3 |
| Production CMS upgrade and content application | Blocked (owner) | Runbook §3 |

## Phase 3 — Deploy verification

| Task | Status | Evidence |
| :--- | :--- | :--- |
| `scripts/release/live-siwe-smoke.mjs` | Done | Green against a local boot: both allowed domains signed in, forged domain rejected with `invalid_domain` |
| Wired into the deploy workflow, existing gates intact | Done | `.github/workflows/deploy-release.yml` additive step |
| `verify.mjs` runtime verification | Done | `verifyRuntime()`; `scripts/release/test/verify-runtime.test.mjs` |
| Production run of the gate | Blocked (owner) | Runs automatically after the owner-approved deploy (runbook §8) |

## Phase 4 — Backstage

| Section | Status | Evidence |
| :--- | :--- | :--- |
| Partners (applications, decisions, commissions, IB settlement) | Done | Backstage server tests; `e2e/test-backstage-operations.mjs` (review) |
| Finance (expenses, reserves, obligations, adjustments, treasury refresh, allocations, position) | Done | Server tests; e2e (expense wizard) |
| Unified audit viewer | Done | `GET /admin/operations/audit`; backend test A1; e2e |
| User status actions | Done | `POST /admin/users/:id/status`; backend test U1; e2e |
| Commercial coupons CRUD + wizard | Done | backend test C1 (owner-attributed audit); e2e |
| Support replies, trader inbox, outbound adapter, departments | Done | backend test S1; e2e; trader Inbox browser check |
| Notifications (table, API, relay, UI, management) | Done | backend test N1; Inbox browser check |
| Live risk board (read-only) | Done | backend test R1; e2e |
| Global search | Done | backend test G1; e2e |
| Real settlement activation | Blocked (owner) | Runbook §10, after security acceptance |
| External email/SMS delivery | Blocked (owner) | Provider credentials are owner infrastructure |

## Phase 5 — Editorial and visual editing

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Backstage Content workspace (route, language, preview, fields, wizard, draft/publish, visual mode) | Done | `apps/backstage/operations/content.js`; `operations/test/content.test.js`; `e2e/test-backstage-content.mjs` against the disposable Directus |
| Security invariants (plain text, forbidden collections, protected fields, preview without editing chrome) | Done | Content tests; Directus role probes (403 on financial, coupons, deletes, contact fields) |
| Coverage exceptions | Done where safe (75 → 49) | 7 literals resolved; 17 helper definitions reclassified; `pickFormat`; remaining 49 reviewed (17 rulebook financial-parameter sentences kept out of editorial editing by policy) |
| ar/ru/zh-CN publication | Blocked (owner) | Drafts only until native review; dictionary fallback stays |
| Open Trade desktop editorial wiring | Out of scope | Findings #2 |

## Phase 6 — Release candidate

| Task | Status | Evidence |
| :--- | :--- | :--- |
| Candidate build (`release:build -- --candidate`, v0.6.0) | Done | Commit `e498ab9`; 29/29 gates passed with no retries (installs, blueprint, docs, typecheck, web, charts, release, i18n, two reproducible frontend builds, migrate ×2, seed, backend suite, browser journeys and matrices); `verify.mjs` payload check passed; manifest runtime Node 26 / PostgreSQL 17 / `directus/directus:11.17.4`, `official: false`; archive SHA-256 `8593b13adedf348a7a3aba0df84d2c82c7d0032dafc5e86cb45172dc419a7abc`. Output in the ignored `output/releases/v0.6.0/` |
| Secret gates | Done locally | gitleaks over the branch commits and docs: no leaks. `check-secrets.mjs` verifies the CI *Secret scan* on the pushed commit and runs in the release workflow |
| Release notes and CHANGELOG | Done | [openfund-0.6.0.md](../releases/openfund-0.6.0.md); `CHANGELOG.md` |
| Owner runbook | Done | [Runbook](LAUNCH_PARITY_RUNBOOK.md) |
| Publish (`publish=true`), production approval, deploy | Blocked (owner) | Runbook §6–§8 |

## Phase 7 — Final checks

| Suite | Result |
| :--- | :--- |
| `npm run docs:check` | Pass |
| `npm run test:release` | Pass (23) |
| `npm --prefix apps/backstage test` | Pass (8) |
| `npm --prefix apps/backend run test:all` | Pass (inside the candidate build; plus `test:backstage-ops` 7/7) |
| web-react typecheck, `test:web`, `test:content-registry`, `test:i18n` | Pass (inside the candidate build; `test:web` 278 locally) |
| `e2e/test-backstage.mjs`, `e2e/test-backstage-operations.mjs` | Pass |
| `e2e/test-backstage-content.mjs`, `visual-editing-check.mjs` (disposable Directus 11.17.4) | Pass, 10/10 |
| gitleaks (branch commits, docs) | No leaks |
