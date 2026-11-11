# Production fix and terminal refinement — evidence (2026-11-11)

Captured from a local candidate (isolated PostgreSQL, `SIM_TEST_MODE`,
disposable generated wallets, live public Gains prices). Not production.
Wallet addresses shown are throwaway test keys.

| Capture | Shows |
| --- | --- |
| [header-fa-1440-dark](header-fa-1440-dark.png), [header-en-1440-light](header-en-1440-light.png), [header-ru-390-dark](header-ru-390-dark.png), [header-ar-390-light](header-ar-390-light.png) | Wallet, terminal entry, language and theme controls with one height, border and radius |
| [review-en-1440](review-en-1440.png), [review-fa-1440-light](review-fa-1440-light.png) | Order review: one label/value row per field, LTR-isolated values |
| [sltp-fa-1440-light](sltp-fa-1440-light.png), [sltp-fa-390-dark](sltp-fa-390-dark.png) | SL/TP dialog in Persian, desktop and phone width |
| [overlay-long-sl-only](overlay-long-sl-only.png) | LONG with SL only: loss zone only, no ratio |
| [overlay-long-both](overlay-long-both.png) | LONG with SL and TP: red below, green above, R in the legend |
| [overlay-fa-light](overlay-fa-light.png), [overlay-fa-toggled-dark](overlay-fa-toggled-dark.png) | SHORT (SL+TP) and LONG (TP only) on one symbol, RTL, both themes |
| [seasonal-yalda-markets-en-1440-light](seasonal-yalda-markets-en-1440-light.png), [seasonal-yalda-markets-fa-390-light](seasonal-yalda-markets-fa-390-light.png), [seasonal-christmas-markets-fa-1440-dark](seasonal-christmas-markets-fa-1440-dark.png), [seasonal-christmas-prop-trade-fa-390-light](seasonal-christmas-prop-trade-fa-390-light.png) | Approved seasonal header logos with a mocked clock (21 Dec / 26 Dec 2026, Tehran) |
| [wallet-a-restored](wallet-a-restored.png) | Wallet A on a fresh browser context after wallet B used the same browser |

Automated: `npm run test:browser:risk` (51 checks),
`apps/backend/test/chart-workspaces.test.mjs` (W1–W6),
`apps/web-react/test/terminal-risk.test.mjs`. See
[Chart workspaces](../../trading/CHART_WORKSPACES.md).
