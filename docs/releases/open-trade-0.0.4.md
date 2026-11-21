# Open Trade 0.0.4 — release notes (internal build)

Open Trade's version is independent of the Openfund platform version. Tag when
published: `open-trade-v0.0.4`.

**Status: internal unsigned build.** Installers come from the
`Open Trade desktop` workflow (`channel=internal`) and are named
`…-internal-unsigned-…`. They are not signed or notarized and are not for
public distribution.

## What changes

- **Performance.** The workspace no longer re-renders on every Gains price
  tick: ticks are coalesced and committed every 250 ms. Charts are memoised
  and only re-render when their symbol, timeframe, theme, locale, account or
  position overlay changes; overlays are re-drawn only when an entry, stop or
  target moves. Dragging Quick Trade or the trading panel writes styles
  directly and commits once on release. Floating glass uses an 18 px blur
  instead of 30 px.
- **Quick Trade** opens in the top-right corner of the chart area. Saved
  positions from 0.0.3 (bottom-left default) are not carried over.
- **Trading panel** can be opened, resized and closed by dragging its grip;
  below 72 px it snaps closed. Double-click, Enter/Space and arrow keys on the
  grip also work.
- **Liquid-glass chrome.** Title bar, side rail, watchlist, workspace bar,
  trading panel, footer and docked Quick Trade are translucent over the native
  window material: macOS vibrancy and Windows 11 acrylic. Linux and Windows 10
  use an opaque tint. Windows and Linux now draw the title bar inside the app
  with native minimise, maximise and close controls that follow the theme.
  Charts stay opaque.
- **Chart branding.** Each chart shows the Openfund "O" mark in its
  bottom-left corner, revealing "Openfund · Chart by Openfund Data" on hover,
  as in the web terminal. It is included in chart captures.
- **Icon and installers.** New app icon (the Openfund mark on a liquid-glass
  hexagon over a rising chart). The macOS DMG window and the Windows installer
  welcome/finish pages carry the logo, a short English description,
  `https://openfi.cloud` and `https://github.com/algomanlife/openfund`.

## Not in this release

Signing and notarization, automatic updates, live Gains execution and the
reviewed ar/ru/zh-CN desktop strings (one new string has a draft).
