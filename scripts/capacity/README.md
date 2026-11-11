# Capacity harness

Isolated load, stress and capacity tests for Openfund. The harness runs the
unmodified backend against a disposable PostgreSQL database and a synthetic
Gains market-data server. It never contacts production, `api.gains.trade`,
DePay or the CMS, and it refuses any target that is not local or an
explicitly named staging host.

Results and analysis: [Capacity assessment 2026-11](../../docs/reviews/capacity-2026-11/REPORT.md).

## Components

| File | Role |
| --- | --- |
| `harness/mock-gains.mjs` | Synthetic Gains REST + WebSocket (493 markets, 250 ms ticks). `LT/USD` encodes its emit time in the price so delivery delay and SL/TP trigger delay can be measured end to end |
| `harness/preload.mjs`, `harness/loader-hooks.mjs` | `node --import` preload: redirects `market-data.js` to the synthetic server at load time (no source change), refuses non-local or non-`*_test` databases, writes CPU, RSS, event-loop delay and pg pool stats every second |
| `harness/start-backend.sh` | Starts the synthetic server and the backend (`NODE_ENV=production`, Node 22, one process as on Render) |
| `harness/seed-users.mjs` | Creates synthetic wallets through the real SIWE sign-in path; keys are derived from a fixed test seed and never stored; a share of users opens one position |
| `harness/sse-swarm.mjs` | One `/trading/stream` per chart user (k6 has no SSE reader); records gaps, drops, reconnects and market-data delay |
| `k6/charts.js` | Signed-in chart user HTTP behaviour modelled on the shipped client: `/products/prop/context` polling, workspace restore and saves, multi-tab conflicts, order review and submit with idempotent retries, SL/TP edits, closes, cross-wallet probes |
| `k6/visitors.js` | Anonymous visitors replaying the real per-route asset graph (`k6/route-assets.json`) with Cloudflare and browser cache behaviour; never calls `/health` |
| `browser/capture-routes.mjs` | Records each public route's real same-origin requests with Playwright |
| `browser/chart-render.mjs` | A few real Chromium terminals: load timing, chart readiness, FPS, long tasks, heap |
| `harness/monitor.mjs` | PostgreSQL and process metrics every 2 s, and the automatic stop conditions |
| `harness/throttle.mjs` | CFS-style CPU quota on macOS to emulate Render plan sizes |
| `harness/integrity.mjs`, `harness/sltp-latency.mjs` | Post-run data-integrity audit and SL/TP execution delay |
| `harness/summarize.mjs`, `harness/graphs.mjs` | Per-stage tables (`summary.json`) and SVG time series |

## Prerequisites

- Node 22 for the backend (Render runs 22) and Node ≥ 22 for the harness
- k6 ≥ 0.50, PostgreSQL 17 client and server binaries
- `npm ci` here, `npm ci` in `apps/backend` and `apps/web-react`, `npm run build:web`
- A disposable PostgreSQL cluster; the database name must end in `_test`

```bash
initdb -D /tmp/of-cap-pg -U postgres --auth=trust
pg_ctl -D /tmp/of-cap-pg -l /tmp/of-cap-pg.log -o "-p 55432 -c max_connections=100 -c shared_preload_libraries=pg_stat_statements" start
psql -h 127.0.0.1 -p 55432 -U postgres -c "CREATE DATABASE openfund_load_test"
DATABASE_URL=postgres://postgres@127.0.0.1:55432/openfund_load_test npm --prefix apps/backend run migrate
DATABASE_URL=postgres://postgres@127.0.0.1:55432/openfund_load_test node apps/backend/seed-plans.js
psql postgres://postgres@127.0.0.1:55432/openfund_load_test -c "CREATE EXTENSION pg_stat_statements"
```

## Running

```bash
cd scripts/capacity
./harness/start-backend.sh results/seed
node harness/seed-users.mjs 1500 results/users.json 0.6
node browser/capture-routes.mjs
PROFILE=uncapped ./run.sh stair-uncapped
PROFILE=render STAGES=baseline,low ./run.sh stair-render
PROFILE=uncapped STAGES=low,medium STAGE_HOLD_S=420 RECOVERY_S=240 ./run.sh sustained-recovery
node harness/summarize.mjs results/stair-uncapped && node harness/graphs.mjs results/stair-uncapped
```

`results/users.json` holds session cookies for the disposable database only; it
is ignored by Git and must not be shared.

Knobs: `STAGES`, `STAGE_RAMP_S`, `STAGE_HOLD_S`, `RECOVERY_S`, `CONST=<charts>:<s>`,
`VISITOR_RATIO`, `ASSET_CDN_HIT` (0 = no-CDN worst case), `PROFILE=render`
(backend 50 % of one core, PostgreSQL 10 %), `HARNESS_PG_MAX` (pool-size
experiment only).

## Stop conditions

k6 aborts when the error rate stays above 25 % (60 s grace) or on any
in-flight integrity violation. The monitor writes `STOP` and interrupts all
generators when database connections stay within 3 of `max_connections`,
the backend exits, event-loop p99 stays above 2 s, or the pg pool queue stays
above 200 for 30 s. The concurrency and reason at the stop are kept in `STOP`.

## Staging

Set `TARGET=https://<name containing staging>`, provide a staging database
URL for the monitor and integrity audit, and run the Gains redirect only
when the staging backend can load the preload. Do not point it at
production; the scripts refuse it.
