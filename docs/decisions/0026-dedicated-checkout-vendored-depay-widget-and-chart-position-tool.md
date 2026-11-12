# ADR 0026 — Dedicated checkout, vendored DePay widget and the chart position tool

- **Status:** Accepted (implementation on branch `agent/claude/depay-checkout-chart-ux`; not deployed)
- **Date:** 2026-11-12

## Context

The Challenge checkout never opened a real DePay payment window. The React
panel loaded DePay only from an external CDN bundle
(`integrate.depay.com/buttons/v13.js`) pinned by a hand-computed Subresource
Integrity hash. That required four public variables plus a CSP exception, and
production had none of them (see [Activation](../payments/ACTIVATION.md)). The
pin also breaks every time DePay republishes the moving `v13.js` file, and the
CDN refuses non-browser clients, so the hash can not be computed in CI.

The official npm package `@depay/widgets` declares React 18 as a peer
dependency, while the Openfund frontend runs React 19.

On the chart, the Long/Short box was Vela's own `position` drawing. Its whole
body and its entry handle could be dragged, its labels cluttered the candles,
and the BUY/SELL execution markers used Vela's full-size arrow marks.

## Decision

### Payment widget

- Vendor the package's self-contained UMD build
  (`@depay/widgets@13.0.45/dist/umd/index.bundle.js`, MIT, React included,
  global `DePayWidgets`) at
  `apps/web-react/public/assets/vendor/depay-widgets-13.0.45.js`.
  `scripts/upstream/vendor-depay-widgets.mjs --update` downloads it, checks the
  tarball against the npm registry's published sha512 integrity, writes the
  licence and generates `src/features/purchase/depay-bundle.ts` with the
  browser's SRI hash. Without `--update` the script verifies the files offline.
- The widget is loaded on demand, same-origin, SRI-pinned. No CSP change is
  needed. `VITE_DEPAY_INTEGRATION_ID` alone enables it; `VITE_DEPAY_WIDGET=0`
  disables it. `VITE_DEPAY_WIDGET_URL` + `VITE_DEPAY_WIDGET_INTEGRITY` remain
  an optional override for an externally hosted bundle.
- The checkout calls the documented managed integration,
  `DePayWidgets.Payment({ integration, payload: { orderId } })`, with the
  client callbacks `sent`, `succeeded`, `validated`, `failed`, `closed`,
  `critical` and `error` used for interface state only. Openfund passes no
  `accept`, `allow`, `deny` or network list, so it never narrows DePay's
  wallets, networks or payer tokens. The accepted settlement chains, tokens,
  receivers and the order's server price still come from the signed dynamic
  configuration.

### Dedicated checkout

`/:locale/checkout` replaces the dialog panel as the single checkout
implementation. The challenge builder hands its selection to it, and
`?order=<id>` resumes or revisits a purchase. A receipt endpoint returns only
verified records. A provisioning failure after a payment is proven on-chain
stays a retryable attempt (`provisioning_retry`), so the recovery sweep issues
the challenge exactly once and the customer is never asked to pay again.

### Chart position tool and markers

Vela hands drawings to its renderer as serialized records and rebuilds them
from `type`. Openfund therefore registers its own types through Vela's
drawing registry (`packages/openfund-charts/src/openfund-drawings.ts`); the
vendored Vela source is unchanged:

- `of-position` (a `PositionTool` subclass): body translation and the entry
  handle are no-ops, and stop/target handles move price only. A level the
  position does not have has no handle, and a level is clamped to its own side
  of the entry. Labels are painted only while dragging.
- `of-exec-buy` / `of-exec-sell` (arrow-mark subclasses): a 7 px triangle 3 px
  off the candle low/high with a 10 px label beyond it.

The terminal validates an edit (`OpenfundPositionOverlay.riskEdit`) before
submitting it through the existing `modifyRisk` service, shows it as
unconfirmed (dashed lines) and redraws the confirmed state afterwards.
Position information moves to compact labels on the right. They are aligned to
each entry row through Vela's public `priceAxisTicks` hook and stacked without
overlap. "Chart Settings → Trading" is contributed through
`renderer.setSettingsSections` and stored in the per-wallet chart workspace
settings ([ADR 0023](0023-per-wallet-chart-workspaces.md)).

## Consequences

- A 3.6 MB vendored file is tracked. Updating DePay is an explicit, reviewed
  version bump through the vendoring script.
- The widget still talks to DePay's own APIs from the browser. A real payment
  additionally needs the owner's DePay dashboard settings and the server
  settlement configuration.
- Vela upgrades must keep `PositionTool`, `ArrowMarkUp`/`ArrowMarkDown`,
  `registerDrawingType`, `priceAxisTicks` and `setSettingsSections`
  compatible. `e2e/test-terminal-risk-workspace.cjs` covers them.
