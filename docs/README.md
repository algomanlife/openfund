# Openfund documentation

Openfund is a trading technology startup building a connected Prop and Perpetual ecosystem. This index separates product intent, current implementation and future delivery. Start with the [Product Overview](product/OVERVIEW.md), [Feature Status](product/FEATURE_STATUS.md), [System Architecture](architecture/ARCHITECTURE.md) and [Roadmap](../ROADMAP.md).

## Canonical sources

Each kind of fact has one maintained home; every other page links to it
instead of repeating it. Historical reviews keep their original wording.

| Fact | Canonical source |
| --- | --- |
| Capability status (Completed / In Progress / Planned / Blocked) | [Feature Status](product/FEATURE_STATUS.md) |
| Milestones, dependencies and acceptance criteria | [Milestones](roadmap/MILESTONES.md) (phase summary: [ROADMAP.md](../ROADMAP.md)) |
| Deployed version and commit | `/version` on the running service and the [release runbook](deployment/RELEASES.md), never hand-edited docs |
| Render resources and image versions | [render.yaml](../render.yaml) ([Render runbook](deployment/RENDER.md)) |
| Environment variables | [Environment](deployment/ENVIRONMENT.md) (CI-checked against the Blueprint) |
| Upstream and vendored versions, patches | [Upstream registry](integrations/UPSTREAM_REGISTRY.md) |
| Licenses and notices | [Licensing report](legal/LICENSING.md), [Third-party notices](../THIRD_PARTY_NOTICES.md) |
| Release and rollback procedure | [Releases](deployment/RELEASES.md), [Rollback](deployment/ROLLBACK.md) |
| Frontend source versus generated output | [Engineering reference](development/ENGINEERING_REFERENCE.md#frontend-applications) |
| Agent and contributor rules | [AGENTS.md](../AGENTS.md), [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Architectural decisions | [ADRs](decisions/README.md) |

## Product and Business

[Overview](product/OVERVIEW.md) · [Vision](product/VISION.md) · [Mission](product/MISSION.md) · [Strategy](product/STRATEGY.md) · [Ecosystem](product/ECOSYSTEM.md) · [Capabilities](product/CAPABILITIES.md) · [Feature Status](product/FEATURE_STATUS.md)

## Architecture

[System](architecture/ARCHITECTURE.md) · [Flows](architecture/FLOWS.md) · [Technology Stack](architecture/TECH_STACK.md) · [Product API and Terminal Contracts](architecture/PRODUCT_TERMINALS.md) · [Simulation implementation](architecture/DEMO_TRADING.md)

## Website

[Content architecture and ownership](website/CONTENT_ARCHITECTURE.md) · [Product rules and launch blockers](product/PRODUCT_RULES.md) · [Website expansion spec](website/WEBSITE_EXPANSION.md) — FAQ hub, Tools Center, Learning Center, Growth Partner · [Official Whitepaper v1.0](website/WHITEPAPER.md) · [Expansion audit](research/WEBSITE_EXPANSION_AUDIT.md)

## Trading

[Unified accounts and Free Trial](trading/UNIFIED_ACCOUNTS.md) · [Journal metrics](trading/JOURNAL_METRICS.md) · [Prop Trading](trading/PROP.md) · [Perpetual Trading](trading/PERPETUAL.md) · [Shared Terminal](trading/TERMINAL.md) · [Indicators](trading/INDICATORS.md) · [Pine runtime](trading/PINE_SCRIPT.md) · [Custom indicators](trading/CUSTOM_INDICATORS.md) · [Portfolio and Journal](trading/PORTFOLIO_JOURNAL.md) · [Chart workspaces and position overlays](trading/CHART_WORKSPACES.md)

## Governance and Economy

[GOVERNANCE.md](../GOVERNANCE.md) · [ECONOMY.md](../ECONOMY.md) · [Operating governance: decisions, approvals and access](governance/OPERATING_GOVERNANCE.md) · [Governance documentation](governance/README.md) · [Roles and permissions](governance/ROLES_AND_PERMISSIONS.md) · [Whitepaper governance chapter](governance/WHITEPAPER_GOVERNANCE.md) · [ADR 0017](decisions/0017-hybrid-governance.md)

## Wallet and Identity

[Wallet, networks and sessions](wallet/IDENTITY.md) · [Authentication technical reference](architecture/WALLET_AUTHENTICATION.md)

## Economy and partner programs

[Economy overview](economy/README.md) · [Business model and operations overview](economy/BUSINESS_MODEL.md) · [Treasury and data sources](economy/TREASURY.md) · [Ambassador (IB): Ambassador and Coach](economy/PARTNER_PROGRAMS.md) · [Live Market Access](economy/LIVE_MARKET_ACCESS.md)

## Payments

[Payment verification and recovery](payments/VERIFICATION.md) · [Payment activation checklist](payments/ACTIVATION.md) · [DePay (multi-chain) and dashboard report](payments/DEPAY.md) · [DePay owner setup](payments/OWNER_SETUP.md) · [Coupons and zero-payment purchases](payments/COUPONS.md) · [Order lifecycle](payments/ORDER_LIFECYCLE.md)

## Protocol (dormant)

[Overview](protocol/OVERVIEW.md) · [Architecture](protocol/ARCHITECTURE.md) · [Development](protocol/DEVELOPMENT.md) · [Roadmap](roadmap/PROTOCOL.md). Source is integrated but not built, shipped or routed.

## Integrations

[Gains VOB and Trades](integrations/GAINS_DEPTH.md) · [Gains Network](integrations/GAINS.md) · [Upstream dependency registry](integrations/UPSTREAM_REGISTRY.md) · [Dependency governance](development/DEPENDENCY_GOVERNANCE.md) · [Upstream isolation and patch registry](integrations/UPSTREAM_DEPENDENCIES.md) · [Vela upgrade protection](integrations/VELA_UPGRADE.md) · [Gains upgrade protection](integrations/GAINS_UPGRADE.md) · [Vela](integrations/VELA.md) · [Markets](integrations/MARKETS_PAGE.md) · [Upstream provenance](integrations/UPSTREAM.md) · [Directus backstage](backstage/README.md) · [Content coverage](backstage/CONTENT_COVERAGE.md) · [Terminal editorial content](backstage/TERMINAL_CONTENT.md) · [CMS permissions](backstage/PERMISSIONS.md) · [Admin guide](backstage/ADMIN_GUIDE.md) · [Content model](backstage/CONTENT_MODEL.md) · [Translations](backstage/TRANSLATIONS.md) · [User management](backstage/USER_MANAGEMENT.md) · [Directus 12 assessment](backstage/DIRECTUS_12_ASSESSMENT.md) · [Backup and restore](backstage/BACKUP_RESTORE.md) · [Upstream update automation](integrations/UPSTREAM_AUTOMATION.md)

## Deployment

[Unified releases](deployment/RELEASES.md) · [Release and deployment checklists](deployment/CHECKLISTS.md) · [Operations and monitoring](operations/README.md) · [Render runbook](deployment/RENDER.md) · [Environment](deployment/ENVIRONMENT.md) · [Database](deployment/DATABASE.md) · [Rollback and recovery](deployment/ROLLBACK.md) · [Iran edge on Liara](deployment/LIARA_IRAN.md) · [Directus migration runbook](deployment/DIRECTUS_MIGRATION_RUNBOOK.md) · [Blueprint](../render.yaml)

## Development

[Local setup](development/LOCAL_DEVELOPMENT.md) · [Testing and CI](development/TESTING.md) · [CI workflows, tiers and timing](development/CI.md) · [Repository hygiene](development/REPOSITORY_HYGIENE.md) · [Pull requests and merge readiness](development/PULL_REQUESTS.md) · [Documentation maintenance](development/DOCUMENTATION.md) · [Directus local setup](backstage/LOCAL_SETUP.md) · [Contributing](../CONTRIBUTING.md) · [Agent instructions](../AGENTS.md) · [Repository governance](development/REPOSITORY_GOVERNANCE.md) · [Repository security settings](development/REPOSITORY_SECURITY.md) · [Code of conduct](../CODE_OF_CONDUCT.md) · [Support](../SUPPORT.md)

## Security

[Reporting policy](../SECURITY.md) · [Architecture and release gates](security/SECURITY.md)

## Legal

[Licensing audit and compatibility report](legal/LICENSING.md) · [Production dependency licenses](legal/DEPENDENCY_LICENSES.md) · [PineTS (AGPL) report](legal/PINETS.md) · [Third-party notices](../THIRD_PARTY_NOTICES.md)

## Roadmap

[Seven-phase overview](../ROADMAP.md) · [Product](roadmap/PRODUCT.md) · [Engineering](roadmap/ENGINEERING.md) · [Protocol](roadmap/PROTOCOL.md) · [Milestones and acceptance criteria](roadmap/MILESTONES.md)

## Architecture Decisions

[ADR index](decisions/README.md) · [Purchases, invoices and withdrawal requests](decisions/0009-challenge-purchases-and-payment-verification.md) · [Gateway routing](decisions/0001-product-gateway-routing.md) · [Shared terminal / isolated state](decisions/0002-shared-product-terminal.md) · [Valuation and product wallets](decisions/0003-trading-valuation-and-product-wallets.md) · [Documentation authority](decisions/0004-documentation-authority.md)

## Brand, evidence and historical material

[Brand assets](assets/brand/README.md) · [Screenshot gallery and provenance](assets/screenshots/README.md) · [Asset inventory](assets/README.md) · [Design system](design/DESIGN_SYSTEM.md) · [Repository metadata](development/GITHUB_METADATA.md) · [Reviews and audit index](reviews/README.md) · [Change log](../CHANGELOG.md)

## Historical records

Dated delivery reports, audits, migration snapshots, capacity results and
captures are kept for audit and rollback evidence; they describe the state at
their date, not current behavior. Start from the
[reviews and audit index](reviews/README.md). Earlier release audits (for
example the [2026-11-03 website audit](reviews/website-refresh/AUDIT.md)) are
listed there.
