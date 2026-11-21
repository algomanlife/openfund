# Bilingual product screenshot acceptance

This matrix records required work, not completed captures. Preserve the existing
README and screenshot history. A completed row needs genuine captures of the
current reviewed source/build in both English and Persian.

## Required coverage

| Surface | English | Persian | Required visible state |
| --- | --- | --- | --- |
| Website | Pending fresh capture | Pending fresh capture | Homepage, challenge catalog, company/product gateway; desktop and mobile |
| Prop terminal | Pending fresh capture | Pending fresh capture | Loaded Gains chart, order panel, positions/account context |
| Chart layout | Pending fresh capture | Pending fresh capture | Chart-only view, Quick Trade and preserved chart state |
| Perpetual | Pending fresh capture | Pending fresh capture | Product identity, read-only Gains account/freshness; no simulated live orders |
| Open Algo V5 | Pending fresh capture | Pending fresh capture | Indicator computed on real candles; legend/settings and visible output; retired dashboard absent |
| Price Action Concepts | Pending fresh capture | Pending fresh capture | Computed structure/levels; selected interval and input context |
| Smart Money Concepts | Pending fresh capture | Pending fresh capture | Computed structure/gaps; selected interval and input context |
| Indicator catalog/settings | Pending fresh capture | Pending fresh capture | Three sources selectable and their actual input dialogs |
| Heatmap | Pending fresh capture | Pending fresh capture | Live tiles, size/color legend, selected details and drilldown |
| Trade Radar | Pending fresh capture | Pending fresh capture | Live positioning and tape with source/freshness; desktop and mobile |
| Footprint | Pending fresh capture | Pending fresh capture | Nonempty executed-trade rows, Bid/Ask Ladder plus additional modes and source labels |
| Portfolio | Pending fresh capture | Pending fresh capture | Owned disposable account with genuine recorded test activity |
| Journal/analytics | Pending fresh capture | Pending fresh capture | Metrics, trade review, calendar and notes; simulated/test records labelled |
| Tools | Pending fresh capture | Pending fresh capture | Index plus working calculators with illustrative input/output labels |
| Learning | Pending fresh capture | Pending fresh capture | Learning path, lesson and glossary |
| Checkout and purchases | Pending fresh capture | Pending fresh capture | Current Openfund Pay methods, coupon and recovery/status UI; no real transfer |
| Certificates | Pending fresh capture | Pending fresh capture | Purchase/completion/payout previews and verification using clearly identified test records |
| Economy/transparency | Pending fresh capture | Pending fresh capture | Real available/unavailable state and source/time; no invented totals |
| Backstage | Pending fresh capture | Pending fresh capture | Disposable owner overview, coupons, payment investigation, payout/risk/content views |
| Open Trade 0.0.3 | Pending fresh capture | Pending fresh capture | Packaged build identity, startup, product selector, chart layouts, settings and read-only Gains |

## Capture and provenance rules

- Use the exact reviewed source SHA and record the platform/desktop version,
  release channel, official flag, environment and build identity.
- Capture actual rendered UI. Do not generate illustrations, edit prices,
  fabricate fills, patch balances or label fixture tape as live activity.
- Indicators must have computed contexts and visible output on genuine candles;
  a catalog row or loading canvas does not satisfy running-indicator coverage.
- Footprint must have nonempty real executed-trade rows and a fresh source
  state; do not present a flag/menu, empty layer or outage as working order flow.
- Use anonymous routes or disposable local accounts. Keep personal wallets,
  owner data, credentials and actual treasury operations out of the images.
- Private test records may demonstrate account workflows only when explicitly
  labelled as simulated test activity. No transfer or trade authorization is
  implied by a screenshot task.
- For each final file, record route, language, theme, viewport, source SHA,
  session class, data source, timestamp, SHA-256 and state in manifest.json.
- Visually inspect every capture for loaded content, text clipping, private
  data, readable controls and the intended language. Preserve RTL and LTR
  numeric isolation.
- Keep the original full README/gallery. Add or replace matching captures
  deliberately without removing product coverage.
- Existing historical images remain labelled by their recorded context.

## Available harnesses

- Pine runtime: `CHART_TEST_LIVE=1 TEST_FRONTEND_URL=... npm run test:browser:charts`.
  The existing script covers English Prop and Persian Perpetual; individual
  indicator/product/theme coverage must be extended or captured separately.
- Footprint: `TEST_FRONTEND_URL=... npm run test:browser:footprint` against
  a backend with the feature enabled and real upstream order flow.
- Heatmap/Radar: `TEST_FRONTEND_URL=... npm run test:browser:heatmap-radar:live`.
  Use the script's documented environment contract; deterministic fixture
  captures are different evidence.
- Desktop: `npm --prefix apps/open-trade run test:desktop` on the packaged
  candidate with explicit build identity; follow its acceptance contract.
- General route, typography, account, certificate, checkout, Backstage and CMS
  suites are under `e2e/`.

## Blocker observed in this documentation session

Both the shell execution service and browser runtime failed to start with
a missing-runtime error. No new screenshot was captured. Existing assets do
not satisfy the fresh bilingual acceptance matrix, particularly individual
optimized indicators, live order flow and packaged desktop 0.0.3.
