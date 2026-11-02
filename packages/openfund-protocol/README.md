# Openfund Protocol

**Openfund Protocol is designed to aggregate liquidity across Gains Network, Hyperliquid, and dYdX, enabling intelligent trade routing and improved execution-path selection. (Available in the final release.)**

This package is the smart-contract foundation for that product. It contains the
complete imported technical base — margin-trading core (liquidity pools, order
book, trading), governance, tokens, readers and the full test suite — kept as a
**dormant, independently organized module** inside the Openfund monorepo.

> **Status: source integration only.** Nothing in this package is wired into the
> Openfund application, backend, deployment or runtime. See
> [`PROVENANCE.md`](./PROVENANCE.md) for the exact upstream revision and
> [`docs/protocol/DEVELOPMENT.md`](../../docs/protocol/DEVELOPMENT.md) for how it
> will be worked on and (eventually, under separate authorization) integrated.

## What is inside

| Path | Content |
| :--- | :--- |
| `contracts/` | Solidity sources — `core/` (liquidity, trade, funding, types, events), `components/`, `liquidity/`, `orderbook/`, `governance/`, `tokens/`, `interfaces/`, `libraries/`, `reader/`, `referral/`, `thirdparty/` |
| `test/` | The upstream Hardhat/Waffle test suite |
| `scripts/` | Deployment tooling (deployer, test-network scripts) — reference only, never run by Openfund CI |
| `deployments/` | Historical on-chain deployment records (public addresses) |
| `audit/` | Third-party audit report of the imported base |
| `hardhat.config.ts`, `tsconfig.json`, `package.json` | Isolated build configuration and dependencies |

## Building and testing (module-local, optional)

The module is fully self-contained — it installs its own dependencies and does
not participate in the Openfund application build:

```bash
cd packages/openfund-protocol
npm install
npx hardhat compile   # compile contracts
npx hardhat test      # run the test suite
```

These steps are **never** required to build, deploy or run Openfund itself.

## License

GPL-2.0 (upstream license, retained unmodified — see [`LICENSE`](./LICENSE)).
Imported under revision `0f70a70`; contract identifiers, interfaces and
build-relevant names are preserved for compatibility and reproducibility.
