# Documentation maintenance

Start with [docs/README.md](../README.md), [Feature Status](../product/FEATURE_STATUS.md), the relevant product/API contract and [milestones](../roadmap/MILESTONES.md) before coding. Maintain one canonical description of each behavior; compatibility pages link to it.

## Language policy

All first-party repository documentation, nested READMEs, GitHub templates, explanatory comments, test descriptions, diagrams and screenshot captions use English. Translate useful historical reports, preserving scope, evidence, provenance and limitations. Historical reports are snapshots, not current specifications.

Application language is a separate contract. Preserve Persian strings, RTL behavior, dictionaries, CMS content/seeds, fonts and executable localization assertions. The automated language checker scans every tracked Markdown/text documentation file, diagram text and first-party source comments/test descriptions. It excludes license bodies and vendored/upstream source comments to preserve original attribution, but still checks upstream Markdown prose. The Vela localization reference table and fenced examples retain native language names/numerals as upstream localization data. It does not treat runtime string literals or translation fixtures as documentation. See [checker](../../scripts/docs/check-language.mjs) for exact behavior.

Current documentation screenshots use the English UI. Native controls may show a Persian language-switch glyph, brand wordmark or localized date/identifier digits; these are authentic application localization, not untranslated explanatory graphics. Older Persian/UI captures are removed from the active asset tree and preserved through immutable historical Git links. New diagrams and presentation graphics are English.

## Required updates

A capability change updates product documentation, feature status, milestone status/dependencies and affected architecture/integration contracts. Material changes add a changelog entry. Significant UI changes refresh screenshots from the current build and update `manifest.json`; do not fabricate states, overlay fake balances or expose personal wallets.

New environment variables update the owning Blueprint service, environment register and example file. Preserve the three Render resources and same-origin app hosting. New validation requirements update CI in the same PR.

## Asset workflow

Approved logo files are copied byte-for-byte from `brand/logos/` into [documentation brand assets](../assets/brand/README.md). SVG presentation art uses current app colors and Ubuntu/system typography, with accessible text alternatives. Do not replace approved geometry, copy commercial fonts without rights, or present design diagrams as screenshots.

## Checks

```bash
npm run docs:language
npm run docs:links
npm run docs:markdown
npm run docs:mermaid
npm run docs:check
```

Local link/image checks include repository-root and relative paths, fragments, HTML attributes and reference-style definitions. HTTP links are external references and are not all availability-probed on each check; localhost examples and upstream API path examples are intentional. Mermaid uses the pinned parser; Markdown checks enforce structural/syntax rules while allowing wide tables and GitHub HTML. Future edits must not weaken exclusions to hide untranslated prose.

## Synchronization gate

`npm run docs:required` (`scripts/docs/check-required.mjs`, part of
`docs:check` and therefore of CI) reports, and never fixes:

- missing required documents (README, CONTRIBUTING, SECURITY, CHANGELOG,
  THIRD_PARTY_NOTICES, payment, deployment, operations, licensing and
  governance references, PR and issue templates);
- README sections that are missing from the 12 required entry-point sections (and the 29 engineering-reference sections);
- `render.yaml` environment variables not documented in
  `docs/deployment/ENVIRONMENT.md`;
- a changelog whose first section is not `Unreleased`.

Content stays human-written and reviewed. CI only validates. Nothing commits
generated documentation or bypasses branch protection. Version information
comes from the release tooling (`scripts/release/version.mjs`, the release
manifest and `/version`), never from hand-edited README values. Every pull
request that changes behavior updates the affected documents in the same
change (PR template checklist).

## Documentation dependency hygiene

Root tooling is development-only. The Markdown parser currently requires scoped overrides for patched `re2js` 2.8.7 and KaTeX 0.18.11 through its math extension; these address the audit findings in the newly added documentation dependency graph. Application dependency versions and lockfiles are unchanged. Recheck `npm audit --registry=https://registry.npmjs.org` before removing the overrides.
