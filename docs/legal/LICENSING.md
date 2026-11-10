# Licensing audit and compatibility report

Engineering inventory, not legal advice. Audited 2026-11-10 against the
repository at `main 123ecfb` plus branch `codex/production-readiness`.
Component facts are maintained in the
[upstream dependency registry](../integrations/UPSTREAM_REGISTRY.md). This
page draws the repository-level conclusions.

## Current state

- **No root `LICENSE` file exists.** The first-party Openfund code has no
  published license. Public visibility grants no reuse rights beyond what
  GitHub's terms allow. The README states this.
- **The owner has not selected a license.** This audit does **not** add or
  choose one. The decision is **pending owner approval**.
- No root `NOTICE` is required today. The Apache-2.0 NOTICE obligation
  attaches to the Vela distribution, whose NOTICE is kept unmodified in
  `vendor/vela/NOTICE` and shipped with the web assets
  (`apps/web-react/public/assets/notices/Vela-NOTICE.txt`,
  `dist/assets/notices/Vela-NOTICE.txt`).
- Third-party notices are indexed in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

## Component inventory (license → obligation)

| Component | Location | License | Key obligations |
| --- | --- | --- | --- |
| Vela charting library (LuxAlgo) | `vendor/vela/` | Apache-2.0 + NOTICE | Keep LICENSE and NOTICE. Mark modified files. **Visible "Vela" attribution with a link on every screen that shows a Vela chart** (NOTICE). The terminal keeps the attribution mark |
| Vela Pine addon (`@luxalgo/vela-pinets`) | npm, plus the patched worker in `apps/web-react/public/assets/openfund-pine-worker.min.js` | **AGPL-3.0-only** | Network-use clause (section 13): users interacting with the served application must be offered the Corresponding Source of the AGPL-covered work, including Openfund's modifications (the worker patch) |
| PineTS | npm, bundled into the workspace and worker | **AGPL-3.0-only** | As above |
| LuxAlgo trade journal / journal-core | `third_party/luxalgo-trade-journal/` | MIT | Keep the copyright and permission notice |
| Gains SDK | `vendor/gains-sdk/` | MIT | Keep the notice |
| Dormant Openfund Protocol (MUX import) | `packages/openfund-protocol/` | GPL-2.0 (`LICENSE`). Files are mostly `GPL-2.0-or-later` (73), a few MIT (2) and `UNLICENSED` (4) | GPL terms if distributed. Not built, deployed or linked into the application |
| Directus | Render image `directus/directus` | BSL 1.1 (see registry; confirm terms for the pinned version) | Separate service, not distributed in this repository |
| npm dependencies | per-app lockfiles | Mostly MIT / ISC / Apache-2.0 / BSD (registry) | Keep the notices in distributed bundles |
| Fonts, brand and service marks | `apps/web-react/public/assets/`, `brand/` | Vazirmatn (OFL), TradingView logo notice, Simple Icons CC0, Openfund marks | Per-asset notices. Openfund marks are not open-licensed |

## Compatibility findings

1. **AGPL-3.0 code ships in the public web application.** PineTS and the Vela
   Pine addon are executed in users' browsers from the Openfund-served
   bundle. Any first-party license for the web application must allow
   AGPL-3.0 combination for the parts that form a combined work. Openfund must
   keep offering the Corresponding Source of the AGPL-covered parts and its
   modifications. The public repository currently provides the source, but a
   visible source offer in the application is recommended, and counsel should
   confirm which parts of the frontend form a combined work. This is the most
   restrictive constraint on the frontend.
2. **Apache-2.0 (Vela) is compatible with AGPL-3.0 and GPL-3.0** (one-way),
   and with permissive or proprietary first-party terms, provided NOTICE and
   attribution are kept.
3. **GPL-2.0-only material would be incompatible with Apache-2.0.** The
   Protocol files are mostly `GPL-2.0-or-later`, which allows GPL-3.0. The
   package is dormant and not combined with the application. Before it is ever
   built into a distributed artifact with Apache-2.0 or AGPL-3.0 code, confirm
   that every file is "or later" and resolve the four `UNLICENSED` files.
4. **Backend (`apps/backend`)** contains no copyleft dependency in its runtime
   (registry). Its license can be chosen independently of the frontend
   constraint.

## Options for the owner (decision pending)

| Option | Effect | Fit |
| --- | --- | --- |
| A. Keep "all rights reserved" (no LICENSE) | No reuse rights for first-party code. AGPL obligations still apply to the AGPL parts | Current state. Consistent with a closed commercial product, but the AGPL source offer remains |
| B. AGPL-3.0-or-later for the whole repository | Uniform copyleft. Directly compatible with PineTS/Vela-pinets | Strongest consistency with the frontend constraint. Allows competitors to reuse code under the same terms |
| C. Split licensing: AGPL-3.0 for `apps/web-react`, proprietary or permissive (for example Apache-2.0) for `apps/backend` and docs | Matches the obligations per component | Needs a `LICENSE` per package and precise scoping in the README |
| D. Replace the AGPL Pine runtime | Removes the copyleft constraint | Engineering change; not part of this task |

Whatever is chosen: keep every upstream LICENSE/NOTICE unmodified, keep the
Vela attribution, keep a single, non-conflicting license statement in the
README, and record the choice as an ADR.
