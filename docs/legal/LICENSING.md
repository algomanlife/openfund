# Licensing audit and compatibility report

Engineering inventory, not legal advice. Audited 2026-11-10 against `main`
`123ecfb` plus branch `codex/production-readiness`. Component facts are kept in
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
   `smc-v1.pine` states *CC BY-NC-SA 4.0* with "© Openfund". `pac v1.pine`
   displays "SDK © Algoman.life". The indicator names ("Smart Money Concepts",
   "Price Action Concepts") are also names of indicators published by third
   parties. The repository does not document where these sources came from.
   `indicators/README.md` calls them "proprietary", which conflicts with the
   CC notice. CC BY-NC-SA forbids commercial use. Confirm authorship, the
   correct copyright holder and the applicable license before commercial use.
   The files are kept byte-for-byte as the repository requires, so nothing in
   them was changed.
4. `@metamask/eth-json-rpc-provider` declares no license.
5. Compatibility of whatever first-party license is chosen with items 1–3.

## 4. Decisions for the owner

| Decision | Options |
| --- | --- |
| First-party license (currently none: all rights reserved) | A. Keep all rights reserved (the AGPL source offer for the PineTS parts still applies). B. AGPL-3.0-or-later for the whole repository: consistent with the frontend constraint, and allows reuse under the same terms. C. Split: AGPL-3.0 for the web application, proprietary or permissive (for example Apache-2.0) for the backend and docs, each with its own LICENSE. D. Replace PineTS (engineering) to remove the constraint |
| MetaMask SDK | Keep it (subject to item 2), or remove the connector |
| Indicator sources | Establish provenance; relicense or replace if they are third-party works |
| Source offer in the UI | Approve a footer and terminal "Source code" link to the released tag |

Whatever is chosen: keep every upstream LICENSE/NOTICE unmodified, keep the
Vela attribution, keep one non-conflicting license statement in the README,
and record the choice as an ADR.
