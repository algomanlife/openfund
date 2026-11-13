# Capacity optimization — 2026-11-13

Performance and scalability work on branch `agent/claude/capacity-optimization`
(based on `main` `0c0c52a`), measured with the isolated capacity harness
([scripts/capacity](../../../scripts/capacity/README.md)) against a fresh
baseline of the same commit. No product rule, financial formula, rounding,
API response shape, authentication rule, payment flow or smart contract was
changed. Nothing was deployed; no production system, Gains endpoint, DePay
endpoint or CMS was contacted. Decision record:
[ADR 0027](../../decisions/0027-trading-stream-fan-out-and-engine-loop-isolation.md).
Previous assessment: [Capacity assessment 2026-11](../capacity-2026-11/REPORT.md).

## Verdict

| Question | Answer (measured on this machine unless stated) |
| --- | --- |
| Primary target 1,500 chart users + 2,000 visitors | **Not reached.** Stage E was not reached by either build |
| Maximum stable stage, reference `main` | **A** (100 + 200). B degrades (chart p99 1.2 s, engine 0.19 passes/s); C stopped (pool queue 608) |
| Maximum stable stage, optimized | **C** (500 + 1,000) at a flat load: chart p95 63 ms / p99 120 ms, 0 errors, engine 0.95 passes/s, SL/TP p95 1.7 s. In the staircase (after A and B grew the database) C reached p95 544–701 ms, above the 250 ms target |
| Stage D (1,000 + 1,500) | Runs without errors or integrity violations but is **not stable**: chart p95 0.9–2.4 s, pool queue 125–1,120. SL/TP stays bounded (max 3.6 s flat, 15 s in the staircase) |
| Render-equivalent profile (backend 0.5 CPU, PostgreSQL 0.1 CPU) | Both builds stable only at A; optimized p95 161 ms vs 311 ms. B fails in both: the 0.1-CPU database is saturated by the engine loop alone (900 open-position accounts) |
| Data integrity | **0 violations** in every valid run (16-check audit, in-flight k6 checks); reference and optimized builds produce identical financial state for the same deterministic sequence |

The application-level bottleneck that limited `main` (per-stream database
work) is removed. The next limits are, in order: the serial engine loop on a
database that must answer ~10 round trips per open-position account per pass,
and the single Node process. Reaching 1,500 + 2,000 needs the changes listed
under *Proposals* and an infrastructure change; it cannot be claimed today.

## Environment

| Item | Value |
| --- | --- |
| Reference | `main` `0c0c52a`, unmodified, in a separate worktree |
| Optimized | this branch; staircase `cand-stair` at `347c236`, all later runs at `c12bca8` (later commits are harness/docs only) |
| Runtime | Node 26.13.0 (backend and harness), `NODE_ENV=production`, one process, API pool 10 (+ engine-loop pool 3 in the optimized build) |
| Database | PostgreSQL 17.11, disposable cluster, `max_connections=100`, `pg_stat_statements`, database `openfund_load_test` |
| Data | 3,000 synthetic wallets created through real SIWE sign-in; 900 free-demo accounts with one open position (30 %, ≈ the 968 of 2026-11-11); 20 MB; restored from the same snapshot before every run (`harness/reset-db.sh`) |
| Market data | synthetic Gains server, 493 markets, 250 ms ticks, `LT/USD` encodes its emit time |
| Load | k6 2.3.0 (chart users, visitors), Node SSE swarm; stages A–G from the brief (60 s ramp, 180 s hold) and flat 240 s runs |
| Machine | Apple M4, 10 cores, 16 GB, macOS 27.2; backend, PostgreSQL and generators on one host. The host also ran idle Openfund processes of other sessions (≈ 1 % CPU) |
| Render emulation | `PROFILE=render`: SIGSTOP/SIGCONT CPU quota, backend 50 % of a core, PostgreSQL 10 % (more generous than a real 0.1-CPU database; see the 2026-11 report) |

### Harness validity after the Node 26 / Express 5 upgrades

- `start-backend.sh` still started the backend with a Node 22 binary although
  the backend requires Node ≥ 26 — now defaults to `node` on `PATH`.
- `k6/route-assets.json` held the 2026-11-11 asset hashes: 82–85 % of origin
  asset requests returned 404 (first baseline run, kept under
  `results/invalid/`). Re-mapped to the current build
  (`browser/remap-route-assets.mjs`; no browser was available to re-record it).
- Added: stages F and G, in-process engine-loop metrics (pass time, skipped
  ticks, pass start → SL/TP sweep), database snapshot/restore, the
  equivalence check, resilience and multi-tab scripts.

