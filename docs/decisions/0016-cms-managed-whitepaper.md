# ADR 0016 — CMS-managed structured Whitepaper

- **Status:** Accepted (local implementation; production schema and seed application pending)
- **Date:** 2026-11-09

## Context

The public footer carried a disabled "Whitepaper · coming soon" document button. Openfund needed an official, bilingual whitepaper and business-model publication. It had to be editable without a frontend build, accurate about the status of each capability, and visually native to the website. The requirements excluded a hardcoded React document, an external PDF and a parallel CMS.

## Decision

1. **One page, structured content.** The whitepaper is one route (`/:locale/whitepaper`) rendered from typed blocks. Diagrams, charts and tables are data, not images or HTML.
2. **Reuse the established Directus pattern.** Collections use parent rows with per-locale translation rows, published-only public reads, and translation reads limited to published parents. Blocks are per-locale JSON paired by index, as lesson blocks are.
3. **One schema, three uses.** [schema.ts](../../apps/web-react/src/cms/whitepaper/schema.ts) localizes the repository edition for seeding, pairs and validates CMS rows for rendering, and validates the bundled edition in tests.
4. **All or nothing.** An invalid or incomplete CMS edition, or one without the disclosures and references chapters, is rejected as a whole. The repository edition is shown instead, and the page states which edition is in use.
5. **Numbers live in datasets; prices live in the catalog.** Charts read numeric datasets with translated labels. The pricing block renders `challenge_plans` directly, so the paper cannot contradict the product.
6. **The footer activates the existing entry.** It is not a new footer link or destination.

## Consequences

- Editors can revise text, statuses, datasets and references in Directus, subject to validation.
- A malformed edit makes the page fall back to the repository edition, so authors must keep both locales in step.
- Draft preview on the public page is unavailable because the public API never serves drafts.
- Production needs `apply_schema.py` and `seed_whitepaper_content.mjs` applied with administrator credentials. Until then, production renders the repository edition.

[Whitepaper specification](../website/WHITEPAPER.md) · [ADR index](README.md)
