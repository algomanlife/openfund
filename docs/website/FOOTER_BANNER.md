# Footer banner: the alien trader

The shared site footer (from `apps/web-react/src/pages/landing-body.html`,
used by the home page and every `InformationShell` page) carries a
full-bleed, decorative banner between the documents row and the credits row
(`footer-credits`). The terminal and portfolio shells do not render the site
footer, so they have no banner.

## What it shows

An original illustrated scene: a slender grey alien seen from behind, seated at
a trading desk, facing six monitors in two rows. The Openfund mark glows as a
patch on the chair back, with mint and teal rim light and haze in a dark room.
The screens show illustrative motion (scrolling candles, a line chart, a
symbol ticker without prices, depth bars, a heat grid). The top-centre screen
shows one real Open Trade capture
(`public/assets/apps/open-trade/chart.webp`). It shows no figures, results or
claims.

## How it behaves

- **Lazy.** `AlienBannerSlot` reserves the band's height. The scene
  (`AlienBanner.tsx` and its stylesheet, a separate chunk) loads only when the
  footer is within 600 px of the viewport.
- **Decorative.** The slot is `aria-hidden` and has nothing focusable.
- **Motion.** Transform and opacity only. Animations run only while the banner
  is on screen and the tab is visible (IntersectionObserver plus
  `visibilitychange`). Light scroll parallax. Reduced motion shows a static
  frame.
- **Themes.** It is a dark band in both themes, blended into the page with
  top and bottom gradients.
- **Mobile.** At 767 px and below, a 4:5 focal crop keeps the alien and the
  two centre monitors.

## Swapping in raster artwork (one asset path)

The room layer can be replaced by generated artwork without changing the
animated screens:

1. Generate the image with the prompt below at 21:9, with the six monitor
   screens flat black.
2. Save it as `apps/web-react/public/assets/footer/alien-trader-room.webp`, with
   `-1280.webp` and `-2560.webp` widths for `srcset`.
3. In `apps/web-react/src/features/footer/AlienBanner.tsx`, set `ROOM_ART` to
   `{ src: '/assets/footer/alien-trader-room.webp', widths: [1280, 2560] }`.
4. Adjust the `SCREENS` rectangles (in the 2100×900 frame) so the animated
   content lands on the artwork's screens.

Image-generation prompt:

> Cinematic wide shot (21:9) from behind: a slender grey alien with a large smooth head sits in a dark leather chair at a sleek trading desk, facing a wall of six thin-bezel monitors arranged in two rows. The monitor screens are pure flat black. Back of the chair shows a small glowing mint-green geometric hexagonal logo patch. Lighting: deep black room, mint green (#82e7bd) and teal rim light glowing from behind the monitors, soft volumetric haze. Photorealistic, moody, no text, no brand names.

Test: `e2e/test-footer-banner.cjs` (`npm run test:browser:footer-banner`).