## Optimizations

Each change is a separate commit; rollback = `git revert <commit>`. None adds a
migration, environment variable or service.

| # | Original bottleneck (evidence) | Change (commit, files) | Why behaviour is unchanged | Before → after |
| --- | --- | --- | --- | --- |
| 1 | `/trading/stream`: per stream, every second **and on every change of any account**, session `SELECT` + `UPDATE last_seen` + full `engine.state()`; 8–9 events/s per stream at 300 users; session queries 28 % of DB time | `e973cb3`: `trading-stream.js`, `server.js` — one scope per (wallet, account); one session query and one fresh `state()` per push, shared by all tabs; events routed by account id; coalescing; bounded slow-reader buffer; logout ends streams | payload is still `JSON.stringify` of a fresh `state()`; a session check (same rule) still precedes every push; unresolved scopes still react to every event; 13 unit tests; equivalence check: first stream snapshot equals `/trading/state` | `state()` per wallet with 3 tabs: **3.05 → 1.00 /s**; events per stream ≈ **1 /s**; session statements 28 % → 7 % of DB time |
| 2 | `UPDATE auth_sessions SET last_seen` on every request (16–17 % of DB time) | same commit: at most once per minute per session | nothing reads `last_seen`; sessions are still validated on every request | 967k → negligible calls |
| 3 | engine loop called full `state()` per open-position account only for its sampling side effect (also reading pending orders and the last 100 closed positions) | `9f35a32`: `engine.js` `#sampleTrialEquity` | same snapshot isolation, same rows and ordering, same `#accountView` equity, same writes | 2 of 6 reads removed per account per pass; history read no longer grows the loop cost |
| 4 | equity-risk upsert + sample insert: two autocommit statements per `state()` (39 % of DB time after #1) | `c12bca8`: `engine.js` — one CTE; for accounts **without** open positions a repeated equity in the same database minute is skipped | the skipped write is a proven no-op (idempotent GREATEST/CASE expressions, `ON CONFLICT DO NOTHING` per minute); writes serialized per account; accounts with positions always written; DB tests with hand-computed rows | stage C PostgreSQL CPU 89 % → 59 %, TPS 6.3k → 4.9k |
| 5 | engine-loop queries queued behind API reads in the 10-connection pool (reference: queue 296 at flat C, engine 0.05 passes/s) | `347c236`: `engine.js`, `server.js` — loop work on a dedicated pool (max 3) via `AsyncLocalStorage` | same SQL, transactions, row locks and per-account mutex; only the connection source differs; listeners run outside the loop scope | flat D, with vs without: SL/TP p50/p95/max **1.7/3.5/3.6 s vs 17.4/58.5/68.6 s**; longest pass 16.7 s vs 65 s |
| 6 | `engine.stop()` did not wait for a running pass; shutdown ended the pool under it (`Cannot use a pool after calling end on the pool`) | `c8447f1`: `engine.js`, `server.js` | a pass is never interrupted; shutdown only waits | reference resilience run logged the error; optimized: 0 |

Combined effect on shutdown: the reference keeps SSE connections open after
SIGTERM (engine and market data already stopped) until the process is killed —
34.9 s in the resilience run. The optimized build ends streams at shutdown and
exits in ≈ 4.7 s; clients reconnect to the new process.

## Capacity results

### Staircase (stages A → G, same data)

Chart HTTP latency p50 / p95 / p99 in ms; SL/TP over the whole run.

| Stage | Reference `ref-stair` | Optimized `cand-stair` (#1, #3, #5, #6) | Optimized `cand2-stair` (+ #4) |
| --- | --- | --- | --- |
| A 100 + 200 | 1.7 / 27 / 87 · engine 0.78/s | 1.3 / 5.3 / 25 · engine 0.98/s | 1.3 / 3.5 / 12 · engine 0.99/s |
| B 300 + 500 | 39 / 233 / 1,202 · queue 146 · engine 0.19/s | 1.3 / 37 / 158 · queue 0.6 · engine 0.96/s | 1.2 / 51 / 562 · queue 2.5 · engine 0.96/s |
| C 500 + 1,000 | 273 / 1,456 / 3,289 · queue 439 · **stopped** | 2.0 / 544 / 1,930 · queue 46 · engine 0.47/s | 1.9 / 701 / 2,140 · queue 54 · engine 0.48/s |
| D 1,000 + 1,500 | not reached | 969 / 2,416 / 4,493 · **stopped** | 690 / 2,225 / 3,671 · **stopped** |
| E–G | not reached | not reached | not reached |
| SL/TP p50 / p95 / max | 9.6 / 20.0 / 20.9 s | 0.86 / 6.4 / 12.7 s | 0.69 / 4.8 / 16.1 s |
| PostgreSQL TPS at B | 11,688 | 7,150 | 5,626 |
| Errors / integrity | 0 % / 0 | 0 % / 0 | 0 % / 0 |

The staircase is cumulative: by C the database carries the positions and
history created during A and B, so C is harder than a fresh flat C.

### Flat stage C (500 + 1,000, 240 s, fresh data)

| Metric | Reference | Optimized | Optimized without loop pool |
| --- | --- | --- | --- |
| Chart p50 / p95 / p99 | 81 / 171 / 226 ms | **1.2 / 63 / 120 ms** | 1.2 / 67 / 124 ms |
| Visitor p95 | 14 ms | 1.9 ms | 1.9 ms |
| Pool queue (avg) | 296 | 0 | 0 |
| Engine passes/s, pass p50 | 0.05, 11.9 s | 0.95, 0.89 s | 0.85, 0.92 s |
| SL/TP p50 / p95 / max | 8.4 / 28.3 / 30.2 s | **1.17 / 1.68 / 1.72 s** | 0.80 / 2.03 / 2.11 s |
| PostgreSQL TPS / CPU | 19,420 / 244 % | 6,991 / 85 % | 6,589 / 89 % |
| Backend CPU (one core) | 99 % | 59 % | 58 % |
| SSE streams / drops | 500 / 0 | 500 / 0 | 500 / 0 |

### Flat stage D (1,000 + 1,500, 240 s, pool stop disabled)

| Metric | Optimized | Optimized without loop pool |
| --- | --- | --- |
| Chart p50 / p95 / p99 | 244 / 2,384 / 3,362 ms | 121 / 2,762 / 3,704 ms |
| Pool queue (avg) | 1,120 | 691 |
| Engine passes/s | 0.22 | 0.18 (one pass 65 s) |
| SL/TP p50 / p95 / max | **1.7 / 3.5 / 3.6 s** | 17.4 / 58.5 / 68.6 s |
| Backend CPU | 83 % | 85 % |
| Errors / integrity | 0 / 0 | 0 / 0 |

D is beyond the single process: HTTP latency is not acceptable, but risk
processing stays bounded because the loop no longer waits in the API queue.

### Render-equivalent profile (stages A, B)

| Stage | Reference | Optimized |
| --- | --- | --- |
| A chart p50 / p95 / p99 | 92 / 311 / 406 ms | 25 / 161 / 223 ms |
| A pool queue, engine passes/s | 34, 0.04 | 0, 0.13 |
| A SL/TP p50 / max | 17.9 / 40.6 s | 5.8 / 30.2 s |
| B | stopped (pool queue 538) | stopped (pool queue 360) |

With 900 open-position accounts the loop needs more database CPU than a
0.1-CPU instance has, independent of users.

### Overload and recovery (`overload-cand`: A 5 min → D 5 min → A 4 min)

| Phase | Chart p50 / p95 / p99 | Pool queue | Engine passes/s |
| --- | --- | --- | --- |
| A before | 1.3 / 3.8 / 12 ms | 0 | 1.00 |
| D overload | 72 / 934 / 1,593 ms | 125 | 0.26 |
| A after | 1.5 / 8.4 / 39 ms | 0 | 0.82 |

Recovered to near-baseline within the recovery window (the 2026-11-11
reference had not recovered after 4 minutes). SL/TP over the run p50 1.2 s,
p95 4.0 s, max 15.0 s. 0 errors, 0 integrity violations.

### Burst (`burst-cand`: 5 s ramps to B, then C, 120 s holds)

B: p95 6.6 ms, p99 41 ms. C: p95 58 ms, p99 110 ms. Engine 1.0 / 0.9 passes/s,
SL/TP max 1.6 s, 0 errors, 0 integrity violations.

### Multi-tab (100 wallets × 3 tabs, 30 s, `multitab.mjs`)

| | Reference | Optimized |
| --- | --- | --- |
| `state()` per wallet per second from streams | 3.05 | **1.00** |
| Cross-wallet payloads / tab mismatches / drops | 0 / 0 / 0 | 0 / 0 / 0 |

### Resilience (`resilience.sh`, 300 chart users, 20 s market-data outage, graceful restart)

| | Reference (`resilience3-ref`) | Optimized (`resilience2-cand`) |
| --- | --- | --- |
| Market-data outage (20 s) | marks stale, no settlement on stale marks; WebSocket re-subscribed after restart of the feed | same |
| SIGTERM → serving again | 34.9 s (old process never exited within the 30 s wait: open streams keep `server.close` pending) | **4.7 s** |
| Streams during the restart | stayed attached to the stopping process (engine loop and market data already stopped), 0 reconnects | ended at shutdown; 320 reconnects to the new process, 300/300 active at the end |
| Chart requests failed (whole run) | 11.1 % (listener closed while the old process lingered) | 0.9 % (refused during the ≈ 4.7 s gap) |
| `Cannot use a pool after calling end` | 1 (when the old process exited) | 0 |
| Integrity violations | 0 | 0 |
| SL/TP p50 / max over the run | 0.41 / 0.53 s | 0.65 / 1.19 s |

Both builds never settle on stale marks and resume after the feed returns. The
SL/TP figures are not a like-for-like comparison: 300 chart users without
visitors are below the reference's saturation point, and the triggers fall at
different times relative to the outages.

### SSE and market data

No stream dropped unexpectedly in any stable stage of either build. Event gap
p95 ≈ 1.0 s (the 1 s push tick; the reference gap was 0.3–0.7 s because every
account's change woke every stream). Market-data delay (synthetic emit →
SSE snapshot) p95 140–240 ms in all stages, unchanged: marks are read from
memory.

## SL/TP and risk latency

Trigger-to-execution delay is measured exactly from the `LT/USD` sawtooth
(hundreds of stops fire on the same tick at each reset — a burst condition).
Processing is asynchronous: a crossing is seen at the next SL/TP sweep, which
runs after the per-account risk sweep of the same 1 s pass.

| Condition | Reference p50 / p95 / max | Optimized p50 / p95 / max |
| --- | --- | --- |
| Flat C (500 + 1,000) | 8.4 / 28.3 / 30.2 s | 1.17 / 1.68 / 1.72 s |
| Flat D (1,000 + 1,500) | — (not reachable) | 1.7 / 3.5 / 3.6 s |
| Staircase A→D | 9.6 / 20.0 / 20.9 s (A–C) | 0.69 / 4.8 / 16.1 s |
| Render-equivalent A | 17.9 / 40.6 / 40.6 s | 5.8 / 30.2 / 30.2 s |

Proposed latency budget for acceptance (owner decision): **p95 ≤ 2 s and
max ≤ 5 s at the supported load** on production hardware. The optimized build
meets it up to flat C locally; it does not meet it on the Render-equivalent
profile, and not at D in the cumulative staircase.

## Data integrity

All valid runs: 0 violations in the post-run audit (`harness/integrity.mjs`,
16 checks: no cross-wallet reads, no lost or duplicated confirmed workspace
updates, no duplicate orders or idempotency keys, no inverted SL/TP, no
corrupted positions, no negative balances, no used-margin drift, no duplicate
funding) and 0 in-flight k6 integrity violations.

Equivalence (`harness/equivalence.mjs`, `results/equivalence/run6.json`):
reference `main` and the optimized build, each on a fresh database, received
the same deterministic sequence — 8 wallets, market/limit/stop orders,
idempotent retries, six concurrent orders on one account, a rejected order,
SL/TP edits, partial and manual closes, SL on three positions on one tick,
TP, liquidation, a breached and a passed challenge. Accounts, positions,
orders, ledger (multiset, final balance, chain consistency), trading events,
equity-risk rows, challenges and challenge events were identical in every run
after the harness normalization was completed (runs 4–6).

### Mandatory concurrency scenarios

| Scenario | Evidence |
| --- | --- |
| Hundreds opening positions simultaneously | seeding (900 positions, 16 concurrent), k6 order submissions at every stage; integrity 0 |
| Several positions hitting SL/TP on one tick | `LT/USD` resets (hundreds per tick); equivalence U5 (three positions) |
| Concurrent orders on one account | equivalence U6 (six parallel), k6 retries |
| Multiple tabs on one wallet | `multitab.mjs`, hub unit tests, k6 two-tab workspace saves |
| Network interruption / reconnection | SSE swarm reconnects in the resilience run; hub cleanup tests |
| Sudden spikes | `burst-cand` |
| Trading load with anonymous visitors | every staircase and flat run |
| Database saturation and recovery | `overload-cand`, flat D |
| Backend restart during sessions | `resilience.sh` |
| Market-data reconnect with open positions | `resilience.sh` (20 s outage) |
| Growing position history | staircase (database grows across stages); the loop no longer reads history (#3). A dedicated large-history run was not performed |
| Concurrent chart-workspace writes | k6 multi-tab saves; integrity audit (no lost confirmed update, no double commit) |
| Duplicate submissions and retries | k6 (30 % retried with the same key), equivalence U0 |
| Graceful shutdown with in-flight work | resilience restart; profiling run (SIGTERM under 500 users: exit in 2 s, no pool errors) |

## Proposals (not implemented — need owner approval)

1. **Risk sweep ordering.** The SL/TP/liquidation sweep runs only after the
   serial per-account sweep (≈ 0.55 s idle, 0.9 s at C, several seconds at D).
   Running the SL/TP sweep first in each pass, or on its own 1 s timer with
   its own single-flight guard, would cut trigger delay by roughly the
   per-account sweep time. It changes the order of risk operations, so it
   needs a deterministic equivalence suite for the reordered loop first.
2. **Bounded concurrency in the per-account sweep.** Accounts are
   independent (own row locks and in-process mutex); a concurrency of 2–3 on
   the loop pool would shorten passes proportionally on a database with spare
   CPU. Not on a 0.1-CPU database.
3. **Fewer loop round trips.** ≈ 10 per open-position account per pass
   (account lookup, risk transaction, sampling transaction). Folding the
   sampling read into the risk transaction would remove ~4 but moves the
   sampling instant into the locked transaction; needs approval.
4. **`/products/prop/context` polling.** The terminal refetches it every 5 s
   and after SSE pushes (throttled to 2 s); each call is a full `state()`
   (≈ 0.4 per chart user per second, now the largest per-user API cost). The
   client already has the same state from SSE; reducing the refetch is a
   frontend behaviour change and was left untouched.

### Horizontal scaling proposal

Not needed before items 1–3 and the database change below. When needed:
engine loop in one Background Worker with a PostgreSQL advisory-lock lease
(single writer; a second worker stands by), web instances without the loop,
SSE change notification through PostgreSQL `LISTEN/NOTIFY` (no new service)
keyed by account id so each instance's scopes recompute only on relevant
changes, sticky sessions not required (each stream reads fresh state), drain
on SIGTERM (already implemented: streams end, pass completes), rollback by
returning to `numInstances: 1` with the loop in the web service. Duplicate
execution is prevented today by row locks + idempotency keys; the lease
prevents two loops from sweeping the same accounts.

## Infrastructure recommendation

Measured: the Render-equivalent database (0.1 CPU) cannot keep the engine
loop at 1 pass/s with 900 open-position accounts even without users, and the
web service at 0.5 CPU is near the single-process limit measured locally at
B–C. Recommended order (not applied):

1. Deploy this branch first (no infrastructure change) and measure on
   staging with this harness (`TARGET=https://<staging>`).
2. Move `openfund-db` from `0.1c-256mb` to a plan with at least 1 dedicated
   CPU (e.g. Render Postgres Basic/Pro 1 CPU class) — the measured first
   bottleneck under the Render profile.
3. Move `openfund` from starter (0.5 CPU / 512 MB) to a 1-CPU / 2 GB instance
   (standard class); keep `numInstances: 1`.
4. Re-run stages A–E on staging. Expected (estimate, not measured): stable
   around stage C, i.e. the local result, since the local run already had
   ≥ 1 dedicated core for each.

Costs depend on the current Render price list and are not stated here; the
owner should confirm them on Render before approving. Connection usage: the
web service opens at most 13 database connections (10 + 3) plus Directus.

## Measured versus estimated

| Item | Status |
| --- | --- |
| All stage, flat, overload, burst, multi-tab, resilience and equivalence results | Measured locally |
| Render-equivalent results | Measured under CPU-quota emulation (more generous than Render) |
| Production capacity on Render, through Cloudflare, over real networks | Not measured |
| Capacity after the infrastructure recommendation | Estimate only |
| 1,500 + 2,000 target | Not reached; not claimed |

## Limitations

- One host for backend, database and generators (generators ≤ 1.1 cores).
- No network latency or TLS; Directus not running (CMS answered empty).
- Account mix: 30 % of chart users hold an open position; a higher share
  raises loop cost and lowers the benefit of change #4.
- The visitor asset graph was re-mapped, not re-recorded in a browser.
- The `cand-stair` run used commit `347c236` content before it was committed
  (identical tree); all other optimized runs used `c12bca8`.

## Files

`results/<run>/summary.json` (per-stage tables), `pg-statements.json`,
`integrity.json`, `sltp-latency.json` (aggregates), `run.txt`, `STOP`;
`results/multitab-*/multitab.json`; `results/resilience3-ref/`, `results/resilience2-cand/`;
`results/equivalence/run6.json`; `results/invalid/` (stale-asset baseline and
the resilience runs whose outage was not applied or whose restart step also killed the load generator).

[Reviews index](../README.md)
