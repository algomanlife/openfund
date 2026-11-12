# First-party license decision (owner approval required)

Decision document, not legal advice. Prepared 2026-11-12 from `main`
`38e17f4`. Facts come from the [licensing report](LICENSING.md), the
[PineTS report](PINETS.md) and the files cited there.

> **Approval gate.** No license is chosen or granted by this document. Until
> the owner records a decision (an ADR under `docs/decisions/`), Openfund's own
> code stays **all rights reserved** and the repository is public for
> transparency only. Publishing a repository does not grant an open-source
> license.

## 1. What is being licensed

Only material Openfund owns. Third-party code keeps its own license whatever
is chosen.

| Scope | Examples | Covered by the decision? |
| --- | --- | --- |
| First-party source | `apps/web-react/src`, `apps/backend`, `apps/backstage/scripts`, `packages/openfund-charts`, `packages/openfund-footprint`, `packages/openfund-gains-adapter`, `packages/cms-client`, `scripts/`, `e2e/`, `infra/` | Yes |
| First-party docs and brand | `docs/`, `brand/` logos and brandbook | Yes, possibly under a different license (for example CC BY 4.0 for docs, trademark terms for the logo) |
| Vendored upstream | `vendor/vela` (Apache-2.0), `vendor/gains-sdk` (MIT), `third_party/luxalgo-trade-journal` (MIT), `packages/openfund-protocol` (GPL-2.0 import) | No: upstream terms, kept unmodified |
| npm dependencies | PineTS and Vela-pinets (AGPL-3.0-only), MetaMask SDK (ConsenSys proprietary), MIT/ISC/BSD/Apache packages | No |
| Unresolved provenance | Irancell-derived fonts, `indicators/*.pine`, generated team portraits | No: must be resolved first (section 3) |

## 2. Options

| | A. All rights reserved (status quo) | B. AGPL-3.0-or-later | C. Split: AGPL-3.0 chart integration, rest reserved or source-available | D. Permissive (Apache-2.0) |
| --- | --- | --- | --- | --- |
| Others may use the code commercially | No | Yes, if they publish their changes, including for network use | Chart integration only, under AGPL | Yes, freely, including closed forks |
| Proprietary use by Openfund itself | Yes | Yes (the owner is not bound by its own license, but third-party contributions are) | Yes for the reserved part | Yes |
| Outside contributions | Undefined terms today; needs a CLA or DCO | DCO is enough (inbound = outbound) | DCO per part; CLA if relicensing is wanted | DCO is enough |
| Fit with AGPL PineTS in the shipped chart bundle | **Conflict to resolve**: the bundle statically combines Openfund chart code with AGPL code ([PineTS](PINETS.md)); conveying it without AGPL terms for that combined work is the main legal question | Compatible | Compatible if counsel accepts the chart bundle as the AGPL boundary | Compatible (permissive code can join an AGPL work), but the combined bundle is still conveyed under AGPL |
| Fit with Apache-2.0 Vela, MIT packages | Fine | Fine (Apache-2.0 is GPLv3-compatible) | Fine | Fine |
| Fit with MetaMask SDK (proprietary) | Fine, subject to its own terms | **Question**: a proprietary module in the same web build as AGPL code | Fine if the SDK stays outside the AGPL part | Fine, subject to its own terms |
| Fit with dormant GPL-2.0 protocol import | Not shipped; no effect | Mostly GPL-2.0-or-later, so it can move to GPLv3 terms; 4 `UNLICENSED` files must be resolved before shipping | Keep it a separate package with its own LICENSE | Must stay GPL; cannot become Apache-2.0 |
| Competitive protection | Strongest | Strong: SaaS competitors must publish changes | Strong for the reserved part | None |
| Effort | None now; still requires the AGPL question answered | Root LICENSE, notices, headers, DCO | Two LICENSE files and a documented boundary | Root LICENSE, NOTICE, DCO |

Two further options exist but do not remove the AGPL question: a
source-available license (for example BSL 1.1 or FSL) behaves like A for the
chart bundle; replacing PineTS (engineering work, no change to visible chart
behavior allowed) removes the AGPL constraint for every option.

## 3. Blockers to clear before any public license

