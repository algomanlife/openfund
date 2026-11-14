# Public navigation, applications and purchase history

The public information shell keeps the sticky navigation above the local page
body layer. Desktop disclosures open on click and support Escape, arrow keys,
focus return, and dismissal outside the group. The existing off-canvas drawer
uses the same Resources destinations on narrow screens.

The Prop purchases route has a single heading and routes its purchase action to
localized checkout. History still reads the owned purchases and invoices API.
Amounts labeled as fees use the recorded USD price. Date, plan and status
presentation follows the active locale. Invoice and explorer links appear only
when the returned record has a usable destination.

## Application distribution

`/:locale/apps` lists the Web Terminal and macOS, Windows and Linux. The official
[v0.5.0 release](https://github.com/algomanlife/openfund/releases/tag/v0.5.0)
contains the unified web/API package. No public desktop installer was verified
in the repository releases on November 14, 2026. The page shows availability
without creating a download URL from a CMS value.

Application text lives in `apps/web-react/src/features/applications/content.ts`.
Review installers in `apps/web-react/src/features/applications/releases.json`.
Before adding a row, verify its exact published tag and GitHub asset, package
format, byte count, SHA-256, platform architecture and installation guide. A
stable installer must be signed. Mark verified experimental releases as beta.
The page validates the record and restricts executables to reviewed assets from
the canonical GitHub releases. Archive packages are not installers.

## Local browser check

The 140 route checks cover Home, Challenges, Checkout, Transparency, FAQ,
Applications, and Prop Purchases at 1440, 1024, 768, 390, and 360 pixels, in
Persian and English and in light and dark themes. Checks include page overflow,
locale direction, keyboard navigation, pointer interaction, compact menu,
installer availability and the shortcut from purchases to checkout. Captures
use anonymous sessions and bundled editorial fallbacks.

- [English checkout with Economy open](../../assets/screenshots/final-refinement/checkout-en-dark.png)
- [Persian mobile Applications](../../assets/screenshots/final-refinement/apps-fa-dark-390.png)
- [Persian mobile purchase history](../../assets/screenshots/final-refinement/purchases-fa-light-390.png)

A generated SIWE signer also loaded a real paid fixture persisted by the
existing isolated confirmation seam. Both Persian and English rendered the
purchase, horizontally scrollable table and localized checkout action at 390 px.
The invoice endpoint returned a PDF in both locales. The older purchase browser
suite signed in successfully but did not find the legacy Challenges builder's
size buttons. The authenticated history check exercised the updated route
independently of that builder.
