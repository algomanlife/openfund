# Content model

Structured, typed collections — no page is stored as one unstructured JSON/HTML blob.
Every user-facing string family has its own collection with a per-language
translation table (`fa` / `en`).

## ui_messages — every UI string

| Field | Type | Notes |
| :--- | :--- | :--- |
| key | text, unique | landing: the Persian source text (locale.js `ofT` contract); terminal: stable key (`side.long`, `nav.trade`…) |
| namespace | landing / terminal / common | fetched in ONE request, split client-side |
| status | published / draft / archined | only `published` is public and rendered |
| translations | o2m → ui_message_translations | fa + en rows |

`ui_message_translations`: `ui_message_id`, `language_code` (fa|en), `value`.

## navigation_items

| Field | Type | Notes |
| :--- | :--- | :--- |
| location | landing_header / landing_footer / terminal_header | where the item renders |
| route | string | `#accounts`, `#/terminal`, … |
| external_url | string | optional https link |
| sort / visible / status | int / bool / status | ordering + workflow |

`navigation_item_translations`: `label`, `description` per language.

## pages — per-page meta/SEO

| Field | Type | Notes |
| :--- | :--- | :--- |
| slug | string, unique | `landing`, `terminal` |
| template | landing / terminal | which React page |
| status | published / draft / archived | |

`page_translations`: `title`, `subtitle`, `description`, `seo_title`, `seo_description` per language.

## site_settings (singleton)

`default_language` (fa|en), `maintenance_message` — plus future logo/favicon file fields
(brand assets stay protected in `brand/`; the core logo is NOT editor-replaceable).

## Non-goals (by design)

- Market data, prices, positions → **Gains Network** (never CMS content)
- Chart rendering → **Vela**
- Wallet connection → **RainbowKit**
- App logic/routing → **React**
- Financial formulas / risk parameters → never editable via CMS
