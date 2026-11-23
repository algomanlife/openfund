# Site search core

Shared by the backend index (`apps/backend/site-search.js`) and the web app's
command palette and results page (`apps/web-react/src/features/search/`).
Pure ES module, no dependencies. Decision record: ADR 0052.

| Export | Purpose |
| --- | --- |
| `normalizeText`, `normalizeWithMap` | Persian/Arabic letter unification (Arabic yeh U+064A and alef maksura U+0649 → Persian yeh U+06CC, Arabic kaf U+0643 → keheh U+06A9), ZWNJ as a space, diacritics removed, Persian (U+06F0–U+06F9) and Arabic-Indic (U+0660–U+0669) digits → 0–9, case folding |
| `tokenize` | Normalized query words (at most 12) |
| `search` | Ranked matches; every token must match, by prefix, substring, synonym or a typo within budget (one edit from 4 letters, two from 8) |
| `synonymLookup` | Synonym groups edited in Backstage → token lookup |
| `highlightRanges` | Match ranges in the original text, for highlighting |
| `maskQuery` | Analytics form of a query: emails, wallets, hashes and phone numbers masked, normalized, capped at 80 characters |

Tests: `apps/backend/test/site-search.test.mjs`.
