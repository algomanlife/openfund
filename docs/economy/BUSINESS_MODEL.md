# Business model and operations overview

This page is the startup-level summary of how Openfund works as a business and
a product. It consolidates facts maintained elsewhere and keeps four categories
apart:

- **Implemented**: present in the source code. Live only when `/version` and
  the [feature register](../product/FEATURE_STATUS.md) say so.
- **Approved policy**: decided by company management ([ECONOMY.md](../../ECONOMY.md)).
- **Proposed**: future functionality, not available.
- **Pending decision**: a business or governance decision has not been taken.

It contains no revenue figures, market share, forecasts or legal-entity
details. None have been published, and none may be invented.

## Company and product

Openfund is an early-stage trading-technology project. It offers a bilingual
website, a shared trading terminal, server-side simulated Prop trading with
challenge evaluation, and read-only Perpetual account review on Gains Network
(Arbitrum One). See [Product overview](../product/OVERVIEW.md) and the
[architecture](../architecture/ARCHITECTURE.md).

## Revenue streams

| Stream | Category | Notes |
| --- | --- | --- |
| Prop challenge sales (evaluation fees) | Implemented, **disabled in production** | Server-priced orders, coupons, multi-chain DePay checkout with on-chain verification ([lifecycle](../payments/ORDER_LIFECYCLE.md)). `paymentsEnabled: false` until the owner configures the receiver, token, RPC and DePay keys |
| Openfund share of distributable live-trading profit | Implemented control plane, **not active** | Requires Live Market Access, verified capital and a real execution adapter (none enabled) |
| Anything else (subscriptions, data, protocol fees) | Proposed or not planned | Not implemented |

## Costs and obligations

| Category | Category of record | Source |
| --- | --- | --- |
| Ambassador commissions | Approved: 10% of the referred customer's first eligible confirmed purchase | `referral_commissions` ledger, recognized at payment, reversed on refund |
| Coach compensation | Approved: 10% of distributable realized net profit from eligible live trades, after trading fees and execution costs; never unrealized or simulated PnL | `profit_share_allocations` (`economy-math.js distributeProfit`) |
| Trader rewards on simulated funded accounts | Per published plan rules | Withdrawal requests are records only; no automatic payout |
| Trader/firm profit-sharing tiers for real capital | **Pending decision** | Code holds placeholder tiers that are not approved policy ([ECONOMY.md](../../ECONOMY.md#decisions-pending)) |
| Refunds and chargebacks | Implemented recording | `payment_adjustments` (append-only); order moves to `partially_refunded`/`refunded` |
| Infrastructure (Render, PostgreSQL, Directus, RPC providers) | Operational expense | Recorded as `verified_expenses` by operators; no figures published |
| Discounts (coupons) | Implemented engine, **no coupon active** | [Coupons](../payments/COUPONS.md) |

## Payment processing

Wallet sign-in is Arbitrum One only; payment is not. DePay offers every
settlement chain the owner configures (EVM networks and Solana), each with an
approved USD stablecoin and receiver, and converts the payer's token where
DePay supports it. Amounts are server-calculated, the dynamic configuration is
signed by Openfund, DePay deliveries are verified by signature, and on-chain
verification on the payment's own chain is the only payment authority. See
[DePay](../payments/DEPAY.md) and [Verification](../payments/VERIFICATION.md).

## Security practices and risk management

- Security architecture and release gates: [docs/security/SECURITY.md](../security/SECURITY.md).
- Financial risk controls in code: idempotent provisioning, unique transaction
  use, finality depth, late-payment grace policy, review queue for under- and
  overpayments, append-only financial audit tables, immutable order pricing.
- Operational risk: a single API instance hosts the simulation loop (no
  horizontal scaling yet), RPC dependency for payment verification, manual
  payout processes.
- Market risk: no real-capital exposure until Live Market Access is approved
  and funded. Gains execution is disabled by default.

## Operational reporting

Transparency figures (`/economy/*`, the Transparency page) are computed from
operational records only. They show "Not configured" or "Unknown" instead of
estimates. See [Treasury and data sources](TREASURY.md) and
[Operations](../operations/README.md).

## Planned expansion

Desktop and mobile apps, rewards, operational Protocol routing and further
networks are proposals ([Roadmap](../../ROADMAP.md)). None is a current
capability. On-chain or token governance is **not** implemented. Governance is
off-chain ([GOVERNANCE.md](../../GOVERNANCE.md)).

## Pending business decisions (register)

| Decision | Owner |
| --- | --- |
| Real-capital trader/firm profit-sharing tiers | Company management |
| 20% customer referral discount (proposed, not active) | Company management |
| Payment chains, tokens, receiving addresses, DePay integration and keys | Company management (operator) |
| Repository license for first-party code ([Licensing](../legal/LICENSING.md)) | Owner |
| Treasury wallet, operational and risk reserves | Company management |
