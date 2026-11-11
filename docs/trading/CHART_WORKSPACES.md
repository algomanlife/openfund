# Chart workspaces and live position overlays

## Per-wallet chart workspace

A signed-in wallet's Vela chart workspace is stored by the Openfund backend in
PostgreSQL and restored on the next sign-in, in any browser or device.

| What | Where it is kept |
| --- | --- |
| Timeframe, indicators and their inputs, chart style, panels and the selected symbol (Vela workspace state) | scope `*`, field `workspace` |
| Renderer configuration (scales, display preferences) | scope `*`, field `config` |
| Drawing-tool defaults | scope `*`, field `tools` |
| User drawings of one market (trend lines, levels, Fibonacci tools, zones, text…) | scope `<symbol>`, e.g. `BTC/USD` |

Not stored: live position risk/reward overlays (rebuilt from position state),
keys, signatures, session material or any authentication token.

### API (session-owned)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/chart/workspaces/:workspace` | Every entry of the signed-in wallet for `prop` or `perpetual` |
| `PUT` | `/chart/workspaces/:workspace/:scope` | Body `{ data, schemaVersion, baseRevision }`; `baseRevision` 0 creates |

- The owner is always `req.user` from the session cookie. No address or user id
  is read from the request.
- `409 stale_revision` returns the stored entry: a stale tab or device adopts
  the newer copy instead of overwriting it.
- `409 identity_mismatch`: the terminal document sends the identity it was
  built for (`X-Openfund-Chart-User`); a save that arrives after the session
  changed to another wallet is refused.
- Limits: 200 KB per entry, 120 entries per wallet and workspace, request body
  256 KB.
- Table `chart_workspaces` (`apps/backend/schema.sql`), additive and
  idempotent; deleting a user cascades.

### Browser behaviour (`apps/web-react/public/legacy/chart-workspace.js`)

- The React shell publishes the chart identity (session user id or guest) and
  remounts the terminal document when it changes (sign-in, sign-out, wallet
  switch). One document only ever shows one identity's workspace.
- The signed-in wallet's workspace is fetched before the chart mounts, so the
  default chart initialization cannot overwrite a restored state.
- The local cache is namespaced per identity (`<key>@<userId>`). Guests keep
  the original browser-only keys.
- Saves are debounced (1.2 s), one request per scope at a time. Network or
  database failures keep the local cache and retry every 15 s and on `online`.
- Drawings saved before this feature (shared browser keys) are adopted once,
  by the first wallet that signs in on that browser with an empty server
  workspace.

## Live position risk/reward overlay

Each open position on the selected symbol that has a Stop Loss and/or a Take
Profit is drawn on the chart from authoritative position state
(`legacy/position-overlay.js` builds the model, `terminal.js` draws it with
Vela's position tool).

| Position | Drawn |
| --- | --- |
| LONG | Loss zone entry → SL below the entry; profit zone entry → TP above |
| SHORT | Loss zone entry → SL above the entry; profit zone entry → TP below |
| SL only / TP only | Only that zone; no ratio; the box is read-only |
| Neither | Nothing (no invented levels) |

- Labels: price-distance percentages and level prices. They are not leveraged
  ROE, gross PnL or net PnL. The Vela tool's own "Loss · Size" line (computed
  from a hypothetical balance) is hidden.
- `R:R` = |TP − entry| / |entry − SL|, shown only when both levels exist and
  the risk is non-zero.
- One overlay per position id; a compact legend lists side, entry, SL, TP and
  R for each and selects that position's box.
- Overlays update on every position update and after a confirmed SL/TP save,
  disappear when a position closes or the symbol changes, and are rebuilt
  after a refresh or sign-in. They are never saved as user drawings.

## SL/TP dialog and order review

- Price fields accept English, Persian and Arabic-Indic digits and the locale
  decimal separator (`legacy/numeric-input.js`); the text is converted
  without rounding before the existing validation. Unreadable input is
  reported and never sent.
- The dialog closes only after the provider confirms the update; a rejected
  update keeps the previous levels and shows the server's message.
- The order review lists one label/value pair per row with technical values
  isolated left-to-right. The values are the ones the order form computed and
  confirmation uses the same submission path.

## Tests

`apps/backend/test/chart-workspaces.test.mjs` (PostgreSQL),
`apps/web-react/test/terminal-risk.test.mjs`, and the browser journey
`e2e/test-terminal-risk-workspace.cjs` (two disposable wallets, real SIWE and
PostgreSQL, live public prices).
