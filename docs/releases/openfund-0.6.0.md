# Openfund v0.6.0 — release notes (candidate)

Status: **unofficial candidate, not published, not deployed.** Built locally
from branch `agent/claude/launch-completion` with
`npm run release:build -- --candidate`. The official release is produced only
by the *Unified release* workflow on `main` after review and merge (see
[the owner runbook](../deployment/LAUNCH_PARITY_RUNBOOK.md)).

## Version

`node scripts/release/plan.mjs` allocates **0.6.0**: the latest official tag
is v0.5.0 and the batch contains `feat:` commits. The earlier draft
[0.6.5-rc.1](openfund-0.6.5-rc.1.md) targeted 0.6.5. The release rules allow
that only as an owner-approved explicit `release_version` inside the newly
allocated 0.6.x line; it is the owner's choice at dispatch.

## What changed

### Release integrity

- The release manifest's runtime section is derived from `render.yaml`
  (`NODE_VERSION`, Postgres major, Directus image) and cross-checked against
  `apps/backend` `engines.node`. It previously claimed Node 22 and Directus
  11.9.1.
- `.npmrc` sets `engine-strict=true`.
- New live SIWE gate (`scripts/release/live-siwe-smoke.mjs`), run after
  deployment by the deploy workflow: a generated wallet completes nonce,
  EIP-4361 signature, verify and an authenticated `/auth/me` on every serving
  domain, and a forged SIWE domain must be rejected with `invalid_domain`.
- `scripts/release/verify.mjs` gains runtime verification: `/version` matched,
  official and on the tag commit; the frontend manifest matches; CMS health;
  the SIWE gate.

### Backstage (owner console)

New sections behind the existing single-owner session, CSRF protection,
password re-entry for every change and the GLOBAL-region gate:

- Partner applications: review, approve (with verification evidence),
  reject, suspend, reinstate; commission balances and payout recording; IB
  settlement approval and payment recording (payment recording follows
  `BACKSTAGE_REAL_SETTLEMENT`).
- Finance: financial position with treasury refresh, revenue allocations,
  verified expenses (record, four-eyes verify, mark paid, void), capital
  reserves, obligations (record, close).
- Unified audit trail over the operational and financial audit logs.
- Trader suspend/activate with a recorded reason.
- Commercial coupon wizard: create, edit, activate, disable, revoke
  permanently; redemption, order and audit detail. Controlled test coupons
  are unchanged.
- Support: trader-visible replies, department filter.
- Notifications: delivery records.
- Live risk board (read-only): open positions, exposure per market, distance
  to daily and total loss limits, market feed freshness and engine-loop lag.
- Global search: wallet, support reference, challenge/order/payout id,
  transaction hash.
- Content workspace: a guided page → language → field → edit-and-publish
  flow over Directus with a live read-only preview and a Visual mode link.

### Trader experience

- New Inbox page (`/{locale}/{prop|perpetual}/inbox`): in-app notifications
  (payout decisions, support replies, challenge pass/fail/expiry) and support
  conversations with replies. Delivery is in-app by polling; no email is sent.

### Content management

- Visual editing works again: the site now lets the configured CMS origin
  frame it (`frame-ancestors`); before this fix the Directus Studio visual
  editor could not load the site.
- Directus 11.17.4 rehearsal tooling and `visual-editing-check.mjs`.
- Content-registry coverage exceptions 75 → 49 (none hidden); new
  placeholder-safe `pickFormat`.

## Database

Additive, idempotent migration (`apps/backend/schema.sql`): `notifications`,
`notification_relay_state`, and thread columns on `support_messages`. No
financial table is changed.

## Configuration (all optional unless stated)

| Variable | Service | Purpose |
| :--- | :--- | :--- |
| `CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC` | openfund-cms | Lets the Studio visual editor frame the site |
| `CSP_EXTRA_FRAME_ANCESTORS` | openfund | Lets Backstage show the read-only site preview |
| `BACKSTAGE_DIRECTUS_TOKEN` | openfund-backstage | Secret; enables Content workspace writes |
| `RELEASE_SIWE_DOMAINS` | GitHub `production` environment variable | Domains the post-deploy SIWE gate signs in on (defaults to the release URL host) |

## Verification

Local candidate from commit `e498ab9`: all 29 release gates passed without
retries; payload verification passed; archive `openfund-v0.6.0.tar.gz`,
SHA-256 `8593b13adedf348a7a3aba0df84d2c82c7d0032dafc5e86cb45172dc419a7abc`;
manifest `official: false`, runtime Node 26 / PostgreSQL 17 /
`directus/directus:11.17.4`. Full results: [launch parity checklist](../deployment/LAUNCH_PARITY_CHECKLIST.md).
Verified locally only; nothing here is deployed. The official build is made
again by the release workflow from `main` and will have a different commit.

## Not included (owner actions)

Publishing, production approval, deployment, the production CMS upgrade and
content publication, secrets, payment activation and enabling real settlement
recording. See [the owner runbook](../deployment/LAUNCH_PARITY_RUNBOOK.md).
