# ADR 0040 — Backstage operations boundary

Status: Accepted for the first local integration stage.

The independent Backstage web service serves one provisioned owner. It uses
same-origin session cookies and a narrow server-side adapter for authoritative
Openfund routes. It stores no business data and shares no trader wallet
session. Operator login uses an externally provisioned password verifier.
Privileged decisions require the password again and are recorded by the
existing backend. Credentials are held on the servers.

Render hosts the separately configured service with manual deployment.
The service uses one instance for expiring, revocable in-memory sessions.
Directus remains the separate editorial surface. The initial deployment
targets the GLOBAL backend. Cross-region operation routing and durable
multi-instance authentication require future review.

See the [architecture review](../backstage/OPERATIONS_ARCHITECTURE.md) and
the [operator guide](../backstage/OPERATIONS_GUIDE.md).
