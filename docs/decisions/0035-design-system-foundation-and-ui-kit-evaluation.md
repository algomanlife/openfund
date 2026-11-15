# 0035. Design-system foundation and UI kit evaluation

Status: proposed for review (v0.6.5 candidate).

## Context

The v0.6.5 brief asked for a unified design system and an evaluation of
VibeFarsi (<https://vibefarsi.ir>, source <https://github.com/TronIsHere/vibefarsiui>)
as a source of animated and interactive components.

Facts recorded on 2026-11-15: VibeFarsi is MIT licensed ("Copyright (c) 2026
VibeFarsi"); it is distributed as source copied into a project by a CLI or by
hand, not as a package; components require Tailwind CSS v4 theme variables and
`lucide-react`; its CLI also writes agent instruction files into the project.

## Decision

1. Openfund does not install VibeFarsi or Tailwind. Both public site and
   terminal are styled with plain CSS on existing tokens; adding Tailwind for a
   few effects would introduce a second styling system across every page.
2. No VibeFarsi source is copied. The few relevant interaction patterns —
   scroll reveal, spotlight/border light on cards, cross-fading product
   sequences — are re-implemented in `design-system.css`,
   `features/company/reveal.ts` and `styles/useSpotlight.ts`. Because no code
   is copied, no VibeFarsi notice is required; if code is copied later, its MIT
   notice must be added to `THIRD_PARTY_NOTICES.md`.
3. A shared `--ds-*` token layer maps onto the existing site and terminal
   palettes instead of replacing them (see [design system](../design/DESIGN_SYSTEM.md)).

## Consequences

No new runtime dependency or bundle cost; brand identity is unchanged. New
components should consume `--ds-*` tokens and the documented primitives.
Legacy pages keep `legacy/style.css`; migrating them onto the tokens is
incremental and out of scope for v0.6.5.
