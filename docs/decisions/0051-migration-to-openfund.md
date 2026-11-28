# ADR 0051: Migration to Openfund (proof review, migration pass, private evidence storage)

**Status:** Accepted for local implementation (item B of the second owner batch). Not deployed. Requests stay closed ("opening soon") until private evidence storage is configured.

## Context

The owner wants traders who already hold a funded account at a reputable prop firm, with at least three successful payouts, to prove it and then buy a Standard or One-phase challenge that starts at the funded stage. The engine already supports a funded stage (`stage = 0`). ADR 0049 added entitlements, but those are 100% coupons: a migration pays the **normal** price, so it cannot be a coupon (coupons require a positive discount, and entitlements are honoured only on zero-payment orders).

Rules from the brief, all configurable:

- an editable firm list (FTMO, FundingPips, FundedNext, E8 Markets to start; names only);
- at least 3 payouts in the last 12 months;
- a size cap at the largest proven funded size;
- normal price and the plan's normal funded rules;
- one migration per person;
- No identity step: Openfund runs no KYC ([ADR 0065](0065-no-kyc-terms-and-privacy.md)).

## Decision

1. **Data.** Six additive tables:
   - `migration_firms` and the singleton `migration_settings` (minimum payouts, window, eligible plans, retention days, pass validity);
   - `migration_requests`, with a partial unique index allowing one open or approved request per person (a rejected or withdrawn trader may apply again);
   - `migration_evidence` (metadata only);
   - `migration_events` (append-only);
   - `migration_passes`.
2. **Checklist.** A request can be submitted only when it has:
   - an identity document;
   - funded-account proof (a screenshot or a recording);
   - at least `min_payouts` **distinct** payouts dated inside the window, counted once per date and amount however many documents prove them.

   The same check runs again at approval.
3. **Review.** An owner-gated decision (Backstage: session, CSRF, password re-entry, audit) needs a reason. Approval also needs the complete checklist and sets the approved maximum size (no identity step, [ADR 0065](0065-no-kyc-terms-and-privacy.md)). Nothing is approved automatically: on-chain payouts are checked (receipt success and block time, through the configured RPC endpoints) only as a reviewer signal.
4. **Migration pass.** Approval issues one wallet-bound pass: eligible plans, maximum size and an expiry. Checkout's Migration path (`?migration=<pass>`):
   - shows only eligible plans and sizes and hides the coupon field;
   - creates a **normal-price** order with `purchase_orders.migration_pass_id`.

   Provisioning (`purchases.js provisionOrderTx`, the one path for every settlement):
   - re-checks the pass under a row lock;
   - consumes it (`redeemed`, order id);
   - starts the challenge at stage 0 with the funded snapshot built as for funded entitlements.

   A pass cannot be combined with a coupon, a controlled coupon or an entitlement. A partial unique index keeps at most one pending or paid order per pass.
5. **Storage.** Evidence files go to a private S3-compatible bucket (`MIGRATION_STORAGE_*`, secrets `sync: false`):
   - SigV4 is implemented in `migration-storage.js` (checked against the AWS published test vector; no SDK dependency);
   - every object is written with server-side encryption;
   - reviewers receive presigned, download-only links valid for at most 15 minutes (5 in Backstage);
   - storage keys never reach the trader.
6. **File safety.** There is no antivirus engine. Instead:
   - only inert formats are accepted (PDF, PNG, JPEG, WebP, MP4, WebM), identified by magic bytes, which must agree with the declared type;
   - size caps are 10 MB, or 40 MB for video;
   - PDFs with JavaScript, launch actions, embedded files or form submission are refused;
   - files are only ever delivered as downloads.
7. **Retention.** `files_purge_after` is set at the decision or withdrawal (`retention_days`, default 90). An hourly job deletes the objects and records the purge in `migration_events`.
8. **Regions.** Each runtime mounts the routes with its own `MIGRATION_STORAGE_*`, so IRAN users' requests and files stay in the IRAN runtime and its database (regional ownership model). Until storage is configured the form says "opening soon" and stores nothing.

## Owner update (2026-11-23)

- **Firms.** `migration_firms` gains `website_url` (https), `program_types` and `evidence_types` (seeded only where empty, so owner edits are never overwritten), and an optional logo:
  - the owner uploads it in Backstage (PNG, JPEG or WebP up to 200 KB, checked by magic bytes; no SVG);
  - it is stored in the database and served by `GET /migration/firms/:id/logo` with `nosniff` and a `default-src 'none'` policy;
  - no firm logo is downloaded or recreated, and until one is uploaded the page shows an original monogram badge.

  The seeded official sites and the program and evidence wording are starting values for the owner to confirm per firm.
- **Request.** A contact email is required (`migration_requests.contact_email`, checked without a backtracking pattern).
- **Hero.** A frameless full-bleed scene (`features/migration/heroScene.ts`) replaces the framed flamingo panel on `/migrate`.

## Consequences

- The pricing and provisioning paths change only for orders that carry a pass; every other order is untouched.
- The owner must provide a private bucket and a key limited to it before requests open.
- Openfund runs no KYC and no identity provider; the reviewer judges the evidence and records the reason with the decision.
- Firm names are text only, never logos, with a "not affiliated" disclaimer.
