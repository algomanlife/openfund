# Render deployment architecture

The canonical deployment specification and operating runbook is [Deployment on Render](../deployment/RENDER.md). Environment configuration lives in [Environment](../deployment/ENVIRONMENT.md), persistence in [Database](../deployment/DATABASE.md), and recovery in [Rollback](../deployment/ROLLBACK.md).

The current [Blueprint](../../render.yaml) defines exactly three resources: `openfund` (Node API and React at `/react/`), `openfund-db` (PostgreSQL 17), and `openfund-cms` (Directus 11.9.1). Earlier single-service optional deployment descriptions are superseded by PRs #23/#24. Configuration is implemented; actual apply and deployed HTTPS acceptance require runtime evidence.

[Deployment diagram](FLOWS.md#deployment) · [ADR index](../decisions/README.md)
