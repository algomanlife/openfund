# Openfund / independent Persian landing page

Revised 2026-10-31. User requested an original blend of Basedash's quiet editorial rhythm and Carrot's prop-firm business content, not a Carrot clone. Supplied four screenshots, five Persian font files, and authorized five fictional placeholder team members.

## Design and copy
- Centered, spacious hero with a concept account illustration. White primary actions, cool black canvas, readable off-white body copy, restrained mint for data/active states.
- New Persian copy around skill, evaluation, discipline and access to funded accounts. No competitor testimonials, payout records, funding totals, affiliations or performance claims.
- Product illustration is SVG/HTML, separate from live market data and labeled conceptual.
- Openfund emblem geometry retained; mint color variant retained from prior page.
- Team: five generated fictional portraits in an engraved monochrome style; names and roles explicitly identified as illustrative. No claimed biographies or credentials. Portrait strip generated with imagegen and stored locally in assets/team-portraits.png.
- Local Persian fonts: user-provided openfund-2 Regular 400, openfund-5 Medium 500, openfund-4 SemiBold 600, openfund-1 Bold 700, openfund-3 Black 900. Mapping follows font name records; OS/2 weight metadata is inconsistent across these older files. No font file modifications.

## Live market integration
Official docs inspected:
- https://docs.gains.trade/developer/trading-api/market-data.md
- https://docs.gains.trade/developer/trading-api/websocket.md
- https://docs.gains.trade/api-reference/markets/historical-candles.md

Public endpoints used, no keys:
- https://api.gains.trade/v1/arbitrum/markets
- https://api.gains.trade/v1/arbitrum/prices
- wss://api.gains.trade/v1/arbitrum/ws (prices channel, ping/pong, sequence gap resubscription, bounded reconnect delay)
- /markets/{symbol}/candles?interval=1h&from=...&to=...

Actual browser verified successful CORS fetch, incoming live price messages and price changes. Market list/quote schema validated against real endpoint responses. Prices use Mark, not Index. Displayed leverage and spread come directly from Gains market metadata; the page explicitly distinguishes them from Openfund prop-account terms.

24-hour percentage is approximate, computed from the nearest hourly candle close; this is disclosed under the table. Missing/old/closed quotes are not presented as fresh live prices. Closed markets may display the latest available historical close, when supplied. If no valid data is available the page shows a dash, not fictional numbers. Updates render at most roughly once per second. The socket is opened lazily near the market section; it closes while hidden and reconnects on visibility. REST polling every 30 seconds is a fallback for socket disconnection. Initial failures can be retried with the visible refresh button. No alternate providers or access-control workarounds.

## Sample prop account data
Previously authorized non-final Carrot-derived sample fee tables retained:
Start: 5k $11 / 10k $14 / 20k $26; 2 phases; 60% split; 3% total and daily loss; 10% lifetime payout cap.
Standard: 10k $25 / 50k $149 / 100k $309; 2 phases; 80% split; 6% total, 3% daily loss; no lifetime cap.
Single: 10k $79 / 50k $339 / 100k $549; 1 phase; 80% split; 3% total/daily loss; no lifetime cap.
These are illustrative Openfund terms, not an activated service. No invented combinations or pricing formula. Payment, wallets and challenge creation remain inactive. Selection opens an explicit sample-terms review dialog.

## Verification
- JavaScript syntax for app.js and market.js.
- Actual browser: supplied Persian font loaded, all local images load, five team members, working links and mobile menu.
- Account preset and size changes update fee, profit split, loss limit and cap; one-phase path hides second phase; modal review and Escape close checked.
- Live market rows populated, price changed between observations, Forex filter/search/no-result state and real historical chart checked.
- Desktop and 390px mobile screenshots inspected; no document horizontal overflow. Market table uses its own intentional horizontal scroll on narrow screens.
- Prior layout saved in Git at fdc0207b5cba6b2b76b091a3309a8e76c298d520 and ../Openfund_Landing_FA-before-original-layout.zip.
