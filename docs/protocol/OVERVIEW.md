# Openfund Protocol — Overview

> **Openfund Protocol is designed to aggregate liquidity across Gains Network,
> Hyperliquid, and dYdX, enabling intelligent trade routing and improved
> execution-path selection. (Available in the final release.)**

## What exists today

`packages/openfund-protocol/` holds the complete **imported technical
foundation** (source revision and scope in
[`PROVENANCE.md`](../../packages/openfund-protocol/PROVENANCE.md)):

- a margin-trading protocol core — liquidity pools, an order book, trader
  positions, funding and collateral accounting;
- governance machinery (timelock-controlled parameter management);
- tokens, readers and the full Hardhat/Waffle test suite;
- deployment tooling and historical deployment records.

These are engineering foundations: audited, tested contract architecture that
Openfund product work can build on.

## What is planned (not yet implemented)

The Openfund-specific capabilities — **venue adapters for Gains Network,
Hyperliquid and dYdX, cross-venue liquidity aggregation and intelligent trade
routing** — are future work, documented as architecture in
[`ARCHITECTURE.md`](./ARCHITECTURE.md). They are
not implemented in this repository today and are not represented as such
anywhere in the product.

## Strict isolation (why nothing "runs")

The module is **dormant by design**:

- not referenced by the React app, the backend, the trading engine, the CMS or
  any service in `render.yaml`;
- installs its own dependencies inside `packages/openfund-protocol/` — nothing
  leaks into the application dependency trees;
- not compiled, tested or deployed by Openfund CI or the Render blueprint;
- no contract deployment, no chain interaction, no background jobs.

Activating any part of it is a **separately authorized integration project**,
not a configuration switch.
