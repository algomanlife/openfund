# openfund-cms-client

Typed integration layer between the React app and the Directus backstage.
This is the canonical copy; the bundled copy lives at
`apps/web-react/src/cms/client.ts` (mirrored, like the gains/charts adapters).

## Contract

- `fetchCmsTranslations(): Promise<CmsTranslations | null>`
  - ONE request: `GET /items/ui_messages?fields=key,namespace,translations.language_code,translations.value&filter[status][_eq]=published&limit=-1`
  - returns `{ landing: {faSource → en}, terminal: {key → {fa, en}} }`
  - hard 2.5s timeout, silent `null` on any failure → the app falls back to
    the static `translations.json` and stays fully usable
- Public read-only endpoint; NO tokens in frontend code
- `VITE_DIRECTUS_URL` env overrides the default `http://localhost:8055`

## Consumers

- `locale.js` bridge: `window.ofCmsLanding` overrides the static dict
- `terminal.js` bridge: `window.ofCmsTerminal` overrides the built-in I18N
- Both pages await the fetch BEFORE injecting the legacy script chain
