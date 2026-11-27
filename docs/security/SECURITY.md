# Security architecture and release gates

The [root security policy](../../SECURITY.md) defines private vulnerability reporting. This repository is not a security audit or regulatory approval.

## Assessments

The [November 2026 self-assessment](SECURITY-AUDIT-2026-11.md) and its [penetration test](PENETRATION-TEST-2026-11.md) list what was reviewed and tested, the findings and their status. Open items are in the [remediation plan](SECURITY-REMEDIATION-PLAN.md), and the commands that were run are in the [test matrix](SECURITY-TEST-MATRIX.md).

## Current controls

SIWE validates message domain, URI, time, chain, nonce and signature; atomic nonce consumption prevents replay races. Opaque session IDs are hashed at rest and use HttpOnly/SameSite cookies, Secure in production. Expired nonces and sessions are deleted by an hourly sweep. Logout, expiry and suspension are backend-enforced. Product APIs derive wallet/account ownership from sessions; SSE revalidates access.

Prop simulated mutations use Decimal arithmetic, account locks, database transactions and owned idempotency. Missing execution marks fail closed. Journals validate scope and optimistic versions; metadata import cannot write financial records. CSV export escapes formula-like values. Directus public content permissions must not expose private user/session/trading tables.

## Operational limits

Rate-limit counters are shared and persistent in PostgreSQL (`rate_limit_hits`, `apps/backend/rate-limit-store.js`): they survive restarts and hold across instances, with a per-process fallback during a database outage. The in-process simulated engine still implies one API instance (`numInstances: 1` and no autoscaling, both enforced by the Blueprint validator). Behind Cloudflare, limits and audit rows key on `CF-Connecting-IP`, trusted only from Cloudflare's published ranges. Do not claim distributed abuse protection or horizontally coordinated execution. Privileged CMS credentials and database secrets stay server-side; all VITE build variables are public. Keep `SIM_TEST_MODE` disabled in production and avoid sensitive data in logs/exports.

CI runs gitleaks and dependency advisory reports. Reported vulnerabilities require triage; report-only audit jobs do not establish a clean dependency set. Before a public release, complete deployed TLS/session/CMS access checks, backup/restore, retention/incident decisions, actual wallet/device acceptance and threat review. See [I2/I3 milestones](../roadmap/MILESTONES.md).

## Future execution

On-chain Gains execution and Protocol routing remain disabled/planned. Contract/network verification, transaction simulation, explicit wallet approval, revert/receipt recovery and settlement reconciliation must precede enablement. Never import a venue's source or advertise a regulatory/security certification as a substitute for acceptance evidence.
