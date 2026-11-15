# Universal visual CMS editing

Implemented by: Cursor Agent

This is a source change on the visual-editing branch. It is not merged, not
deployed, and it has not been applied to a production Directus database.
Commits:

- `b7fec1ed076008c6454024d0017fa08e21176605` — `feat(cms): [Cursor] implement universal visual content editing`
- `8c98b4d6b0749b1e51bbeeba8f75f304556f4263` — `docs(cms): [Cursor] record visual editing implementation SHA`
- `90f744f2917974aa87aae132f0df6f9066e3b1cf` — `docs(cms): [Cursor] list visual editing commit SHAs`
- `440ecb8a0b437d57adc138c116126f87d7b74bb1` — `fix(cms): [Cursor] stop srcdoc postMessage errors and lock TypeScript 5.9.3`

## Directus version

The repository pin is `directus/directus:11.17.4`, recorded in
`docs/integrations/upstream-registry.json` and ADR 0020. The 11.17.4 release
notes include `@directus/visual-editing` inside the Studio. The page adapter
uses that version's messages: `connect`, `confirm`, `checkFieldAccess`,
`activateElements`, `edit` and `saved`. Directus was not upgraded.

## What an editor can do

1. Open the existing Directus Studio and its visual editor, pointed at the
   website origin.
2. The website sends `connect` only when it is framed and the parent origin is
   the configured CMS origin.
3. After `confirm`, editable elements receive `data-directus` values of the
   form `collection:<name>;item:<id>;fields:<field>;mode:popover|drawer|modal`.
4. A click sends `edit` for that collection, item and field. The language is
   the language already selected in the website.
5. A draft saved in Directus stays off the public API. The editor iframe can
   preview a plain-text value from the `saved` payload. Visitors never receive
   that preview.
6. Publishing makes the value available on the next public fetch. The editor
   iframe drops its content cache immediately. A public tab refetches when it
   regains focus. No rebuild is required.
7. Directus item revisions remain the rollback control. The schema script sets
   accountability to `all` only when a collection had been given a narrower
   value.
8. Copy that is conditional, ambiguous, or not on the current screen is listed
   in the editor content catalog. That catalog is not a route and is not
   rendered for visitors.

## Coverage inventory

Counts are from `apps/backstage/content-registry.json` and
`node apps/web-react/scripts/validate-visual-editing.mjs` on this branch.

| Item | Count |
| --- | --- |
| Registered source records (`fa` and `en` required) | 4285 |
| Records with a `pick` pipeline location | 2138 |
| Registry exceptions | 74 (67 dynamic interpolated pairs, 7 literal JSX strings) |
| Reviewed language-neutral exclusions | 27 |
| Routes registered for editorial ownership | 54 |
| Structured editorial surfaces | 21 |
| Forbidden financial collections blocked by the checker | 12 |
| Direct JSX literals with a visual-editing reference | 29 of 29 |

Area counts in the registry: Global Content 2279, Website 1800, User Dashboard
169, Trading Terminal 37. Page labels in the registry are source-file hints,
not proof that every component is mounted on that route.

### Locales

| Locale | Registry / seed | Runtime |
| --- | --- | --- |
| fa | 4285 source values, seeded only as drafts for new rows | Required. No silent switch to English. |
| en | 4285 source values, same draft rule | Required. |
| ar | Not seeded onto CMS rows | Dictionary fallback, then a published Directus row if an editor adds one. Missing rows are reported. |
| ru | Not seeded onto CMS rows | Same as Arabic. |
| zh-CN | Not seeded onto CMS rows | Same as Arabic. The app code is `zh-CN`, not `zh`. |

Added-locale dictionary rows for the new editor-catalog labels were inserted
for `ar`, `ru` and `zh-CN`. They are repository fallbacks, not published CMS
translations, and they have not had a separate native legal review.

### Click coverage and exceptions

- Direct literal `pick` / `pickRecord` JSX children and attributes get a stable
  key on the element.
- Structured collections (home, FAQ, legal, learning, whitepaper, referral,
  governance, terminal sections, and the others listed in
  `editorialSurfaces.ts`) are fetched in the editor session. Text that fills
  exactly one element and matches exactly one field is tagged. Repeated text
  is not guessed.
