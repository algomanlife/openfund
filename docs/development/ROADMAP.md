# Openfund Development Roadmap

This roadmap distinguishes existing assets from future deliverables. Checkboxes are evidence-based, not promises of completion.

## Phase 0 — Repository foundation

- [x] Initial website and terminal frontend files exist.
- [x] Local Git history and private GitHub repository established.
- [x] Existing brandbook ZIP included in repository.
- [x] Initial brand assets and design notes included.
- [ ] Verify brand asset licenses and review brandbook contents.
- [ ] Capture and review real UI screenshots for README.
- [ ] Add automated checks and a reproducible build process.

## Phase 1 — Product and frontend quality

- [ ] Audit website, accounts UI, terminal, and wallet source.
- [ ] Establish component/design-token conventions.
- [ ] Verify responsive layouts and accessibility.
- [ ] Consolidate localization and frontend routing.
- [ ] Add automated frontend smoke tests.

## Phase 2 — Wallet and Gains testnet feasibility

- [ ] Verify official supported networks, contracts, ABIs, and API capabilities.
- [ ] Validate wallet connect/disconnect and network switching.
- [ ] Establish test collateral/account lifecycle.
- [ ] Read positions and order state from authoritative sources.
- [ ] Execute and reconcile an end-to-end testnet demo order.
- [ ] Document fees, risk parameters, limitations, and failure cases.

## Phase 3 — Market data and Vela

- [ ] Review Vela license, architecture, and open-source capabilities.
- [ ] Decide fork vs dependency vs isolated integration.
- [ ] Map Gains instruments to chart symbols.
- [ ] Implement candle history and real-time updates where available.
- [ ] Validate chart price consistency and data latency.
- [ ] Assess feasibility of footprint and depth independently of candle data.

## Phase 4 — Backend and operational maturity

- [ ] Define APIs and data persistence requirements.
- [ ] Add integration tests and CI/CD.
- [ ] Set up environment configuration, secrets management, and monitoring.
- [ ] Prepare staging and production release process.
- [ ] Perform security, licensing, and product-readiness reviews.

## Acceptance criteria for next milestone

A new contributor can clone the repository, preview both current frontend pages, find the brand assets, understand the planned integrations, and distinguish implemented behavior from roadmap items.
