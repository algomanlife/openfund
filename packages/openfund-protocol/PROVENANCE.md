# Provenance — Openfund Protocol source

- **Upstream repository:** https://github.com/mux-world/mux-protocol
- **Exact revision imported:** `0f70a70b9b3410c2ae7209900e5d2521635249d1`
  (`feat: a better protection to asset price`, 2025-07-14)
- **Imported into Openfund:** 2026-11-02 (branch `feat/openfund-protocol-foundation`)
- **Imported content:** smart contracts (`contracts/`), Hardhat build configuration
  (`hardhat.config.ts`, `tsconfig.json`, `package.json`), deployment tooling
  (`scripts/`), test suite (`test/`), historical deployment records
  (`deployments/` — public on-chain addresses only), audit reports (`audit/`),
  upstream overview (`docs/`, `misc/`, `.prettierrc`)
- **Excluded:** upstream `.git` history, editor settings, dependency caches and
  build artifacts
- **License:** upstream is GPL-2.0 (`LICENSE`) — retained unmodified. Openfund
  uses this code under the GPL-2.0 terms; contract identifiers, interfaces and
  build-relevant names are preserved for compatibility and reproducibility.
- **Rebranding:** product-facing documentation and package metadata were renamed
  to **Openfund Protocol** (see README and `docs/protocol/`); no blind global
  replacement was performed and no contract/API identifier was altered.

This module is a **dormant, isolated foundation**: it is not part of the
Openfund application build, deploy or runtime (see `docs/protocol/DEVELOPMENT.md`).

## Known upstream defect (verified at import)

The imported HEAD revision does **not compile** with its own pinned toolchain
(solc 0.8.10, optimizer on, runs 200): `contracts/orderbook/OrderBook.sol:417`
fails with `Stack too deep` — a regression introduced by the final upstream
commit (`0f70a70`, +54 lines in OrderBook; the repository has no CI). This was
verified with the pristine upstream `hardhat.config.ts`:

- HEAD (`0f70a70`) → `CompilerError: Stack too deep` (also under `viaIR`,
  which hits a separate solc 0.8.10 Yul bug)
- parent revision (`37b34d1`) → `npx hardhat compile` **succeeds** with the
  same config (full artifact set generated) — proving the imported foundation
  and toolchain are sound and the failure is upstream's final commit

The source is imported **unmodified** at HEAD. Fixing the upstream compile
regression is deliberately left to a protocol-engineering change (documented in
`docs/protocol/DEVELOPMENT.md`) rather than silently patched here.
