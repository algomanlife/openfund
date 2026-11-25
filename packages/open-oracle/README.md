# Open Oracle

`@openfund/open-oracle` is Openfund's independent, read-only multi-source
reference-price research package. GAACP v1 combines eligible Gains Network,
Hyperliquid and GMX underlying observations using auditable quality-adjusted
weights. It is isolated from the terminal, execution, payments and production.

**In Progress:** implemented and fixture-tested locally. Remote CI passed real
REST/SSE, all three public inventories, nonempty reference observations and
provider-history reads. Complete economic equivalence mapping and empirical
calibration remain open; local network/socket restrictions are recorded separately. These are acceptance gates,
not completed features. See [validation](../../docs/research/OPEN_ORACLE_VALIDATION.md).

## Run independently

Requires Node 26 and npm. Install only this package:

```bash
npm ci --prefix packages/open-oracle
npm --prefix packages/open-oracle run typecheck
npm --prefix packages/open-oracle run lint
npm --prefix packages/open-oracle test
npm --prefix packages/open-oracle run test:socket
npm --prefix packages/open-oracle run benchmark
npm --prefix packages/open-oracle run calibrate
npm --prefix packages/open-oracle run validate:live
npm --prefix packages/open-oracle start
```

Run live validation with an explicit output directory and requested observation
window in milliseconds:

```bash
node packages/open-oracle/scripts/live.mjs /tmp/oracle-validation 60000
```

The API binds exclusively to `127.0.0.1:9091`. `start` accepts an optional JSON
configuration path with `pricing`, `equivalences`, `timeframes`,
`pollIntervalMs`, `evaluationIntervalMs`, `historyDirectory` and `port`.
No production environment variables, wallet signatures or credentials are used.
Public redistribution is disabled pending provider usage-term verification.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/decimal.ts`, `pricing.ts`, `types.ts` | Typed, deterministic 24-place integer decimal GAACP and quality metadata |
| `src/adapters.mjs`, `transport.mjs` | Read-only discovery, bounded polling, histories, timeouts and rate-limit recovery |
| `src/registry.mjs` | Full discovered inventory, explicit equivalence evidence, quote conversion |
| `src/engine.mjs` | Event/receipt-time eligibility, rolling reliability, causal replay and backfill |
| `src/candles.mjs` | All requested UTC timeframes, gaps, finalization and explicit corrections |
| `src/history.mjs` | Segmented append-only hash-linked audit history and integrity checks |
| `src/server.mjs` | Local read-only REST and backpressure-bounded SSE subscriptions |
| `tests/`, `fixtures/` | Deterministic contract, integration, property, replay and resilience evidence |
| `benchmarks/` | Actual measured local synthetic results and explicit failed live access evidence |

## Important data boundaries

Every discovered instrument stays visible. Unverified identities stay separate;
a matching ticker never establishes economic equivalence. Builder perps and
spot instruments without proven reference semantics remain ambiguous.
Receipt-only timestamps are explicit and default-ineligible. Historical provider
OHLC remains `PROVIDER_REFERENCE`, never native Open Oracle candles. No market
microstructure or volume is fabricated from oracle prices.

[Integration contract](../../docs/integrations/OPEN_ORACLE.md) ·
[Architecture](../../docs/architecture/OPEN_ORACLE_ARCHITECTURE.md) ·
[Mathematics](../../docs/research/OPEN_ORACLE_METHODOLOGY.md) ·
[Coverage](../../docs/research/OPEN_ORACLE_MARKET_COVERAGE.md).

## Attribution and rights

Original implementation belongs to the Openfund project subject to its existing
unresolved first-party licensing policy; no new license is granted by this
package. Provider data belongs to its respective rights holders. No provider SDK
is copied or required. TypeScript is a development-only Apache-2.0 dependency.
See [repository notices](../../THIRD_PARTY_NOTICES.md). Provider publication and
redistribution permissions have not been established.
