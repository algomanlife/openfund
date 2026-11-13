# ADR 0027 — Trading stream fan-out, equity sampling and engine-loop isolation

- **Status:** Accepted (implementation on branch `agent/claude/capacity-optimization`; not deployed)
- **Date:** 2026-11-13
- **Evidence:** [Capacity optimization 2026-11-13](../reviews/capacity-2026-11-13/REPORT.md)

## Context

The [2026-11 capacity assessment](../reviews/capacity-2026-11/REPORT.md) and a
fresh baseline of `main` at `0c0c52a` (Node 26, Express 5) measured the same
first bottleneck: database work per connected chart user on one 10-connection
pool in one Node process.

- Every `/trading/stream` connection ran, every second and again on every state
  change of *any* account, a session `SELECT`, an `UPDATE auth_sessions SET
  last_seen` and a full `engine.state()` transaction. At 300 chart users each
  stream received 8–9 events per second.
- Every `engine.state()` of a free-demo account wrote an `account_equity_risk`
  upsert and an `account_equity_samples` insert as two autocommit statements.
- The engine monitoring loop queued for connections behind API reads; at 300
  chart users a pass took 3.4 s (p50) and SL/TP was checked every few seconds.

The task forbids changes to trading rules, financial formulas, response
contracts, authentication strength and transaction guarantees.

## Decision

1. **Shared stream scopes** (`apps/backend/trading-stream.js`). One scope per
   (wallet, trading account) holds every open stream (tab) of that scope. A push
   checks all sessions of the scope in one query with the existing rule (valid,
   unexpired, user `active`), computes one fresh `engine.state()` and writes the
   same JSON to every tab. Engine events are routed by account id; a scope whose
   account id is not yet known reacts to every event. A change during an
   in-flight push is coalesced into one follow-up push. A reader whose socket
   buffer is full keeps only the newest snapshot until it drains. Logout ends
   the session's streams immediately.
2. **`last_seen` throttling.** `auth_sessions.last_seen` is bookkeeping that
   nothing reads; it is written at most once per minute per session. Sessions
   are still read and validated on every request and before every push.
3. **Equity sampling.** The two sampling writes run as one data-modifying CTE.
   For an account without open positions (equity equals the stored balance),
   repeating the same equity within the same database minute is a provable
   no-op and is skipped; the returned risk view is identical. Accounts with
   open positions are written on every sample. The loop samples with a narrow
   read (account and open positions) instead of a full `state()`.
4. **Engine-loop pool.** Work started by the monitoring loop uses a dedicated
   pool of at most 3 connections, selected with `AsyncLocalStorage` for the
   duration of a pass. SQL, transactions, row locks and the per-account mutex
   are unchanged. The API pool stays at the `pg` default of 10.
5. **Graceful stop.** `engine.stop()` resolves when the running pass ends;
   shutdown waits for it before ending the pools.

## Consequences

- Equivalence with `main` is checked by
  `scripts/capacity/harness/equivalence.mjs` (same deterministic order and price
  sequence, identical normalized financial state) and by the new unit and
  DB tests. No API response shape, rule, formula or rounding changed.
- One backend instance is still required: the scopes, the session-touch record,
  the sampling record and the engine loop are process-local. Horizontal scaling
  needs the coordination described in the report's proposal.
- Total database connections of the `openfund` service grow by at most 3.
- The no-op sampling skip relies on the engine being the only writer of
  `account_equity_risk` (true today). A direct database edit of that table would
  be overwritten at the next minute, not immediately.

## Rejected alternatives

- Raising the pool size: measured worse in 2026-11 (queueing moves into
  PostgreSQL).
- Caching account state for the stream or `/products/prop/context`: would serve
  financial state that is not freshly read.
- Reordering the loop (SL/TP sweep before the per-account sweep) or running the
  per-account sweep concurrently: changes risk-processing order; proposed for
  owner approval instead of implemented.
