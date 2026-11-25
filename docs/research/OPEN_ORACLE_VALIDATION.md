# Open Oracle implementation and validation

## Result and scope

**In Progress.** The standalone implementation exists on
`feat/open-oracle-protocol`, based on inspected main
`8b9e4b7ba1b7d0dc57005148307e64f33578e265`. Deterministic protocol tests and
TypeScript compilation pass locally. Local network access and TCP listeners are blocked, but remote CI independently
passed the real socket test and public inventory, reference-price and historical
reads for all three providers. Complete cross-source economic mapping,
representative-category calibration and production readiness are not established. No integration, merge or deployment was performed.

The originally supplied workspace path was absent. A new isolated temporary
checkout was reconstructed from exact GitHub main tree/commit objects and
matching local blob objects. Unavailable unrelated files were excluded rather
than overwritten. This permits exact-base scoped development, but prevents a
claim of full application-regression acceptance in this checkout.

## Executed checks

| Check | Actual result |
| --- | --- |
| Package install | Successful offline `npm ci` using the exact existing TypeScript 6.0.3 archive and integrity-pinned package lock |
| TypeScript | `npm --prefix packages/open-oracle run typecheck` passed |
| Syntax / whitespace / import isolation | Package lint passed |
| Deterministic tests | 55 passed, zero failed; includes 1,000 seeded property iterations |
| Socket integration | Local `EPERM`; remote implementation CI passed the actual REST/SSE integration test |
| Public Gains discovery/prices/history | Remote success: 496 inventory entries; 3,397 price observations; 10 provider-reference bars |
| Public Hyperliquid discovery/prices/history | Remote success: 927 entries across default/builder/spot inventories; 5,139 oracle observations; 11 provider-reference bars |
| Public GMX discovery/prices/history | Remote success after envelope fix: 305 market/token entries; 2,592 reference observations; 3 provider-reference bars |
| Local sensitivity experiment | Four synthetic scenarios; base/equal/median/freshness/robust and every leave-one-out result recorded |
| Performance | Actual local synthetic measurements; see linked benchmark, not production-capacity evidence |
| Runtime dependency audit | Zero runtime npm dependencies; omit-dev audit reported zero vulnerabilities |
| README generator and structure gate | Passed: 18 sections, 165 images, 7 badges, 339 links; generated blocks and graphics in sync |
| Status validation | Nine tests passed; canonical status check passed |
| Render Blueprint | Passed; existing service graph preserved |
| Required docs / dependency registry / licence inventory | Passed individually |
| English documentation/source language gate | Passed individually |
| YAML parsing | Both modified/new workflows parsed successfully |
| Repository-wide link check | Blocked by an unrelated unavailable cached font-notice target; new protocol and README links resolved |
| Full docs check | Local partial checkout blocked; remote Web CI passed all documentation gates on implementation commit `15c0b1c` |
| Full application regression/build | Remote Web (React + Vite) passed on `15c0b1c`; backend/browser/CMS jobs were still running when recorded |
| Full package vulnerability audit | Remote isolated CI passed with zero vulnerabilities; local audit network remains blocked |

[Test output](../../packages/open-oracle/benchmarks/tests.txt) ·
[Benchmark JSON](../../packages/open-oracle/benchmarks/results.json) ·
[Benchmark table](../../packages/open-oracle/benchmarks/results.md) ·
[Sensitivity evidence](../../packages/open-oracle/benchmarks/calibration.md) ·
[Actual live attempt](../../packages/open-oracle/benchmarks/live-validation.json) ·
[Coverage](OPEN_ORACLE_MARKET_COVERAGE.md).

## Mathematical and resilience evidence

Tests cover all eight provider-availability subsets; exact single/equal-price
identity; sum of decimal normalized weights equal to one; bounded composite
prices; explicit zero-weight failure; freshness decay; alignment; invalid prices
and impossible timestamps; missing references; dual disputes; evidence-gated
outlier exclusion; shared upstream concentration; quote depeg conversion;
source disappearance/recovery; closed/reopened sessions; out-of-order receipt;
duplicate handling; bounded queues; causal replay; durable history reopen,
classification and tamper detection; native OHLC, finalization, gaps and explicit
corrections; bounded-memory streams; classified rate limits and transport errors;
poll reconnection; and in-process API/SSE semantics and cleanup.

The actual TCP/socket test is separate from in-process route tests. Required
remote CI passes both. Live validation is a separate PR/manual workflow,
preserving failed and successful aggregate collection evidence.

## Requirement traceability

