# Operating governance: decisions, approvals and access

[GOVERNANCE.md](../../GOVERNANCE.md) defines the Hybrid Governance framework:
the Community Council, OFP proposals and voting. That framework is implemented
in source, off-chain, and is not in production use. This page covers the
**operational** side of governance: who may decide and change what in the
running product, and how that is approved and recorded. It describes controls
that exist in the repository. It names no individuals.

## Decision authorities

| Domain | Decides | Recorded in |
| --- | --- | --- |
| Commercial, financial, treasury, pricing, commissions, coupons, refunds | Company management | [ECONOMY.md](../../ECONOMY.md) (approved policy); `financial_audit_log`, `coupon_audit`, `payment_adjustments` |
| Delegated non-financial domains (for example product priorities submitted as OFPs) | Community Council, within [delegated authority](../../GOVERNANCE.md#7-delegated-authority) | `gov_*` evidence tables (append-only) |
| Production configuration, secrets, deployments | Owner / company management | Render dashboard, GitHub `production` environment approval, release workflow logs |
| Source changes | Maintainers through reviewed pull requests | Git history, PR reviews, CI results |
| Partner approvals (Ambassador, Coach) | Named operators | `partner_application_events` |

## Approval process for changes

1. **Proposal.** Business policies change only by a management decision. The
   decision is written into ECONOMY.md as Approved. Proposals stay labelled
   Proposed and are not implemented as active.
2. **Implementation.** A pull request from a topic branch, with the PR
   template filled in (checked by CI), tests, documentation and Feature Status
   aligned ([Pull requests](../development/PULL_REQUESTS.md)).
3. **Review.** At least one reviewer approves. Required CI checks must pass.
   No force-pushes and no direct pushes to `main`.
4. **Release.** A reviewed batch is published by the Unified release workflow
   ([Releases](../deployment/RELEASES.md)).
5. **Deployment.** The `production` environment approval deploys the exact
   released commit, and `/version` is checked. A merge alone never deploys.
6. **Activation of money movement.** Purchases, payouts and live capital have
   separate activation checklists ([Payment activation](../payments/ACTIVATION.md))
   that require explicit owner approval.

## Administrative permissions and role-based access

| Principal | How authenticated | Can | Cannot |
| --- | --- | --- | --- |
| Anonymous visitor | none | Read public pages, plans, transparency data | Anything account-scoped |
| Wallet user | SIWE on Arbitrum One → HttpOnly session | Own accounts, orders, invoices, journals, applications | Other users' data. Every query is scoped by the session user |
| Brand Ambassador | Wallet user + approved `ambassador_profiles` | Own referral dashboard and ledger | Coach data. Approving payouts |
| Verified Coach | Wallet user + approved `coach_profiles` | Linked traders' eligibility progress | Traders' private journals. Ambassador data |
| Council member | Wallet user + active `gov_memberships` | Governance actions within delegated authority | Treasury and financial decisions |
| Operator (admin API) | `ADMIN_API_TOKEN` bearer + named `X-Admin-Actor` | User/challenge directory, withdrawal review, partner decisions, payment review, economy records, coupons | Bypass the append-only audit. Change order pricing (blocked by database triggers) |
| Directus administrator | Directus credentials | Editorial content, plan catalog | Market data, payments, sessions (not in Directus) |

The admin API is disabled (404) when `ADMIN_API_TOKEN` is unset, which was the
production state on 2026-11-10. The shared service token is coarse. Per-operator
credentials and scoped roles are a **pending decision** before scaling the
operations team. See [Roles and permissions](ROLES_AND_PERMISSIONS.md) for
governance roles.

## What is not active

- No token-based or on-chain governance exists. Votes are off-chain database
  records.
- The Council framework is merged in source and not yet in production use.
