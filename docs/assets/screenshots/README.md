# Genuine application screenshots

Captured 2026-11-02 from the current source at baseline `2f5cf93`, built with `npm run build:web` and served by the matching Node backend at local port 8186. [manifest.json](manifest.json) records routes, viewports, account state and timestamps. All images are unaltered 1440 × 1000 browser captures, consistently framed by the native application header and GitHub gallery tables.

## Provenance

Public pages use the existing local Directus instance on port 8055 through public read endpoints and live Gains market data. No request interception, fabricated prices, chart fixtures, CMS fixtures, injected trading history or hand-drawn UI was used. Network availability and prices are capture-time observations.

Account images use a disposable generated in-memory wallet, actual ECDSA/SIWE verification and a separate local PostgreSQL test database. The real backend issues its normal 100,000 virtual-DAI practice account. No trades, notebook entries, deposits, approvals or blockchain transactions were created. The wallet address is a generated documentation identity, not personal wallet information. Its session was revoked and its private key discarded after capture. [Account capture utility](../../../scripts/docs/capture-account.cjs) enforces a localhost target and uses no financial response fixtures.

## Gallery

| Home | Markets |
| --- | --- |
| ![Current English Home gateway](home.jpg) | ![Current Markets with live Gains information](markets.jpg) |
| **Prop Terminal — anonymous account** | **Perpetual Terminal — anonymous read-only context** |
| ![Prop chart and disabled anonymous trading controls](prop-terminal.jpg) | ![Perpetual chart and read-only trading controls](perpetual-terminal.jpg) |
| **Challenges — published catalog** | **Prop Portfolio — new virtual account** |
| ![Challenge catalog; purchase and activation remain future capabilities](challenges.jpg) | ![Real local virtual account with no trades and normal initial funding](prop-portfolio.jpg) |
| **Journal — empty private notebook** | **Account analytics — new account** |
| ![Actual private Journal with no seeded entries](journal.jpg) | ![Actual new-account dashboard without manufactured performance history](analytics.jpg) |
| **Account / Profile — generated documentation identity** | **Wallet connection — unconnected modal** |
| ![Actual Openfund profile for disposable local test identity](account-profile.jpg) | ![Actual wallet connection modal with no personal wallet](wallet-connection.jpg) |
| **Perpetual Portfolio — new wallet, live provider reads** | **Transparency — labelled sample interface** |
| ![Native Gains read result for a generated wallet with no positions](perpetual-portfolio.jpg) | ![Transparency interface with explicit sample-data labels](transparency.jpg) |

[Rulebook — draft, not active](rulebook.jpg)

## Capture limits

- These are local application captures, not deployed Render evidence, customer activity, real capital, trading performance or a commercial launch.
- Prop terminal screenshots are anonymous and cannot place orders. Account screenshots show a fresh backend-created virtual account; they do not manufacture a richer trading history.
- Real extension/hardware/remote WalletConnect and live contract-wallet acceptance remain unverified. The generated signer is a test transport using real signatures.
- The English UI retains its authentic Persian language-switch glyph. The current Profile also formats some dates/identifier digits in Persian despite English labels; that application localization issue is preserved and documented, not edited out of the screenshot. Presentation graphics and explanatory captions are English.
- The new-wallet Gains view shows actual upstream read results; it does not establish an active position, fee-adjusted PnL or transaction settlement. Transparency remains explicitly synthetic.
- The initial market render may vary with upstream availability. Old captures are preserved through [historical Git links](../../reviews/repository-transformation/REMOVED_FILES.md), outside the active image tree.

[README gallery](../../../README.md#product-gallery) · [Feature Status](../../product/FEATURE_STATUS.md)
