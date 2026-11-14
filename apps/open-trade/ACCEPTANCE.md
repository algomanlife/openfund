# Open Trade acceptance record

Source baseline: main `e330cf99ad6f29204132527d9d613431e89bc2b6`.
Branch: `feature/open-trade-desktop`. Version: 0.0.1, internal unsigned beta.

## Audit and reuse boundaries

- Root npm scripts orchestrate independently locked applications.
- Vela 0.10.6 and the patched Pine worker are built by the existing chart build.
  The shared bridge accepts an optional storage key for independent desktop panes;
  existing web defaults remain unchanged. Vela and Gains source are not replaced.
- Gains adapter shares a price socket among chart subscribers and supplies candles;
  missing candle volume remains unknown. No synthetic footprint is generated.
- Existing position-sizing and position-overlay modules supply lot conventions,
  rounding and chart protection semantics. The desktop renderer is a new host UI.
- Backend `/auth/nonce`, `/auth/verify`, `/auth/me`, `/auth/logout`, `/accounts`,
  `/trading/state`, `/trading/stream`, `/trading/preview`, `/trading/order`, existing
  close/cancel/protection endpoints and owned trade details remain authoritative.
- Main-process HTTP carries the same opaque session cookie as the web client.
  Separate web and desktop sessions may coexist for one wallet. No browser-cookie
  import, custom wallet database, backend migration or deployment is introduced.
- Existing Render, DePay, evaluation and web release workflows remain unchanged.
- The two supplied screenshots guide layout only. No TradingView/Ledger graphics
  or brand marks are included in the desktop app.

## Verification

Work in progress. Executed checks and artifacts are recorded here before handoff;
implementation alone is not verification. Public release and signing are blocked
pending owner approval and required distribution credentials/license decisions.
Real WalletConnect/device sign-in is pending a confirmed project ID and wallet.

## Desktop design correction — 2026-11-14

The desktop shell was redesigned against the supplied TradeLocker image. The
38-pixel titlebar, 43-pixel application rail, dominant neutral chart surface,
floating compact order ticket and collapsed-by-default positions strip replace
the initial website-like header and boxed sidebars. Watchlist rows are 29 pixels;
watchlist and order ticket are collapsible, and the ticket can dock. The existing
web terminal's visual design is unchanged.

Settings/account dialogs use alpha surfaces, backdrop blur and subtle highlights.
Keyboard shortcuts: Cmd/Ctrl+1/2/4 chart layout, Cmd/Ctrl+, settings, Alt+W watchlist,
Alt+T order ticket, Alt+P positions, Cmd/Ctrl+Shift+F focus, Escape close dialog.
Right-click the workspace toolbar for its compact panel menu.

### Verified locally

- Actual macOS Electron launch, sandbox/context isolation and no renderer Node.
- One/two/four Vela charts with more than 100 real historical bars in every pane.
- Compact watchlist, floating order ticket, glass settings, Persian/light settings.
- Window resize to 1000 by 720 without document overflow.
- Desktop TypeScript, production build and four IPC policy tests passed.
- Existing web TypeScript, chart/Pine tests and terminal/Quick Trade tests passed.
- Existing Blueprint structural check passed; no backend deployment.
- A warm development launch reached the startup UI in 1,469 ms. One process sample
  reported approximately 623 MiB combined working set after the layout checks;
  this is a single diagnostic sample, not a benchmark or sustained CPU test.

The earlier blank capture waited only for a canvas. The Gains candle request
returned HTTP 200 with real OHLC history; a later capture showed candles. Desktop
acceptance now waits for Vela's load completion and bar count, and the UI exposes
loading explicitly. No provider substitution or fabricated candles were used.

### Visual evidence

- [One chart](../../docs/assets/screenshots/open-trade/chart.png)
- [Two charts](../../docs/assets/screenshots/open-trade/two-charts.png)
- [Four charts](../../docs/assets/screenshots/open-trade/four-charts.png)
- [Glass settings](../../docs/assets/screenshots/open-trade/settings-glass.png)
- [Watchlist and order ticket](../../docs/assets/screenshots/open-trade/watchlist-ticket.png)
- [Resized window](../../docs/assets/screenshots/open-trade/resized.png)

### Pending or incomplete

Real-wallet sign-in remains pending a confirmed project ID and wallet. Generated
signature desktop account acceptance and the full isolated backend suite have not
yet completed. Perpetual account UI, footprint forwarding, panel divider resizing
between chart cells and signed updates are not delivered. Unknown operations
without a provable existing record deliberately remain locked for support review.
Windows/Linux/Intel macOS package verification is recorded from CI when available.
No public release, tag, merge or production deployment is authorized or performed.

### Local macOS package

`Open-Trade-0.0.1-beta-unsigned-mac-arm64.dmg` was built and its packaged
`Open Trade.app` launched successfully through Electron automation with real
Gains history loaded. SHA-256 is in the local `release/SHA256SUMS.txt`. The app
archive contains the desktop `out/` payload and package metadata; backend
source and secrets are not bundled. This is an unsigned, unnotarized internal
review build from the uncommitted working tree, not an official release.
