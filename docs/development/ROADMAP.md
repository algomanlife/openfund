# Openfund delivery roadmap

## Phase 0 — Repository foundation (current)

- Preserve baseline frontend and assets.
- Document architecture, brand inventory, integration contracts, agent workflow and feature status.
- Establish feature branches, PR reviews and changelog discipline.

## Phase 1 — Technical inventory and UI foundation

- Audit existing HTML/CSS/JS and npm dependencies.
- Verify Vela package exports, license and embed approach.
- Verify Gains official SDK/APIs and supported testnets.
- Establish shared design tokens and reproducible frontend checks.

## Phase 2 — Charting

- Implement Openfund chart adapter and sample-data fixtures.
- Embed chart in terminal, handle symbols, intervals, resize and errors.
- Validate supported volume/footprint features separately.

## Phase 3 — Read-only Gains connectivity

- Implement verified symbol, price and account/position reads.
- Add wallet connection, chain validation and stale-data handling.
- Document source timestamps, precision and failures.

## Phase 4 — Demo/testnet workflows

- Confirm supported testnet and verified contract deployments.
- Implement transaction preview, simulation, confirmation and reconciliation.
- Test rejection, revert, RPC failure and network mismatch.

## Phase 5 — Quality and release

- CI, tests, accessibility, performance, security review and deployment plan.
- Update docs and release notes after each accepted milestone.

**Gate:** Do not advance a phase based solely on directory creation or dependency installation.
