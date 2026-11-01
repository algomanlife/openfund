# Translations

## Flow

```text
Directus ui_messages (fa + en, published)
        │  one REST call (public, no token)
        ▼
cms-client (apps/web-react/src/cms/client.ts)
        │  window.ofCmsLanding / window.ofCmsTerminal
        ├── locale.js:  ofT(text) → CMS value, else static translations.json
        └── terminal.js: I18N.fa/en merged with window.ofCmsTerminal
```

- Both pages **await the CMS fetch before the legacy scripts boot**, so the
  first paint already uses backstage content (hard 2.5 s timeout).
- **Fallback:** on any failure the static `translations.json` (the exact
  wording at seed time) keeps the site fully usable — verified by test with
  the backstage stopped.
- Drafts never reach the public API (`status = published` filter + public
  permission condition).

## Language switch

Unchanged from the pre-CMS behaviour: the header language toggle drives
`document.documentElement.dir` (fa→rtl / en→ltr), and text swaps instantly —
there is **no second page load**, only dictionary lookups.

## Editing rules

- **Landing strings**: the item `key` IS the Persian source text (matches the
  rendered DOM node). Edit the `fa` or `en` translation values only.
- **Terminal strings**: keys are stable identifiers (`side.long`, `nav.trade`).
  Editing a value updates the label on the next page refresh (or immediately
  after a language toggle, which re-renders all labels).
- Do not rename keys — the client merges by key.
- Missing translation (no `en` row) → the Persian text is shown (existing
  graceful-degradation behaviour).

## Seeding

`seed_content.py` imports the current wording once and never overwrites
editorial changes afterwards (upsert by key). Re-extract terminal keys after
editing `dist/terminal.js` (brace-counted extraction, see
`apps/backstage/scripts/terminal-i18n.json`).
