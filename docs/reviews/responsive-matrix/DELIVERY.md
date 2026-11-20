# Responsive, RTL/LTR and accessibility launch matrix

Branch `agent/claude/responsive-matrix`, cut from `main` at `3dd5a45e` with later
`main` merged in. Frontend and CI only. Unreleased, not deployed. This covers
workstreams D/E/F of the launch-readiness mandate: the public website, the
terminal's responsiveness and RTL/LTR correctness.

## How the evidence was produced

`e2e/test-responsive-matrix.cjs` runs against the production build in `react/`.
It serves that build through `e2e/helpers/static-site.cjs`, which provides a stub
`/runtime-config.js` and answers 503 to every backend and Directus request. Pages
therefore show their published, backend-down fallbacks. The pages' own public
market-data requests from the browser (Gains) were not blocked, so live prices
appear in some captures and a loading state in others. No request was
intercepted or fabricated, and no wallet was connected. The context used
`prefers-reduced-motion: reduce`, so marquees and reveals stay still.

The suite covers:

- 10 widths: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px;
- 5 locales: `fa` and `ar` (RTL); `en`, `ru` and `zh-CN` (LTR);
- 2 themes: dark and light;
- 16 routes: `home`, `challenges`, `markets`, `rulebook`, `transparency`,
  `whitepaper`, `roadmap`, `checkout`, `prop/dashboard`, `prop/trade`,
  `prop/chart`, `prop/radar`, `prop/heatmap`, `prop/portfolio`, `prop/journal`
  and `perpetual/trade`.

[Testing](../../development/TESTING.md#responsive-matrix) lists the assertions.

## Results

| Run | Build | Checks passed | Failed |
| --- | --- | --- | --- |
| Baseline | `main` at `3dd5a45e`, before the fixes | 10,664 | 438 |
| After | this branch merged with `main` at `48504022` | 11,198 | 0 |

Baseline failures by check: axe serious/critical 284, clipped control labels
102, overflow with disclosures open 50, and document horizontal overflow 2. Clipped interactive controls, critical console errors and every drawer check
passed in the baseline. The after run also includes the later
`no untranslated-copy notice` check (96 more checks). The drawer already opened on the correct
side and closed on Escape, on an outside click and after navigation in every
locale.

## Root causes and fixes

| Finding | Root cause | Fix (shared layer) |
| --- | --- | --- |
| `GitHub` icon label reported as untranslated in ar/ru/zh-CN (introduced and caught on this branch) | A brand name was missing from the language-neutral list | `GitHub` joins `TradingView`, `Bitpin` and the other brand names |
| Filter tab labels cut at 320-768 px (challenges and markets, every locale) | The design-system rule `min-inline-size: 32px` replaces flex's `min-width: auto`, so the strip's buttons shrank below their text | `flex-shrink: 0` on the shared `.market-tabs` / `.market-views` button rule; the strip scrolls |
| Whitepaper chart-data tables widen phones to 680 px when opened | legacy `style.css` gives every `table` `min-width: 680px` and `nowrap` below 700 px, a rule meant for tables in a scroller | Information pages reset tables that are not inside `.info-table-wrap` |
| Russian market cards overflow at 320 px | The card head row cannot wrap a long status label | The head row wraps (logical properties) |
| Terminal menu button and brand link have no accessible name at compact widths | `display: none` on the only visible text | The text is visually hidden (`.ds-sr-only` declarations) instead |
| Label-in-name mismatches (WCAG 2.5.3): header brand, GitHub row, market cards | An `aria-label` replaced the visible text | The visible text is the name; the GitHub icon carries `role="img"` |
| Scroll regions not keyboard-reachable (ticker, wallet showcase, market list, whitepaper tables) | `overflow: auto` with no focusable content | Focusable viewports; new shared `TableScroll` region for data tables |
| Size control `aria-label` on a bare `div`; notice text inside `<dl>` | Invalid ARIA and list content | `role="group"`; the notice sits beside the hidden list |
| Light-theme contrast (table headers, empty and error states) | Dark-theme hex colours with no light token | Light overrides use `--ds-text-muted` and `--ds-negative` |
| Low-contrast decorative copy (landing caption, whitepaper numbers) | 6-8 px type or opacity below 3:1 | Readability floor and colour mixes that pass in both themes |
| `/transparency` route error when a 2xx response is not JSON | `useRemote` treated `null` data as a ready report | A 2xx with no JSON body is treated as unavailable |

The last finding appeared only while the static host returned the HTML shell to
backend fetches. With the final host (503) it no longer occurs. The fix stays
because a proxy or CDN that serves an HTML fallback would produce the same crash.

Vela chart internals and trading logic were not touched.

## Screenshots

Genuine captures from the runs above are in
[`docs/assets/screenshots/responsive-matrix/2026-11-20/`](../../assets/screenshots/responsive-matrix/2026-11-20/),
in `before/` and `after/` pairs. They are recorded in the
[screenshot manifest](../../assets/screenshots/manifest.json).

## Not verified

- Pages with live backend data, Directus content or a connected wallet. Wider
  data tables, account tables and published CMS copy can change the layout.
- Real devices, Safari and Firefox (the suite runs Chromium only).
- The first CI run of the new `Responsive matrix` job.
- Other public routes (governance, learn, tools, about, contact and similar) are
  outside the matrix. The `TableScroll` primitive has not been adopted on their
  tables yet.
