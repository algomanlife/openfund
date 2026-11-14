# Content registry and React interface editing

The registry extends the existing `ui_messages` / `ui_message_translations`
publication path to React's existing `pick` and `pickRecord` functions. It does
not introduce a second translation engine. Directus is authoritative for
published overrides; repository text is the fallback when an override is absent,
unpublished, invalid or the CMS cannot be reached.

## Locate and edit

1. Serve `apps/backstage` locally, for example with
   `python3 -m http.server 8098 --directory apps/backstage`, and open
   `http://localhost:8098/content-registry.html`.
2. Search by Persian/English text, page, route, component or key. Filter by
   product area or mapping status. Results are paginated, with expandable source
   locations and separate RTL Persian / LTR English values.
3. In Directus, open `ui_messages`. Use the Website or Dashboard and Terminal
   bookmark, then search the `react.*` key from the registry. Filter by
   `content_page`, `content_routes`, `status` or `translation_status` as needed.
4. Edit the nested Persian and English translation rows independently. Review
   both values, mark `translation_status` as `reviewed`, then set the parent
   `status` to `published`. The normal Directus item revisions record edits.
5. Reload the application. AppFrame waits for one bounded published-only request
   before mounting its routes. No rebuild is required for published CMS edits.
   Set the parent to draft/archived and reload to restore bundled fallback text.

The standalone viewer deliberately shows repository wording and mapping status,
not live publication status or last-modified values. Directus shows those fields.
It never contains an administrator token, modifies records, or claims to preview
unpublished text. Draft preview remains within the authenticated Directus editor.

## Administrator examples

- Homepage heading: the existing `home_content` translated heading fields remain
  the editorial authority. Do not create competing interface overrides.
- Dashboard card description: search its text in the registry; use the listed
  `ui_messages` record when mapped to `pick`, or `terminal_sections` for existing
  editorial sections. Render-path review is required for records marked pending.
- Terminal label: React controls use the registry; classic runtime controls retain
  `namespace=terminal` and their established identifiers.
- Applications and certificate copy: use their page filter after regenerating
  and importing the integrated registry. Only static template text is eligible;
  release URLs, certificate issuance, amounts and verification status are not.
- Both languages: edit `fa` and `en` separately in the translations interface;
  select any additional supported language only when its translation is reviewed.

## Setup and updates

Run the existing schema initializer in an authorized local/staging CMS, then:

```sh
node apps/web-react/scripts/content-registry.mjs
python3 apps/backstage/scripts/seed_interface_content.py --dry-run
python3 apps/backstage/scripts/seed_interface_content.py
```

The importer reads the existing server-side `DIRECTUS_URL`,
`DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` environment variables. It
creates missing records as drafts and product-area bookmarks, and never replaces
editor values or customized bookmarks. It does not change application settings,
production credentials, financial tables or permissions. Public permissions
remain published-parent-only for both messages and translation children.

Source-derived identifiers use both Persian and English wording. A source change
creates a new identifier rather than silently attaching an obsolete translation.
Editors must review the new draft; old records can be archived after confirming
that no running release uses them. The generator rejects identifier collisions.

## Coverage and validation boundaries

The AST inventory discovers literal bilingual calls and flat bilingual records,
and records component, line, product area, page and route hint. Route patterns
are organizational hints, not proof that every component is mounted there.
`pick-pipeline` records can resolve through the override path; flat records must
be consumed with `pickRecord`, or created with the repository-only
`interfaceRecord` helper, for that path to apply. Other direct `record[locale]`
access does not gain an override. Existing structured editorial collections
continue through their dedicated typed CMS clients.

Dynamic/interpolated pairs and literal JSX appear explicitly in `exceptions`.
Dynamic account values are never pattern-matched or changed by the CMS. The
registry is therefore an audited inventory with known gaps, not a claim of 100%
coverage or editability. Review functions wrapping `t`, `tr` and similar names:
static discovery alone cannot prove their runtime translation path.

`test:content-registry` fails for newly introduced literal JSX/dynamic-pair
exceptions and placeholder/duplicate-key findings outside the reviewed baseline.
It tests published-only overrides, independent languages, invalid placeholders,
unpublishing and fallback. Existing `test:i18n` remains the additional-language
coverage gate. Updating the registry baseline requires review of its exceptions;
do not regenerate merely to hide missing translations. Additional locales remain
supported and report missing translations using the existing visible notice.

The inventory does not detect every possible hardcoded value (for example,
arbitrary string variables outside bilingual calls). Server errors and inline
legacy strings still need their separate audits. No total-coverage percentage is
asserted. End-to-end editing acceptance requires a running authorized Directus
instance and browser verification of representative pages in both languages.

## Persian and bidirectional writing

Use natural Persian, the approved Persian term for Entry Price, and consistent SL/TP semantics.
Keep prices, percentages, symbols, wallet addresses and transaction identifiers
in isolated LTR spans (`bdi` or `dir="ltr"`). Translate labels only; submit the
original machine-readable numeric values. Never swap SL and TP labels to repair
visual ordering. Preserve placeholder names and do not insert HTML into text.
