# PostgreSQL roles and privileges

This document describes the least-privilege database model that fixes
[OF-2026-11-12](SECURITY-AUDIT-2026-11.md). Before it, Directus and the
backend shared the `openfund-db` owner credential, so a Directus administrator
could write financial and trading tables directly. On the isolated stack, an
admin `PATCH` set a challenge to `passed` (HTTP 200).

## Roles

| Role | Default name | Login | Purpose |
| --- | --- | --- | --- |
| Owner and migration | `openfund_app` (Render's database user) | yes | Owns every backend table, sequence and function. Runs `migrate.js`. Never given to Directus |
| Backend runtime (optional) | `openfund_runtime` | yes | `SELECT`, `INSERT`, `UPDATE` and `DELETE` on backend tables and sequence use. No DDL and no ownership |
| Directus | `openfund_directus` | yes | Owns `directus_*` and the editorial collections it creates. On backend tables it has only the grants listed below |
| Read-only reporting | `openfund_readonly` | no (group role) | `SELECT` on backend tables. Members are created by the owner when needed |

The policy is version-controlled in
[`infra/postgres/cms-privileges.json`](../../infra/postgres/cms-privileges.json).
[`scripts/ops/db-roles.mjs`](../../scripts/ops/db-roles.mjs) applies and
verifies it:

| Command | Effect |
| --- | --- |
| `plan` | Prints every statement, with passwords redacted. Makes no changes |
| `apply` | In one transaction: creates the missing roles, moves the `directus_*` and editorial tables to the Directus role, revokes and re-grants every backend table, and sets default privileges. Then it runs `verify` |
| `verify` | Read-only drift check. Exits 1 on any difference from the policy |

The script reads backend tables from `apps/backend/schema.sql` and
`apps/backend/footprint/schema.sql`, not from name prefixes. A table that the
policy does not list fails the policy check. Any relation that is neither a
backend table, a `directus_*` table nor a registered Directus collection is
left untouched and reported.

## What Directus can and cannot do

Directus keeps `USAGE` and `CREATE` on schema `public`, because it creates
its own system tables and the editorial collections defined by
`apps/backstage/scripts/apply_schema.py`. It cannot:

- read or write any table not listed below, including withdrawals, payments,
  payouts, treasury, rewards, regional sync, governance, sessions and the
  financial audit log;
- write challenge status, trading balances, positions, orders, the trading
  ledger or purchase orders (read-only views stay available in Data Studio);
- alter, drop, truncate or add triggers to backend tables, or replace backend
  functions (they belong to the owner);
- create schemas, or gain superuser, `CREATEROLE`, replication or the owner's
  membership;
- take over a future backend table by creating it first: `migrate.js` refuses
  to run when a backend table is owned by another role, and `verify` reports
  it.

Future backend tables receive no Directus privileges by default. The owner's
default privileges grant only the runtime and read-only roles.

### Backend tables Directus can access

| Table | Domain | Protected | SELECT | INSERT | UPDATE | DELETE | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `audit_log` | security | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `challenge_plans` | catalog | no | all columns | all columns | `name`, `status`, `configuration`, `slug` | — | Plan catalog: Directus is its editing surface (seed_production_content.mjs inserts and updates plans). No delete: orders reference plans. |
| `coupon_allowed_users` | commerce | no | all columns | all columns | all columns | yes | Coupon allowed-customer junction, edited with the coupon. |
| `coupon_audit` | commerce | no | all columns | all columns | — | — | Read for the audit view. INSERT is needed because the coupon audit triggers run with the writer privileges; the table is append-only (no UPDATE or DELETE). |
| `coupon_challenge_plans` | commerce | no | all columns | all columns | all columns | yes | Coupon eligibility junction, edited with the coupon. |
| `coupon_redemptions` | financial | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `coupons` | commerce | no | all columns | `id`, `code`, `name`, `description`, `kind`, `value`, `status`, `internal`, `starts_at`, `expires_at`, `max_redemptions`, `per_user_limit`, `products`, `account_sizes`, `user_created`, `user_updated`, `created_at`, `updated_at` | `code`, `name`, `description`, `kind`, `value`, `status`, `internal`, `starts_at`, `expires_at`, `max_redemptions`, `per_user_limit`, `products`, `account_sizes`, `user_created`, `user_updated`, `created_at`, `updated_at` | — | Commerce Admin coupon administration (register_commerce_tables.py). Usage counters stay trigger-maintained; no delete (revocation is a status). |
| `demo_accounts` | trading | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `openfund_challenges` | trading | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `openfund_users` | identity | no | all columns | — | — | — | Shown read-only in Data Studio and used by coupon allowed-customer relations. Suspension goes through the backend admin API (Backstage Operations), which records a reason and actor; a direct write would also have to append to the signed regional sync outbox. |
| `purchase_order_events` | financial | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `purchase_orders` | financial | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `support_message_events` | support | no | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `support_messages` | support | no | all columns | — | `status`, `assigned_to`, `internal_notes` | — | Support Agent queue: operator fields only; content immutability is also enforced by trigger. |
| `trading_events` | trading | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `trading_ledger` | trading | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `trading_orders` | trading | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |
| `trading_positions` | trading | yes | all columns | — | — | — | Shown read-only in Directus Data Studio (register_user_tables.py / register_commerce_tables.py / register_support_tables.py). |

No access (105 tables):

| Domain | Tables |
| --- | --- |
| trading | `account_equity_risk`, `account_equity_samples`, `account_ownership`, `account_ownership_events`, `certificate_events`, `certificate_identities`, `certificates`, `challenge_equity_days`, `challenge_events`, `challenge_reviews`, `challenge_strikes`, `challenge_trailing`, `live_trade_events`, `live_trades`, `position_close_requests`, `runtime_mode`, `runtime_mode_events` |
| rewards | `ambassador_attributions`, `ambassador_profiles`, `partner_application_events`, `partner_applications`, `referral_attributions`, `referral_codes`, `referral_commissions`, `referral_visits` |
| security | `auth_nonces`, `auth_sessions` |
| application | `campaign_daily_stats`, `chart_workspaces`, `cms_snapshot`, `coach_profiles`, `journal_entries`, `journal_preferences`, `notification_relay_state`, `notifications`, `trade_notes`, `trader_coach_links` |
| financial | `capital_allocations`, `capital_reserves`, `controlled_challenge_coupons`, `depay_events`, `fee_refunds`, `financial_audit_log`, `financial_obligations`, `ib_settlement_policies`, `invoices`, `live_funding_approvals`, `payment_adjustments`, `payment_allocations`, `payment_attempts`, `payment_events`, `payment_intents`, `payment_monitor_cursors`, `payment_refund_liabilities`, `payment_settings`, `payment_transactions`, `payments`, `payout_transaction_claims`, `profit_share_allocations`, `revenue_allocation_journal`, `revenue_allocation_policies`, `settlement_records`, `treasury_snapshots`, `treasury_token_movements`, `treasury_transfer_cursors`, `verified_expenses`, `withdrawal_requests` |
| market-data | `economic_calendar_coverage`, `economic_events`, `footprint_gaps`, `footprint_minutes` |
| governance | `gov_audit_events`, `gov_comments`, `gov_conflicts`, `gov_decision_amendments`, `gov_decisions`, `gov_election_candidates`, `gov_election_voters`, `gov_election_votes`, `gov_elections`, `gov_eligibility`, `gov_implementation_log`, `gov_memberships`, `gov_proposal_history`, `gov_proposal_revisions`, `gov_proposals`, `gov_roles`, `gov_seats`, `gov_terms`, `gov_vote_challenges`, `gov_votes`, `gov_voting_sessions` |
| regional | `region_discrepancies`, `region_handoff_offers`, `region_inbox`, `region_outbox`, `region_peer_status`, `region_reconciliation_runs`, `region_remote_entries`, `region_remote_rows`, `region_stream_checkpoints`, `region_stream_heads`, `region_sync_nonces`, `region_sync_settings`, `runtime_region` |

`coupon_audit` stays append-only for Directus: it gets `INSERT` but no
`UPDATE` or `DELETE`. That `INSERT` is needed because the coupon audit
triggers run with the writer's privileges. A Directus administrator could
therefore add a forged audit row, but never change or remove an existing one.
Moving those triggers to `SECURITY DEFINER` would remove that residual, but it
changes coupon-domain SQL, which is outside this remediation's scope.

## Verification evidence

[`scripts/ops/test/db-roles.test.mjs`](../../scripts/ops/test/db-roles.test.mjs)
runs in the CI job `Database role isolation`. That job uses a non-superuser
`CREATEROLE` owner, as on Render, plus Directus 11.17.4 connected as
`openfund_directus`, the full CMS bootstrap and the Backstage editor role. The
suite covers:

- the original finding: a Directus admin `PATCH` of a challenge to `passed`,
  a balance change and a delete are refused, and the rows are unchanged;
- direct SQL as the Directus role against challenges, balances, positions,
  the ledger, financial audit, purchases, withdrawals, the regional outbox and
  coupon counters;
- escalation attempts: `ALTER ROLE`, `GRANT`, `SET ROLE`, `DISABLE TRIGGER`,
  ownership changes, replacing a function, `CREATE SCHEMA` and `COPY TO PROGRAM`;
- a collection named after a financial table, and table squatting;
- editorial CRUD with draft isolation, fa/en translations, public published
  reads, coupon create, revoke and eligibility with the audit trail, and plan
  catalog editing;
- the runtime role: DML, sequences and `LOCK TABLE`, but no DDL and no
  `directus_*` access.

The CMS bootstrap regression (`scripts/release/test-cms-bootstrap.mjs`) also
runs across a Directus restart on the reduced role.

Before the fix, the HTTP finding test failed on the shared credential ("a
Directus administrator could still pass a challenge"). After `apply`, all 12
tests pass.

## Deployment (owner action)

The steps change the production database and the Render configuration, so
the owner runs them. Do them in this order, and never revoke anything before
step 4 passes.

1. **Backup.** Take a Render on-demand backup, or a `pg_dump`, and run
   `scripts/ops/backup-drill.mjs` against a local scratch database.
2. **Check that the owner can create roles.** Run
   `SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user` as the
   `openfund-db` user. If it returns false, create `openfund_directus` (LOGIN)
   and `openfund_readonly` (NOLOGIN) as a privileged user first.
3. **Apply.** From a trusted machine, with the owner's external connection
   string in `OWNER_DATABASE_URL` and a new generated password in
   `CMS_DB_PASSWORD`, both supplied through the environment and never as
   arguments:
   `node scripts/ops/db-roles.mjs plan`, review the output, then
   `node scripts/ops/db-roles.mjs apply`. The result must be `"ok": true`.
   Directus keeps working on the owner credential during this step.
4. **Switch Directus.** In Render, set `openfund-cms` → `DB_CONNECTION_STRING`
   to the internal connection string for `openfund_directus`, then restart the
   service. Check `/server/ping`, a Backstage Content edit, coupon
   administration and a public published read. Then confirm that an admin
   `PATCH /items/openfund_challenges/<id>` is refused.
5. **Sync the Blueprint.** Only after step 4: the Blueprint now declares
   `DB_CONNECTION_STRING` as `sync: false` and no longer references the owner
   credential.
6. **Record the result.** Add the verification time and evidence to
   `docs/status/status.json`, without credentials.

Optional, separately: create `openfund_runtime` (`RUNTIME_DB_PASSWORD`), set
the API's `MIGRATION_DATABASE_URL` to the owner credential and
`DATABASE_URL` to the runtime role. The full backend suite was run against a
runtime-role server. The application logged no privilege errors. The only
failures were test-harness DDL: fault-injection triggers, `TRUNCATE` fixtures
and schema re-application, which need the owner role.

## Rotation and rollback

- **Rotate the Directus password:** `ALTER ROLE openfund_directus PASSWORD
  '<new>'` as the owner, update `DB_CONNECTION_STRING` in Render, and restart
  `openfund-cms`.
- **Roll back the connection:** point `DB_CONNECTION_STRING` at the previous
  value and restart. The grants do not need to be reverted for Directus to
  run as the owner.
- **Revert ownership (only if needed):** `REASSIGN OWNED BY openfund_directus
  TO openfund_app`, run by the owner, which is a member of the Directus role.
- **Drift:** run `node scripts/ops/db-roles.mjs verify` after every
  migration, Directus upgrade and bootstrap. CI runs it on every pull request
  against a disposable database.
