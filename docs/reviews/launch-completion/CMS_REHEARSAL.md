# Directus 11.17.4 rehearsal and content application (disposable)

Launch-completion Phase 2. Every step ran against a disposable local stack
(`apps/backstage/upgrade/docker-compose.staging.yml`: `directus/directus:11.17.4`
and `postgres:17-alpine`, bound to 127.0.0.1, throw-away credentials). Nothing
touched production. Directus 12 was not used; it stays blocked by the licence
decision in [the Directus 12 assessment](../../backstage/DIRECTUS_12_ASSESSMENT.md).

## Results

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Stack starts on 11.17.4 + PostgreSQL 17 | Pass | `/server/ping` ok; `/server/health` `{"status":"ok"}` |
| Application migrations in the CMS database | Pass | `npm --prefix apps/backend run migrate` (idempotent), `seed-plans` |
| Bootstrap run 1 (`bootstrap-cms.sh`: schema, editorial, catalog, website, terminal, application tables, commerce, whitepaper, support) | Pass | Exit 0; e.g. `faqs: created 43`, `whitepaper_chapters: created 20`, roles *Commerce Admin* and *Support Agent* created |
| Interface seed run 1 (`seed_interface_content.py`) | Pass | `Created 4293 drafts; preserved 0 existing records` |
| Interface seed run 2 | Pass | `Created 0 drafts; preserved 4293 existing records` |
| Bootstrap run 2 | Pass | Exit 0; every collection `created 0 · updated 0 · kept N`; terminal `new records: {"pages": 0, "ui_messages": 0, "terminal_sections": 0}` |
| No duplicate rows | Pass | `ui_messages` keys with more than one row: 0 |
| Existing keys untouched, new rows draft-only | Pass | 4293 `react` rows, 0 not in `draft`; the 639 published rows are unchanged |
| ar / ru / zh-CN language choices | Pass | `ui_message_translations.language_code` choices: fa, en, ar, ru, zh-CN; no values rewritten |
| Drafts hidden from the public API | Pass | Anonymous `status=draft` read returns `[]` |
| Public bilingual reads (the `check-public-cms.mjs` routes) | Pass | Anonymous `ui_messages` (published) and `home_content` return fa and en; `/server/health` ok. The script itself refuses non-HTTPS origins by design, so the same three reads were made directly against the local instance |
| Whitepaper from CMS collections | Pass | Anonymous `whitepaper_documents` returns the published document with fa/en titles; 20 chapters, 4 datasets, 22 references seeded |
| Visual editing protocol (`apps/backstage/upgrade/visual-editing-check.mjs`) | Pass, 10/10 | See below |

## Visual editing on 11.17.4

The site was served locally with `CMS_PUBLIC_URL=http://localhost:8055`; Directus
had *Visual Editor URLs* set to the site's `/fa/` and `/en/` and
`CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC="'self' http://localhost:8080"`.

1. Anonymous visitors: no `data-directus` attributes and no editing style.
2. Studio frames the site origin.
3. `confirm` from the configured CMS origin attaches `data-directus` attributes;
   none reference a financial collection.
4. Clicking an activated element posts `edit` with
   `collection: ui_message_translations`, the item id and `fields: ["value"]`;
   Studio opens its *Value* popover.
5. A draft `ui_messages` row is invisible to the public API.
6. A published edit is returned by the next public fetch (no rebuild).
7. Anonymous `POST /items/challenge_plans` is refused.

### Defect found and fixed in scope

The site sent `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`, so
the Studio visual editor could not frame it in any environment; the merged
adapter was unusable. The site now adds exactly the configured CMS origin
(`CMS_PUBLIC_URL`, or the `VITE_DIRECTUS_HOST` fallback) to `frame-ancestors`
and omits `X-Frame-Options` only in that case (`apps/backend/server.js`).

### Directus CSP value

Directus 11.17.4 sends no default `frame-src`, so `child-src` governs frames.
Verified with `CHILD_SRC` alone. Production value:

```text
CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC='self' https://openfi.cloud https://openfund.cloud https://openfund-our6.onrender.com
```

## Production steps

The owner runbook is in
[LAUNCH_PARITY_RUNBOOK.md](../../deployment/LAUNCH_PARITY_RUNBOOK.md) (section
*CMS upgrade and content application*). No production command was run.
