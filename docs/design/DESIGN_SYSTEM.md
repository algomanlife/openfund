# Openfund design system

**Status:** Brand system consolidation pending source brandbook audit.

## Principles

Clarity, data legibility, consistent spacing, accessible contrast, predictable interactions, responsive composition and honest loading/error states.

## Asset sources

See `brand/README.md` for logos, typography, imagery and original brandbook archive. The brandbook is the creative reference; exact color tokens, type scales and logo rules must be extracted and verified rather than invented here.

## UI component inventory

Navigation, account/wallet status, market selector, chart shell, price display, trade form (demo only), positions table, toast/status messaging, empty states and dialogs.

## Implementation rules

Preserve approved Openfund logo geometry and proportions. Build shared tokens before duplicating styles. Ensure keyboard navigation, contrast, clear focus indicators, mobile breakpoints and explicit network/testnet badges.

## Agent deliverables

Component inventory, token mapping, visual QA screenshots, responsive acceptance criteria and documented changes to brand guidelines.

## Trading workspace tokens

The compact terminal reuses the existing Obsidian `#060808`, dark-green surfaces `#0A100D` / `#0E1712`, mint `#82E7BD`, negative `#E89483`, Ubuntu and Dastkhat assets from the established terminal stylesheet. Its scoped layout adds `--terminal-control` (32px, 30px at compact height), `--terminal-space` (10px), `--terminal-label` (11.5px), `--terminal-text` (12px) and a divider alias to the existing line token. Numeric typography is tabular. These are terminal presentation settings, not a new brand system.

Use 1px structural boundaries and small 3px control corners; avoid card wrappers and decorative shadows in the trading workspace. Layout geometry stays LTR while Persian text is scoped locally. [Rendered acceptance](../reviews/terminal-ui/DELIVERY.md) records both products, languages, desktop sizes and responsive limits.

## Public website implementation

