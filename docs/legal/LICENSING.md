# Licensing audit and compatibility report

## Current source clarification — 2026-11-21

This update checks repository source at `adbdeabd64b2ba69379411db607be12d35339426`.
It does not repeat the historical bundle or production audit below.

- **First-party terms:** no root `LICENSE` is published and no license choice
  is recorded by this update. The owner's choice and copyright holder remain
  necessary. Third-party rights and obligations are unaffected.
- **Active UI typography:** Dastkhat and Dastkhat Arabic replace Irancell as
  the UI defaults. The unmodified font files, OFL and upstream notices are
  recorded in [SOURCE.json](../../apps/web-react/public/assets/fonts/dastkhat/SOURCE.json).
- **Legacy font copies remain:** 50 standalone font files matching
  `irancell-*.ttf`, `openfund-1.ttf` through `openfund-5.ttf`, or
  `openfund-persian-*-v4.woff2` are still tracked: 15 in
  `apps/web-react/public/assets/`, 15 in `dist/assets/`, 10 in
  `brand/typography/` and 10 in the investor-pack typography directory.
  This count excludes archives. Their presence does not establish current CSS
  use, but public asset copies may still be packaged or served. No permission
  is recorded. Removal needs a reference and packaging check; changing the UI
  font does not clear rights to retained copies.
