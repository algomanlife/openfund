# ADR 0049: Backstage plan administration, challenge decisions and granted entitlements

**Status:** Accepted for local implementation (item E of the second owner batch). Not deployed.

## Context

The owner wanted Backstage to be fully operational. Three gaps involved enforced rules or money-adjacent records:

- **Plans.** Challenge plans could only change through `apps/backend/plan-catalog.js` and `npm run seed-plans`. The website catalog (`apps/web-react/src/data/challengePlans.ts`) and the backend each carried a copy of the validation rules.
- **Challenge decisions.** Challenges were view-only: there was no way to extend a time limit after an outage, to void a duplicate, to fail for a conduct finding, or to pass a challenge that the engine could not settle.
- **Issuing.** The only way to give a trader a challenge was the two "controlled test" coupons. The Premium League (item A) and Migration (item B) also need to issue accounts, including accounts that start at the funded stage.

## Decision

1. **One validator.** `packages/plan-validation` holds the plan rules. The website's `assertPlansValid` calls it, and the backend's publish path calls it together with the engine's `normalizeRules`, which must report the plan as `evaluationCapable`. The backend stays the source of enforced rules.
2. **Publishing.** `POST /admin/console/plans/publish`:
   - validates the draft;
   - writes `challenge_plans`;
   - increments `configuration.catalogVersion`;
   - records the previous and the new configuration in the append-only `plan_catalog_history`.

   Retire and reactivate only flip `status`. Only new orders read the published row: every challenge keeps the `rules_snapshot` frozen at provisioning, which `evaluation.js` already stores. The website, checkout, rulebook, comparison and FAQ read the same rows through the CMS (`challenge_plans`, `status=active`), with the bundled catalog as the offline fallback. There is therefore one published catalog and no second copy to edit.
3. **Challenge decisions.** These live in the engine (`Engine.adminChallengeAction`), not in an admin query:
   - **extend** adds 1–90 days to an existing limit;
   - **void** sets `cancelled`;
   - **fail** sets `failed` with violation `manual_review`;
   - **pass** advances the stage exactly as an automatic stage pass does.

   Terminal decisions settle open positions at the server mark through the engine's settlement path, and are refused while any position lacks a fresh, tradeable mark. Nothing writes balances, positions or trade history directly. Each decision records a `challenge_events` row with the actor and reason, plus an audit-log entry.
4. **Entitlements.** These generalize the controlled-entitlement path. `granted_entitlements` ties a single-use, internal, 100% coupon to one wallet, plan and size, with `start_stage` 0 (funded) or 1 (evaluation) and a source of `admin`, `tournament` or `migration`.
   - The trader redeems the coupon at checkout, so `provisionOrderTx` stays the only place a challenge is created.
   - A funded entitlement gets the same funded snapshot that the reward review builds: the plan's normal funded rules, plus the funded payout cycles when that policy applies.
5. **Gate.** Backstage keeps one gate for every mutation: owner session, CSRF, password re-entry and the GLOBAL region. The backend requires the service token and a named actor. A reason is mandatory.

## Consequences

- An owner edit can change prices and rules for new orders immediately. The diff preview and the history table make every change reviewable. Rollback means publishing the previous configuration again.
- A void or manual fail can wait for a market to reopen. This is deliberate: settling without a mark would invent a price.
- Items A and B call `issueEntitlementTx` instead of creating challenges themselves.