The source public system uses mint #82E7BD, obsidian #060808, green surfaces,
Ubuntu/Dastkhat, rounded platform cards and subtle dividers in
`apps/web-react/public/legacy/style.css`. The shared footer comes from
`pages/landing-body.html`; public information pages reuse it. Document language
and direction plus `data-theme` control localization and theme. Public responsive
rules use 700px and 1050px breakpoints. PR #42's Telegram presentation is merged
but unreleased. The three-provider controls and white light-theme refinements are
**Completed within local scope; UNRELEASED**, with exact white canvases and actual
text contrast >=4.5 checked on public and authenticated inner routes.
[Refinement evidence](../reviews/community-theme/DELIVERY.md) records genuine
bilingual dark/light desktop/mobile captures. Persian Home has no footer;
English Home and other public footers remain. Use one provider-configured
component for public Telegram/Discord/Instagram actions,
matching dimensions and responsive alignment; retain Telegram blue and Discord
blurple (#5865F2), authentic icons, keyboard focus and reduced-motion behavior.
No community actions belong in the terminal, and missing destinations remain
non-navigating.

Native terminal light surfaces must reuse `html[data-theme]` and persisted
`of-theme`, not a separate theme system or an inversion/overlay workaround.
Use supported Vela theme APIs; precisely document any unsupported chart surface.
Verify navigation, refresh and wallet-state persistence plus legibility of forms,
tables, dialogs, empty/error/loading states in both languages and themes.
TradingView, Render, Gains, Vela and DePay marks require official variants or safe
contrast treatments, preserved aspect ratios and no brand-color-changing global
filters. Final refinement captures record native terminal/service marks and
readable public labels/footer text; official review and deployed acceptance
remain separate from passing local theme checks.
Official artwork provenance remains in the website refresh report.

## Flamingo accent (`--flamingo`)

A soft flamingo pink, added for the "Migration to Openfund" scenes (the
Challenges menu banner and the `/:locale/migrate` hero). It is used **only** in
migration scenes; it is not a second brand colour and never replaces mint.

| Theme | Value | Contrast on the page background | Use |
| --- | --- | --- | --- |
| Dark | `#f4a3b8` | 10.3:1 on `#060808` (9.8:1 on `#0b1010`) | birds, banner border, CTA text |
| Light | `#b23a63` | 5.7:1 on `#ffffff` (5.3:1 on `#f4f8f6`) | same |

Scenes (owner update 2026-11-23): the menu banner and drawer card show the
flock over the lake **without** the OpenFi mark or its reflection. The
`/migrate` hero (`features/migration/heroScene.ts`) is frameless and full
bleed: birds at three depths cross the upper sky band, and three birds land
in shallow water on the inline-end side, wade, and take off again. Birds
never cross the copy or the call to action; phones show fewer, smaller birds
with the scene above the copy; reduced motion is a static frame.

Both pass WCAG AA for text and icons (4.5:1). Defined in
`public/legacy/style.css` (site pages) and `src/styles/design-system.css`
(React shell) with the light override under `html[data-theme=light]`.

## Shared foundation (v0.6.5)

`apps/web-react/src/styles/design-system.css` is the single shared layer,
imported once in `main.tsx`. It adds `--ds-*` tokens that **map onto** the
existing palettes (site `--mint/--surface/--line/--body`, terminal `--of-*`)
rather than introducing a second brand: semantic colour (brand, positive,
negative, warning, info), a type scale with an 11px floor for real copy,
4px spacing rhythm, radii, elevation, z-index layers, motion durations and
easings, and documented breakpoints (430, 768, 1024, 1440). Light-theme
overrides live under `html[data-theme=light]`.

Opt-in primitives: `.ds-card`, `.ds-glass`, `.ds-chip`, `.ds-num` (tabular,
isolated LTR numbers inside RTL text), `.ds-sr-only`, `.ds-reveal` (with
`useReveal`) and `.ds-spotlight` (cursor-following border light with
`useSpotlight`, inert on touch and reduced motion).

Rules:

- Website: entrance, reveal and hover motion use transforms/opacity only and
  stop under `prefers-reduced-motion`. Terminal: functional transitions only
  (`--ds-dur-fast`); no decorative motion on charts, order forms, positions or
  financial tables.
- Grid containers that hold wide tables or treemaps must declare
  `grid-template-columns: minmax(0, 1fr)` (or `min-width: 0` on items); a
  min-content track widened the page to 670px on phones before v0.6.5.
- Numbers, tickers, serials and wallet addresses are isolated as LTR (`dir="ltr"`,
  `<bdi>` or LRI/PDI in canvas text). Canvas text that mixes scripts uses the
  Persian face only for the Arabic range so Latin digits stay Latin.
- React components that render inside legacy pages and own their text must set
  `data-locale-owned`, or the legacy static translator re-applies stale text.

## Typography and font tokens

**Policy: exactly two faces.** Ubuntu is the general/Latin face (Latin,
Cyrillic, digits); **Dastkhat** is the only Persian/Arabic face. No other face
may be declared anywhere in the project (owner decision, 2026-11-21);
`scripts/docs/check-fonts.mjs` fails CI otherwise. Retired faces (Irancell,
its renamed copies, standalone Vazirmatn) are listed in the
[retired registry](../development/RETIRED.md).

Dastkhat v1.210 (SIL OFL 1.1, by Dastyar, based on Vazirmatn by Saber
Rastikerdar) is self-hosted as variable WOFF2 files (`wght` 100–900) in
`apps/web-react/public/assets/fonts/dastkhat/`, with provenance, hashes,
`OFL.txt` and `FONTLOG.txt` beside them. **One stylesheet,
[`dastkhat.css`](../../apps/web-react/public/assets/fonts/dastkhat/dastkhat.css),
declares the only Persian/Arabic `@font-face` set** — `'Dastkhat'`,
`'Dastkhat Arabic'` and `'Dastkhat FaNum'` — and every surface loads it from
its own origin: legacy pages and the terminal iframe (`@import`), the React app
and Open Trade (`<link>` in `index.html`), Backstage (`@import`, same-origin
route). The certificate canvas registers
the same file as the `FontFace` `'Dastkhat Certificate'`.

| Token | Stack | Use |
| --- | --- | --- |
| `--ds-font-persian` | Dastkhat, Ubuntu, Tahoma, system-ui | Persian interface copy (`--ds-font-sans` points here) |
| `--ds-font-arabic` | Ubuntu, Dastkhat Arabic, Dastkhat, Tahoma, system-ui | Arabic: Ubuntu digits and Latin, Dastkhat Arabic letters, Dastkhat for Persian-only fallback copy |
| `--ds-font-latin` | Ubuntu, Dastkhat, system-ui | English and Latin-first shells; Persian glyphs inside them still use Dastkhat |
| `--ds-font-cjk` | Ubuntu, system-ui, PingFang SC, Microsoft YaHei, Noto Sans SC, Dastkhat | Russian and Simplified Chinese |
| `--ds-font-numeric` | Ubuntu, Dastkhat, system-ui | `.ds-num` technical numbers (tabular, isolated LTR) |

Dastkhat's default build draws Latin digits `0-9` as Latin, tabular digits.
`'Dastkhat FaNum'` (Latin digits drawn as Persian-Indic) is declared but is
**not used by any surface today**: prices, sizes, addresses and hashes never
turn into Persian digits through the font, and number serialization is
unchanged. A surface that must show Persian-Indic digits from Latin input may
opt in with `font-family: 'Dastkhat FaNum', var(--ds-font-persian)` and must be
listed here when it does (current list: none).
Persian digits appear only where the copy itself contains them. Dastkhat has
no Cyrillic, CJK or arrow glyphs; those fall back to Ubuntu and system fonts.

The legacy stylesheets, the terminal iframe and the Backstage console are
separate documents, so they carry verbatim copies of these tokens.
`apps/web-react/test/typography.test.mjs` fails if a copy drifts, if any owned
stylesheet declares a Persian/Arabic `@font-face` outside `dastkhat.css`, or if
a pinned file changes; `scripts/docs/check-fonts.mjs` (part of `docs:check`)
fails if a retired face is referenced anywhere in code or assets. `e2e/test-typography.mjs` measures the rendered font in a
browser.

Third-party UI kits were evaluated in [ADR 0035](../decisions/0035-design-system-foundation-and-ui-kit-evaluation.md).
