# Engine load report (release 0.6.5)

Measured 2026-11-17 with `scripts/ops/engine-load.mjs` on a disposable local
database. The engine was used unchanged; only the market feed was a
deterministic in-memory source (as in the engine tests), so no network
latency is included.

- Machine: Apple M4, 10 cores; PostgreSQL 17.11 on the same machine; Node 26.13.0.
- Each account is a free-demo account with **one open position**, opened
  through `Engine#submitOrder`. The monitoring loop visits only accounts
  with open positions (plus started challenges), so this is the workload
  that drives a loop pass.
- Three loop passes per size, each after a mark change; `Engine#state`
  (risk view) timed on 100 sampled accounts.

| Accounts with an open position | Loop pass median (min–max) | Per account | Risk view `state()` p50 / p95 |
| ---: | ---: | ---: | ---: |
| 200 | 180 ms (155–254) | 0.90 ms | 1.1 / 3.6 ms |
| 1,000 | 921 ms (853–1,064) | 0.92 ms | 0.6 / 1.0 ms |
| 2,500 | 1,959 ms (1,942–2,032) | 0.78 ms | 0.6 / 1.4 ms |

## Reading the numbers

- Loop cost grows linearly: about **0.8–0.9 ms per open account per pass**.
- The loop is scheduled every 1,000 ms and never overlaps itself
  (`loopBusy`). Beyond roughly **1,100 accounts with open positions** a pass
  takes longer than the interval, so passes run back to back and the time
  between two risk checks of the same account grows with the pass (about
  2 s at 2,500). Nothing is skipped; risk enforcement just becomes slower.
- Per-request risk-view latency stays around 1 ms and does not depend on
  the number of accounts.

## Single-instance ceiling and caveats

- On this machine the single process keeps a one-second risk cadence up to
  about 1,100 concurrently open accounts.
- Render `starter` instances have far less CPU than this machine, and the
  production database is remote (each query adds network round trips).
  Expect a **considerably lower** ceiling in production. Measure it on
  a staging copy before relying on more than a few hundred concurrently open
  accounts.
- Horizontal scaling of the engine needs a coordination design first
  (`docs/product/STRATEGY.md`); the Blueprint runs `numInstances: 1` on
  purpose.
- The `/admin/operations/metrics` endpoint reports the live engine-loop lag
  (`engineLoop.lagMs`); an alert at more than 10 s means the loop is
  saturated or stalled.

## Reproduce

```bash
createdb openfund_engine_load
DATABASE_URL=postgres://localhost:5432/openfund_engine_load npm --prefix apps/backend run migrate
DATABASE_URL=postgres://localhost:5432/openfund_engine_load npm --prefix apps/backend run seed-plans
DATABASE_URL=postgres://localhost:5432/openfund_engine_load node scripts/ops/engine-load.mjs 200 1000 2500
```
