# Coupons and zero-payment purchases

Status: **IMPLEMENTED — LIVE VERIFICATION PENDING** (branch
`codex/production-readiness`, not deployed). Source: `apps/backend/coupons.js`,
`apps/backend/purchases.js`, tables `coupons`, `coupon_redemptions` and
`coupon_audit` in `apps/backend/schema.sql`.

## Coupon types

| Type | Definition | Server pricing |
| --- | --- | --- |
| Percentage | `kind: "percent"`, `0 < value ≤ 100` | `discount = round_half_up(list × value / 100, cents)` |
| Fixed amount | `kind: "fixed"`, USD | `discount = min(value, list)` |
| 100% | Percentage 100, or fixed ≥ price | Net price `0.00` → zero-payment flow |
| Product-restricted | `planSlugs` and/or `accountSizes` | Other plans/sizes → `coupon_not_applicable` |
| Usage-limited | `maxRedemptions` (total), `perUserLimit` (default 1) | `coupon_exhausted`, `coupon_already_used` |
| User-restricted | `allowedWallets` (lowercase addresses) | Anyone else → `coupon_not_found` (existence not revealed) |
| Time-limited | `startsAt`, `expiresAt` | `coupon_not_started`, `coupon_expired` |

Codes are case-insensitive (stored upper-case, `A–Z 0–9 _ -`, 3–40
characters). `code`, `kind` and `value` are immutable after creation: orders
already reference the pricing, so a different discount is a new coupon.

## Internal testing coupons

`internal: true` coupons are for the two authorized test accounts. A database
CHECK requires them to name **one or two** wallets and a finite
`maxRedemptions`. Any other wallet sees `coupon_not_found`. A coupon can never
be both internal and unrestricted or unlimited. The owner names the two test
wallets. The repository contains none.

## Customer flow

1. `POST /purchases/quote` `{planSlug, accountSize, couponCode?}`
   (authenticated, rate-limited) returns list price, discount, net price and
   `paymentRequired`. Nothing is created. The browser never prices anything.
2. `POST /purchases/orders` `{planSlug, accountSize, couponCode?, idempotencyKey}`
   runs in **one** database transaction:
   - reads the plan price of record;
   - locks the coupon row (`SELECT … FOR UPDATE`) and re-validates it;
   - counts reserved and consumed redemptions **under that lock**;
   - inserts the order with an immutable snapshot (`list_price_usd`,
     `discount_usd`, `price_usd`, `coupon_id`, `payment_required`) and a
     `reserved` redemption;
   - if the net price is zero, provisions in the same transaction.
3. Paid orders follow the [DePay / on-chain flow](DEPAY.md). The redemption
   becomes `consumed` when the order is paid. It becomes `released` when the
   order is cancelled or expires unpaid (database trigger).

Concurrency: requests on the same coupon serialize on the row lock, so
neither parallel requests nor retries can exceed a limit. The same
`idempotencyKey` returns the same order. Tests R1–R3 in
`test/commerce.test.mjs` cover this: 12 parallel users on a 3-use coupon get
exactly 3 accounts, and 10 parallel requests from one user get exactly one.

Bounded edge case: a released reservation (expired order) can be re-used by a
new order. If the expired order is then paid late inside
`PURCHASE_LATE_GRACE_MINUTES`, both orders are honored. That can exceed the
limit by the number of such late payments. It cannot happen for 100% coupons,
which have no payment window.

## Zero-payment flow (100% discount)

- Never produces a DePay configuration or an on-chain zero-value payment
  (`order_not_payable`, `zero_payment_order`).
- One transaction runs `awaiting_payment → paid → provisioned`. It provisions
  one challenge, writes a `0.00` invoice and consumes the redemption. No
  `payments` row is written, because no payment exists.
- Ambassador commission: none (no confirmed payment, recorded as
  `zero_amount`).
- Atomic: a failure anywhere leaves no order, reservation or challenge (test
  Z2). The customer can retry.

## Administration

All routes need `Authorization: Bearer $ADMIN_API_TOKEN` and a named
`X-Admin-Actor`. Every change is written to the append-only `coupon_audit`
with before/after snapshots.

| Action | Route |
| --- | --- |
| List (with consumed/reserved counts) | `GET /admin/coupons` |
| Create | `POST /admin/coupons` |
| Edit eligibility, limits, window, description, status | `PATCH /admin/coupons/:id` |
| Disable | `POST /admin/coupons/:id/disable` |
| Redemption history | `GET /admin/coupons/:id/redemptions` |
| Coupon-associated orders | `GET /admin/coupons/:id/orders` |
| Administrative audit trail | `GET /admin/coupons/:id/audit` |

No coupon exists in production. `ADMIN_API_TOKEN` was not set on the Render
service at the 2026-11-10 audit, so the admin API is disabled there.

## Pending business decisions

- Whether a 100%-discount order counts as the referred customer's "first
  eligible purchase" for the Ambassador rule. The current behavior predates
  coupons and is unchanged: any earlier paid order makes a later purchase
  non-first. A free order therefore removes the commission on that customer's
  later first paid purchase. **Pending owner decision.**
- Coupon stacking (one coupon per order today) and campaign budgets are not
  implemented. Both are pending decisions.
