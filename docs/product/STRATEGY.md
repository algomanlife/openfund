# Product and technology strategy

## Product thesis

A common trading workspace becomes more valuable when market discovery, execution context and performance review agree about the account being used. Openfund develops that foundation first, then expands execution capabilities behind explicit validation gates.

## Product sequence

| Priority | Investment | Reason | Delivery gate |
| --- | --- | --- | --- |
| 1 | Reliable market and account foundations | Stale prices and ambiguous balances undermine every downstream workflow | Freshness, precision, ownership and retry checks |
| 2 | Prop practice and review | Provides a bounded environment for execution discipline and persistent performance analysis | Reconciled simulated ledger, fees, margin and risk telemetry |
| 3 | Perpetual read experience | Gives wallet users useful account context before live transactions | Correct Arbitrum records, provenance, errors and account isolation |
| 4 | Complete product experience | Connects challenge discovery, identity, portfolio and journal | Real wallet verification, accessible UI and validated commercial facts |
| 5 | Advanced execution and analytics | Expands workflows only after the account model is dependable | Approved transaction model, simulation, failure recovery and reconciliation |
| 6 | Protocol and ecosystem services | Extends execution-path choice across venues | Separate protocol scope, adapter validation, security and operational readiness |

## Differentiation

Openfund's intended differentiation is workflow coherence: a shared charting workspace, explicit product context, source-aware metrics and a private decision journal. The repository already implements portions of this approach. This is a product direction, not a comparative claim of better returns, lower fees or superior execution.

Prop simulation and Gains wallet records use separate authorities. A shared design language does not imply common collateral, a common risk engine or transferable balances. The planned protocol must preserve those distinctions.

## Technology choices

React and TypeScript own routes, wallet/session state and product views. Existing Vela and script-based adapters remain integrated rather than being replaced. Node.js, Decimal arithmetic and PostgreSQL own simulated financial mutations. SSE supplies Prop state updates; polling refreshes account analytics and Gains reads. Directus supplies published editorial content and catalog administration, with no public financial write authority.

Render uses one API/web process, one PostgreSQL 17 database and one Directus 11.9.1 service. Horizontal engine scaling requires a coordination design first. Per-app lockfiles keep installation boundaries reproducible; the root package coordinates development and validation.

## Business development boundaries

Challenge pricing and terms in the catalog are configuration and editorial material. Paid activation, evaluation enforcement, funded accounts, payouts and legal eligibility require separate product approval and implementation. No revenue model, pricing guarantee, investor, partner or adoption metric is implied by their presence in the UI.

Near-term work should improve correctness, wallet evidence, observability, accessibility and deployment readiness before expanding commercial claims. Longer-term objectives include advanced analytics, execution improvements, venue adapters and developer services. [Milestones](../roadmap/MILESTONES.md) record their dependencies and acceptance criteria.
