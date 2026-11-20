# ADR 0047 — Perpetual Gains read-only readiness: adapter boundary, freshness and execution gate

- **Status:** Proposed (implemented on branch `agent/claude/gains-readiness`; review, release and owner acceptance pending)
- **Date:** 2026-11-20
- **Builds on:** [Product terminals](../architecture/PRODUCT_TERMINALS.md), [Gains integration](../integrations/GAINS.md), [Wallet identity](../wallet/IDENTITY.md).

## Context

Openfund Perpetual already showed wallet-scoped Gains records through
`apps/backend/gains-portfolio.js`, behind the shared SIWE session. A readiness
review on 2026-11-20 found these gaps:

- A malformed upstream field (for example a missing `collateralConfig` or a
  non-numeric amount) threw a `TypeError` or `DecimalError`. The client got a
  500, not an explicit provider error.
- `asOf` was the response time. A cached read up to 60 seconds old looked
  current. The response did not report upstream timestamps
  (`trading-variables.lastRefreshed`, `stats.updatedAt`).
- Timeouts and outages both returned `502 gains_read_failed`.
- An unset TP/SL (encoded as `0` upstream) was returned as the price `"0"`.
  Unknown trade types were counted as pending orders.
- Transaction links were built from unvalidated upstream strings.
- After a failed refresh, the UI kept the previous snapshot without marking it
  outdated. The Perpetual pages did not show the source, the network or the
  read-only state.

## Decision

1. **One read adapter per product, no shared mutable provider.**
   `gains-portfolio.js` is the only Perpetual account-read adapter. It never
   imports the Prop engine, ledger or database, and it never writes. Prop keeps
   its engine adapter. The terminal gives each product its own adapter object.
   Perpetual's adapter is constructed `readOnly: true, canTrade: false`.

   | Layer | Owner | Data |
   | --- | --- | --- |
   | Wallet identity | `useOpenfundSession` (SIWE), backend `/auth/*` | Wallet address and session cookie; Arbitrum One only |
   | Market data | `packages/openfund-gains-adapter`, `market-data.js` | Public Gains prices, candles and metadata |
   | Gains account reads | `apps/backend/gains-portfolio.js` | Open trades, trading variables, history and stats for the session wallet |
   | Normalisation | `gains-portfolio.js` (decode), `gainsView.ts` (presentation rules) | Fixed-point decode, freshness and provenance |
   | Presentation | `GainsPortfolio.tsx`, `Dashboard.tsx`, `TradingPages.tsx` | Read-only UI |
   | Simulation fixtures | `apps/backend/test/fixtures/gains-scenarios.mjs`, `e2e/test-perpetual-readiness.cjs` | Deterministic test data, never served in production |
   | Future execution | None | Not implemented. Gated below |

2. **Every snapshot carries provenance and freshness.** The response adds
   `network` (`42161`, Arbitrum One), `capabilities`
   (`readOnly: true, canTrade: false, execution: "disabled"`), `provenance`
   (one upstream source per field group) and `freshness`. `freshness` holds the
   oldest source fetch time, each source's fetch time, the upstream timestamps
   and a status:
   - `stale`: a cached read is older than 60 s, or an upstream timestamp is
     older than 5 minutes.
   - `inconsistent`: an upstream timestamp is more than 60 s in the future.
   - `fresh`: otherwise.
   A cache hit keeps its original fetch time.
3. **Fail closed on schema change.** Any decode failure returns
   `502 gains_schema_changed`. Transport failures return `502 gains_unavailable`
   or `502 gains_read_failed`, and timeouts return `504 gains_timeout`. Error
   messages are fixed codes and never contain the URL, which holds the wallet
   address.
4. **No manufactured values.** Unset TP/SL is `null`. Unknown trade types are a
   schema error. Malformed transaction hashes become `null` and are not linked.
   Balances, available collateral, liquidation price, fee-adjusted PnL,
   borrowing/funding and fills are never returned.
5. **The client never presents an old snapshot as current.** Feed states are
   `live`, `stale`, `inconsistent`, `outdated` (a snapshot kept after a failed
   refresh, shown with its fetch time), `unavailable`, `loading` and
   `signedout`.
6. **Live execution stays disabled.** No flag enables it in this release. A
   future proposal needs the approvals listed in
   [GAINS.md § Execution gate](../integrations/GAINS.md#execution-gate).

## Consequences

- The `/products/perpetual/gains` response is a superset of the previous
  response. Existing fields keep their names. `sl`/`tp` may now be `null`.
- The Perpetual `/context` capabilities add `readOnly`, `canTrade` and
  `network`. The Prop context response is unchanged (asserted in
  `test/products.test.mjs`).
- Rollback: revert the branch. No schema, migration, environment variable or
  dependency changed.
