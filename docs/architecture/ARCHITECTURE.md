# System architecture

P0 audit correction: the earlier mutable 8080 preview lost its frontend manifest and was unversioned. Clean-context real clicks verify white light canvases, not the owner Opera profile (permission unavailable). Final candidate hashes, pipeline outcomes and canonical extracted-archive captures are tracked in [P0 evidence](../../docs/assets/screenshots/manifest.json). Historical captures and prior matched-runtime claims do not identify the final build. Official v0.2.0 and integrated base `d05b4b8` remain unchanged; owner acceptance is open.

Integrated source baseline: `d05b4b88fc2776e09bf1a701254ac229e8145a7f`, including merged PR #42. Official v0.2.0 remains `561e7f3101f3a43376068d9bba1a87c30e2b7d71` (PR #40/#41); PR #42 is implemented but unreleased. The community/native-light-theme addendum is locally captured and UNRELEASED; local white-theme refinement acceptance is verified; official review and deployment remain open. [Current evidence](../reviews/community-theme/DELIVERY.md). The application is a React frontend and Node.js API with persistent Prop simulation, Gains read integrations, SIWE and editorial Directus. [Feature Status](../product/FEATURE_STATUS.md) records delivery boundaries.

![Openfund system architecture](../assets/diagrams/system.svg)

## Runtime graph

```mermaid
flowchart TB
  Browser[Browser React and wallet UI] -->|same origin / and API| Node[openfund Node.js API]
  Browser -->|public published content| CMS[openfund-cms Directus 11.17.4]
  Browser -->|REST candles and WS marks| Gains[Gains market data]
  Node -->|server execution marks and wallet reads| Gains
  Node --> Auth[SIWE sessions and ownership]
  Node --> Engine[Prop simulation and SSE]
  Node --> Product[Product portfolio and journal API]
  Node --> Commerce[Gated purchases invoices and withdrawal requests]
  Commerce --> DB
  Auth --> DB[(openfund-db PostgreSQL 17)]
  Engine --> DB
  Product --> DB
  CMS -->|editorial catalog and CMS tables| DB
  CMS --> Uploads[Persistent uploads disk]
```

## Source and build boundaries

| Location | Responsibility |
| --- | --- |
| `apps/web-react/` | React/TypeScript routes, product views, wallet/session contexts and authoritative public legacy assets |
| `apps/backend/` | Express auth, ownership, simulation engine, market data, portfolio and product APIs; additive schema migrations |
| `apps/backstage/scripts/` | Directus schema and published-content seeding/admin utilities |
| `packages/openfund-charts/` | Openfund Vela bridge; script-load mirror in `dist/` |
| `packages/openfund-gains-adapter/` | Gains REST/WS market provider; script-load mirror in `dist/` |
| `packages/cms-client/` | Shared CMS contract; actual React client lives in app source |
| `packages/openfund-ui/`, `apps/web/`, `apps/terminal/` | Ownership/contract directories; not additional deployed applications |
| `vendor/`, `third_party/` | Preserved upstream sources, attribution and analytical core provenance |
| `dist/` | Source-critical classic compatibility deliverable; not disposable build output |
| `react/` | Tracked historical build plus output of the current Vite build; Render rebuilds from `apps/web-react/` |

The root package orchestrates commands and repository tooling. Applications install from their own lockfiles. `packages/openfund-protocol/` already contains dormant Solidity source, tests and provenance; it is not connected to operational venue routing.

## Financial authority

`engine.js` and `trading-math.js` own Prop simulated mutations and Decimal valuation. PostgreSQL stores virtual funding, orders, positions, ledger entries and sampled risk telemetry. Browser values never authorize execution. SSE pushes account updates while the engine monitors pending orders/protection in the API process.

Perpetual account data comes from official Gains wallet endpoints via `gains-portfolio.js`, using the SIWE session wallet. Missing values stay unknown. Prop-only aggregate APIs reject Perpetual use; product identity is not a cosmetic tab over shared money state.

Portfolios and notebooks use session ownership and product/account scope. Financial rows are distinct from editable journal metadata. [Product API contract](PRODUCT_TERMINALS.md) provides endpoint details; [Prop Trading](../trading/PROP.md) documents calculations and assumptions.

## Identity and editorial authority

SIWE establishes one normalized wallet identity and an opaque first-party session. Prop uses Sepolia sign-in context; Perpetual uses Arbitrum One. Both are connection/authentication paths, not transaction approval. [Identity](../wallet/IDENTITY.md) and [flows](FLOWS.md) describe replay, expiry and switch handling.

Directus shares the managed PostgreSQL service and edits catalog/editorial collections. Public read permissions allow published content only. The Node API remains the ownership and financial boundary; CMS public access must not expose user/session/trading tables. No second backend authentication system is introduced.

## Deployment boundary

The [Render Blueprint](../../render.yaml) preserves exactly `openfund`, `openfund-db` and `openfund-cms`. The Node service builds React and serves it from the site root with a browser-history SPA fallback (the former `/react/` prefix is a permanent redirect plus a compatibility asset mount), and hosts the API, SSE and one engine loop. Directus uses its official image and persistent uploads disk. There is no separate frontend service, queue, worker or Redis. Horizontal engine scaling requires coordinated ownership before deployment.

See [Render operations](../deployment/RENDER.md), [Database](../deployment/DATABASE.md), [technology registry](TECH_STACK.md), and [ADRs](../decisions/README.md). Configuration and local checks do not establish a live deployment.

## Public presentation and commerce boundaries

Public footer markup remains in `apps/web-react/src/pages/landing-body.html`;
`InformationShell.tsx` extracts it for editorial routes, and `Landing.tsx` hosts
the existing challenge runtime. Persian gateway `Home.tsx` explicitly disables its
footer; English Home uses the shared landing and retains its footer. PR #42's reusable Telegram presentation
is mounted only by public layouts; TerminalShell and authenticated workspaces
retain their own navigation. The addendum's shared provider-configured Telegram/Discord
controls are locally captured and UNRELEASED: public Heroes/Footers only, with provider-specific
validated owner URLs and unavailable non-navigating states. Native light-theme
corrections must reuse the existing `data-theme` / persisted `of-theme` state and
supported Vela APIs; current white canvases and readable text are verified through
local anonymous and generated-session acceptance, with genuine bilingual captures.
No provider homepage is an Openfund community destination. Public platform cards communicate
availability only; unified release archives are web/API payloads, not installers.

Merged PR #41 adds `apps/backend/purchases.js`, `invoice-pdf.js`, additive order,
payment, invoice and withdrawal tables, `/auth/profile`, and frontend
`features/purchase`. Server-side pricing, session ownership, receipt verification
and atomic provisioning remain authoritative. `PURCHASE_PAYMENT_RECEIVER` gates
ordering; the DePay widget is opt-in. Displaying its footer logo does not enable
payments. Withdrawals record requests intended for later operator review; no
operator review interface or payout settlement is established. Purchased challenge
records remain read-only, not evaluated or funded accounts. [Design decision](../decisions/0009-challenge-purchases-and-payment-verification.md).
