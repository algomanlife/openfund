# Licensing audit and compatibility report

## First-party license — 2026-11-27

Openfund's own code and documentation are licensed under **Apache-2.0** with
a root [`NOTICE`](../../NOTICE) that credits Openfund
([ADR 0060](../decisions/0060-open-source-license.md)). Exclusions:
third-party and vendored code, `packages/openfund-protocol/` (GPL-2.0),
`indicators/`, `brand/` trademarks, the investor pack and fonts. The web
bundle that includes PineTS and the Vela Pine addon is conveyed as an
AGPL-3.0 combined work; its corresponding source is this public repository at
the commit reported by `/version`. Statements below that say "no license" or
"all rights reserved" for first-party code are historical.

## Source clarification — 2026-11-21 (historical)

This update checks repository source at `adbdeabd64b2ba69379411db607be12d35339426`.
It does not repeat the historical bundle or production audit below.

- **First-party terms:** no root `LICENSE` is published and no license choice
  is recorded by this update. The owner's choice and copyright holder remain
  necessary. Third-party rights and obligations are unaffected.
- **Active UI typography:** Dastkhat v1.210 (Dastkhat, Dastkhat Arabic,
  Dastkhat FaNum; SIL OFL 1.1, based on Vazirmatn) is the only Persian/Arabic
  face and Ubuntu the only other face. The unmodified font files, OFL, FONTLOG
  and upstream notices are recorded in
  [SOURCE.json](../../apps/web-react/public/assets/fonts/dastkhat/SOURCE.json).
- **Irancell provenance blocker: RESOLVED by removal (2026-11-21).** All 50
  standalone files matching `irancell-*.ttf`, `openfund-1.ttf` through
  `openfund-5.ttf` or `openfund-persian-*-v4.woff2` (15 in
  `apps/web-react/public/assets/`, 15 in `dist/assets/`, 10 in
  `brand/typography/`, 10 in the investor-pack typography directory) and the
  standalone `Vazirmatn.ttf`/`Vazirmatn-LICENSE.txt` copies were deleted after
  a reference and packaging check; CI's font gate
  (`scripts/docs/check-fonts.mjs`) keeps them out. Git history still contains
  the old blobs; no redistribution permission is claimed for them. Investor
  documents and the brandbook were regenerated with Dastkhat; see the
  [retired registry](../development/RETIRED.md).
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
| Vela 0.10.19 (`vendor/vela`) | LuxAlgo | Apache-2.0 + NOTICE | Patched (see [registry](../integrations/UPSTREAM_REGISTRY.md)) | LICENSE, NOTICE, modified-file notices, visible "Vela" attribution with link | Met |
| PineTS 0.13.1, Vela-pinets 0.3.5 | LuxAlgo (npm) | AGPL-3.0-only | Worker patched by `build-charts.mjs` | Corresponding Source, section 13 offer | License texts shipped; offer form and combined-work scope **open** ([PineTS](PINETS.md)) |
| MetaMask SDK 0.33.1 | ConsenSys (npm, via wagmi) | ConsenSys proprietary | None | Prominent notice; non-commercial use (≤ 10,000 MAU) | Notice shipped; commercial-use limit **open** |
| Gains SDK (`vendor/gains-sdk`) | Ingenium Labs | MIT | None; not imported | Keep notice | Met (dormant) |
| Journal core (`third_party/luxalgo-trade-journal`) | LuxAlgo | MIT | Built `dist/` vendored | Keep notice | Met |
| Openfund Protocol import (`packages/openfund-protocol`) | mux-protocol | GPL-2.0 (files mostly or-later; 4 `UNLICENSED`) | Renamed | GPL only if distributed | Dormant, not shipped |
| npm production dependencies (web, backend) | npm | MIT / ISC / BSD / Apache-2.0 (exceptions listed) | None | Keep license comments | CI-checked ([dependency licenses](DEPENDENCY_LICENSES.md)) |
| Directus 11.17.4 | Docker image | BSL 1.1 (12.x: MSCL-1.0-GPL) | None | Service terms; not distributed here | Separate service |
| Dastkhat, Dastkhat Arabic and Dastkhat FaNum variable fonts (`assets/fonts/dastkhat/`) | Dastyar (Dastkhat Project Authors), based on Vazirmatn by Saber Rastikerdar | SIL OFL 1.1, no Reserved Font Name | None (unmodified WOFF2 copies) | Ship OFL text and upstream notices; do not sell the fonts alone | Met (`assets/fonts/dastkhat/OFL.txt`, `FONTLOG.txt`, `THIRD-PARTY-NOTICES.txt`; v1.210, pinned commit `ac5b01542f36`, SHA-256 in `SOURCE.json`) |
| Ubuntu font (`ubuntu-400/700.ttf`) | Canonical | Ubuntu Font Licence 1.0 | None | Ship licence with the fonts | **Fixed in this change**: `assets/Ubuntu-LICENSE.txt` added (text taken from the brandbook archive, where it already shipped) |
| Irancell fonts (`irancell-*.ttf`) and renamed copies (`openfund-1…5.ttf`, `openfund-persian-*-v4.woff2`) | Irancell (MTN Irancell) per embedded metadata | "All rights reserved"; no license recorded | — | — | **Resolved by removal (2026-11-21)**: no copies remain in the tree; see [retired registry](../development/RETIRED.md) |
| Pine indicators (`indicators/`) | Openfund (owner decision 2026-11-28, [ADR 0066](../decisions/0066-indicator-ownership.md)) | Apache-2.0 (four files, `indicators/LICENSE`); `smc-v1.pine` CC BY-NC-SA 4.0 as stated in the file | Optimized November 2026 ([ADR 0048](../decisions/0048-pine-indicator-optimization-and-provenance.md)) | Keep the file headers | Resolved ([item 3](#pine-indicator-sources)) |
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
3. <a id="pine-indicator-sources"></a>**Pine indicator sources (`indicators/`): resolved.**
   Openfund owns the three indicators (Open Algo V5, Price Action Concepts,
   Smart Money Concepts) and the two libraries (`Overlayslibrary`, `sdk`) and
   publishes them as open source (owner decision, 2026-11-28,
   [ADR 0066](../decisions/0066-indicator-ownership.md)).
   `Open algo v5.pine`, `pac v1.pine`, `Overlayslibrary.pine` and `sdk.pine`
   are Apache-2.0 (`SPDX-License-Identifier: Apache-2.0`, "Copyright 2026
   Openfund", [indicators/LICENSE](../../indicators/LICENSE)). `smc-v1.pine`
   keeps the licence it states, CC BY-NC-SA 4.0 with "© Openfund". The earlier
   provenance review is kept as a
   [historical record](history/PINE_PROVENANCE_REVIEW_2026-11.md).
4. `@metamask/eth-json-rpc-provider` declares no license.
5. Compatibility of whatever first-party license is chosen with items 1–3.
6. **Legacy Irancell assets — resolved by removal (2026-11-21).** Every
   tracked copy was deleted; see the current clarification above and the
   [retired registry](../development/RETIRED.md).
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
