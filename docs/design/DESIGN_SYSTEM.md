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

The compact terminal reuses the existing Obsidian `#060808`, dark-green surfaces `#0A100D` / `#0E1712`, mint `#82E7BD`, negative `#E89483`, Ubuntu and Irancell assets from the established terminal stylesheet. Its scoped layout adds `--terminal-control` (32px, 30px at compact height), `--terminal-space` (10px), `--terminal-label` (11.5px), `--terminal-text` (12px) and a divider alias to the existing line token. Numeric typography is tabular. These are terminal presentation settings, not a new brand system.

Use 1px structural boundaries and small 3px control corners; avoid card wrappers and decorative shadows in the trading workspace. Layout geometry stays LTR while Persian text is scoped locally. [Rendered acceptance](../reviews/terminal-ui/DELIVERY.md) records both products, languages, desktop sizes and responsive limits.

## Public website implementation

The source public system uses mint #82E7BD, obsidian #060808, green surfaces,
Ubuntu/Irancell, rounded platform cards and subtle dividers in
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