- Whitepaper dataset numbers and `value` fields are not tagged. Reference URLs,
  support URLs and footer destination fields are not click targets.
- `challenge_plans` prices, limits and the rest of the forbidden list are not
  visually editable.
- Dynamic pairs (67) interpolate account or market values. They stay in the
  exception list.
- Seven literal JSX strings remain in the existing review exception list.
- Open Trade desktop (`apps/open-trade`) has its own `t()` helper and does not
  mount this session. Its order and wallet code was not changed. Wiring it
  would be a separate desktop integration.
- Legacy terminal labels inside the trading iframe are annotated only when the
  confirmed session sends a unique string. The terminal script does not submit
  orders or read accounts.

## Schema

`apply_schema.py` adds `ar`, `ru` and `zh-CN` to existing language dropdowns
when those choices are absent. It does not rewrite translation values.
`seed_interface_content.py` still creates missing `ui_messages` as drafts with
`fa` and `en` only, and it still skips keys that already exist.
`seed_terminal_content.py` widens the terminal section language dropdown the
same way.

No production schema command was run.

## Security

- Editing attributes and the catalog exist only after `confirm` from the
  configured CMS origin.
- Public reads stay published-only. The preview reader is inactive until that
  confirmation.
- Preview text is plain text. Placeholder sets must match the English source
  or the preview is ignored. React renders the string as text.
- Link, payment and support URL fields are not visual-editing targets.
- The terminal iframe accepts edit forwarding only for collections on the
  editorial allowlist.

## Isolated Studio verification (2026-11-15)

Directus `GET /server/info` on the isolated instance reported version **11.17.4**.
The database was a new PostgreSQL 16 database, not a production copy. Schema
was applied with `apply_schema.py`. `seed_interface_content.py` created 4285
draft `ui_messages` and left existing rows untouched (there were none). One
home singleton and one interface row (`react.38b877ee39f7a358`, English
"Buy Challenge" and its bundled Persian label) were published for the click-through.

| Check | Result |
| --- | --- |
| Studio visual module framed `http://127.0.0.1:5173/fa/home` | Persian page, `dir=rtl`. Three `data-directus` nodes. |
| Click the bundled Persian challenge label | Directus opened a Value popover on that translation. |
| Type a distinct Persian test sentence and press the check control | API read-back: fa value changed; en stayed `Buy Challenge`; status stayed `published`. |
| Parent set back to `draft` | Anonymous `GET /items/ui_messages?filter[id][_eq]=964` returned `[]`. Public `/fa/home` showed the bundled label, not the draft. |
| Parent set to `published` again and the public page reloaded | `/fa/home` showed the new Persian sentence with no rebuild. |
| `/en/home` | `dir=ltr`, still "Buy Challenge", Persian draft text absent. |
| `/ar/home`, `/ru/home`, `/zh-CN/home` | `dir` rtl, ltr, ltr. `lang` ar, ru, zh-CN. No horizontal overflow at 1280px. The published row has no ar/ru/zh-CN translation, so those pages keep the dictionary fallback. |
| Revisions | Studio Revisions tab and `GET /revisions` showed create plus three updates (ids 3289, 13258, 13260, 13261). `POST /revisions/13261/revert` is not a route on 11.17.4 (404). |
| Public editing chrome | A normal `/fa/home` load had zero `data-directus` attributes. |
| Financial collection | Anonymous `POST /items/challenge_plans` returned 403. |
| Layout sweep | `/fa/home`, `/en/home`, `/fa/prop/dashboard`, `/fa/prop/trade` at 390, 768 and 1280px. `scrollWidth` stayed within the viewport. Dashboard and trade were the signed-out Vite shell, not a funded trading session. |

Directus's default `child-src 'self'` blocked the preview iframe until this
isolated process set `CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC` to also
allow `http://127.0.0.1:5173`. That environment variable is local-only. It is
not a repository or production change. A production Studio needs the same kind
of frame allowance for its real website origin, configured by the operator.

Evidence:

