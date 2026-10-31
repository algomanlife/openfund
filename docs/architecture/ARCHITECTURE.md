# System architecture

## Baseline

`dist/` contains the current static website and terminal prototype (served by the local static server). `src/` and root npm dependencies exist. **Do not migrate or delete the baseline without a dedicated PR.** `apps/` and `packages/` define ownership boundaries; since branch `qwen/frontend-polish-vela-gains` the chart and Gains adapters are **implemented** with their sources of truth under `packages/` mirrored verbatim into `dist/` for script-tag loading.

## Proposed layers

```text
Openfund web / account UI ──┐
                            ├── Openfund UI components
Openfund terminal UI ───────┤
                            ├── Openfund charts adapter ──> Vela (implemented: dist/vela-bridge.js)
                            └── Openfund Gains adapter ───> verified Gains market data (dist/gains-adapter.js; on-chain SDK still unused)
                                                │
                                        wallet provider / testnet
```

## Module contracts

- `apps/web`: navigation, landing, account context and responsive shell.
- `apps/terminal`: chart panel, symbol selection, demo order-entry presentation and positions.
- `packages/openfund-ui`: reusable components and design tokens.
- `packages/openfund-charts`: **implemented** — `src/vela-bridge.js` mounts the real Vela chart (global bundle), syncs theme/resize, exposes setSymbol/setTimeframe/setTheme/destroy; mirrored to `dist/vela-bridge.js`.
- `packages/openfund-gains-adapter`: **market data implemented** — `src/gains-adapter.js` wraps the verified public REST/WS API (markets, prices, candles, live stream) and provides the Vela `DataProvider`; mirrored to `dist/gains-adapter.js`. Chain configuration, ABIs and gated testnet transactions remain future work (`vendor/gains-sdk` untouched).

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

## Implemented data flow (terminal, 2026-10-31)

```text
Gains REST/WS (api.gains.trade, Arbitrum)
  → OpenfundGains adapter (dist/gains-adapter.js)   — markets, prices, candles, WS stream
  → PriceBoard (dist/terminal-data.js)              — live marks, staleness watchdog
  → Vela provider (gains:SYMBOL)                    — getBars / listSymbols / subscribe
  → Vela chart (dist/vela-bridge.js + vela.global.min.js)
  → Terminal UI (dist/terminal.js)                  — stats, order form, positions (demo engine)
```

Demo trading state is local only; prices are real Gains marks. Volume, OI, depth and trade tape are not provided by the API and are never fabricated.
