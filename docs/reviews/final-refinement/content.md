# Content refinement evidence

Status: **PARTIALLY COMPLETE**. Local implementation, isolated tests and registry
browser checks are verified. Total fixed-content editability and live Directus
publication acceptance are not yet verified. No production content was modified.

## Implemented

- Existing React `pick` / `pickRecord` supports validated published overrides from
  the existing Directus `ui_messages` translation authority. AppFrame fetches
  before mounting routes; unavailable/invalid CMS content falls back to bundled
  wording. No operational data, HTML or executable URLs are edited through it.
- AST registry: 3,977 bilingual source records, 2,012 records with discovered
  literal calls, 74 explicit dynamic/JSX exceptions, 28 reviewed neutral
  identifiers, zero placeholder/duplicate-key findings. These are source inventory
  counts, not verified total coverage or a percentage.
- Searchable, paginated administrator viewer with product-area/language/mapping
  filters and expandable component/route locations. Existing Directus collection
  gains page/route/owner/review metadata; additive importer creates drafts and
  product bookmarks without overwriting editorial values.
- Dashboard and portfolio unit labels are now static translatable labels with
  separate operational units. Journal filters, empty states and accessibility
  labels, economy table headings and the technical feature notice are localized.
- Named template interpolation fixes reordered translated placeholders. Thirty
  existing Arabic/Russian/Chinese entries now retain their source placeholder
  names. In particular, Chinese word order no longer swaps day/profit values.
- CI gains registry and locale-contract checks. Newly unregistered fixed content,
  new exceptions, duplicate dictionary keys and placeholder mismatches fail.

## Verified checks

- `npm ci --prefix apps/web-react --ignore-scripts --legacy-peer-deps`: passed.
  Plain `npm ci` failed on the baseline missing TypeScript peer lock entry; no
  lockfile was changed to hide that failure.
- TypeScript, registry/runtime unit tests, existing additional-locale coverage,
  Blueprint validation, full documentation checks and Python compilation passed.
- Registry browser: Opera headless at 1440x1000 and 390x844; searched Dashboard
  (53 results), moved to the next result page and visually inspected both
  captures. One favicon 404 was the only observed browser console error.

[Desktop](../../assets/screenshots/final-refinement/content-registry-desktop.png)
· [Mobile](../../assets/screenshots/final-refinement/content-registry-mobile.png)

## Remaining acceptance

Local Directus 11.17.4 setup is in progress using an isolated PostgreSQL database;
production CMS access is not used. Apply/seed, parent/child draft permissions,
editor publication and actual route rendering require live acceptance.
Registry flat records need `pickRecord` or the repository-only `interfaceRecord`
helper; dedicated editorial clients retain their existing authority. Dynamic
financial prose, arbitrary JSX/attribute literals and indirect arrays still need
mapping review. Literal-call discovery alone cannot prove a wrapper uses `pick`.

The administrator workflow and coverage limits are documented in
[Content Registry](../../backstage/CONTENT_REGISTRY.md). A Persian companion guide
is provided as an external artifact to preserve English-only repository prose.
