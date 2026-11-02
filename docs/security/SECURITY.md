# Security architecture and release gates

The [root security policy](../../SECURITY.md) defines private vulnerability reporting. This repository is not a security audit or regulatory approval.

## Current controls

SIWE validates message domain, URI, time, chain, nonce and signature; atomic nonce consumption prevents replay races. Opaque session IDs are hashed at rest and use HttpOnly/SameSite cookies, Secure in production. Logout, expiry and suspension are backend-enforced. Product APIs derive wallet/account ownership from sessions; SSE revalidates access.

Prop simulated mutations use Decimal arithmetic, account locks, database transactions and owned idempotency. Missing execution marks fail closed. Journals validate scope and optimistic versions; metadata import cannot write financial records. CSV export escapes formula-like values. Directus public content permissions must not expose private user/session/trading tables.

## Operational limits

The current in-process rate limiter and engine imply one API instance. Do not claim distributed abuse protection or horizontally coordinated execution. Privileged CMS credentials and database secrets stay server-side; all VITE build variables are public. Keep `SIM_TEST_MODE` disabled in production and avoid sensitive data in logs/exports.

CI runs gitleaks and dependency advisory reports. Reported vulnerabilities require triage; report-only audit jobs do not establish a clean dependency set. Before a public release, complete deployed TLS/session/CMS access checks, backup/restore, retention/incident decisions, actual wallet/device acceptance and threat review. See [I2/I3 milestones](../roadmap/MILESTONES.md).

## Future execution

On-chain Gains execution and Protocol routing remain disabled/planned. Contract/network verification, transaction simulation, explicit wallet approval, revert/receipt recovery and settlement reconciliation must precede enablement. Never import a venue's source or advertise a regulatory/security certification as a substitute for acceptance evidence.
