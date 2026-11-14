# Open Trade desktop beta

Open Trade 0.0.1 is an internal Electron companion to Openfund. It uses the
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
or launching. Both configuration values can also be saved in Settings. Never
put a private credential in these public settings. `OPEN_TRADE_BACKEND` accepts
HTTPS origins and HTTP loopback for isolated tests. Saving settings logs out the
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
`release/` and explicitly contain `beta-unsigned` in their names. The normal
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
blockers. WalletConnect's Community License is also included. Ubuntu and Vazirmatn
are used with their license texts; unlicensed Irancell font files are excluded.

## Tests

`npm run test:desktop --prefix apps/open-trade` launches actual Electron and checks
startup, the security preferences, Vela canvases, four charts, settings, RTL/light
mode and resizing. It saves genuine captures and process measurements in
`artifacts/`. `TEST_BACKEND_URL` plus matching `OPEN_TRADE_BACKEND` enables generated
signature and trading acceptance, but only against a loopback test backend using
an isolated database and `SIM_TEST_MODE=1`. Never use a production account for tests.
