# ADR 0006: Unified account directory and irreversible trial stop

Date: 2026-11-02. Status: accepted within the simulated execution boundary.

## Context

The account UI was split by product, trial risk had only position maintenance liquidation, and Book/Trades were hidden by a shared-workspace override. New work must preserve product execution isolation and the three-resource deployment.

## Decision

Reuse the existing engine, portfolio, journal tables and shared terminal. Add an owned directory over trial/challenge/wallet identities, account-aware navigation and journal preferences. Fund new trials once in virtual USD; preserve older DAI ledger provenance.

The user explicitly set permanent trial termination at full-precision equity at or below zero, independently of the existing position maintenance policy. Use PostgreSQL account locks, transactional settlement/cancellation, persisted audit events and an irreversible database state guard. No Challenge rules apply to a trial. Disabled trials remain readable and cannot receive metadata changes.

Use the newly verified public Gains VOB and executed-trade resources. Display their actual semantics; never replace failed feeds with generated liquidity. Preserve Vela and all proprietary source algorithms.

## Consequences

No new service, database, worker or execution engine. Scope is carried in routes but validated by the backend. Challenge execution and Perpetual on-chain execution remain unavailable. Missing FX/lot specifications fail closed. Live deployment and physical-wallet acceptance remain separate external verification gates.
