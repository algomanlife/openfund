# ADR 0062 — Request-based 14-day Free Trial; the automatic demo account is retired

- Status: Accepted by the owner (2026-11-27).
- Supersedes: the automatic free demo account (one `free_demo` account with
  100,000 virtual USD per user, created at sign-in, permanently disabled at
  zero equity — [Unified accounts](../trading/UNIFIED_ACCOUNTS.md)) and the
  "trial provisioning activates with the commercial launch" status of the
  [challenge catalog](../research/OPENFUND_CHALLENGE_CATALOG.md).

## Context

Every signed-in wallet received a free demo account automatically. It had no
challenge rules, no time limit and only a zero-equity stop. The catalog
published a Free Trial (Standard rules, 14 days per phase, no rewards), but
nothing could create one: purchases rejected the free plan and operator grants
refused it. The owner decided on 2026-11-27 that:

1. signing in must not create any trading account;
2. a trader requests a Free Trial, which is activated at once;
3. the trial follows the rules of a real challenge, One-phase or Two-phase
   (not Instant, which is purchase-only), at any account size the site offers;
4. each phase lasts 14 days, so a two-phase trial has two 14-day phases;
5. a trial has no rewards and no withdrawals; passing it earns a Free Trial
   pass certificate;
6. a new trial is available 72 hours after the previous one ends, and never
   while the trader has any running account;
7. a trader with no account sees a graphical activation page with the trial
   and the challenge checkout inside the dashboard;
8. the existing free demo accounts are test data and are deleted completely.

## Decision

- **A trial is a challenge.** `apps/backend/trials.js` creates an
  `openfund_challenges` row on the `free-trial` plan and starts it in the same
  transaction. Its frozen rules snapshot is the *current* configuration of the
  chosen paid plan (`standard` or `one-phase`) with the trial overrides: `free`,
  14 days per phase, no profit split, no reward cycles, no payout terms, no
  reduced daily-loss variant, and `trialModel`. The engine, evaluation, stage
  progression (stage 2 starts its own 14 days), expiry and conduct rules apply
  unchanged; `rewards.js` already refuses to fund a free snapshot.
- **Eligibility** is checked under a per-user advisory lock: no challenge of
  the user may be `created` or `started`, and 72 hours must have passed since
  the user's latest trial `completed_at`.
- **API.** `GET /trials` (offer and eligibility) and `POST /trials`
  `{ model: 'standard' | 'one-phase', accountSizeUsd }` → `201` with the
  started challenge, or `400 invalid_trial_model | invalid_account_size`,
  `409 active_account_exists | trial_cooldown (availableAt) | trial_not_available`.
- **Sign-in** (`POST /auth/verify`) no longer provisions an account. Only test
  mode (`SIM_TEST_MODE` against a test database) keeps provisioning the
  engine's internal practice account, the fixture the existing backend and
  browser suites trade on. `GET /products/prop/context` answers with no account
  instead of `404` so the dashboard can offer activation.
- **Certificates.** Three kinds join `purchase`, `completion`, `payout` and
  `tournament`: `trial` (activation), `stage_pass` (phase 1 of any two-phase
  evaluation, trial or paid) and `trial_pass` (final pass of a trial, no
  reviewer, because a trial is never funded).
- **Dashboard.** A Prop trader with no selected account and no running account
  sees `TrialActivation`: model cards with the rules, size choices, the
  eligibility message and the embedded checkout (`CheckoutPage embedded`).
- **Deletion.** `npm --prefix apps/backend run retire-free-demo` (dry run by
  default, `--confirm` to delete) removes every free demo account owned by the
  local region with its journal entries, preferences, trade notes, close
  requests, positions, orders, ledger rows, engine events, risk and equity
  samples, ownership row and the synchronized copies of the peer region's
  free demo accounts, in one transaction with an `audit_log` row. The trial
  immutability triggers allow a delete only inside that transaction
  (`SET LOCAL openfund.retire_free_demo = 'on'`). The owner runs it on each
  region after a database backup; it is not part of `migrate.js`.

## Consequences

- A new user sees the activation page instead of a funded practice account.
- The engine's `free_demo` code path remains as a test fixture
  (`RETIRED.json`: legacy-only pending removal) until the suites move to trial
  or challenge fixtures.
- The planned on-chain certificates and trade records (next owner decision in
  this batch) build on these certificate events and the trial's trades.
- Tests: `apps/backend/test/trials.test.mjs` (`test:trials`, in `test:all`).
