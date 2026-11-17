# ADR 0038 — Universal visual editing on Directus 11.17.4

- **Status:** Accepted; merged to `main` (`b7fec1e`, `440ecb8`). Rehearsed on a disposable Directus 11.17.4 on 2026-11-17, where a site `frame-ancestors` defect was found and fixed ([rehearsal](../reviews/launch-completion/CMS_REHEARSAL.md)). Not applied to production Directus and not deployed.
- **Date:** 2026-11-15

## Context

Openfund already edits user-facing copy in Directus. The installed CMS is
`directus/directus:11.17.4`. That release includes the Studio visual editor and
the `@directus/visual-editing` protocol (`connect`, `confirm`,
`checkFieldAccess`, `activateElements`, `edit`, `saved`). Directus 12 is still
blocked by the licence decision in ADR 0020.

Editors needed to select an existing page, choose a language, and change the
copy that is already on that page. They did not need a page builder, a second
CMS, or control over layout, trading, or payments.

## Decision

1. Keep Directus as the only CMS. The website speaks the 11.17.4 visual-editor
   protocol with a small in-repo adapter. No new npm dependency was added.
2. A `data-directus` attribute is rendered only after the configured CMS origin
   confirms the Studio iframe. Visitors, and any other parent frame, do not
   receive editing attributes or draft preview.
3. React interface strings keep their `react.*` ids in `ui_messages`.
   Structured pages keep their existing collections. The adapter never targets
   financial collections.
4. `fa` and `en` stay the required authored pair. `ar`, `ru` and `zh-CN` are
   additional translation choices. New unreviewed translations are not seeded
   onto published parents, because publishing the parent would publish every
   language row.
5. If Directus is unavailable, the existing bundled copy remains. Drafts are
   not part of the public read.

## Consequences

- Click targets exist for direct JSX literals and for on-screen text that
  matches one published field. Ambiguous strings and copy that is not on
  screen are listed in the editor catalog.
- Production still needs an authorized run of `apply_schema.py` before the new
  language choices exist in a live Studio. This change does not run that script
  against production.
- Open Trade desktop keeps its own string helper and is not wired to this
  session.

[Visual editing report](../backstage/UNIVERSAL_VISUAL_EDITING.md) · [ADR index](README.md)
