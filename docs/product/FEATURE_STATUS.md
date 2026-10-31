# Feature status — source of truth

Use these statuses: **Implemented** (working and tested), **Prototype** (visible but not end-to-end validated), **Planned** (not built), **Blocked** (external dependency), **Unverified** (requires inspection).

| Capability | Status | Evidence / next step |
| --- | --- | --- |
| Landing/account static frontend | Prototype | `dist/index.html`; review behavior |
| Terminal UI | Prototype | `dist/terminal.html`; review behavior |
| Brand assets and brandbook | Unverified | Audit `brand/` and archive rights/content |
| Vela npm dependency | Unverified | Inspect `package.json` and lockfile |
| Embedded functional Vela chart | Planned | Integrate and demonstrate rendered chart |
| Gains SDK dependency | Unverified | Verify official package and APIs |
| Gains market data adapter | Planned | Verify official endpoints, types and polling/streaming |
| Arbitrum Sepolia demo contract integration | Blocked | Verify supported contracts, addresses, ABI and testnet availability |
| Wallet state and chain switching | Planned | Validate wallet library and UI |
| Positions/order lifecycle | Planned | Specify read/write lifecycle and reconciliation |
| True order-book / footprint | Blocked | Confirm legitimate trade/volume/depth data source |
| Backend, CI and production deployment | Planned | Define deployment architecture and test gates |

Agents must update this table when verified work changes the status.
