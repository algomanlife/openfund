# Capacity assessment — 2026-11

Non-destructive load, stress and capacity assessment of `main` at `b018c25`
(merge of PR #88), run on 2026-11-11 in an isolated local environment.
No production service, Gains endpoint, DePay endpoint or CMS was contacted,
and no real transaction was made. Harness and reproduction steps:
[scripts/capacity](../../../scripts/capacity/README.md).

## Verdict

The current deployment cannot serve the target load. Measured on this
environment:

| Question | Measured answer |
| --- | --- |
| Maximum stable concurrent chart users (local, one uncapped Node core) | **100** (with 200 visitors). 300 chart users held HTTP latency for a 3-minute stage but SL/TP execution was already delayed 5–13 s; a later sustained attempt at 300 tripped the stop condition after 1.5 minutes |
| Maximum stable combined concurrency (local) | **300** (100 charts + 200 visitors) |
| Render-equivalent profile (backend 0.5 CPU, PostgreSQL 0.1 CPU) | **Not stable at the lowest stage tested (100 + 200).** Chart p95 719 ms, engine loop almost stopped (0.01 passes/s). Capacity below 100 chart users was not measured |
| 1,500 chart users / 3,500 combined | **Not reached.** The highest stage reached was 1,000 chart users with a pool of 40 (p95 5.7 s) |
| First bottleneck | Database work per connected chart user: every SSE stream queries the session and a full `engine.state` transaction every second through a single 10-connection pg pool, on one Node process that also runs the trading engine loop |
| HTTP errors, dropped SSE streams, data-integrity violations | **None** in any valid run (all failures were latency and queueing, not errors) |

Capacity figures in this report are measurements on this machine. Render
figures come from a CPU-quota emulation (see *Environment*). Everything
labelled *estimate* is not measured.

## Environment

| Item | Value |
| --- | --- |
| Source | `main` `b018c25`, unmodified application code |
| Backend | Node 22.23 (Render uses 22), `NODE_ENV=production`, one process (Render `numInstances: 1`), default `pg.Pool` (max 10) |
| Database | PostgreSQL 17, disposable cluster, `max_connections=100`, `pg_stat_statements`; database `openfund_load_test` |
| Market data | Synthetic Gains server: 493 markets (production count), 250 ms ticks, recorded schemas; `LT/USD` encodes its emit time for delay measurement |
| Machine | 10-core Apple Silicon, 16 GB RAM; backend, PostgreSQL and generators on the same host |
| Generators | k6 2.3 (two processes: charts, visitors), Node SSE swarm, Playwright 1.65 Chromium |
| Users | 1,500 synthetic wallets created through real SIWE sign-in; 60 % opened one position at seed (968 accounts with open positions during all runs) |
| Render emulation | `PROFILE=render`: CFS-style CPU quota (SIGSTOP/SIGCONT per 100 ms) — backend 50 % of one core, PostgreSQL backends 10 %. Measured effective caps: backend ≈ 31–51 %, PostgreSQL ≈ 10–25 % (overshoot from 10 ms accounting). The emulation is therefore **more generous** than a real 0.1-CPU database |

### Production topology (preflight)

From `render.yaml`: `openfund` web service on the **starter** plan
(0.5 CPU / 512 MB), `numInstances: 1`, hosting the API, the SSE stream, the
1 s trading-engine loop, the server-side Gains WebSocket and the static React
build. `openfund-db` is PostgreSQL 17 on **`0.1c-256mb`**. Directus runs as a
separate starter service on the same database. Cloudflare proxies the
production domain; content-hashed assets are immutable, HTML and unhashed
legacy files are `no-cache` and revalidate at the origin.

Charts load candles and live prices **directly from Gains in the browser**,
so chart streaming adds no backend load. The backend load of a signed-in
chart user comes from:

- one `/trading/stream` SSE connection: every second (and on **any**
  account's state change) it runs `userFromSession` (SELECT + `UPDATE
  auth_sessions SET last_seen`) and `engine.state()` (a repeatable-read
  transaction with five queries);
- `/products/prop/context` every 5 s plus a refetch at most every 2 s after an
  SSE push (another full `engine.state()` and a ~12 KB pricing map);
- `/accounts` every 15 s, chart-workspace saves, orders and SL/TP edits.

Independently of connected users, the engine loop runs every second and
**serially** calls `enforceTrialRisk` + `state()` for every free-demo account
with an open position, then checks pending orders and SL/TP/liquidation.

## Workload

Stages from the brief, 60 s ramp and 180 s hold each (steady-state metrics
use the hold window only, trimmed 10 s/5 s at the edges):

| Stage | Chart users | Visitors | Combined |
| --- | ---: | ---: | ---: |
| Baseline | 100 | 200 | 300 |
| Low | 300 | 500 | 800 |
| Medium | 500 | 1,000 | 1,500 |
| High | 1,000 | 1,500 | 2,500 |
| Peak | 1,500 | 2,000 | 3,500 |

**Chart user** (k6 `charts.js` + SSE swarm): one SSE stream, context poll
every ~2.5 s, accounts every 15 s, and per 2.5 s cycle: 5 % settings save
(timeframe/indicators/tools), 8 % drawing save, 3 % order review + submit
with Idempotency-Key (30 % of them retried with the same key), 3 % SL/TP
update, 1 % close/partial close, 1.5 % two-tab concurrent save, 2 % workspace
restore with verification, 0.5 % cross-wallet probe.

**Visitor** (k6 `visitors.js`): the real per-route request graph recorded by
Playwright (`results/route-assets.json`), landing mix home 35 % / challenges
25 % / markets 15 % / others, 65 % Persian, 1–5 SPA transitions with 4–12 s
think time, 15 % locale switches, 40 % returning browsers (ETag 304s), 95 %
of hashed assets served by Cloudflare. `/health` is never used as traffic.

## Results by stage

### Uncapped local (`results/stair-uncapped`) — the application's own ceiling

| Stage | Chart HTTP rps | Chart p50 / p95 / p99 (ms) | Visitor rps | Visitor p95 (ms) | Errors | Backend CPU | Event-loop p99 | Pool queue avg | PG TPS | PG CPU | Engine loop passes/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 58 | 1.5 / 15 / 31 | 170 | 1.2 | 0 % | 46 % | 1.5 ms | 3 | 6,627 | 78 % | 0.96 |
| Low | 175 | 25 / 131 / 221 | 425 | 6.9 | 0 % | 89 % | 1.8 ms | 113 | 11,933 | 160 % | 0.25 |
| Medium | 192 | 276 / 494 / 720 | 555 | 93 | 0 % | 99 % | 2.2 ms | 416 | 10,651 | 147 % | 0.01 |
| High | — | stopped | — | — | — | — | — | — | — | — | — |

Stopped at the end of the medium hold (500 charts + 1,000 visitors):
`pg pool queue 566 waiting for 30 s`. CPU is % of one core.

Chart request rate rose only from 175 to 192 rps while chart users grew from
300 to 500, with a growing queue: the backend was saturated, not the load
generator.

### Render-equivalent (`results/stair-render`)

| Stage | Chart p50 / p95 / p99 (ms) | Visitor p95 (ms) | Errors | Backend CPU | Pool queue avg | PG TPS | Engine loop passes/s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 288 / 719 / 929 | 77 | 0 % | 31 % | 59 | 1,466 | 0.01 |
| Low | stopped during ramp at 254 chart users | — | — | — | — | — | — |

With **zero users**, the Render-equivalent engine loop completed 0.16 passes/s
(one SL/TP sweep every ~6 s) because of the 968 accounts with open positions
(`results/idle-render`). Uncapped with zero users: 4,594 TPS, PostgreSQL 49 %
and backend 38 % of a core (`results/idle-uncapped`).

### Pool-size sensitivity (`results/stair-uncapped-pool40`, harness override only)

| Stage | Chart p95 pool 10 → pool 40 | PG CPU (pool 40) | Engine loop (pool 40) |
| --- | --- | ---: | ---: |
| Baseline | 15 → 126 ms | 60 % | 0.35 |
| Low | 131 → 1,132 ms | 91 % | 0 |
| Medium | 494 → 2,594 ms | 91 % | 0 |
| High (1,000 + 1,500) | — → 5,668 ms | 86 % | 0 |

A larger pool moves the queue into PostgreSQL and makes every percentile worse.
Raising `max` alone is not a fix. (This run started from a larger database;
see *Limitations*.)

### Sustained load and recovery

- **Sustained low** (`results/sustained-recovery`): with the database grown
  by earlier runs (8,307 positions, 2,433 open), 300 + 500 tripped the
  pool-queue stop condition **1.5 minutes into the hold**; p95 1,384 ms.
  The 3-minute low stage of the first staircase was therefore not a stable
  operating point.
- **Overload and recovery** (`results/overload-recovery`, pool stop disabled
  on purpose): baseline 5 min → medium 5 min → baseline 4 min.

| Phase | Chart p50 / p95 / p99 (ms) | Pool queue avg | Engine loop |
| --- | --- | ---: | ---: |
| Baseline (before) | 14 / 191 / 307 | 24 | 0.29 |
| Medium (overload) | 1,348 / 2,701 / 4,002 | 842 | 0 |
| Baseline (after) | 101 / 300 / 436 | 42 | 0.13 |

The pool queue drained ~50 s after load dropped; HTTP latency did not return
to the pre-overload level within 4 minutes and the engine loop stayed at half
its previous rate. No errors and no integrity violations.

### Latency of key operations (whole run, ms, p50 / p95 / p99)

| Run | Chart save | Workspace restore | Order submit | SL/TP update |
| --- | --- | --- | --- | --- |
| Uncapped staircase | 39 / 302 / 410 | 11 / 270 / 339 | 116 / 620 / 809 | 64 / 380 / 490 |
| Render-equivalent | 203 / 1,311 / 1,822 | 217 / 1,560 / 1,921 | 428 / 3,195 / 3,853 | 259 / 1,587 / 2,023 |
| Overload-recovery | 806 / 1,686 / 2,334 | 696 / 1,560 / 2,146 | 1,939 / 3,835 / 5,330 | 1,057 / 2,218 / 2,955 |

### SL/TP execution delay (time from price crossing to position close)

Computed exactly from the `LT/USD` sawtooth (`harness/sltp-latency.mjs`).
The price reset every 10 minutes triggers hundreds of stops at once, so these
are burst conditions comparable to a fast market.

| Stage (uncapped staircase) | n | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 161 | 2.8 s | 5.7 s | 6.0 s |
| Low | 32 | 5.3 s | 12.6 s | 14.6 s |
| Medium | 166 | 61 s | 131 s | 141 s |

Render-equivalent baseline: 1 trigger in the window, 16.5 s.

### SSE / WebSocket stability and market-data delay

| Run / stage | Active streams | Drops | Reconnects | Event gap p95 | Market-data delay p50 / p95 |
| --- | --- | ---: | ---: | ---: | --- |
| Uncapped baseline | 100/100 | 0 | 0 | ≤ 1.0 s | 28 / 193 ms |
| Uncapped medium | 500/500 | 0 | 0 | ≤ 1.0 s | — / 236 ms |
| Overload-recovery medium | 500/500 | 0 | 0 | ≤ 1.3 s | — / 240 ms |
| Render baseline | 100/100 | 0 | 0 | ≤ 1.0 s | — / 238 ms |

No stream dropped in any valid run. Market-data delay (synthetic Gains emit →
backend WebSocket ingest → SSE snapshot at the client) stayed ~0.2 s at p95
because marks are read from memory; delay is dominated by the 1 s SSE timer.
Each stream received ~2 events/s instead of 1 because every account's state
change wakes every stream. New streams took longer to open under overload
(connection waits for the first state query).

### Chart rendering (real Chromium, `results/browser`)

| Backend condition | Chart ready | Workspace restored | FPS median / min | JS heap | Long tasks / 90 s |
| --- | ---: | ---: | --- | --- | ---: |
| Baseline load (4 browsers) | 0.73–0.75 s | 0.79–0.80 s | 60 / 59.2 | 23 → 27 MB | 0–83 ms |
| Medium overload (4 browsers) | 1.01–1.05 s | 1.09–1.22 s | 60 / 58.7 | 24 → 26 MB | 126–295 ms |

Rendering is client-side and unaffected by backend saturation; only
backend-dependent steps (workspace restore, positions, PnL) slow down. Cold
public pages transfer 3.3–3.7 MB. One third-party request (`api.bitpin.ir`)
was blocked by the harness and never reached.

### PostgreSQL

Statements are fast (mean ≤ 0.015 ms); the load is volume. Top statements in
the uncapped staircase (`results/stair-uncapped/pg-statements.json`):

| Share of DB time | Calls | Statement | Source |
| ---: | ---: | --- | --- |
| 18.0 % | 1,208,282 | `INSERT INTO account_equity_risk … ON CONFLICT DO UPDATE` | `engine.state()` |
| 17.2 % | 928,874 | `UPDATE auth_sessions SET last_seen = now()` | every authenticated request and every SSE tick |
| 11.8 % | 928,874 | session + user lookup | `userFromSession` |
| 11.5 % | 1,208,283 | open positions | `engine.state()` |
| 11.5 % | 1,208,282 | `INSERT INTO account_equity_samples` | `engine.state()` |
| 9.3 % | 1,208,282 | last 100 closed positions | `engine.state()` |

No lock waits, ungranted locks or deadlocks were observed; database
connections never exceeded 46 of 100 (the app uses at most its pool). Cache
hit ratio stayed ≈ 1.0. The PostgreSQL log recorded 12 statements over 200 ms in the whole staircase.

### CPU and memory

| Run | Backend CPU (avg at highest stage) | Backend RSS max | PostgreSQL CPU | Generators CPU max |
| --- | ---: | ---: | ---: | ---: |
| Uncapped staircase | 99 % of one core | 275 MB | 147–160 % | 295 % of 10 cores |
| Overload-recovery | 99 % | 309 MB | 71 % | 208 % |

Backend RSS stayed under the 512 MB of the starter plan. The generators used
at most ~3 of 10 cores and never limited the test.

## Data integrity

All valid runs ended with **0 violations** in the post-run audit
(`harness/integrity.mjs`, 16 SQL checks) and 0 in-flight violations in k6:

- no cross-wallet chart reads; every workspace row's `owner` matches its user;
  a stale `X-Openfund-Chart-User` header was refused with 409 in every probe
  (1,320 checks passed across runs);
- no lost confirmed workspace update (every confirmed revision and content hash
  was re-read and matched); no multi-tab double commit (exactly one of two
  concurrent same-revision saves succeeded each time);
- no duplicate orders: idempotent retries returned the same order marked
  `duplicate`; no duplicate idempotency keys in `trading_orders`;
- no inverted SL/TP and every last accepted SL/TP update is the stored value;
- no corrupted positions (non-positive size/margin, open with close fields,
  closed without exit), no cross-user positions, no negative balance, no
  used-margin drift, no duplicate demo funding;
- no malformed chart-state records.

Totals by the end of testing: 10,954 positions, 10,195 orders, 8,778 SL/TP
updates, 4,661 workspace entries.

## First observed bottleneck

**Per-user database work on a single 10-connection pool in a single Node
process.** At 300 chart users (uncapped) the pool queue averaged 113 and the
engine loop slowed to 0.25 passes/s; at 500 the Node process was at 99 % of a
core with 416 queued queries. Under Render CPU limits the 0.1-CPU database
saturates first, already at 100 chart users and even without users because
of the engine loop.

The engine loop is a second, independent limit: its cost grows with the
number of accounts holding open positions, it runs serially, and SL/TP and
liquidation checks only run after the per-account sweep finishes.

## Estimated requirements for 3,500 concurrent users (estimate, not measured)

Linear extrapolation of the current design is not meaningful: one Node process
cannot use more than one core for JavaScript, and the engine loop and SSE
stream must stay in that single instance (`numInstances: 1`). The measured
ceiling of that process is ~300 chart users on this machine's core, which is
faster than a Render 0.5-CPU instance.

From the measured cost (~20 PostgreSQL transactions/s per chart user plus
~4.7/s per account with an open position), 1,500 chart users would need on
the order of 30,000–40,000 TPS — several dedicated database cores — for state
reads that rarely change. Scaling hardware is therefore not recommended
before fixes 1–4 below. After those fixes, the expected order of magnitude is:

| Component | Estimate after fixes 1–4 |
| --- | --- |
| Web/API | 2–3 instances of ≥ 1 CPU / 2 GB behind sticky routing for SSE, with the engine loop in a separate single worker |
| Database | Plan with ≥ 2 dedicated CPU / 4 GB, pooled connections (PgBouncer or equivalent) |
| Fan-out | Shared change notification (PostgreSQL `LISTEN/NOTIFY` or Render Key Value) so any instance can push state |
| Static | Cloudflare already serves hashed assets; unhashed legacy files and HTML revalidate at the origin |

These figures must be re-measured with this harness after the fixes.

## Recommended fixes, ranked by impact

1. **Stop per-stream polling in `/trading/stream`.** Compute account state
   once per changed account per tick and push it to that account's streams.
   Use the `accountId` that `engine.emit` already passes (today every stream
   reacts to every account). Revalidate the session every 30–60 s, not
   every second. Expected to remove most of the measured database load.
2. **Throttle `auth_sessions.last_seen`** to once per several minutes per
   session (today: 17 % of database time).
3. **Make the engine loop set-based and event-driven.** Check SL/TP and
   liquidation from in-memory open positions on each price tick, first. Run
   the equity-risk sampling (two upserts per account per second today) per
   minute or on change. Avoid calling the full `state()` per account in the
   loop.
4. **Remove `engine.state()` from `/products/prop/context`** or cache it per
   account briefly; the SSE stream already delivers it. Cache the 493-market
   pricing map.
5. **Separate the engine loop into its own worker** so the web service can run
   more than one instance; add shared change notification for SSE.
6. **Resize infrastructure only after 1–5**: move the database off
   `0.1c-256mb` and the web service off starter, then re-run this harness.
   Do not raise the pool size alone (measured worse).
7. **Fix the shutdown race**: `engine.stop()` does not wait for the running
   loop, which then queries an ended pool (`Cannot use a pool after calling
   end on the pool` at every shutdown).
8. **Frontend weight**: cold public pages are 3.3–3.7 MB.

## Measured versus estimated

| Item | Status |
| --- | --- |
| Stage results, latencies, CPU, RAM, PostgreSQL, SSE, integrity, browser FPS | Measured locally |
| Render-equivalent results | Measured under CPU-quota emulation (more generous than Render) |
| Behaviour on real Render, through Cloudflare, over real networks | Not measured |
| Capacity for 1,000–1,500 chart users and 3,500 combined | Not reached; not claimed |
| Infrastructure for 3,500 users | Estimate only |

## Limitations

- Single host: backend, PostgreSQL and generators shared one machine. The
  generators stayed under 3 of 10 cores.
- No network latency or TLS; real latencies add round-trip time.
- The database grew across runs (3,009 positions after the first staircase,
  10,954 at the end). Later runs carried more open positions and history, so
  they are heavier per account than the first staircase; real accounts also
  accumulate history.
- Directus was not run; CMS requests were answered with empty content.
- Gains and DePay were never called; purchases were not exercised.
- A Render staging environment and Render metrics were not available, so
  CPU, memory and response-time graphs come from the harness's own monitors.

### Invalid runs (kept for transparency, excluded from all figures)

`results/invalid/`: two Render-profile attempts whose throttling did not
apply or was too strict (`cpulimit` 0.2 has no effect on this macOS; the first
duty-cycle throttler also paused idle processes), and one pool-40 run that was
contaminated by a throttler left running from the previous run.

## Files

- `results/<run>/summary.json` — per-stage tables used above
- `results/<run>/k6-*-summary.json`, `k6-*-dashboard.html` — k6 raw summaries and dashboards
- `results/<run>/sse.jsonl`, `backend-metrics.jsonl`, `monitor.jsonl` — 1–2 s time series
- `results/<run>/pg-statements.json`, `pg-slow.log`, `integrity.json`, `sltp-latency.json`, `STOP`
- `graphs/<run>/*.svg` — streams, CPU, event loop, pool queue, PostgreSQL TPS, SSE gap and market-data delay, engine loop
- `results/browser/*.json` — Chromium measurements

[Reviews index](../README.md)
