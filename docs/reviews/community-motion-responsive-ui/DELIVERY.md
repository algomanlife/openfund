# Community, footer, platform motion and responsive navigation

Branch `agent/claude/community-motion-responsive-ui`, based on `main` at
`b018c25`. Frontend only; unreleased, not deployed. Captures were taken from
the local Vite development server (`apps/web-react`, port 5173) with live
public CMS and Gains responses and no request fixtures, by
`e2e/test-responsive-navigation.cjs` (`NAV_CAPTURE=1`) and a dark-theme
capture pass. No wallet was connected.

## Scope

| Task | Result |
| --- | --- |
| Telegram-only community | Discord action removed from the home, hero and footer community group; the single Telegram action links to `https://t.me/communitybuopenfund` with `target="_blank"` and `rel="noopener noreferrer"`. Discord/Instagram validators and runtime settings are kept for configuration compatibility. |
| Hyperliquid footer service | Eighth provider (`https://hyperliquid.xyz`, "Market data & liquidity depth" with existing ar/ru/zh-CN translations). Grid: 8 columns from 1200px, 4 + 4 below, 2 × 4 on phones. Visual listing only. |
| Three-platform motion | The static Gains mark at the end of the challenges-page platform flow is replaced by three CSS glass orbs (Gains, Hyperliquid, GMX). Transform-only looping motion, no JavaScript loop, static under `prefers-reduced-motion`. Surrounding copy unchanged. |
| Website navigation | Shared `OffCanvas` drawer and `SiteNavDrawer`, fed by the same `navigationModel` as the desktop header. |
| Terminal navigation | `TerminalMenu` drawer at ≤1100px with its own state; desktop tabs and the More menu are unchanged. |

## Root causes addressed

- Phone header: below 600px the header deliberately wrapped onto two rows,
  and the second row still had to hold theme, language, terminal entry,
  wallet and menu — wider than a phone, so the inline-end control was pushed
  off-screen (measured at −19px at 320px in Russian).
- Two compact systems: fixed stylesheet breakpoints (700/1000/1150px) hid the
  links while the width measurement (`fitNavigation`) did not flag compact
  mode, so header geometry differed by page, locale and wallet label.
  Compact mode is now decided only by measurement and is staged: links, then
  the terminal entry, then language/theme move into the drawer.
- The former mobile menu was an absolutely positioned dropdown without a
  backdrop, scroll lock or focus management.
- Terminal: overlapping 540/650/800/1100/1150px rules alternately hid tabs
  and moved destinations into the More dropdown, producing different partial
  tab rows per width.

## Cross-domain footer

`https://openfi.cloud` and `https://openfund.cloud` served the same build on
2026-11-12 (`/version` 0.5.0, commit `df288dc`, identical `index` asset
hashes). Any difference in the footer arrangement between the two domains is
therefore viewport-driven (the former 4 + 3 grid at ≤1100px), not an asset or
deployment difference. No infrastructure was changed.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run build:web` | pass (existing chunk-size warning) |
| `npm run test:web` | 190 / 190 |
| `npm run docs:check` | pass |
| `npm run validate:blueprint` | pass |
| `e2e/test-responsive-navigation.cjs` | 968 / 968 checks |

The browser suite covers 11 widths (320–1920px) × 5 locales on the website
header and drawer, short viewports (320 × 568, 375 × 667 and two landscape
phones), route selection and keyboard focus containment, the challenges page
(Telegram, eight providers, orbs, reduced motion) and the terminal at eight
locale/viewport combinations including chart-workspace identity, URL and
selected-market persistence across opening and closing the drawer.

Not run: `test-website-refresh`, `test-ui-polish`, `test-website-navigation`
and other full-stack suites that need the backend and a PostgreSQL test
database; their assertions were updated for the new contract.

## Captures

| View | Capture |
| --- | --- |
| Website phone header (fa, 390) | ![Website phone header (fa, 390)](captures/site-fa-390-header.png) |
| Website drawer RTL (fa, 390) | ![Website drawer RTL (fa, 390)](captures/site-fa-390-drawer.png) |
| Website drawer LTR (en, 390) | ![Website drawer LTR (en, 390)](captures/site-en-390-drawer.png) |
| Website tablet drawer (en, 820) | ![Website tablet drawer (en, 820)](captures/site-en-820-drawer.png) |
| Website tablet drawer (fa, 820) | ![Website tablet drawer (fa, 820)](captures/site-fa-820-drawer.png) |
| Website drawer, dark (ar, 390) | ![Website drawer, dark (ar, 390)](captures/dark-site-ar-390-drawer.png) |
| Website drawer, dark (zh-CN, 820) | ![Website drawer, dark (zh-CN, 820)](captures/dark-site-zh-820-drawer.png) |
| Terminal phone drawer (fa, 390) | ![Terminal phone drawer (fa, 390)](captures/terminal-fa-390-drawer.png) |
| Terminal phone drawer (en, 390) | ![Terminal phone drawer (en, 390)](captures/terminal-en-390-drawer.png) |
| Terminal tablet header (ru, 768) | ![Terminal tablet header (ru, 768)](captures/terminal-ru-768-header.png) |
| Terminal tablet drawer (ru, 768) | ![Terminal tablet drawer (ru, 768)](captures/terminal-ru-768-drawer.png) |
| Terminal tablet drawer (zh-CN, 820) | ![Terminal tablet drawer (zh-CN, 820)](captures/terminal-zh-CN-820-drawer.png) |
| Terminal drawer, dark (fa, 390) | ![Terminal drawer, dark (fa, 390)](captures/dark-terminal-fa-390-drawer.png) |
| Footer, eight providers (fa, 1440) | ![Footer, eight providers (fa, 1440)](captures/footer-fa-1440.png) |
| Footer, dark (en, 1440) | ![Footer, dark (en, 1440)](captures/dark-footer-en-1440.png) |
| Footer 4 + 4, dark (fa, 768) | ![Footer 4 + 4, dark (fa, 768)](captures/dark-footer-fa-768.png) |
| Footer 2 × 4 (en, 390) | ![Footer 2 × 4 (en, 390)](captures/footer-en-390.png) |
| Platform orbs (fa, 1440) | ![Platform orbs (fa, 1440)](captures/orbs-fa-1440.png) |
| Platform orbs, dark (en, 1440) | ![Platform orbs, dark (en, 1440)](captures/dark-orbs-en-1440.png) |
| Telegram community action (fa, 1440) | ![Telegram community action (fa, 1440)](captures/telegram-fa-1440.png) |

[Reviews index](../README.md)
