# Third-party notices

Openfund includes or depends on third-party software. Each component keeps its
own license. The files below are the authoritative texts, preserved
unmodified. PineTS details: [docs/legal/PINETS.md](docs/legal/PINETS.md). This index adds no license terms. Openfund's own code currently
has **no published license** ([Licensing](docs/legal/LICENSING.md), [decision document](docs/legal/LICENSE_DECISION.md)).

| Component | License | Notice / license text |
| --- | --- | --- |
| Vela charting library, LuxAlgo | Apache-2.0 + NOTICE (visible attribution requirement) | [vendor/vela/LICENSE](vendor/vela/LICENSE), [vendor/vela/NOTICE](vendor/vela/NOTICE), shipped as [Vela-Apache-2.0.txt](apps/web-react/public/assets/notices/Vela-Apache-2.0.txt) and [Vela-NOTICE.txt](apps/web-react/public/assets/notices/Vela-NOTICE.txt) |
| Vela Pine addon (`@luxalgo/vela-pinets`) | AGPL-3.0-only | [Vela-PineTS-AGPL-3.0.txt](apps/web-react/public/assets/notices/Vela-PineTS-AGPL-3.0.txt); source: <https://github.com/LuxAlgo/Vela-pinets> |
| PineTS | AGPL-3.0-only | [PineTS-AGPL-3.0.txt](apps/web-react/public/assets/notices/PineTS-AGPL-3.0.txt); source: <https://github.com/LuxAlgo/PineTS> |
| MetaMask SDK (`@metamask/sdk` and its modules), ConsenSys Software Inc. | ConsenSys proprietary license (non-commercial use as defined there; notice required) | [MetaMask-SDK-LICENSE.txt](apps/web-react/public/assets/notices/MetaMask-SDK-LICENSE.txt). Shipped in the React build through wagmi's MetaMask connector. See [Licensing › legal review](docs/legal/LICENSING.md#3-items-for-legal-review) |
| LuxAlgo trade journal and journal-core | MIT | [third_party/luxalgo-trade-journal/LICENSE](third_party/luxalgo-trade-journal/LICENSE), [packages-core/LICENSE](third_party/luxalgo-trade-journal/packages-core/LICENSE), [PROVENANCE](third_party/luxalgo-trade-journal/PROVENANCE.md) |
| Trade Radar logic adapted from `drkxbt/whales` (drk) | MIT | [third_party/drkxbt-whales/LICENSE](third_party/drkxbt-whales/LICENSE), [NOTICE](third_party/drkxbt-whales/NOTICE), [PROVENANCE](third_party/drkxbt-whales/PROVENANCE.md); shipped as [drkxbt-whales-MIT.txt](apps/web-react/public/assets/notices/drkxbt-whales-MIT.txt) |
| Heatmap treemap layout adapted from `drkxbt/charts` (drk) | MIT | [third_party/drkxbt-charts/LICENSE](third_party/drkxbt-charts/LICENSE), [NOTICE](third_party/drkxbt-charts/NOTICE), [PROVENANCE](third_party/drkxbt-charts/PROVENANCE.md); shipped as [drkxbt-charts-MIT.txt](apps/web-react/public/assets/notices/drkxbt-charts-MIT.txt) |
| Gains Network SDK | MIT | [vendor/gains-sdk/LICENSE](vendor/gains-sdk/LICENSE) |
| DePay Payment Widget (`@depay/widgets` 13.0.45 UMD bundle, vendored) | MIT | [DePay-Widgets-MIT.txt](apps/web-react/public/assets/notices/DePay-Widgets-MIT.txt); source: <https://github.com/DePayFi/widgets>; [ADR 0026](docs/decisions/0026-dedicated-checkout-vendored-depay-widget-and-chart-position-tool.md) |
| Openfund Protocol (dormant import of mux-protocol) | GPL-2.0 (files mostly GPL-2.0-or-later) | [packages/openfund-protocol/LICENSE](packages/openfund-protocol/LICENSE), [PROVENANCE](packages/openfund-protocol/PROVENANCE.md) |
| Dastkhat, Dastkhat Arabic and Dastkhat FaNum fonts (the only Persian/Arabic UI face), Dastyar; **based on Vazirmatn by Saber Rastikerdar**, whose Latin glyphs derive from Roboto | SIL Open Font License 1.1 (no Reserved Font Name); Roboto glyphs Apache-2.0 per upstream notice | [OFL.txt](apps/web-react/public/assets/fonts/dastkhat/OFL.txt), [FONTLOG.txt](apps/web-react/public/assets/fonts/dastkhat/FONTLOG.txt), [THIRD-PARTY-NOTICES.txt](apps/web-react/public/assets/fonts/dastkhat/THIRD-PARTY-NOTICES.txt); Dastkhat v1.210, pinned at commit `ac5b01542f36` of <https://github.com/dastyar-io/dastkhat-font> (the Dastkhat and FaNum files are byte-identical to tag `v1.210`), files and SHA-256 in [SOURCE.json](apps/web-react/public/assets/fonts/dastkhat/SOURCE.json) |
| Ubuntu font, Canonical Ltd. (`ubuntu-400.ttf`, `ubuntu-700.ttf`) | Ubuntu Font Licence 1.0 | [Ubuntu-LICENSE.txt](apps/web-react/public/assets/Ubuntu-LICENSE.txt) |
| Simple Icons (service glyphs) | CC0-1.0 | [Simple-Icons-CC0.txt](apps/web-react/public/assets/notices/Simple-Icons-CC0.txt) |
| TradingView logo | Brand-owner terms | [TradingView-logo-LICENSE.txt](apps/web-react/public/assets/notices/TradingView-logo-LICENSE.txt) |
| Interactive day/night toggle design, Hamzeh Ghoreyshi (adapted in `apps/web-react/src/theme-toggle.css` and `src/theme.ts`) | MIT | [Day-Night-Toggle-MIT.txt](apps/web-react/public/assets/notices/Day-Night-Toggle-MIT.txt); source: <https://github.com/HamzehGhoreyshi/interactive-day-night-toggle> |
| Black hole sound on the gateway: sonification of the black hole at the centre of the Perseus galaxy cluster, NASA/CXC/SAO/K. Arcand, SYSTEM Sounds (M. Russo, A. Santaguida) | No copyright asserted by NASA/SAO for Chandra content; credit required; no NASA, SAO or Smithsonian endorsement implied | [NASA-Chandra-Perseus-sonification.txt](apps/web-react/public/assets/notices/NASA-Chandra-Perseus-sonification.txt); source: <https://chandra.si.edu/sound/perseus.html>; policy: <https://chandra.harvard.edu/photo/image_use.html> |
| Public service brand assets | Brand-owner terms | [Public-brand-assets.txt](apps/web-react/public/assets/notices/Public-brand-assets.txt) |
| npm packages | Per package (mostly MIT / ISC / Apache-2.0 / BSD) | Lockfiles; non-permissive production licenses listed in [DEPENDENCY_LICENSES.md](docs/legal/DEPENDENCY_LICENSES.md) (CI-checked); [upstream registry](docs/integrations/UPSTREAM_REGISTRY.md) |
| Directus (separate service) | BSL 1.1 for the pinned 11.17.4 image (shown in its Studio licence notice); 12.x is MSCL-1.0-GPL with licence-key entitlements | Not distributed in this repository; runs as a separate container |

Retired components (Irancell and its renamed copies, standalone Vazirmatn) are no
longer in the repository and are not listed above; see
[Retired and no longer used](docs/development/RETIRED.md).

Service names and logos identify technologies only. They do not indicate
partnership or endorsement.

## Open Oracle standalone research package

The original `packages/open-oracle/` implementation preserves the repository's
existing unresolved first-party licensing policy. Gains Network, Hyperliquid and
GMX retain rights in their services and data; no ownership of external data,
partnership or redistribution permission is asserted. Provider interfaces and
limits are documented in [Open Oracle](docs/integrations/OPEN_ORACLE.md). No
provider SDK or source is copied. TypeScript 6.0.3 is a package-local
development-only Apache-2.0 dependency, not an application runtime dependency.
External publication remains disabled pending provider usage-term verification.
