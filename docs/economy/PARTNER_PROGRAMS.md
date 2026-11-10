# Brand Ambassador and Verified Trading Coach

Both programs are presented on one consolidated page, **Economy › Ambassador
(IB)** (`/{locale}/ambassador`). The coach section is `#verified-coach`, and
`/{locale}/coach` redirects there. The page covers applications, approval
status, referral tracking, commission history, earnings and settlements,
statistics and program rules for each role. Consolidation is presentation
only: data, permissions, approvals and calculations stay separate.

The two roles are independent. One wallet may hold both, but each needs its own application and approval. Approving one role grants nothing in the other.

## Application workflow

The states are `submitted`, `under_review`, `approved` and `rejected`, and an approved role can move between `approved` and `suspended`. Submitting an application never approves it. Every transition is stored in `partner_application_events` with the operator name and note. The connected wallet is taken from the SIWE session, never from the form. Only one open application per role is allowed.

Operators decide through `POST /admin/partners/applications/:id/decision` with `{ action, note, verification }`. Approval, rejection and suspension require a note.

## Brand Ambassador policy

**Eligibility:**

- At least 50,000 followers on Instagram **or** YouTube.
- Genuine activity on a second platform.
- Financial-markets content of acceptable quality.
- A credible, active presence with a real audience and no serious evidence of engagement fraud.
- Acceptance of the terms (`ambassador-2026-11`).

**Verification:** follower counts entered by the applicant are stored as claims. Approval requires reviewer evidence of the form `verification.audience = [{ platform, count, evidence, verifiedAt }]` with at least one platform at or above 50,000, plus `secondPlatformActive`, `marketsContent` and `engagementReviewed` all set to `true`. No platform API is connected, so no count is shown as verified unless a reviewer recorded it.

**Code:** an `A`-prefixed referral code is created only at approval. Before that, no code and no commission right exist. The generic Growth Partner invite codes are a separate pre-launch feature and never earn commission.

**Attribution:** the `/:locale/ref/:code` link sets the `of_ref` cookie (30 days), plus an optional `of_cmp` campaign tag from `?c=`. A new account is attributed at sign-up. An existing account that has never paid is attributed when it creates its first order. A customer can be attributed only once, never to their own code, and only to an active ambassador.

**Traffic:** a public beacon stores a daily hashed fingerprint (date, IP, user agent and code). No IP address is stored.

## Referral commission rules

- **Rate:** 10% of the confirmed net purchase amount (`purchase_orders.price_usd`, which is server-priced; no discount system exists today). Rounding is half-up to cents.
- **Scope:** the referred customer's first paid purchase only. Later purchases create nothing.
- **Recognition:** inside the same database transaction that confirms the payment. The commission exists exactly when the payment is confirmed.
- **Idempotency:** partial unique indexes allow one `earned` entry per customer and per order. Replays, duplicate callbacks and reprocessing insert nothing.
- **Not recognized,** with an audit entry giving the reason, when:
  - the ambassador is suspended;
  - the attribution is later than the order;
  - the payer wallet is the ambassador's own wallet;
  - the order is not the customer's first paid order.
- **Refunds and chargebacks:** each `payment_adjustments` row appends a proportional `reversal` entry that never exceeds what remains. The original entry is never edited or deleted, because the ledger is append-only by trigger.
- **Recognition versus transfer:** the pending balance is the sum of all entries. A transfer is recorded as a `payout` entry with the operator's payout reference. It cannot exceed the pending balance and is idempotent per reference.

## Verified Trading Coach policy

**Requirements:** no audience threshold. Applications must cover trading experience, markets traded, a verifiable track record, risk management, mentoring experience, profile links and supporting documents, and motivation. Approval requires `verification.trackRecordReviewed = true` with an evidence note. Coaches receive a `C`-prefixed code.

**Relationships:** a trader requests a coach by code, and the coach accepts or declines. While the link is active, the coach records a qualification decision (`verified` or `rejected`) with a required note. Self-coaching is impossible. A trader can have one open relationship at a time.

**Visibility:** a coach sees only linked traders: a masked wallet, an optional display name and eligibility progress. Coaches never see journals or private history.

**Coach profit share:** 10% of distributable realized net profit from eligible live trades only. Distributable profit is verified realized PnL minus trading fees and execution costs. Simulated accounts and unrealized PnL never create coach revenue. See [Live Market Access](LIVE_MARKET_ACCESS.md).
