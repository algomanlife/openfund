# Upstream isolation evidence

Produced 2026-11-10 on one machine (Node 22.23.4, PostgreSQL 17.11, Playwright Chromium). These are local verification results, not deployed acceptance.

| Artifact | What it shows |
| :--- | :--- |
| [vela-0.10.4-assessment.txt](vela-0.10.4-assessment.txt) | Output of `npm run update:vendor -- --provider vela --to v0.10.4` (report mode). The vendored tree is proven identical to upstream v0.9.3 plus three registered patches. Vela 0.10.4 is flagged high risk, changes two patched files and breaks patch OF-VELA-001 (exit 2, working tree untouched). Vela was not upgraded. |
| [browser-charts-0.9.3-pass.txt](browser-charts-0.9.3-pass.txt) | Passing lines of `npm run test:browser:charts` (17 checks, exit 0) against the committed build served by the local backend with `SIM_TEST_MODE=1` and a disposable database: branding, attribution notice, themes, exact indicator catalog, settings persistence, symbol picker, responsive dialogs. |

Other results recorded in this change: `npm run check:upstream` passes; `npm run test:upstream` 11 unit tests and 13 Gains contract tests pass; `npm run test:charts` 9 pass; backend engine suites (`engine-rules`, `engine-audit`) 31 pass with the new `MarketData` options seam; `npm run check:gains-live` reported 493 markets, 373 prices and a valid WebSocket snapshot; `node scripts/build-charts.mjs` reproduces the committed bundle byte for byte.
