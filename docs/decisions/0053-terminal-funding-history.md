# 0053 — Terminal Funding and Details tabs, and our own funding history

- **Status:** Accepted (2026-11-23)
- **Scope:** terminal chart panel, backend, schema
- **Item:** batch 2, G

## Context

Traders want to see a market's current funding and borrowing, how open
interest is split, how funding moved over time, and the limits that apply to
their own account. Gains Network documents the current values
(`GET /v1/arbitrum/markets/{symbol}/funding` and
`GET /v1/arbitrum/markets/{symbol}`; the `/markets` list carries the same
funding block for every market) but publishes no funding history. Undocumented
endpoints must not be used, and missing values must never be estimated.

## Decision

1. **Tabs.** The chart panel's tab bar is Chart | Funding | Details | News &
   info. The chart stays mounted; the other three are panels over it. Arrow
   keys (mirrored in RTL), Home and End move between the four tabs, and the
   phone workspace gains Funding and Details views.
2. **Current values** are read through the backend from the two documented
   endpoints (`GET /markets/:symbol/funding`, `GET /markets/:symbol/details`,
   30-second cache) and labelled "Market data from Gains Network".
3. **History is ours.** `sampleFunding` records the funding block of the
   `/markets` list that `market-data.js` already refreshes every minute, once
   per market per hour (`market_funding_samples`, 400-day retention). No
   extra Gains requests are made. `GET /markets/:symbol/funding-history`
   averages samples into 1h, 4h or 1d buckets for 1d, 1w, 1m or 3m ranges and
   offers a range only when the samples cover it; otherwise it answers with
   the date from which data exists. The terminal disables those ranges and
   says so.
4. **Details** shows two separate cards: the Gains market specification, and
   "your Openfund account limits" (the Prop leverage policy ceiling from
   `prop-leverage.js` combined with the market maximum; a challenge plan can
   lower it further). Perpetual accounts follow the Gains market limits.

## Consequences

- History begins on the day this ships and grows by one sample per market per
  hour; the 1w, 1m and 3m ranges become available as samples accumulate.
- Each region samples from its own market feed.
- Annualized values are the hourly rate × 8,760, shown as a toggle, never as
  a prediction.
