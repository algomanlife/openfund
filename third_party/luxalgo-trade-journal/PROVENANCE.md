# Vendored source — LuxAlgo Trade Journal (journal-core)

- **Upstream repository:** https://github.com/LuxAlgo/trade-journal
- **Vendored commit SHA:** `834e7b68f553d1aba0d7777875cdc4622f5a7eb5`
- **License:** MIT (see LICENSE) — © 2026 LuxAlgo Global, LLC
- **Scope:** `packages/core` only (`@luxalgo/journal-core`) — the dependency-free
  analytics library (round-trips, metrics, equity/drawdown, daily & calendar
  aggregation, trade analysis). The upstream `apps/web` (Next.js app) and
  `packages/importers` (broker/CSV importers) are intentionally NOT vendored:
  Openfund has its own React frontend and its own authoritative trading engine —
  external imports are explicitly out of scope for the Openfund Portfolio.
- **Local modifications:** none to the TypeScript sources; a compiled ESM bundle
  (`dist/index.js`, built with esbuild from these sources) is committed so the
  Node backend can import it without a TypeScript loader. Rebuild:
  `node third_party/luxalgo-trade-journal/build.mjs`.
- **Reproducibility:** the sources in `packages-core/src/` are byte-identical to
  the upstream commit above; the build script contains the full esbuild command.
