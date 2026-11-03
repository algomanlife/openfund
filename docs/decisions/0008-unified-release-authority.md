# ADR 0008: main-only unified release authority

Status: accepted for implementation; first official release and deployment acceptance remain pending evidence.

## Decision

Use one SemVer for the deployable Openfund application. Main merges validate the integrated candidate. An explicit reviewed batch dispatch triggers the full release gate and immutable publication. Feature builds remain candidates. Keep the existing React/API/PostgreSQL/Directus architecture and the disabled Perpetual execution boundary.

The manifest binds frontend content, backend sources, schema hash and verification stages to one SHA. Render rebuilds the published SHA and rejects mismatching hashes. Production uses a required-reviewer environment and exact commit deployment with live version checks. Direct commit auto-deploy is disabled in the Blueprint; live service reconciliation remains necessary.

## Consequences

Releases cannot be certified from private worktrees or screenshots. External production setup can block deployment without blocking a verified package. Tests use disposable wallets and an isolated local database. Rollback selects an existing official tag and requires schema compatibility and retained backups. No migration reset or data deletion is automated.

[Release architecture and operations](../deployment/RELEASES.md) · [Integration recovery report](../reviews/final-integration/DELIVERY.md)