- `/opt/cursor/artifacts/05-after-click-text.png`
- `/opt/cursor/artifacts/07-popover-edited-fa.png`
- `/opt/cursor/artifacts/08-after-popover-save.png`
- `/opt/cursor/artifacts/12-item-draft-in-studio.png`
- `/opt/cursor/artifacts/13-public-fa-while-draft.png`
- `/opt/cursor/artifacts/14-public-fa-after-publish.png`
- `/opt/cursor/artifacts/15-public-en-unchanged.png`
- `/opt/cursor/artifacts/16-locale-ar.png`
- `/opt/cursor/artifacts/16-locale-ru.png`
- `/opt/cursor/artifacts/16-locale-zh-CN.png`
- `/opt/cursor/artifacts/17-fa-home-390.png`, `17-fa-home-768.png`, `17-fa-home-1280.png`
- `/opt/cursor/artifacts/17-fa-prop-dashboard-1280.png`
- `/opt/cursor/artifacts/17-fa-prop-trade-1280.png`
- `/opt/cursor/artifacts/18-revisions-panel.png`
- `/opt/cursor/artifacts/studio-draft-publish-locales.webm`

## CI Backend failure

Job `Backend (API + engine)` on `90f744f` failed in `npm run test:browser:audit`,
which the workflow retries once. The first attempt timed out waiting for the
terminal partial-close control. The second attempt reached the final assertion
`No uncaught JavaScript errors` and failed. The audit does not print the
message. A local Chromium reproduction of the trading `srcdoc` iframe showed:

`Failed to execute 'postMessage' on 'Window': Invalid target origin 'null'`

`legacy/visual-editing.js` posted to `location.origin`. A `srcdoc` document
reports that origin as `null`, and `postMessage` throws. The script now posts
to `parent.location.origin` and ignores a cross-origin parent. The same
reproduction then reported no page error. After rebuilding `react/` and booting
the API on a disposable database, `npm run test:browser:audit` passed all 27
checks, including "No uncaught JavaScript errors" and the partial-close margin
wait that had timed out in CI. Main's CI at `a439f24` was green, so this
failure was introduced by the new terminal script.

## Lockfile

`npm ci` with npm 10.9.9 failed: `Missing: typescript@5.9.3 from lock file`.
`@solana/accounts@5.5.1` (under `@coinbase/cdp-sdk`) has an optional peer
`typescript@^5.0.0`. The root TypeScript is 7.x, so npm places 5.9.3 beside
that package. `npm install --package-lock-only` added that optional peer and
`dev: true` markers on existing optional platform packages. No package version
was upgraded. A clean `npm ci --ignore-scripts` then exited 0.

## Tests executed

| Command | Result |
| --- | --- |
| `npm --prefix apps/web-react run test:content-registry` | Pass. Registry check, locale contracts, visual-editing check, 18 tests. |
| `npm --prefix apps/web-react run test:i18n` | Pass. |
| `npm --prefix apps/web-react run typecheck` | Pass. |
| `npm --prefix apps/web-react run test:terminal` | 51 pass, 1 fail: `terminal-completion.test.mjs` could not import `jsdom` until the root devDependency was installed. Re-run after `npm ci` at the repo root: 9 pass, 0 fail. |
| `npm --prefix apps/web-react run test:content` | First run failed where tests import `jsdom` and the package was not installed. Re-run with root `jsdom@27.4.0`: `public-content`, `community`, `ui-refinement` and `refinement-navigation` passed (46 tests, 0 fail). |
| `node --test scripts/pr/check-pr-description.test.mjs` | Run with the documentation checks. |
| `python3 -m py_compile apps/backstage/scripts/apply_schema.py apps/backstage/scripts/seed_terminal_content.py` | Pass. |
| `python3 apps/backstage/scripts/seed_interface_content.py --dry-run` | Pass. Printed the registry summary. No network. |

The isolated Studio click-through, locale checks and 390/768/1280 layout sweep
are recorded above. Not run: `npm run release:build` and any production
migration. After the lockfile update, `npm ci --ignore-scripts` in a clean
directory exited 0. `node --test apps/web-react/test/visual-editing.test.mjs`
then passed 11 tests, including the srcdoc postMessage guard.

## Unrelated functionality

No trading, evaluation, payment, wallet, authentication, market-data, chart,
or deployment file was edited except `TradingPages.tsx`, which only appends
`legacy/visual-editing.js` to the existing terminal iframe script list. The
script is inert until the editor session starts.

[ADR 0038](../decisions/0038-universal-visual-editing.md) · [Content registry](CONTENT_REGISTRY.md)
