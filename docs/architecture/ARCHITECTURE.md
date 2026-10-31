# Architecture — Current and Target

## Current repository

The current application is predominantly static HTML/CSS/JavaScript under `dist/`, with a wallet-related React source file in `src/wallet.jsx`. `package.json` includes React, RainbowKit, wagmi, viem, TanStack Query, and esbuild. There is no documented complete build script. The `dist/` directory is currently source-critical and must not be deleted or automatically ignored.

## Target logical components

```text
Openfund Website / Accounts / Trading Terminal
             |
       Shared UI and wallet
             |
   +---------+------------+
   |                      |
Trading Adapter       Market Data Adapter
   |                      |
Gains testnet         Price/candle sources
contracts             and streaming layer
   |                      |
Position/tx sync       Chart adapter (Vela evaluation)
   +---------+------------+
             |
     Backend services (planned)
```

## Architecture rules

- Keep contract addresses, chain IDs, and external endpoints configurable by environment.
- Do not embed secrets in frontend bundles.
- Distinguish confirmed on-chain state from optimistic UI state.
- Separate order submission from order/position reconciliation.
- Treat chart price feeds, trading oracle prices, and execution outcomes as distinct concepts.
- Maintain tests for network failures, wallet rejection, unsupported assets, and reorg/latency scenarios.

## Proposed future monorepo

`apps/web`, `apps/terminal`, `apps/api`, `packages/ui`, `packages/wallet`, `packages/gains-adapter`, `packages/chart-adapter`, `brand`, `docs`, `infra`. This is a design target, not an implemented structure.
