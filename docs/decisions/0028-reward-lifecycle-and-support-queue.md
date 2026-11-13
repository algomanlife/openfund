# ADR 0028 — Server-computed reward lifecycle and a backend-owned support queue

- Status: Proposed (implemented on branch `agent/claude/launch-readiness`, not deployed)
- Date: 2026-11-13

## Context

Before this change:

- `POST /withdrawals` accepted any amount up to USD 1,000,000 from any signed-in
  wallet, with or without a challenge. No payout term in the catalog (split,
  first-payout wait, minimum request, consistency, profitable days, monthly
  cycle, fee refund) was evaluated (`PLAN-PAYOUT-CONDITIONS`, `PLAN-FEE-REFUND`).
- A final evaluation pass ended the challenge as `passed`. There was no review
  state and no funded stage, so a two-phase or one-phase customer could never
  reach a reward-eligible account.
- There was no public contact channel. The terminal linked to an unverified
  mailbox on a domain that is not an Openfund production domain.

## Decision

1. **Rewards are computed by the server** (`apps/backend/rewards.js`). A
   request names a funded account and a cycle; the server computes the realized
   net profit (Decimal), applies the frozen payout terms and returns every check.
   A client-supplied amount is ignored. Only funded accounts qualify: a paid
   Instant challenge, or a funded-demo account created by an approved review.
2. **Final passes are reviewed by an operator** (`POST /admin/rewards/reviews/:id`).
   Approval provisions exactly one funded-demo account (stage 0, same size and
   frozen rules plus `funded: true`, restarted at the starting virtual balance).
   One decision per challenge (`challenge_reviews` primary key) and one funded
   account per passed challenge (unique `funded_from_challenge_id`) are
   enforced by the database. No real capital is ever allocated.
3. **Profit is reserved at request time.** The requested gross profit leaves
   the funded account in the same transaction (`reward_withdrawal` ledger row).
   The day's loss basis moves down by the same amount and trailing drawdown
   restarts from the new balance, so a reward cannot itself cause a breach.
   Rejection or cancellation re-credits it (`reward_reversal`). At most one
   open request per account (partial unique index).
4. **Rules snapshots are versioned.** `RULES_VERSION` 2 freezes the payout terms
   into new snapshots. Version-1 snapshots are never rewritten; for them the
   payout terms are read from the plan row and every request records
   `termsSource: plan_configuration` for the operator.
5. **Support messages belong to the backend** (`apps/backend/support.js`,
   `support_messages`). The public form posts to a validated, rate-limited,
   write-only endpoint. Directus registers the table for a `Support Agent` role
   (read; update status, assignment and notes only; 2FA enforced). The public
   policy has no permission on the queue. A database trigger keeps submitted
   content immutable for every writer. No email is sent: no verified mail
   infrastructure exists.

## Consequences

- The previous free-amount withdrawal form is removed. Legacy rows keep
  `kind='legacy'` and their existing review path.
- A funded-demo account never passes again: `evaluateRules` only evaluates
  targets for stage ≥ 1 and non-funded snapshots.
- Several payout parameters still need an owner decision (reward cycles,
  profitable-day threshold, inactivity, open-risk and news rules). See
  [Launch readiness](../reviews/launch-readiness-2026-11-13/REPORT.md).

## Rollback

Revert the branch. The schema changes are additive (new tables, nullable or
defaulted columns, partial indexes) and may stay in place; support messages and
`kind='reward'` withdrawal rows remain readable by the previous code.

Caution: the previous `evaluateRules` evaluates a profit target on any stage
of a phased plan, so it would treat an open funded-demo account (stage 0,
phases ≥ 1) as an evaluation. Before rolling back after any review has been
approved, pause those accounts (or finish the rollback before approving the
first review), and settle open reward requests manually.
