# Home Visual Refresh — Delivery

- **Branch:** `qwen/home-visual-refresh` (from `origin/main` @ `61c70fe`)
- **Date:** 2026-11-02
- **Owner requests:** remove the gateway's texts · add motion · new illustrations in the spirit
  of the two Ethereum references (Openfund palette) · an animated background · a bottom
  strip; review corrections: no scene backdrop, no «قلب تپنده» word, empty menu on this page,
  no links to other pages, fix panel fonts.

## What shipped

| Request | Delivered |
| :--- | :--- |
| متن‌ها پاک | Sub-line, product descriptions, the Gains note AND the OPENFUND eyebrow label removed — only headline, product titles and CTA labels render. Fields cleared in Directus (re-addable anytime). |
| Motion | Staggered entrance (h1 → panels → signature), panel hover lift + mint glow, illustration parallax, animated SVG internals (scan, chips, lenses, holograms). |
| Illustration A | `assets/home/prop-trading.svg` — «میز ارزیابی»: a focused trader at a glowing terminal, evaluation chips (5%, 80%, checkmark) floating above; flat-vector, Openfund palette. |
| Illustration B | `assets/home/perpetual-trading.svg` — «دستگاه دادهٔ بازار»: a machine with a holographic lozenge core, four glowing lenses, data ribbon ticks, warm side module. |
| Background (v2) | Scene backdrop REMOVED per owner feedback — minimal animated ambience instead: two drifting mint glows, a breathing glow under the signature, a faint dot-grid. Clean and quiet; the owner supplies a background image later. |
| Signature line | Animated beating heart + `ساخته شده توسط معامله‌گران برای معامله‌گران` (fa) / `Built by traders, for traders` (en) — CMS-managed via the `home_content` note field. «قلب تپنده» label removed. |
| Nav-less Home | The Home header carries NO links to other pages: menu links, the menu button and the header CTA are all removed — only logo, wallet, language and theme. Other pages keep the full navigation. |
| Typography | Panel titles 19–25px, weight 600; CTA buttons 14px/12px padding. |

All motion honors `prefers-reduced-motion`; one screen at 1440 (≤1px slack); 375px without
overflow; light mode verified.

## Corrections after owner review (same PR)

- scene backdrop removed → minimal animated ambience (glows + dot grid)
- «قلب تپنده» label removed — heart + one signature line only
- Home header nav-less (no menu / menu button / header CTA)
- OPENFUND eyebrow label removed; panel typography corrected
- markets page hero title/subtitle composition restored via the pages CMS seed
- `market.js` teardown guards (a WS tick during the React teardown window could crash
  `state()`/`render()` — the same guard pattern as the terminal round)

## Verification

- `tsc --noEmit` clean · `vite build` ok · zero page errors
- gateway E2E **53/53** · content E2E **108/108** · CMS E2E **35/35**
- Screenshots: `screenshots/` — fa 1440 (clean), en, fa 375, fa light
