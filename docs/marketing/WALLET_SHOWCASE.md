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
| Strip | Full viewport width; the heading and disclaimer stay in the 1240 px container. The strip's viewport is anchored left-to-right (`direction: ltr`) and only the cards inside are RTL, so the track starts at the left edge in every locale and never runs out on one side |
| Horizontal loop | As many copies of the list as needed for one copy to be wider than the viewport plus one card (`copiesFor()`, measured with a `ResizeObserver`, so it follows resizes, breakpoints and locale switches). One linear CSS animation moves the track by exactly one list plus the gap. Copies after the first are `aria-hidden` |
| Direction | RTL locales (`fa`, `ar`) enter from the right and move left; LTR mirrors it with `animation-direction: reverse` |
| Scanner beam | A fixed vertical mint line at the horizontal centre with a soft breathing glow |
| Data dissolve | Two layers run the same animation (same keyframes, start time and play state). The card layer is clipped with `clip-path` to the entry side of the beam; the data layer, clipped to the exit side, shows each card as monospace figures, percentages and hex derived from its seed (`dataLines()`), so cards dissolve into data as they cross the beam. The data layer is `aria-hidden` |
| Edges | A light 9% opacity fade on each side; no backdrop blur |
| Depth | Staggered vertical offsets |
| Glow | Mint radial glow that breathes on a 13 s ease-in-out cycle |
| Figures | Abstract numbers drifting slowly behind the cards, with a light pointer parallax on fine pointers |
| Pause | Only while one card is hovered (`:has(.ws-card:hover)`), not the whole section. Keyboard focus on the strip (`:focus-visible`, so a mouse click does not freeze it) pauses it, removes the clip so every card is readable, shows a focus ring, and the arrow keys move it one card at a time |
| Below 768 px | No data layer: the whole strip moves under the beam glow |

Resource use: animations run only while the section is on screen and the tab
is visible (IntersectionObserver plus `visibilitychange`). The only
`requestAnimationFrame` is one frame per pointer move for the parallax; there
is no continuous loop. No animation library or canvas is used; the data layer
is plain DOM text. For `prefers-reduced-motion` the row is static and
scrollable, with no duplicate list, beam, data layer, drift or glow. The
section has its own container styles, so it renders final before the page's
legacy stylesheet arrives.

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

`npm run test:browser:wallet-showcase` (`e2e/test-wallet-showcase.cjs`, 36
checks, also in CI):

- placement, labels, disclaimer and deterministic data;
- continuous linear motion in the locale's direction and a seamless loop distance;
- a full-bleed strip whose track covers the viewport plus one copy, also after resizing to 3840 px;
- the centred beam with the card and data layers clipped to opposite sides and in sync;
- pause only on a hovered card (not elsewhere in the section), resume on leave, keyboard pause and arrow stepping;
- no data layer below 768 px; pause off screen;
- no internal layout shift and stable height;
- RTL/LTR, dark/light and 375/390/768/1440 px without overflow;
- reduced motion, terminal routes untouched, and a recorded video.

Unit tests (`npm --prefix apps/web-react run test:content`, `test/wallet-showcase.test.mjs`): copy count for every width from 320 to 7680 px and the deterministic, glyph-only data rendition.

Evidence: `docs/assets/screenshots/wallet-showcase/` (first version) and `docs/assets/screenshots/wallet-showcase-beam/` (full-bleed loop with the scanner beam).
