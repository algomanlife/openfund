# Chart protection refinement

Status: **Completed within local implementation and browser acceptance scope**.
Not merged, released or deployed. Based on main `8539996`.

## Behavior

- Every tradable open position has separate `+ SL` and `+ TP` controls in its
  entry information label. Drag either vertically to create that level; clicking
  or using Enter opens the existing accessible protection dialog. No price is
  chosen or submitted merely by opening the control.
- Existing protection levels have their own drag and remove buttons. Removing
  one sends its value as `null` and preserves the other. It never calls the
  close-position API. Mobile expands the entry label to reveal these controls.
- Pointer capture keeps explicit handle gestures separate from chart pan/draw.
  A six-pixel threshold prevents accidental creation. Cancellation or Escape
  restores confirmed levels. Logarithmic and inverted scale projection is
  inverted from Vela's public price-axis callback; prices snap to its known
  tick size and the existing market precision.
- Native Vela position handles remain available. Their preview uses the actual
  filled quantity and fixed position side; missing levels remain absent until
  the trader creates them. Entry and execution time remain immutable.
- A pending update uses dashed lines, an unconfirmed label and disabled
  controls. Only the existing provider's `modifyRisk` acknowledgement followed
  by its state refresh establishes confirmation. Server rejection or network
  failure restores the last confirmed state. Per-position writes are serialized;
  account or market switches before submission abandon the pending request.
- Labels show estimated **gross** PnL (`quantity * (target - entry) * side`) in
  account currency and signed price movement percentage. Fees, spread and
  slippage are excluded. These are presentation estimates, never execution or
  settlement calculations, and do not claim net PnL or leveraged ROE.
- Footprint has a subtle Beta badge in the existing chart-style picker. Its
  chart type, feed, settings and selection behavior are unchanged.

## Source and editing path

| Responsibility | Source |
| --- | --- |
| Protection controls, submission and Beta decoration | `apps/web-react/public/legacy/terminal.js` |
| Pure display estimate, projection and precision helpers | `apps/web-react/public/legacy/position-overlay.js` |
| Managed Vela drawing behavior | `packages/openfund-charts/src/openfund-drawings.ts` |
| Footprint style release label | `packages/openfund-charts/src/footprint/plugin.ts` |
| Responsive control presentation | `apps/web-react/src/features/terminal/workspace.css` |

The existing Vela English-only/LTR contract is preserved in both FA and EN
application routes. Persian application terminology already uses Entry Price's
approved equivalent in the active terminal dictionary; no backend identifiers or
trading/business rules are renamed. The chart's release label and control text
require the repository release workflow. They are not newly claimed CMS-editable.
The broader content registry must map these sources explicitly.

## Verification

Node 26; fresh dependencies installed with `npm ci --legacy-peer-deps` for the
web application (plain host npm installation encounters the existing TypeScript
peer-lock mismatch). No dependency manifests or locks changed.

- TypeScript, web production build and Blueprint validation: passed.
- Existing terminal suite: 44 passed.
- Chart protection queue and native Vela behavior suite: 5 passed.
- Pure overlay tests cover both sides, all four initial protection states,
  independent deletion, gross-PnL calculation and log/inverted projection.
- Browser test: `TEST_FRONTEND_URL=http://localhost:8396
  TEST_BACKEND_URL=http://localhost:8396 node e2e/test-chart-protection.cjs`.
  Real disposable SIWE wallets, new local PostgreSQL database, live public Gains
  chart, and the existing non-production price-injection seam. No production
  financial records, payment events or blockchain writes.
- Browser sequence on BUY and SELL: create SL from neither level, add TP, move
  each, remove only SL, recreate SL from TP-only state, remove both independently,
  reload and verify the position remains open with both levels absent.
- Responsive bounds and genuine captures: FA/EN, light/dark, widths 1440, 1024,
  768, 390 and 360. Native touch drag tested at 390px; browser runtime errors
  checked. Representative images and detailed result records accompany delivery.
- Footprint picker badge and actual selection checked in Chromium.
- The first Escape-cancellation check exposed missing iframe keyboard focus.
  Explicit handle focus and capture-phase Escape handling corrected it; the
  final browser run includes this regression check.

## Acceptance boundaries

Tests use the existing simulated Prop engine, not live Perpetual execution.
Production wallet/device acceptance and human review remain open. The chart
bundle is rebuilt into both existing tracked deliverables. The unrelated classic
`dist/terminal.js` is preserved; this feature belongs to the active shared React
terminal. Existing build warnings about large chunks remain.
