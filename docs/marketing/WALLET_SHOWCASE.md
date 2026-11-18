# Wallet showcase (Challenges page)

An animated row of sample wallet cards on `/{locale}/challenges`, directly
after the Market Pulse section (`#markets`) and before the next section.

## Data: illustrative only

Addresses, returns, risk levels and trade counts are generated from a fixed
seed (`demoWallets()` in `apps/web-react/src/features/home/WalletShowcase.tsx`).
They are **not** Openfund traders, accounts or verified results:

- every card carries a *Demo account* badge;
- the section is titled *Sample wallets · demo data*;
- a disclaimer under the row says so explicitly.

The seed makes the output identical on every render and every load.
Financial figures use Latin digits, left to right, like the market table.

## Motion

| Element | Technique |
| --- | --- |
| Horizontal loop | Two identical lists in one track moved by exactly one list width plus the gap (CSS `translate3d`, linear). The copy is `aria-hidden` |
| Depth | Staggered vertical offsets, edge opacity falloff (mask) and light edge blur |
| Glow | Mint radial glow that breathes on a 13 s ease-in-out cycle |
| Figures | Abstract numbers drifting slowly behind the cards, with a light pointer parallax on fine pointers |
| Hover and focus | Pause the loop; the hovered card lifts |

Resource use: animations run only while the section is on screen and the tab
is visible (IntersectionObserver plus `visibilitychange`). The only
`requestAnimationFrame` is one frame per pointer move for the parallax; there
is no continuous loop. No animation library is used. For
`prefers-reduced-motion` the row is static and scrollable, with no duplicate
list, no drift and no glow. The section has its own container styles, so it
renders final before the page's legacy stylesheet arrives.

## Reference

The reference site was inspected in a browser on 2026-11-18. It uses absolutely
positioned trader cards moved horizontally by JavaScript, small drifting
percentage figures inside each card (5.2 to 10.2 s, staggered) and a blurred
radial backdrop breathing on a 13 s cycle. Its horizontal speed could not be
measured, because its carousel is driven by `requestAnimationFrame` and the
inspection browser ran as a background page. This implementation follows the
same visual vocabulary (drifting figures, breathing glow, depth) in Openfund's
mint identity, with a CSS-only loop instead of per-frame JavaScript. It is not
a copy of the reference.

## Placement note

The owner's brief places the showcase "between Market Pulse and the slogan
*The world is in motion. Follow it with open eyes.*" On the live page that
slogan is the heading of the Market Pulse section itself, so the showcase sits
directly after the complete Market Pulse section, matching the brief's
structure (Market Pulse → showcase → next section). The anchor is one line in
`apps/web-react/src/pages/Landing.tsx` (`#markets`).

## Tests

`npm run test:browser:wallet-showcase` (`e2e/test-wallet-showcase.cjs`, 24
checks, also in CI):

- placement, labels, disclaimer and deterministic data;
- continuous linear motion and a seamless loop distance;
- pause on hover and off screen;
- no internal layout shift and stable height;
- RTL/LTR, dark/light and 375/390/768/1440 px without overflow;
- reduced motion, terminal routes untouched, and a recorded video.

Evidence: `docs/assets/screenshots/wallet-showcase/`.
