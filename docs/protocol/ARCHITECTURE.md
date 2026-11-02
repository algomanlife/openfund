# Openfund Protocol — Architecture

This document describes the **imported contract architecture** (what exists in
`packages/openfund-protocol/contracts/` today) and the boundary where future
Openfund-specific components will attach.

## Imported foundation (exists today)

### Margin-trading core — `contracts/core/`

| Contract | Role |
| :--- | :--- |
| `LiquidityPool` (+ `LiquidityPoolHop1/2`) | the pool facade — deposits, withdrawals, collateral accounting, trading entry points. Split into "hop" contracts to work around EVM contract-size limits (a common upgradable-pool pattern) |
| `Storage` / `Types` / `Events` | shared state layout, asset/position structs, emitted events |
| `Liquidity` | liquidity accounting (asset weights, utilization, funding) |
| `Trade` | position lifecycle — open, close, liquidation, fee/PnL math |
| `Account` | trader balance & position bookkeeping |
| `Admin` / `Getter` | parameter management and read-only views |

Traders place **position orders through the OrderBook**; a broker decides when
to fill them based on oracle data. The design separates price discovery
(external oracles + broker) from settlement (pool).

### Order book — `contracts/orderbook/`

`OrderBook` + `Storage/Types/Admin`: order placement, cancellation, expiry and
fill callbacks against the liquidity pool.

### Liquidity management — `contracts/liquidity/`

`LiquidityManager`, `AssetManager`, `DexWrapper`, `ExtensionProxy` and
`plugins/`: move provider assets between venues (DEX farming, bridges) when
pool utilization is low, and recall them when trading needs them.

### Governance — `contracts/governance/`

- `MuxTimelock` — delayed transaction executor controlling key parameters of
  the pool and order book, with a fast lane for limited emergency operations
- `POL` / `Vault` — protocol-owned-liquidity and treasury flows

### Supporting modules

`tokens/` (protocol assets, debt/muxToken semantics), `reader/` (gas-efficient
state reads for clients), `referral/`, `components/`, `interfaces/`,
`libraries/`, `thirdparty/` (upstream vendored dependencies).

### Upgrades & records

Deployment scripts live in `scripts/` (deployer with link-reference handling);
`deployments/` keeps the historical on-chain address records of the imported
base; `audit/` holds its third-party audit report.

## Future Openfund components (design target, NOT implemented)

```text
                       ┌──────────────────────────┐
   trader intents ────▶│  Openfund Router (future) │
                       └─────┬────────┬───────┬───┘
                             ▼        ▼       ▼
                    Gains adapter  Hyperliquid  dYdX
                    (future)       adapter      adapter
                             (future)     (future)
                             ▼        ▼       ▼
                       aggregated liquidity & execution paths
```

- **Venue adapters** — per-venue quoting/execution interfaces (Gains Network
  first, aligned with the existing Openfund Gains market-data integration).
- **Liquidity aggregation** — a unified view of available depth across venues.
- **Intelligent routing** — execution-path selection considering price, depth,
  fees, settlement latency and risk.
- **Settlement anchoring** — where on-chain settlement is required, the imported
  pool/order-book foundation provides the contract skeleton.

Each of these is a separately scoped, separately authorized project; nothing
above exists in code today beyond this documentation.
