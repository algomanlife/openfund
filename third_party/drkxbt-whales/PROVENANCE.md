# Adapted source — drkxbt/whales

- **Upstream repository:** <https://github.com/drkxbt/whales>
- **Reviewed commit SHA:** `34d55756cc1228c8dd0a558d60d49308dc6920e8` (2026-10-29)
- **License:** MIT, © 2026 drk. [LICENSE](LICENSE) and [NOTICE](NOTICE) are
  byte-identical copies of the upstream files.
- **Shipped notice:** `apps/web-react/public/assets/notices/drkxbt-whales-MIT.txt`
  (LICENSE followed by NOTICE).

## What Openfund uses

No upstream file is copied verbatim. The following logic was re-implemented in
JavaScript/TypeScript from the upstream TypeScript, keeping its behaviour:

| Upstream (`whales/`) | Openfund location | Changes |
| --- | --- | --- |
| `board.ts` — `condenseBoard` (leaderboard condensing, $100K monthly-volume filter) | `apps/backend/radar.js` | Keeps 200 traders per window instead of 1000; display names trimmed to 40 characters; JSON-safe `null` instead of `NaN` |
| `api.ts` — `toMarkets`, `toAccount`, `toFill`, `toTrade`, `toPnl`, request limiting, 429/5xx back-off, shared in-flight requests | `apps/backend/radar.js` | Runs on the Openfund backend for all viewers; a failed refresh serves the last good answer marked `stale`; spot pairs and coin logos are not used |
| `model.ts` — `positioning`, `fillRecord`, `sparkline` | `apps/backend/radar.js`, `apps/web-react/src/features/radar/RadarPage.tsx` | Adds per-coin *concentration* (share of tracked whale notional); holder lists capped at 8 |
| `tape.ts` — trades websocket, $10K floor, de-duplication, ping, back-off | `apps/backend/radar.js` | One shared server socket, started on demand and stopped after 5 idle minutes; browsers poll the backend |

The upstream demo, its fonts (Geist, SIL OFL), recorded sample data, tour and
the `app.ts` interface are **not** used. Openfund's interface is its own.

## Data and trademarks

Data comes from Hyperliquid's public info API, websocket and leaderboard.
Hyperliquid is a trademark of its owner; neither upstream nor Openfund is
affiliated with or endorsed by Hyperliquid (see [NOTICE](NOTICE)).
