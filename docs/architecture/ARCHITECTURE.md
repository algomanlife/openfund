# System architecture

## Baseline

`dist/` contains the current static website and terminal prototype. `src/` and root npm dependencies exist. **Do not migrate or delete the baseline without a dedicated PR.** `apps/` and `packages/` currently define future ownership boundaries only.

## Proposed layers

```text
Openfund web / account UI ──┐
                            ├── Openfund UI components
Openfund terminal UI ───────┤
                            ├── Openfund charts adapter ──> Vela (verify API/license)
                            └── Openfund Gains adapter ───> verified Gains data/contracts
                                                │
                                        wallet provider / testnet
```

## Module contracts

- `apps/web`: navigation, landing, account context and responsive shell.
- `apps/terminal`: chart panel, symbol selection, demo order-entry presentation and positions.
- `packages/openfund-ui`: reusable components and design tokens.
- `packages/openfund-charts`: normalize candles, symbols, chart lifecycle and optional overlays for Vela.
- `packages/openfund-gains-adapter`: isolate chain configuration, data APIs, ABI types, read-only state and gated testnet transactions.

## Data and state

Use explicit environment/network identifiers, decimal precision, timestamps and source metadata. Handle stale oracle data, disconnected wallets, RPC failures, pending/reverted transactions and chain mismatch. Avoid conflating oracle prices with trade-by-trade volume or order-book depth.

## Delivery milestones

1. Inventory current code and dependencies.
2. Create typed interfaces and fixtures for adapters.
3. Embed and verify chart rendering using deterministic sample data.
4. Add verified read-only market feeds and wallet state.
5. Add explicitly gated testnet interactions and reconciliation.
6. Add automated tests, CI, observability and release processes.

See integration specifications and roadmap for acceptance criteria.
