# Security acceptance — launch admin surface (release 0.6.5)

Review of the surfaces added in the launch-completion work (PR #132) and in
this release, made 2026-11-17 from the source and automated tests. It is the
evidence the owner reviews before setting `BACKSTAGE_REAL_SETTLEMENT=true`
(runbook §10). It does not replace the owner's decision, and an AI review is
not a human approval.

## Scope

`apps/backend/admin-operations.js` (audit, search, notifications, metrics,
risk), `coupons.js` commercial CRUD, `admin.js` user status, `support.js`
operator replies and trader inbox, `notifications.js`, the Backstage
operations server (`apps/backstage/operations/server.js`, `content.js`), and
the site `frame-ancestors` change in `apps/backend/server.js`.

## Findings by control

| Control | Result | Evidence |
| :--- | :--- | :--- |
| Admin authentication | Pass | Every admin router applies `adminAuth` (constant-time token check; disabled when `ADMIN_API_TOKEN` is unset). Tests: unauthenticated calls get 403 in `test/backstage-operations.test.mjs` (U1, C1, A1, R1) and `test/observability.test.mjs` |
| Named actor on admin writes | Pass | User status, coupon writes and support replies call `adminActor`; coupon writes set `openfund.actor` so the append-only `coupon_audit` names the operator (C1 asserts it) |
| Rate limits | Pass | `express-rate-limit` on every route this work added: operations reads 120/min, user status 30/min, coupon writes 30/min, support operator replies 45/min, reserves/obligations reads 30/min, trader inbox 45/min, trader notifications 60/min. CodeQL "missing rate limiting" alert on PR #132 resolved |
| Ownership (IDOR) on trader routes | Pass | `/support/inbox*` and `/notifications*` filter by the session user id; another trader's reference returns 404 and their inbox is empty (S1); read receipts only update the caller's rows |
| No financial writes | Pass | New admin routes write only `openfund_users.status` + `audit_log`, `coupons` and its eligibility tables, `support_messages` thread fields, `notifications`. No balances, ledger, positions, payments, withdrawals or challenge state. The risk board and metrics read recorded state and never call the engine. The notification relay only reads `challenge_events`, `openfund_challenges` and `purchase_orders` |
| Backstage owner gate | Pass | Every new Backstage mutation goes through the existing session cookie (`__Host-` over HTTPS), CSRF header, `confirmOwner` password re-entry and GLOBAL-region check. Tests: `apps/backstage/operations/test/server.test.js` (403 without CSRF, 401 on wrong password, `wrong_region`, 400 on invalid actions) and `test/content.test.js` |
| Content workspace limits | Pass | Server-side allowlist of editorial collections and text fields; forbidden financial collections and link/destination/contact/money-like fields refused; plain text only; placeholders must match the English source (content tests). The Directus role from `register_backstage_editor.py` has no deletes; its token got 403 on `challenge_plans`, `coupons`, deletes and `site_settings` contact fields on a disposable 11.17.4 |
| Real settlement switch | Pass | `settle` and IB `ib_paid` are refused with `settlement_disabled` while `BACKSTAGE_REAL_SETTLEMENT` is not `true` (server tests) |
| Site framing | Pass | `frame-ancestors` is `'self'` plus the configured CMS origin and exact `CSP_EXTRA_FRAME_ANCESTORS` origins only (paths, wildcards and other schemes dropped; https only in production). `X-Frame-Options` is omitted whenever a CMS origin is set because it would override the CSP. Production refuses to start without a CMS origin, so production always allows exactly that origin. Test: `e2e/test-frame-ancestors.mjs` (CI) |
| Audit visibility | Improved | `audit_log` insert failures were swallowed; they are now counted and logged (`[obs]` lines) and visible in `/admin/operations/metrics` |
| Secrets | Pass | gitleaks clean on every commit; new secrets (`BACKSTAGE_DIRECTUS_TOKEN`) are `sync: false` in `render.yaml` |

## Residual risks (accepted or owner decisions)

1. **CMS origin can frame the site.** Intended for visual editing. A
   compromise of the Directus origin could frame the site (clickjacking).
   Mitigation: Directus admin accounts with strong credentials and 2FA; keep
   `CMS_PUBLIC_URL` pointed at the real CMS only.
2. **Backstage content routes have no per-route rate limit.** They need the
   single owner session plus CSRF, and writes need the password (login is
   throttled). Accepted for a single-owner console.
3. **Shared admin token.** The backend admin API uses one service token
   (`ADMIN_API_TOKEN`) held by Backstage; the actor name attributes decisions
   but is not separate authentication. Rotate the token if Backstage is
   compromised.
4. **Notification relay batch.** One relay pass handles up to 500 events in
   one transaction; a very large backlog drains over several passes
   (30 s apart). No correctness impact.
5. **Not covered here:** payment verification, the engine and evaluation
   (forbidden surfaces, unchanged), and an external penetration test.

## Recommendation for `BACKSTAGE_REAL_SETTLEMENT`

No blocking issue was found in the surfaces above. Enabling real settlement
recording remains the owner's decision. Prerequisites: production
provisioning per the runbook (§2), the release deployed and verified (§8–§9),
and one end-to-end settlement rehearsal with a controlled test payout.
