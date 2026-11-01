# Audit — LuxAlgo Trade Journal integration (Portfolio)

> Audit date: 2026-11-01 · Branch: `qwen/portfolio-journal`
> Upstream: https://github.com/LuxAlgo/trade-journal @ `834e7b68f553d1aba0d7777875cdc4622f5a7eb5` (MIT)

## Upstream inspection

| Component | Finding | Reuse decision |
|---|---|---|
| `packages/core` (`@luxalgo/journal-core`) | dependency-free analytics: round-trips, metrics, equity/drawdown, daily stats, aggregation | **REUSED** — vendored under `third_party/` (sources + esbuild dist) |
| `apps/web` | Next.js app with its own auth (Supabase), DB, importers | NOT reused — Openfund has its own React app, auth, DB (would violate single-source-of-truth) |
| `packages/importers` | broker/CSV importers | NOT vendored — external imports are explicitly out of scope for Openfund |
| License | MIT © 2026 LuxAlgo Global, LLC | Preserved in `third_party/luxalgo-trade-journal/LICENSE` |

## Integration architecture

- **Vendor:** `third_party/luxalgo-trade-journal/` — journal-core sources byte-identical to the upstream commit, MIT license, PROVENANCE.md (SHA, scope, build script). No submodule.
- **Single source of truth:** the Openfund engine/PostgreSQL remain authoritative; `apps/backend/portfolio.js` only READS positions/ledger and adapts rows into journal-core `RoundTrip` shapes (id-preserving keys `accountId|symbol|direction|openedAt`).
- **Wallet isolation:** every `/portfolio/*` endpoint resolves the account from the session — client ids are never trusted; notes are user-private.
- **No external accounts:** no import/CSV/broker features exist in the UI or API (probed 404).
- **Equity honesty:** the curve is labeled "realized" (cumulative net PnL per close) — no fabricated mark-to-market history.

## Reused journal-core APIs

`computeOverview` (metrics + curves), `equityCurve`, `dailyStats` (PnL calendar, UTC policy), `drawdown`, `bySymbol/byDirection/byAssetClass`.

## Openfund files

- `apps/backend/portfolio.js` (adapter + Portfolio class), `/portfolio/*` routes in `server.js`, `trade_notes` table
- `apps/web-react/src/pages/Portfolio.tsx` + `portfolio.css` + `portfolio-body.html` (shared terminal header for identical look)
- route `#/portfolio` in `main.tsx`; terminal nav «پرتفوی» link enabled

## Test evidence

- Backend suite `test/portfolio.test.mjs` — **31/31** (auth/ownership, metrics vs independent expectations, calendar, buckets, pagination/filters, details, notes privacy, no import endpoints)
- Browser E2E `e2e/test-portfolio-e2e.js` — **36/36** (the 20-step acceptance scenario + Persian digits + reconnect/isolation + Directus admin + no page errors)
- Full matrix after integration: SIWE 22/22 · engine 54/54 · regressions 19+9+11 (dev) and trading 23 + portfolio 36 (build) — nothing regressed
- Fixes found during integration: CORS preflight needed PUT; terminal periodic functions needed teardown guards (page-transition races)

## Known limitations

- Equity curve is realized-basis (documented label) — no historical mark-to-market snapshots exist
- Trade Replay not implemented (no intrabar data; honest exclusion per the master prompt)
- journal-core math is floating-point (analytical views only; authoritative totals come from NUMERIC columns)