- **Indicators:** the optimization merge (#170) did not relicense them.
  Preserve the existing CC BY-NC-SA notice and file-specific provenance
  questions. The runtime's AGPL license is a separate scope.
- **Desktop:** #171 adds a 0.0.3 candidate and signing pipeline. CI build,
  acceptance, packaging and integrity steps passed on four targets; macOS x64
  artifact upload failed with a GitHub timeout
  ([run](https://github.com/algomanlife/openfund/actions/runs/44880940066)).
  There is no signed/public 0.0.3 release in the reviewed release collection.

The historical findings below remain evidence of the earlier inventory.
Statements about files being used or served then are not a fresh runtime audit.
Do not remove upstream attribution or claim all retained assets are cleared.

## Historical audit context

Engineering inventory, not legal advice. Audited 2026-11-10; re-verified
2026-11-11 against `main` `67cc812` (deployed as v0.4.4): `npm run
legal:licenses` passes, the built application contains all eight notice files,
and production serves them under `/assets/notices/`. Re-audited 2026-11-12 on
`main` `38e17f4` including fonts and images (section 1a); the license choice
itself is prepared in the [decision document](LICENSE_DECISION.md). Component facts are kept in
the [upstream dependency registry](../integrations/UPSTREAM_REGISTRY.md), the
generated [production dependency licenses](DEPENDENCY_LICENSES.md) (checked in
CI) and the [PineTS report](PINETS.md).

## 1. Completed in the repository

- Inventory of first-party, vendored, third-party and npm production licenses
  (this page, [DEPENDENCY_LICENSES.md](DEPENDENCY_LICENSES.md),
  [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)).
- Every upstream LICENSE/NOTICE kept unmodified: Vela (Apache-2.0 + NOTICE),
  Gains SDK (MIT), LuxAlgo journal-core (MIT), Openfund Protocol import (GPL-2.0),
  PineTS and Vela-pinets (AGPL-3.0 texts shipped in `assets/notices/`).
- **Added the missing MetaMask SDK notice**
  (`apps/web-react/public/assets/notices/MetaMask-SDK-LICENSE.txt`). The SDK
  ships in the React build (`metamask-sdk-*.js`, through wagmi's MetaMask
  connector), and its license requires a prominent ConsenSys notice.
- CI gate `npm run legal:licenses` (part of `docs:check`): fails when a
  non-permissive or undeclared license appears in, or changes among,
  production dependencies.
- The README license section points here and makes no license claim.
- No root `LICENSE` or `NOTICE` was added: no license has been chosen, and
  the Apache NOTICE obligation is met where the Vela distribution ships.

## 1a. Component inventory (2026-11-12)

Licenses were confirmed from each component's own LICENSE file, package
manifest or embedded font metadata, not inferred from neighbours.

| Component | Source | License | Modifications | Distribution obligations | Status |
| --- | --- | --- | --- | --- | --- |
| Openfund application and packages (`apps/`, `packages/openfund-charts`, `-footprint`, `-gains-adapter`, `cms-client`, `scripts/`, `e2e/`, `infra/`) | First party | **None selected (all rights reserved)** | — | — | Owner decision pending ([decision](LICENSE_DECISION.md)) |
| Docs and brand (`docs/`, `brand/` logos) | First party | None selected; logo is a trademark | — | — | Owner decision pending |
| Vela 0.10.6 (`vendor/vela`) | LuxAlgo | Apache-2.0 + NOTICE | Patched (see [registry](../integrations/UPSTREAM_REGISTRY.md)) | LICENSE, NOTICE, modified-file notices, visible "Vela" attribution with link | Met |
| PineTS 0.13.1, Vela-pinets 0.3.4 | LuxAlgo (npm) | AGPL-3.0-only | Worker patched by `build-charts.mjs` | Corresponding Source, section 13 offer | License texts shipped; offer form and combined-work scope **open** ([PineTS](PINETS.md)) |
| MetaMask SDK 0.33.1 | ConsenSys (npm, via wagmi) | ConsenSys proprietary | None | Prominent notice; non-commercial use (≤ 10,000 MAU) | Notice shipped; commercial-use limit **open** |
| Gains SDK (`vendor/gains-sdk`) | Ingenium Labs | MIT | None; not imported | Keep notice | Met (dormant) |
| Journal core (`third_party/luxalgo-trade-journal`) | LuxAlgo | MIT | Built `dist/` vendored | Keep notice | Met |
| Openfund Protocol import (`packages/openfund-protocol`) | mux-protocol | GPL-2.0 (files mostly or-later; 4 `UNLICENSED`) | Renamed | GPL only if distributed | Dormant, not shipped |
| npm production dependencies (web, backend) | npm | MIT / ISC / BSD / Apache-2.0 (exceptions listed) | None | Keep license comments | CI-checked ([dependency licenses](DEPENDENCY_LICENSES.md)) |
| Directus 11.17.4 | Docker image | BSL 1.1 (12.x: MSCL-1.0-GPL) | None | Service terms; not distributed here | Separate service |
| Dastkhat and Dastkhat Arabic variable fonts (`assets/fonts/dastkhat/`) | Dastyar (Dastkhat Project Authors), derived from Vazirmatn | SIL OFL 1.1, no Reserved Font Name | None (unmodified WOFF2 copies) | Ship OFL text and upstream notices; do not sell the fonts alone | Met (`assets/fonts/dastkhat/OFL.txt`, `THIRD-PARTY-NOTICES.txt`; pinned commit `ac5b01542f36`, SHA-256 in `SOURCE.json`) |
| Vazirmatn font | Vazirmatn Project | SIL OFL 1.1 | None | Ship license | Met (`Vazirmatn-LICENSE.txt`); no longer a UI default |
| Ubuntu font (`ubuntu-400/700.ttf`) | Canonical | Ubuntu Font Licence 1.0 | None | Ship licence with the fonts | **Fixed in this change**: `assets/Ubuntu-LICENSE.txt` added (text taken from the brandbook archive, where it already shipped) |
| Irancell fonts (`irancell-*.ttf`) and renamed copies (`openfund-1…5.ttf`, `openfund-persian-*-v4.woff2`, `brand/typography/`) | Irancell (MTN Irancell) per embedded metadata | **"All rights reserved"**; no license recorded | Renamed; woff2 files re-named "Openfund Persian" | Unknown without a license | **Blocker: provenance missing** |
| Pine indicators (`indicators/`) | Owner asserts authorship; repository evidence of third-party origin for several files ([item 3](#pine-indicator-sources)) | CC BY-NC-SA 4.0 stated in `smc-v1.pine`; none in the others | Optimized November 2026 ([ADR 0048](../decisions/0048-pine-indicator-optimization-and-provenance.md)) | NC forbids commercial use | **Blocker: provenance missing** |
| Service logos (Gains, Vela, TradingView, DePay, Render, Liara, Bitpin, Hyperliquid, GMX, MetaMask, Rabby, social glyphs) | Brand owners / Simple Icons | Brand terms / CC0 | Per [Public-brand-assets.txt](../../apps/web-react/public/assets/notices/Public-brand-assets.txt) | Brand guidelines | Documented; `dist/` copy of the notice re-synced in this change |
| Day/night toggle design | Hamzeh Ghoreyshi | MIT | Adapted | Keep notice | Met |
| Trade Radar logic (`apps/backend/radar.js`, `features/radar/RadarPage.tsx`) | drkxbt/whales `34d5575` | MIT | Re-implemented and modified ([provenance](../../third_party/drkxbt-whales/PROVENANCE.md)) | Keep copyright and permission notice | Met: LICENSE/NOTICE in `third_party/`, shipped in `assets/notices/` |
| Heatmap treemap layout (`features/radar/HeatmapPage.tsx`) | drkxbt/charts `7e5f50e` | MIT | Re-implemented as DOM tiles ([provenance](../../third_party/drkxbt-charts/PROVENANCE.md)) | Keep copyright and permission notice | Met: LICENSE/NOTICE in `third_party/`, shipped in `assets/notices/` |
| `team-portraits.png` | AI-generated (per `DESIGN_AND_CONTENT_NOTES.md`) | Uncertain by jurisdiction | — | — | Record generator terms |
| `react/` build output, `dist/` mirrors | Generated from the above | Inherit their inputs | — | Same notices as inputs | `dist/` notices re-synced |

## 2. Obligations that apply today

| Component | Where it ships | Obligation |
| --- | --- | --- |
| Vela (Apache-2.0 + NOTICE) | Web bundle, `dist/` | Keep LICENSE and NOTICE; mark modified files; **visible "Vela" attribution with a link on every screen showing a Vela chart** (met in terminal status) |
| PineTS, Vela-pinets (AGPL-3.0-only) | Web bundle + patched worker | Corresponding Source of the modified program to every user (section 6), and a prominent source offer to network users (section 13). See [PineTS](PINETS.md) |
| MetaMask SDK (ConsenSys proprietary license) | React build (lazy chunk) | Prominent notice with each copy (now shipped as a notice file; "prominent" placement is a legal question). Use is limited to **"Non-Commercial Use"**, defined as including a product whose monthly active users never exceed **10,000** |
| MIT / ISC / BSD / Apache npm packages | Bundles | Keep copyright and license notices (license comments retained by the build) |
| Gains SDK, journal-core (MIT) | Vendored | Keep notices |
| Openfund Protocol (GPL-2.0, files mostly GPL-2.0-or-later, 4 `UNLICENSED`) | Dormant, not built or shipped | GPL terms only if distributed |
| MPL-2.0 (`@ethereumjs/*`, `webextension-polyfill`), AGPL-3.0-or-later `ua-parser-js` 2.x | Installed transitively; **not found in the current bundles** | None while unshipped; re-check if a bundle starts including them |
| Directus (BSL 1.1 on 11.x; MSCL-1.0-GPL from 12.0) | Separate service | Service terms; see [Directus 12 assessment](../backstage/DIRECTUS_12_ASSESSMENT.md) |

## 3. Items for legal review

1. **AGPL scope.** Does the bundled Openfund chart code form a combined work
   with PineTS? What form must the section 13 source offer take? See
   [PineTS](PINETS.md).
2. **MetaMask SDK commercial-use limit.** Openfund is a commercial product.
   The ConsenSys license allows non-commercial use, which it defines to include
   products with ≤ 10,000 monthly active users. Confirm whether Openfund
   qualifies, and how "prominent notice" must be shown. The engineering
   alternative is to drop the MetaMask SDK connector and rely on injected
   (EIP-6963) and WalletConnect wallets: a product decision, not made here.
3. <a id="pine-indicator-sources"></a>**Pine indicator sources (`indicators/`).**
   The owner states that the three indicators and two libraries are
   owner-controlled and intended to be open source (recorded 2026-11-21 in the
   optimization task; no authorship records accompany the statement). A
   file-by-file review of the repository found:

   | File | Header / marks | Evidence of other origin | Status |
   | --- | --- | --- | --- |
   | `smc-v1.pine` | CC BY-NC-SA 4.0, "© Openfund" | Structure, identifiers and doc comments closely resemble a widely published third-party "Smart Money Concepts" script distributed under CC BY-NC-SA 4.0 | Not relicensable without the original author's permission; notice kept |
   | `pac v1.pine` | None; title "Open source"; scanner shows "SDK © Algoman.life" | "Price Action Concepts" is a commercial third-party product name | Unresolved |
   | `Open algo v5.pine` | None (original first line "I made it better yay") | Original imports `ayvaliktrading/EyopsTelegram` and `ayvaliktrading/JoinUsEyopsTelegram`; the removed dashboard was titled "SMRT Algo" | Unresolved |
   | `Overlayslibrary.pine` | None | Served in place of `ayvaliktrading/EyopsTelegram` | Unresolved |
   | `sdk.pine` | None | Description wording of a published Nadaraya–Watson kernel library | Unresolved |

   The November 2026 optimization changed the indicator code (see
   [ADR 0048](../decisions/0048-pine-indicator-optimization-and-provenance.md)).
   Those changes are derivative work on these files and do not change their
   licence status. **Prepared change, not applied:** for each file the owner
   proves wholly owner-authored (commit history, original drafts or a written
   assignment), add an `SPDX-License-Identifier: Apache-2.0` header with the
   owner's copyright line, add `indicators/LICENSE` (Apache-2.0) scoped to
   those files, and list them in the root README licence table. For a file of
   third-party origin, record the upstream author, URL and licence, then either
   obtain permission or keep (or restore) the upstream licence and attribution.
   CC BY-NC-SA material cannot be offered commercially. The Openfund monorepo
   licence is not affected by this item.
4. `@metamask/eth-json-rpc-provider` declares no license.
5. Compatibility of whatever first-party license is chosen with items 1–3.
6. **Legacy Irancell assets.** Dastkhat has replaced the UI defaults.
   The remaining tracked copies and locations are counted in the current
   clarification above. No redistribution permission is recorded; reference
   and packaging checks are needed before removal. Historical use is not
   evidence that the current CSS still selects them.
7. **Copyright ownership.** Commits come from three human GitHub identities and
   from AI agents working for the owner; confirm the owning entity and that
   each human author's work is assigned or licensed to it.

## 4. Decisions for the owner

The consolidated comparison, blockers and recommendation are in the
[license decision document](LICENSE_DECISION.md).

| Decision | Options |
| --- | --- |
| First-party license (currently none: all rights reserved) | A. Keep all rights reserved (the AGPL source offer for the PineTS parts still applies). B. AGPL-3.0-or-later for the whole repository: consistent with the frontend constraint, and allows reuse under the same terms. C. Split: AGPL-3.0 for the web application, proprietary or permissive (for example Apache-2.0) for the backend and docs, each with its own LICENSE. D. Replace PineTS (engineering) to remove the constraint |
| MetaMask SDK | Keep it (subject to item 2), or remove the connector |
| Indicator sources | Establish provenance; relicense or replace if they are third-party works |
| Source offer in the UI | Approve a footer and terminal "Source code" link to the released tag |
| Inbound contribution terms | Until a first-party license exists, GitHub's "inbound = outbound" rule has no license to apply, so the terms of outside contributions are undefined. A. Adopt the [Developer Certificate of Origin](https://developercertificate.org) (`Signed-off-by` trailer, enforceable with a check) together with the chosen license. B. A contributor license agreement, if the company needs to relicense contributions later. C. Accept only maintainer contributions until the license is chosen |

Whatever is chosen: keep every upstream LICENSE/NOTICE unmodified, keep the
Vela attribution, keep one non-conflicting license statement in the README,
and record the choice as an ADR.
