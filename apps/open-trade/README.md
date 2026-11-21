# Open Trade desktop beta

Open Trade (version in `package.json`, currently 0.0.4) is the Openfund Electron desktop workspace. It uses the
existing Vela workspace, Gains market adapter, SIWE sessions and authoritative
Prop account APIs. It does not contain a backend, account database or P&L engine.
Public distribution is not approved. See [acceptance](ACCEPTANCE.md).

## Development

Use Node 26 and the repository's per-application npm lockfiles:

```sh
npm ci --prefix apps/web-react
npm run build:charts --prefix apps/web-react
npm ci --prefix apps/open-trade
npm run typecheck --prefix apps/open-trade
npm test --prefix apps/open-trade
OPEN_TRADE_BACKEND=https://openfi.cloud npm run dev --prefix apps/open-trade
```

Set `OPEN_TRADE_WALLETCONNECT_PROJECT_ID` to your real project ID before building
or launching. Configure these values before launch. Never
put a private credential in these public settings. `OPEN_TRADE_BACKEND` accepts
current session. No Render environment variable or deployment is needed.

`npm run dev` builds the renderer and launches Electron. It does not use a
privileged remote page. The packaged renderer is served from `open-trade://app`.
The wallet connector uses Arbitrum One, chain 42161; the existing backend checks
the signature, nonce, audience, chain and expiry. Extension wallets are not
injected into Electron. A WalletConnect project ID and an actual wallet are
required for real-device acceptance. Restored backend sessions work without
reconnecting the wallet until they expire.

## Packages

```sh
OPEN_TRADE_BACKEND=https://openfi.cloud npm run package --prefix apps/open-trade
cd apps/open-trade
node scripts/checksums.mjs
```

Use each platform's runner to produce its installers. macOS supports arm64 and
x64 DMGs; Windows uses x64 NSIS; Linux uses x64 AppImage and deb. Outputs go to
`release/`. `npm run package` runs `scripts/package.mjs`: the default
`OPEN_TRADE_CHANNEL=internal` produces `…-internal-unsigned-…` files; `beta` and
`stable` refuse to package without signing (and macOS notarization)
credentials. `npm run verify:signatures` checks checksums, names and, for
signed channels, codesign/notarization or Authenticode on the building runner. The normal
workflow never publishes a release or deploys Render. PRs validate only;
branch builds and manual runs additionally package. Installers include only
compiled desktop code and selected public assets, not backend code or secrets.

## Trading and recovery

Select an owned Prop account after signing in. The active chart selects the
Quick Trade market. Buy/Sell first requests the existing server preview; Confirm
submits with one idempotency key. An ambiguous response locks further trading
and persists the operation ID locally. Reconcile reads existing account and
trade details; it never resends the operation. If the existing API cannot prove
the result (for example an absent/rejected unknown order), keep the lock and
contact support with the operation ID. Do not erase local storage to bypass it.

Position protection uses the existing `of-position` drawing type and backend
protection endpoint. Drawn levels are unconfirmed until the server acknowledges
them. Pending, rejected, disconnected and stale states prevent unsafe submits.
Lotage uses the existing symbol-specific position-sizing module. Unsupported
lot conventions remain unavailable. Perpetual on-chain execution is not enabled.

## Security and distribution

The renderer has no Node access. The preload exports named, validated operations;
main retains HttpOnly session credentials and uses OS encryption where available.
Linux plaintext storage fallback is refused. Without OS encryption the session
is memory-only. Navigation, popups, webviews and permissions are denied. Requests
use a fixed configured backend, reject redirects and never disable TLS checking.

Automatic updates are disabled for unsigned builds. Future signed beta/stable
channels must verify signatures, present a user-approved install action and allow
deferral. Windows signing requires an owner-supplied signing certificate/service;
macOS requires Developer ID and notarization credentials. These are not configured
or read by the unsigned workflow. Do not put signing secrets on PR jobs.

Vela notices and PineTS licenses ship with the application, with a visible Vela
and source link. The existing indicator provenance and first-party/AGPL combined
work questions in [licensing](../../docs/legal/LICENSING.md) remain distribution
blockers. WalletConnect's Community License is also included. Ubuntu and Dastkhat (the
Persian UI font, SIL OFL 1.1, pinned in `assets/fonts/dastkhat/SOURCE.json`)
are used with their license texts; unlicensed Irancell font files are excluded.

## Tests

`npm run test:desktop --prefix apps/open-trade` launches actual Electron and checks
startup, the security preferences, Vela canvases, four charts, settings, RTL/light
mode and resizing. It saves genuine captures and process measurements in
`artifacts/`. `TEST_BACKEND_URL` plus matching `OPEN_TRADE_BACKEND` enables generated
signature and trading acceptance, but only against a loopback test backend using
an isolated database and `SIM_TEST_MODE=1`. Never use a production account for tests.

### Version 0.0.2 beta

The startup region selector reports HTTPS health round-trip times. International
is the default. Iran stays disabled until its endpoint is healthy and operators
explicitly enable it with `OPEN_TRADE_IRAN_APPROVED=1` after confirming shared
accounts and trading state. WalletConnect uses
`OPEN_TRADE_WALLETCONNECT_PROJECT_ID` from launch or build configuration.

Quick Trade opens in the top-right corner of the chart area; drag its header
to move it. Drag the grip above Positions up to open the bottom panel, resize
it, or drag it down to close it (double-click or Enter/Space on the grip
toggles it). The three-chart layout has a resizable left chart and
two stacked right charts. Use Capture in the workspace toolbar to preview,
save, or copy a chart PNG. The preview includes unrealized P&L only when the
account snapshot reports a fresh valuation and has a matching position.

### Version 0.0.4

- Smoother workspace: Gains price ticks are coalesced (250 ms), charts are
  memoised and their position overlays re-sync only when a level changes;
  Quick Trade and the trading panel move without re-rendering the workspace
  on every pointer event.
- Liquid-glass chrome: title bar, side rail, watchlist, workspace bar,
  trading panel and footer are glass over the native window material (macOS
  vibrancy, Windows 11 acrylic; Linux and older Windows use an opaque tint).
  Windows and Linux draw the title bar in-app with native minimise, maximise
  and close controls. Charts stay opaque.
- Openfund chart mark in each chart's bottom-left corner (same glyph and hover
  as the web terminal).
- New app icon and branded installers (macOS DMG window, Windows installer
  welcome/finish pages) rendered from `branding/*.svg` by `scripts/prepare.mjs`.

### Version 0.0.3

- Account selector shows **PROP — Simulated Trading** and **PERPETUAL — Gains
  Account** for the signed-in wallet. Perpetual is a read-only view of
  `/products/perpetual/gains` (positions, orders, latest 100 history events);
  it has no order, approval or transfer control. Switching products does not
  sign out; each product keeps its own chart layout.
- Languages: fa, en, ar, ru, zh-CN (Settings or start screen). Desktop-only
  ar/ru/zh-CN strings ship in English until reviewed
  (`src/i18n-desktop/drafts/` → `reviewed/`).
- Packaged builds accept only `https://openfi.cloud` / `https://openfi.live`.
  A loopback or other HTTPS backend works only in unpackaged development.
- Update notifications open the official GitHub Release; nothing installs itself.
- Tests: `npm test` (unit), `npm run test:security`, `npm run test:i18n`,
  `npm run test:desktop` (real Electron), `npm run test:performance`
  (baseline recorder). Owner steps: [owner setup](../../docs/releases/OPEN_TRADE_0.0.3_OWNER_SETUP.md).
