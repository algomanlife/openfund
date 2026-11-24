# Open Oracle implementation and validation

## Result and scope

**In Progress.** The standalone implementation exists on
`feat/open-oracle-protocol`, based on inspected main
`8b9e4b7ba1b7d0dc57005148307e64f33578e265`. Deterministic protocol tests and
TypeScript compilation pass locally. Public provider access and local TCP
listeners are blocked in this environment, so this report does not assert
successful live conformance, complete current coverage, empirical calibration
or production readiness. No integration, merge or deployment was performed.

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
| Deterministic tests | 52 passed, zero failed; includes 1,000 seeded property iterations |
| Socket integration | Executed and failed: `listen EPERM` on `127.0.0.1`; separate required CI test retained |
| Public Gains discovery | Executed; `NETWORK` failure, no inventory verified |
| Public Hyperliquid discovery | Executed; `NETWORK` failure, no inventory verified |
| Public GMX discovery | Executed; `NETWORK` failure, no inventory verified |
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
| Full docs check | Blocked at retired-font scanning of stale unrelated cached files in the partial checkout; not a verified failure of the remote main tree |
| Full application regression/build | Not established in this partial checkout; no application runtime source was changed |
| Full registry vulnerability audit | Network-dependent verification remains unestablished locally; isolated CI includes blocking audit |

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

The actual TCP/socket test is separate from in-process route tests, not skipped
or relabelled as passing. Required CI runs both. Live validation is separately
manual, preserving all failed as well as successful collection evidence.

## Requirement traceability

| Original section | Implementation/evidence | Outstanding acceptance |
| --- | --- | --- |
| 1 Objective | Independent GAACP, registry, candles and history | Full live acceptance |
| 2 Isolation | Package-only runtime; no application imports or production writes | None within phase scope |
| 3 Inspection | Exact main; existing Gains, footprint, decimal and docs contracts inspected | Full checkout/regression access |
| 4 Universe | Union discovery, builder/spot catalogs and explicit ambiguous entries | Real complete current inventory |
| 5 Selection | Every 0/1/2/3-source subset tested | Live source-combination evidence |
| 6 Adapters | Three read-only HTTP adapters, schemas, histories and bounded polling | Live payload conformance, source timestamp/session limitations |
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
| 18 Live validation | Actual three-provider attempt recorded | Usable collection window, category samples, reconnect/history conformance |
| 19 Calibration | Synthetic sensitivity, concentration and source-loss comparisons | Independent reference dataset and live candle-stability calibration |
| 20 Performance/security | Measured throughput/CPU/memory; queue/transport/history bounds | Real inventory latency and durable end-to-end load; redistribution terms |
| 21 Documentation | Existing README data/graphics structure preserved; protocol contracts added | Repository-wide tooling acceptance recorded separately |
| 22 Rights | Existing first-party policy and third-party data rights preserved | Verified redistribution permission |
| 23 CI | Isolated compile/lint/tests/socket/audit and separate manual live workflow | Exact PR CI results |
| 24 Deliverables | Reviewable implementation and measured evidence | Incomplete live/coverage/calibration requirements remain explicit |
| 25 Done | Partial acceptance, not declared complete | All unverified gates above |
| 26 Execution | Actual code, tests, measurements, docs and implementation branch | Review and remaining acceptance |

## Remaining integration work

Before a later integration: obtain network-backed provider conformance and a
complete inventory, review comparable economic mappings and quote conversions,
calibrate instrument-specific freshness/deviation/session policies, verify usage
terms, run TCP/API and full application regressions, measure durable production
workloads, and obtain review. Production terminal integration requires a separate
authorization. The current production price path stays unchanged throughout.
