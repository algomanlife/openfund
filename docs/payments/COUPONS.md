# Coupons and zero-payment purchases

Status: **VERIFIED LOCALLY THROUGH THE DIRECTUS UI — REQUIRES PRODUCTION CMS
BOOTSTRAP.** Coupons are created and managed by administrators in the
Directus Data Studio (collection group **Commerce**). The backend stays the
only authority that validates, prices and redeems a coupon. Source:
`apps/backend/coupons.js`, `apps/backend/purchases.js`, tables `coupons`,
`coupon_challenge_plans`, `coupon_allowed_users`, `coupon_redemptions` and
`coupon_audit` in `apps/backend/schema.sql`, Directus registration in
`apps/backstage/scripts/register_commerce_tables.py`.

Acceptance (2026-11-11, Directus 11.9.1 and the Openfund server on one
disposable PostgreSQL database, `e2e/test-directus-coupons.cjs`, 16/16 checks
passed): a Commerce Admin logs in to the Directus UI, creates a 100% internal
coupon restricted to one test customer and the Standard model, activates it;
the customer applies it in the checkout, a `0.00` order with payment method
`internal_coupon` is provisioned without any payment row; the account appears
for the customer; the redemption and order are visible on the coupon in
Directus; reuse is rejected; a Directus user without the Commerce Admin role
cannot read or create coupons; anonymous reads are refused.

## Coupon types

| Type | Definition | Server pricing |
| --- | --- | --- |
| Percentage | `kind: "percent"`, `0 < value ≤ 100` | `discount = round_half_up(list × value / 100, cents)` |
| Fixed amount | `kind: "fixed"`, USD | `discount = min(value, list)` |
| 100% | Percentage 100, or fixed ≥ price | Net price `0.00` → zero-payment flow |
| Product-restricted | **Products** (`products`), **Challenge Models** (M2M to `challenge_plans`), **Account Sizes** (`account_sizes`); empty = all | Other plans/sizes → `coupon_not_applicable` |
| Usage-limited | **Max Redemptions** (total), **Per User Limit** (default 1) | `coupon_exhausted`, `coupon_already_used` |
| Customer-restricted | **Allowed Customers** (M2M to `openfund_users`) | Anyone else → `coupon_not_found` (existence not revealed) |
| Time-limited | **Starts At**, **Expires At** (UTC) | `coupon_not_started`, `coupon_expired` |

Codes are case-insensitive (stored upper-case, `A–Z 0–9 _ -`, 3–40
characters). `code`, `kind` and `value` are locked after the first
redemption (database trigger): orders already reference the pricing, so a
different discount is a new coupon. `revoked` is final.

## Internal testing coupons

**Internal** coupons are for the two authorized internal testers. The database
requires a finite **Max Redemptions** and rejects more than two **Allowed
Customers**; checkout refuses an internal coupon with no allowed customer.
Any other customer sees `coupon_not_found`. Orders are recorded with
`payment_method = 'internal_coupon'`, are excluded from revenue reporting
(reported separately as coupon activations), earn no Ambassador commission
and do not use up the customer's first-paid-purchase referral slot (test
Z3).

Creating the internal test coupons (owner, in production Directus):

1. Each tester signs in once at openfi.cloud with their wallet, so an
   Openfund account exists.
2. In Directus: **Content → Commerce → Coupons → +**. Code, for example
   `OPENFUND-INTERNAL-TEST-01`; Kind *Percentage*; Value `100`; tick
   **Internal test coupon**; Max Redemptions `1` (or the agreed number);
   Starts At / Expires At; Challenge Models and Account Sizes as needed;
   **Allowed Customers → Add Existing** → the tester's account.
3. Set Status *Active* and save. Repeat for the second tester.

No coupon code is stored in the repository.

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

Coupons are administered in Directus. `register_commerce_tables.py` (step
7/8 of `bootstrap-cms.sh`) registers the commerce tables with labels, field
notes, validation and relations, and creates the **Commerce Admin** role and
policy.

| Capability | Where in Directus |
| --- | --- |
| Create, edit, activate, deactivate | Coupons item form (Status: Active / Inactive) |
| Revoke safely | Status *Revoked* (final; deletion is not granted) |
| Window, total and per-customer limits | Starts At, Expires At, Max Redemptions, Per User Limit |
| Products, account sizes, challenge models, customers | Products, Account Sizes, Challenge Models, Allowed Customers |
| Usage statistics | Uses Reserved, Uses Consumed (trigger-maintained, read-only) |
| Redemption history, related orders | Redemptions and Orders on the coupon; Coupon Redemptions and Purchase Orders collections |
| Who created or changed it | User Created, User Updated, Audit Trail (append-only `coupon_audit`, every writer including Directus) |

Permissions: only the Commerce Admin policy (and the instance administrator)
can read or write commerce collections. The public policy has no access, and
the bootstrap verifies that anonymous reads are refused. Financial columns
(counters, orders, redemptions, audit) are read-only in Directus. Checkout
business rules live in the database triggers and the backend, so a Directus
edit cannot bypass them.

The backend also exposes read-only reporting at `/admin/coupons`,
`/admin/coupons/:id/redemptions`, `/orders` and `/audit` (token
`ADMIN_API_TOKEN`). There is no coupon-creation API.

Production: the application tables exist (migrations ran with v0.4.4), but
step 7/8 of the CMS bootstrap must be run against the production Directus
before administrators can see the Commerce group. See
[Directus backstage](../backstage/README.md).

## Pending business decisions

- Coupon stacking (one coupon per order today) and campaign budgets are not
  implemented. Both are pending decisions.