| Original section | Implementation/evidence | Outstanding acceptance |
| --- | --- | --- |
| 1 Objective | Independent GAACP, registry, candles and history | Full live acceptance |
| 2 Isolation | Package-only runtime; no application imports or production writes | None within phase scope |
| 3 Inspection | Exact main; existing Gains, footprint, decimal and docs contracts inspected | Full checkout/regression access |
| 4 Universe | Union discovery, builder/spot catalogs and explicit ambiguous entries | Real complete current inventory |
| 5 Selection | Every 0/1/2/3-source subset tested | Live source-combination evidence |
| 6 Adapters | Three read-only HTTP adapters; successful live inventory, reference observations and provider history | Broader representative-category, timestamp/session and reconnect conformance |
| 7 Registry | Evidence-bearing identity, quote/unit separation and conversion utility | Reviewed comprehensive economic-equivalence corpus |
| 8 Mathematics | Typed deterministic GAACP v1 and property tests | Empirical instrument/source calibration |
| 9 Confidence | Versioned source factors, rolling reliability and explicit states | Statistical calibration is not claimed |
| 10 Event time | As-of receipt/event filtering, bounds, ordering and watermark | Real source clock/update-frequency measurements |
| 11 Candles | All requested UTC intervals, finalization, gaps and corrections | Verified provider-specific holiday/session calendars |
| 12 Microstructure | Source-specific metadata retained without volume fabrication | Broader provider fields only where available |
| 13 Historical | Durable raw/normalized/composite/health/candle history; backfill/replay | Granular historical reference datasets and live backfill |
| 14 Package | Independent Node 26 package, no runtime npm dependencies | None within implemented scope |
| 15 Interface | Read-only loopback REST/SSE and handler tests | Actual socket acceptance blocked locally |
| 16 Coverage | Executable JSON/Markdown report and honest failed live capture | All real market counts/overlaps |
| 17 Tests | Unit, contract integration, property, replay and resilience cases | Live and complete application regressions |
| 18 Live validation | Successful 60-second remote collection window; all three source inventories, nonempty reference observations and history | Representative-category comparisons, deeper reconnect/clock studies |
| 19 Calibration | Synthetic sensitivity, concentration and source-loss comparisons | Independent reference dataset and live candle-stability calibration |
| 20 Performance/security | Measured throughput/CPU/memory; queue/transport/history bounds | Real inventory latency and durable end-to-end load; redistribution terms |
| 21 Documentation | Existing README data/graphics structure preserved; protocol contracts added | Repository-wide tooling acceptance recorded separately |
| 22 Rights | Existing first-party policy and third-party data rights preserved | Verified redistribution permission |
| 23 CI | Isolated compile/lint/tests/socket/audit and separate manual live workflow | Exact PR CI results |
| 24 Deliverables | Reviewable implementation and measured evidence | Incomplete live/coverage/calibration requirements remain explicit |
| 25 Done | Partial acceptance, not declared complete | All unverified gates above |
| 26 Execution | Actual code, tests, measurements, docs and implementation branch | Review and remaining acceptance |

## Remote CI follow-up

The first GitHub Actions run passed all 52 initial deterministic tests, TypeScript
and lint, then exposed an asynchronous SSE cleanup race in the real socket test.
The server now releases subscribers synchronously during shutdown, independently
of delayed TCP close events, with an additional deterministic regression test.
The rerun passed 53 deterministic tests, the actual socket test, typecheck, lint and the full package audit with zero vulnerabilities (run 45486530875, job 138773510933). A separate
public-data workflow runs on protocol PRs and manual dispatches; only aggregate
health/count summaries are uploaded, while raw provider observations remain local.

The first remote public collection reached Gains and Hyperliquid and accepted
6,379 input events over approximately 72 seconds including discovery. It exposed
a GMX catalog-envelope parsing defect (four wrapper entries), so that run is
**not** evidence of complete GMX coverage. The follow-up unwraps catalog envelopes,
supports explicit address-field identities, adds a regression, and requires
nonempty per-provider price observations before live validation can pass. Live
history retrieval now retains only provider-reference data and reports actual
success/failure counts. Revalidation succeeded in [run 45487308364](https://github.com/algomanlife/openfund/actions/runs/45487308364): all three public inventories, nonempty reference observations and provider-reference history reads succeeded. The run took 67,185 ms including discovery/history and accepted 10,117 deduplicated input events. [Committed summary](../../packages/open-oracle/benchmarks/ci-live-validated.json). The implementation CI also passed all 54 deterministic tests, the real socket test, compile, lint and audit.

A final normalization regression additionally verifies evidenced provider-specific
units and exact positive multipliers before triple-source calculation, preserving
raw prices separately. No economic identity is inferred from a ticker. The local
protocol suite now passes 55 tests; final-commit CI is tracked in PR #223.

## Remaining integration work

Before a later integration: extend the successful public-data window across
representative categories, review all comparable economic mappings and quote conversions,
calibrate instrument-specific freshness/deviation/session policies, verify usage
terms, run TCP/API and full application regressions, measure durable production
workloads, and obtain review. Production terminal integration requires a separate
authorization. The current production price path stays unchanged throughout.
