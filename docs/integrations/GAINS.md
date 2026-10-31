# Gains Network — Planned Demo Trading Integration

## Goal

Allow users to interact with supported Gains testnet trading infrastructure through the Openfund-branded terminal, without requiring the Gains frontend.

## Intended flow

1. User opens Openfund terminal and connects a compatible wallet.
2. UI checks the selected chain, expected Arbitrum Sepolia configuration, and supported contract deployments.
3. UI reads supported instruments, pricing, trading parameters, and account/position state.
4. User submits a demo/testnet order through the appropriate contract integration.
5. UI tracks wallet signature, transaction submission, confirmation, execution state, and resulting position updates.
6. UI reconciles its display with authoritative chain and supported indexer/API state.

## Research and implementation gates

- Verify that the relevant Gains contracts are deployed and supported on the intended testnet.
- Identify exact contracts, ABIs, chain IDs, collateral/test-token flows, and supported pairs.
- Confirm whether demo account setup requires test tokens, faucet access, allowances, or separate registration.
- Identify APIs/indexers for positions, orders, trade history, leverage, fees, and live price updates.
- Document the gap between Gains' own frontend presentation and public data/API availability.
- Validate failure modes, rate limits, latency, and contract upgrade handling.

## Deliverables

Wallet/network validation; typed contract adapter; read-only account and market state; testnet order placement; position and order reconciliation; event/status UI; automated tests.

## Current status

**Planned / under technical investigation.** No verified working end-to-end Gains demo-trading integration is claimed here.
