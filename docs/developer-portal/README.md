# Developer portal source

This folder is the source of truth for the public
[Developer documentation](https://openfi.cloud/en/developers) page
(`/:locale/developers`).

| File | Content |
| --- | --- |
| [`sections.json`](sections.json) | English sections: `slug`, `section`, `sort`, `status`, `source_path`, `last_verified_commit`, `last_verified_at`, `title`, `body` (Markdown) |
| [`../../apps/web-react/src/features/developers/sections.fa.json`](../../apps/web-react/src/features/developers/sections.fa.json) | Persian `title` and `body` per slug |

- The web app bundles both files as the published-only fallback; published
  rows of the Directus `developer_docs` collection override it per section.
- `apps/backstage/scripts/seed_developer_docs.mjs` creates missing rows and
  translations and never overwrites values edited in Directus.
- Arabic, Russian and Chinese readers see the English text until an editor
  publishes a reviewed translation in Directus; nothing is machine translated.
- Every section summarizes a repository file (`source_path`) and links to it.
  Keep the page public-safe: no admin endpoints, internal infrastructure
  details, secrets or anything [SECURITY.md](../../SECURITY.md) keeps private.

The merge rule is in [AGENTS.md](../../AGENTS.md#developer-docs-merge-rule):
developer-facing changes update this folder in the same pull request, and
`scripts/docs/check-docs-impact.mjs` enforces it.
