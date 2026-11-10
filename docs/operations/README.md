# Operations: monitoring, reporting and incident handling

This page lists what exists today for running Openfund in production and
names the gaps. It does not claim alerting or monitoring that is not
configured.

## Health and version

| Signal | Where | Notes |
| --- | --- | --- |
| Liveness | `GET /health` | Render health check (`render.yaml`) |
| Running build identity | `GET /version` | Backend and frontend version and commit must match (`status: matched`). This is the deployment authority ([Releases](../deployment/RELEASES.md#version-authority-hierarchy)) |
| Payments readiness | `GET /purchases/plans` → `paymentsEnabled` | `false` until the payment configuration is complete |
| Logs | Render service logs (`render logs`) | Errors are logged without secrets. Payment attempts and DePay deliveries are stored in the database, not only in logs |

## Payment operations

| Queue / record | Query or route | Action |
| --- | --- | --- |
| Payments needing review (underpayment, wrong token/receiver, late, duplicate, overpayment) | `GET /admin/payments/attempts?review=open` ([Verification](../payments/VERIFICATION.md)) | Re-verify, reconcile, or record a refund |
| Stuck retryable attempts | `payment_attempts WHERE status='pending' AND retryable` | The recovery sweep retries every `PAYMENT_RECOVERY_INTERVAL_MS`. An attempt stuck past 24 hours needs an operator |
| DePay deliveries | `depay_events` (append-only) | Correlate a transaction hash, order and outcome |
| Order history | `purchase_order_events` | Full state history per order |
| Coupon activity | `GET /admin/coupons/:id/redemptions`, `/orders`, `/audit` | Investigate abuse; disable a coupon |

## Reporting

Transparency and revenue figures come only from operational tables (orders,
payments, adjustments, commissions, expenses, treasury snapshots). There is no
external BI or accounting integration. Accounting treatment is subject to
accountant confirmation ([ECONOMY.md](../../ECONOMY.md#revenue)).

## Alerts (gap)

No automated alerting is configured in the repository or on Render. Before
enabling payments, the owner should configure at least:

- Render notifications for failed deploys and health-check failures;
- an uptime monitor on `/health` and `/version` for both production hosts;
- a daily check that no `payment_attempts` row is pending and retryable for
  more than one hour, and that the review queue is empty or acknowledged.

## Incidents and rollback

Follow [Rollback and recovery](../deployment/ROLLBACK.md) and
[Database](../deployment/DATABASE.md) (backups). Payment incidents: unsetting
`PURCHASE_PAYMENT_RECEIVER` stops new paid orders. It also stops verification
of payments already in flight, because the verifier needs the configured
receiver. Note open attempts first, then re-verify them once the
configuration is restored. Records are never deleted.
