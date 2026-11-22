# Backstage capability matrix

Audit of every section of the Backstage console
(`apps/backstage/operations/`), recorded on 2026-11-22 from a local run.

**Setup for the audit:**

- `apps/backend` on test port 8313 with a disposable PostgreSQL database (`openfund_test_wte`: migrated, plans seeded, one fixture trader and challenge);
- the console on port 8413 with a throwaway owner password;
- Directus not running.

**Method:** a Playwright script signed in, opened each section, and recorded page errors, alerts, tables, filters, pagination and actions. It then exercised every console mutation through the owner gate (session, CSRF, password re-entry and GLOBAL region) with `checks/backstage-ops.mjs`.

**Result:** no section threw a page error. The broken behaviour and gaps found are listed per section. "Fixed" means fixed in the item E pull request, with the test that covers it.

**Columns:**

- **View** — the section lists or shows records.
- **Create** — new records can be created.
- **Edit** — existing records can be changed.
- **Archive/void** — records can be retired without deletion.
- **Actions** — owner decisions available.

Every mutation requires a reason (where meaningful) and the owner password, and writes an audit entry with the actor. Nothing is ever deleted.

## Prop operations

| Section | View | Create | Edit | Archive/void | Actions | Broken or missing before item E | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Traders (`users`) | List with search, status filter and pagination; detail | — | Internal notes (append-only) and tags | — | Suspend / activate | Suspend and activate only; no full profile, notes or tags | **Fixed.** Profile view (purchases, challenges, support threads, certificates, entitlements, tournament and migration records), notes and tags. Backend `admin-console.js`; tests `test/admin-console.test.mjs` and `operations/test/server.test.js` |
| Challenges | List with status filter and pagination; detail with account, rules, positions and events | Entitlement (below) | Extend the time limit | Void | Manual fail, manual pass to the next stage | View-only | **Fixed.** `engine.adminChallengeAction` settles through the engine's own path and is refused while an open position has no fresh mark. Trade history and balances are never written directly |
| Final-pass reviews (`reviews`) | List | — | — | Reject | Approve, reject | None found | — |
| Payout requests (`payouts`) | List with status and scope, pagination; detail | — | Correspondence | Reject | Approve, simulate, settle (owner flag), IB settlement | None found (empty state shown) | — |
| Plans (new) | List with version, challenge count and history | Create plan | Edit as a draft, with a diff preview | Retire / reactivate | Publish (catalog version bump) | Did not exist; plans changed only through seeds | **Fixed.** Shared validator `packages/plan-validation` (the same rules the website uses) plus `normalizeRules`, and the `plan_catalog_history` table |
| Entitlements (new) | List | Issue a challenge or a funded account | — | — | — | Did not exist beyond the two controlled test coupons | **Fixed.** `entitlements.js`: single-use internal 100% coupon bound to wallet, plan and size. Funded (stage 0) entitlements are provisioned by the one checkout path |

## Payments

| Section | View | Create | Edit | Archive/void | Actions | Broken or missing before item E | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Payment overview | Totals and queues | — | — | — | — | None found | — |
| Payment search | Filters by order, wallet, transaction hash, chain, method, status and dates | — | — | — | — | None found | — |
| Payment attempts | List with status filter | — | — | — | Re-verify | None found | — |
| Deposits (unattributed) | List with filters | — | Associate (with evidence) | Close | Refund case, re-verify | None found | — |
| Refunds | List with status filter | — | — | Reject | Review, approve, sent, failed, confirm | None found | — |
| Payment settings | Methods | — | Enable / disable a method (reason) | — | — | None found | — |

## Business

| Section | View | Create | Edit | Archive/void | Actions | Broken or missing before item E | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Coupons | List; detail with redemptions, orders and audit | Coupon wizard | Update | Revoke | Activate / disable; controlled test coupons | None found | — |
| Support | List with status and department, pagination; thread | — | Internal note | Close | Status transitions, reply | None found | — |
| Partner applications | List with role and status | — | — | Reject / suspend | Review, approve with evidence, reinstate | None found | — |
| Partner commissions | List | — | — | — | Record a payout | None found | — |

## Finance

| Section | View | Create | Edit | Archive/void | Actions | Broken or missing before item E | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Financial position | Position, treasury | — | — | — | Refresh treasury | None found | — |
| Verified expenses | List | Record expense | — | Void | Verify, paid | No filters or search | Not changed (listed as a gap) |
| Capital reserves | List | Set reserve | — | — | — | None found | — |
| Obligations | List | Record obligation | — | Void | Settle | None found | — |

## Operations

| Section | View | Create | Edit | Archive/void | Actions | Broken or missing before item E | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Audit trail | Source, action and actor filters | — | — | — | — | None found | — |
| Live risk board | Read | — | — | — | — | None found | — |
| Global search | Query | — | — | — | — | None found | — |
| Notifications | List with pagination | — | — | — | — | None found | — |
| System status | GLOBAL and IRAN health, versions | — | — | — | — | None found | — |

## Content and marketing

| Section | View | Create | Edit | Archive/void | Actions | Broken or missing before item E | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Content workspace | Interface copy per route and locale; structured surfaces; live preview | **Create a draft item** (fa + en copy) | Text of existing items; **department mailboxes** (owner-gated, validated) | **Archive** (status `archived`) and restore | Publish / unpublish, **reorder**, **media upload** | Could only edit the text of existing items; no create, archive, reorder or media; contact mailboxes could not be set from Backstage | **Fixed.** `content.js` adds `prepareCreate`, `prepareReorder` (`/utils/sort`), `prepareProtected` and `upload`/`media`. The editor role gains create and sort on editorial collections and the four mailbox fields. Test `operations/test/content.test.js` |
| Promotional campaigns | List, stats, editor with live preview | New campaign | Edit | Archive | Publish, activate / deactivate | None found in code; needs Directus. In production, the CMS bootstrap and `register_backstage_editor.py` had not been run, which is the likely reason creation failed (owner step in the release) | Release step runs the scripts after a verified backup |
| Announcement banners | Same editor | New banner | Edit | Archive | Publish, activate / deactivate, preview | No tone, no non-dismissible option, and no way to show a banner on the terminal or portfolio | **Fixed.** Tone (info, success, warning), a dismissible switch, and the `terminal` and `portfolio` pages. The same `AnnouncementBar` is now mounted in the terminal shell. Close target is 44 px |

## Verified in this run

`checks/backstage-ops.mjs` against the local console:

- a note without the password was refused (401);
- note added, tags set, and an invalid tag refused before reaching the backend;
- the profile showed the note and tags;
- a created challenge was extended;
- a pass on a created challenge was refused with its reason (`challenge_created_not_actionable`);
- an entitlement was issued;
- the plan preview showed the diff;
- an invalid plan was refused with the validator's problem list (422);
- the plan was published (catalog version 3 → 4), retired and reactivated.

**Bug found by this audit and fixed:** write-only console sections (notes, tags, challenge actions) were answered 404 by the console router, because it checked the read-route table first.

## Gaps not closed in item E

- **Five console locales.** `public/strings.js` holds English and Persian only (about 660 labels). Arabic, Russian and Chinese require drafting and native review of every label, and are reported as open work.
- **Uniform list controls.** Search and sort exist on Traders, Challenges, Audit, Payments and Support, but not on every section (for example Expenses and Notifications). Pagination exists where the backend paginates.
- **Media in collections.** Uploaded images are stored and their URLs can be copied; collections with image fields still set them in Directus Studio.
- **Tournament, migration and search screens** arrive with items A, B and D. Their operator roles (`register_operator_roles.py`) skip collections until those items create them.
