# PineTS licensing report

Engineering report, not legal advice. Facts were verified on 2026-11-10 from
the installed packages, the lockfile and the build script. Nothing here
replaces PineTS or changes the chart engine.

## What is used

| Item | Fact | Evidence |
| --- | --- | --- |
| Implementation | `pinets` **0.13.1** (LuxAlgo PineTS, the Pine Script runtime) and `@luxalgo/vela-pinets` **0.3.4** (0.3.2 when first audited) (the official Vela Pine addon that embeds a PineTS worker) | `apps/web-react/package.json` (exact pins), `apps/web-react/package-lock.json` |
| Declared license | **AGPL-3.0-only** for both | `node_modules/pinets/package.json`, `node_modules/@luxalgo/vela-pinets/package.json` and their `LICENSE` files |
| Upstream source | <https://github.com/LuxAlgo/PineTS>, <https://github.com/LuxAlgo/Vela-pinets> | package metadata |

## How it reaches users

| Question | Answer |
| --- | --- |
| Shipped to the browser? | **Yes.** `scripts/build-charts.mjs` bundles the addon (esbuild, minified, IIFE) together with Openfund's `packages/openfund-charts` code and the vendored Vela (Apache-2.0) into `assets/vela-workspace.global.min.js`, and writes the addon's PineTS worker to `assets/openfund-pine-worker.min.js`. Both are served from `apps/web-react/public/assets/` and copied to `dist/assets/` |
| Modified? | **Yes.** The worker is extracted from the addon and patched: the build inserts Openfund's `installPineCompatibility` (`packages/openfund-charts/src/pine-compatibility.mjs`) before the worker's entry point. The build also replaces the embedded worker string inside the addon module with an empty string, so the hosted worker file is used instead. Marker checks make the build fail when upstream changes |
| Linked or embedded? | **Embedded / statically combined.** It is not a separate process or a network service. The addon is bundled into the same JavaScript file as Openfund's chart integration code, and the patched worker runs in a Web Worker started by that bundle |
| Notices shipped? | Yes: `assets/notices/PineTS-AGPL-3.0.txt` and `assets/notices/Vela-PineTS-AGPL-3.0.txt` (copied by the build from the packages' LICENSE files). esbuild `legalComments: 'eof'` keeps license comments in the bundle |

## Obligations under AGPL-3.0 (summary for review)

- **Conveying object code (section 6):** the minified bundle and worker are
  conveyed to every visitor. Recipients must be able to get the
  **Corresponding Source** of the AGPL-covered work. That means the unmodified
  package sources, plus Openfund's modifications (`pine-compatibility.mjs`) and
  the scripts that build them (`scripts/build-charts.mjs`).
- **Remote network interaction (section 13):** users interact with the
  modified program over a network. The modified version must prominently offer
  those users access to its Corresponding Source.
- **Combined work:** whether the Openfund code bundled into the same file
  (`packages/openfund-charts`) forms a single "work based on" PineTS that must
  also be released under AGPL-3.0 is a **legal question**. Statically bundling
  into one script file is the strongest form of combination.
- **Notices:** keep the license texts and copyright notices (done), and state
  the modification (this report and the PINE_SCRIPT documentation).

Current position: the repository is public, so the source exists. **But the
running application does not show a source offer to its users, and no
first-party license has been chosen** (see [Licensing](LICENSING.md)). Attribution
alone does not resolve these points.

## Replacement options (not done; for the owner)

| Option | Effect | Cost |
| --- | --- | --- |
| Keep PineTS and comply | Add a visible "Source code" offer in the terminal and website footer, linking to the exact released source (release tag) including the patch and build scripts. Choose a first-party license compatible with AGPL for the combined frontend | Low engineering; licensing decision required |
| Commercial license from the copyright holder | Some AGPL projects offer dual licensing. Whether LuxAlgo does is **not verified** | Commercial negotiation |
| Replace the Pine runtime | An Openfund-owned interpreter (or another permissively licensed one) removes the AGPL dependency. The three supplied indicators need exact Pine semantics (ADR 0005), so this is a substantial engineering project | High; not part of this task |
| Make Pine indicators optional / server-side | Running PineTS on the server would not avoid section 13 (it still serves network users) | Not a compliance shortcut |

## Items for legal review

1. Whether `packages/openfund-charts` and the rest of the frontend bundle form a
   combined work with PineTS (scope of AGPL-3.0 copyleft).
2. The form and placement of the section 13 source offer, and whether the
   public GitHub repository plus release tags satisfy it.
3. Compatibility of the AGPL frontend with any first-party license the owner
   chooses.
4. The licensing and provenance of the Pine indicator sources in `indicators/`
   (see [Licensing › Pine indicator sources](LICENSING.md#pine-indicator-sources)).
