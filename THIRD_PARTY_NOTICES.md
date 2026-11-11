# Third-party notices

Openfund includes or depends on third-party software. Each component keeps its
own license. The files below are the authoritative texts, preserved
unmodified. PineTS details: [docs/legal/PINETS.md](docs/legal/PINETS.md). This index adds no license terms. Openfund's own code currently
has **no published license** ([Licensing](docs/legal/LICENSING.md)).

| Component | License | Notice / license text |
| --- | --- | --- |
| Vela charting library, LuxAlgo | Apache-2.0 + NOTICE (visible attribution requirement) | [vendor/vela/LICENSE](vendor/vela/LICENSE), [vendor/vela/NOTICE](vendor/vela/NOTICE), shipped as [Vela-Apache-2.0.txt](apps/web-react/public/assets/notices/Vela-Apache-2.0.txt) and [Vela-NOTICE.txt](apps/web-react/public/assets/notices/Vela-NOTICE.txt) |
| Vela Pine addon (`@luxalgo/vela-pinets`) | AGPL-3.0-only | [Vela-PineTS-AGPL-3.0.txt](apps/web-react/public/assets/notices/Vela-PineTS-AGPL-3.0.txt); source: <https://github.com/LuxAlgo/Vela-pinets> |
| PineTS | AGPL-3.0-only | [PineTS-AGPL-3.0.txt](apps/web-react/public/assets/notices/PineTS-AGPL-3.0.txt); source: <https://github.com/LuxAlgo/PineTS> |
| MetaMask SDK (`@metamask/sdk` and its modules), ConsenSys Software Inc. | ConsenSys proprietary license (non-commercial use as defined there; notice required) | [MetaMask-SDK-LICENSE.txt](apps/web-react/public/assets/notices/MetaMask-SDK-LICENSE.txt). Shipped in the React build through wagmi's MetaMask connector. See [Licensing › legal review](docs/legal/LICENSING.md#3-items-for-legal-review) |
| LuxAlgo trade journal and journal-core | MIT | [third_party/luxalgo-trade-journal/LICENSE](third_party/luxalgo-trade-journal/LICENSE), [packages-core/LICENSE](third_party/luxalgo-trade-journal/packages-core/LICENSE), [PROVENANCE](third_party/luxalgo-trade-journal/PROVENANCE.md) |
| Gains Network SDK | MIT | [vendor/gains-sdk/LICENSE](vendor/gains-sdk/LICENSE) |
| Openfund Protocol (dormant import of mux-protocol) | GPL-2.0 (files mostly GPL-2.0-or-later) | [packages/openfund-protocol/LICENSE](packages/openfund-protocol/LICENSE), [PROVENANCE](packages/openfund-protocol/PROVENANCE.md) |
| Vazirmatn font | SIL Open Font License | [Vazirmatn-LICENSE.txt](apps/web-react/public/assets/Vazirmatn-LICENSE.txt) |
| Simple Icons (service glyphs) | CC0-1.0 | [Simple-Icons-CC0.txt](apps/web-react/public/assets/notices/Simple-Icons-CC0.txt) |
| TradingView logo | Brand-owner terms | [TradingView-logo-LICENSE.txt](apps/web-react/public/assets/notices/TradingView-logo-LICENSE.txt) |
| Public service brand assets | Brand-owner terms | [Public-brand-assets.txt](apps/web-react/public/assets/notices/Public-brand-assets.txt) |
| npm packages | Per package (mostly MIT / ISC / Apache-2.0 / BSD) | Lockfiles; non-permissive production licenses listed in [DEPENDENCY_LICENSES.md](docs/legal/DEPENDENCY_LICENSES.md) (CI-checked); [upstream registry](docs/integrations/UPSTREAM_REGISTRY.md) |
| Directus (separate service) | BSL 1.1 for the pinned 11.9.1 image (shown in its Studio licence notice); 12.x is MSCL-1.0-GPL with licence-key entitlements | Not distributed in this repository; runs as a separate container |

Service names and logos identify technologies only. They do not indicate
partnership or endorsement.
