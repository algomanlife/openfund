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