These apply to every option, including A.

1. **Irancell fonts.** `openfund-1.ttf`–`openfund-5.ttf` are byte-identical
   copies of `irancell-400/500/600/700/900.ttf`, and the five
   `openfund-persian-*-v4.woff2` files are renamed derivatives. All of them
   carry "Copyright © 2017 by Irancell. All rights reserved." and an Irancell
   trademark string. They are served by the production web app (legacy and
   terminal CSS) and stored in `brand/typography/`. No license or permission is
   recorded. The owner must produce a license from the rights holder or replace
   the fonts (a visual change that needs separate design approval). Relicensing
   cannot cover them.
2. **Pine indicators.** `indicators/smc-v1.pine` states CC BY-NC-SA 4.0
   (non-commercial), and `indicators/README.md` calls the sources proprietary.
   Authorship and the right license are unconfirmed
   ([LICENSING.md item 3](LICENSING.md#pine-indicator-sources)).
3. **AGPL scope** of the shipped chart bundle and the form of the section 13
   source offer ([PineTS](PINETS.md)).
4. **MetaMask SDK** commercial-use limit (non-commercial use defined as at most
   10,000 monthly active users) and notice placement.
5. **Copyright ownership.** Commits come from three human GitHub identities
   (one account with 38 commits besides the owner's two) and AI coding agents
   working for the owner. The owner must confirm which legal entity owns the
   code and that every human author assigned or licensed their work to it.
6. **Generated imagery.** `team-portraits.png` is recorded as AI-generated
   (`DESIGN_AND_CONTENT_NOTES.md`); its copyright status may differ by
   jurisdiction. Low risk, but record the generator's terms.

## 4. Recommendation

On the verified dependencies, and before counsel answers the AGPL question:

- If the goal is openness and contributor reuse: **option B**
  (AGPL-3.0-or-later for first-party code, CC BY 4.0 for docs, logos kept
  under trademark terms). It is the only option with no license conflict in the
  shipped chart bundle.
- If the goal is commercial control: **option C**, with counsel confirming that
  the chart bundle (`packages/openfund-charts` plus `scripts/build-charts.mjs`)
  can be the AGPL part; otherwise plan the PineTS replacement.
- Option D gives away the commercial application without solving any blocker,
  and option A leaves the AGPL question open. Neither is recommended.

In every case adopt the [Developer Certificate of Origin](https://developercertificate.org)
for outside contributions (or a CLA if future relicensing matters), and clear
blockers 1 and 2 first.

## 5. Owner decisions requested

| # | Decision | Needed from |
| --- | --- | --- |
| 1 | Option A, B, C or D (or PineTS replacement) | Owner, with counsel on the AGPL question |
| 2 | Copyright holder name for notices (legal entity) | Owner |
| 3 | Irancell fonts: license evidence or replacement | Owner (and designer if replaced) |
| 4 | Indicator sources: author and license | Owner |
| 5 | MetaMask SDK: keep or drop the connector | Owner (product) |
| 6 | DCO or CLA for contributions | Owner |
| 7 | Visible "Source code" link in footer and terminal for the AGPL offer | Owner (product) |

## 6. Prepared next steps once a decision is recorded

The change set is ready to write and is deliberately not created yet:

1. ADR `docs/decisions/00NN-first-party-license.md` recording the decision,
   holder and scope.
2. Root `LICENSE` with the unmodified license text (and per-part `LICENSE`
   files for option C); a root `NOTICE` listing the holder and the Vela NOTICE
   reference for Apache-2.0 redistribution.
3. `"license"` fields in the root, `apps/*` and first-party `packages/*`
   `package.json` files (today the root, `apps/backend` and `apps/web-react`
   declare no license and are `private: true`; the protocol import declares
   `UNLICENSED` and stays as imported).
4. README badge and License section, `THIRD_PARTY_NOTICES.md` header,
   `CONTRIBUTING.md` (DCO sign-off) and, if the DCO is chosen, a CI check.
5. Footer/terminal source-offer link if approved (a UI change with its own
   review).

Vendored LICENSE and NOTICE files, `third_party/` provenance and the shipped
notice files under `assets/notices/` stay unchanged in every option.
