# Openfund Markets Page — Gains Network Integration

Status: **Operational (verified 2026-11-01)** · Route: `#/fa/markets`, `#/en/markets`

## Purpose

A standalone market-discovery page presenting the full Openfund instrument universe
with live mark prices, category filtering, normalized search, and one-click deep-links
into the trading terminal. It is the public answer to "what can I trade here?" and the
Product B entry point of the Home gateway.

## Authoritative data source

**Gains Network public API** — identical endpoints and protocol to the terminal
integration (see `GAINS.md`). The page does NOT use any competitor data source and does
not hardcode instrument lists; everything below is derived from live metadata:

| Data | Source | Notes |
| :--- | :--- | :--- |
| Instruments & metadata | `GET /v1/arbitrum/markets` | 488 symbols; symbol, base, quote, group, pricePrecision, maxLeverage, spreadRate, isOpen |
| Mark prices (REST seed) | `GET /v1/arbitrum/prices` | initial fill before the stream connects |
| Mark prices (live) | WS `wss://…/ws`, `prices` channel | shared singleton, ping/pong, seq-gap resubscribe |

Fields Gains does **not** provide (volume, 24h change, liquidity, market cap) are never
invented — the cards simply omit them.

## Architecture

```text
features/markets/
├── Markets.tsx         # page: hero + animated asset universe + toolbar + card grid
├── marketsData.ts      # PURE logic: filtering, normalized search, price formatting,
│                       #   staleness — unit-tested (test/markets.test.mjs)
├── useGainsMarkets.ts  # loads legacy/gains-adapter.js once, subscribes to the SHARED
│                       #   prices WebSocket, batches updates at ~1s (landing cadence)
├── MarketIcon.tsx      # reusable asset icons (curated identity map + neutral fallback)
└── markets.css
```

- **Shared data source:** the hook injects the existing `legacy/gains-adapter.js`
  (`window.OpenfundGains`) — the same module the terminal uses — so there is exactly one
  prices WebSocket per browser page. No second price engine exists.
- **Teardown contract:** because the page owns that script runtime, leaving Markets
  reloads the browser (same contract as Landing/Terminal/Portfolio); the terminal
  therefore always boots against a clean adapter singleton.
- **Performance:** updates are buffered and flushed on a ~1s cadence; category lists are
  memoized; long lists render in pages of 120 cards with `content-visibility:auto`;
  animations are CSS-only and disabled under `prefers-reduced-motion`.

## Categories

Derived from the `group` field of live metadata (labels localized in
`marketsData.ts`): crypto, forex, stocks, indices, commodities. Counts shown next to
each tab come from the data, never hardcoded.

## Search

Client-side, normalized (case + Persian/Arabic digit folding), matching against symbol,
base, quote and category. English input works while the interface is Persian.

## Terminal deep-links

Selecting a market stores `of-terminal-symbol` in sessionStorage and navigates to
`#/terminal`; terminal boot consumes the value **once** and only if the symbol exists in
Gains metadata, then selects it (and its category) in the market selector. This is the
single narrowly-scoped terminal change in the feature.

## Honest limitations

- Prices are Gains **mark** prices on the data source's feed; the page never implies
  execution. Execution in this phase is simulated (stated on the Home gateway note).
- Closed markets (`isOpen:false`) remain visible and selectable for browsing, consistent
  with the terminal's view-only handling.
- The classic `dist/` deployment still shows the pre-gateway navigation; the React app
  at `/react/` is the authoritative website.
