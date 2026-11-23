/* /migrate hero: a full-bleed, frameless flamingo scene (owner update
 * 2026-11-23). Original SVG; no mark, no panel.
 *
 *   - flyers cross the upper sky band at three depths (far, mid, near), each
 *     with its own size, speed and offset wing timing;
 *   - landers fly in from the upper inline-end corner, land in the shallow
 *     water at the bottom, wade, and take off again (a flying pose and a
 *     standing pose cross-fade), so the scene is always alive.
 *
 * Birds keep to the upper band and the inline-end side, so they never cross
 * the copy or the call to action (inline-start, lower half). Motion is
 * transform/opacity only (migration-hero.css), runs only while the hero is
 * on screen and the tab is visible ([data-live]); reduced motion shows a
 * static frame with the landers standing in the water. Phones show fewer,
 * smaller birds. RTL mirrors the scene so it stays on the inline-end side. */

const SVG_NS = 'http://www.w3.org/2000/svg'
export const HERO_W = 1600, HERO_H = 720, WATER_Y = 600

/* one flying flamingo facing +x (about 80 × 30 units at scale 1) */
const FLY = {
  body: 'M-12 0c4-5 16-6 24-2 3 2 2 4-2 5-8 2-17 2-22-3z', neck: 'M10 -1c8-3 16-4 24-3',
  head: 'M33 -5c3-1 6 0 6 2l5 3c-3 0-6-1-8-1-2 1-4 0-3-4z', legs: 'M-11 1c-10 1-20 2-31 2M-11 2c-10 2-19 4-29 5',
  near: 'M-4 -2c2-10 8-19 18-24-1 9-3 17-8 24z', far: 'M-1 -2c4-7 10-13 19-16-2 7-6 13-11 16z',
}
/* one standing (wading) flamingo facing +x, feet at y = 0 */
const STAND = {
  body: 'M-14 -46c2-9 14-13 25-8 7 3 7 9 0 12-9 4-22 4-25-4z', wing: 'M-10 -48c6-6 16-7 22-2-6 4-15 5-22 2z',
  neck: 'M9 -50c8-6 6-18-1-26-6-7-3-15 6-16', head: 'M14 -92c4-2 8 0 8 3l6 5c-4 0-7-1-9-1-3 1-6-1-5-7z',
  legs: 'M-2 -40l-3 40M3 -40l6 22-9 18', water: 'M-14 0c6 2 22 2 30 0',
}

export interface Flyer { band: 'far' | 'mid' | 'near'; y: number; s: number; dur: number; delay: number; flap: number }
export interface Lander { x: number; s: number; dur: number; delay: number; flap: number }
/* fixed values (deterministic and testable) */
export const FLYERS: Flyer[] = [
  { band: 'far', y: 70, s: 0.74, dur: 46, delay: -6, flap: 1.1 }, { band: 'far', y: 112, s: 0.68, dur: 52, delay: -31, flap: 0.95 },
  { band: 'far', y: 150, s: 0.81, dur: 49, delay: -18, flap: 1.2 }, { band: 'far', y: 92, s: 0.7, dur: 55, delay: -44, flap: 1.02 },
  { band: 'mid', y: 130, s: 1.47, dur: 34, delay: -9, flap: 0.9 }, { band: 'mid', y: 196, s: 1.61, dur: 37, delay: -24, flap: 1.06 },
  { band: 'mid', y: 88, s: 1.4, dur: 40, delay: -35, flap: 0.98 },
  { band: 'near', y: 170, s: 2.66, dur: 26, delay: -4, flap: 0.86 }, { band: 'near', y: 236, s: 2.94, dur: 29, delay: -17, flap: 0.92 },
]
export const LANDERS: Lander[] = [
  { x: 1180, s: 1.76, dur: 30, delay: -3, flap: 0.9 }, { x: 1330, s: 1.49, dur: 33, delay: -14, flap: 1.0 }, { x: 1470, s: 1.62, dur: 36, delay: -25, flap: 0.95 },
]

function el(tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  parent?.append(node)
  return node
}
function flying(parent: Element, flap: number) {
  const g = el('g', { class: 'mh-fly' }, parent)
  el('path', { d: FLY.far, class: 'mh-wing is-far', style: `--mh-flap:${flap}s` }, g)
  el('path', { d: FLY.legs, class: 'mh-legs' }, g)
  el('path', { d: FLY.neck, class: 'mh-neck' }, g)
  el('path', { d: FLY.body, class: 'mh-body' }, g)
  el('path', { d: FLY.head, class: 'mh-head' }, g)
  el('path', { d: FLY.near, class: 'mh-wing', style: `--mh-flap:${flap}s` }, g)
  return g
}

/** The hero scene as an SVG node (decorative; the page provides the text). */
export function migrationHeroNode(): SVGSVGElement {
  const svg = el('svg', { viewBox: `0 0 ${HERO_W} ${HERO_H}`, preserveAspectRatio: 'xMaxYMax slice', 'aria-hidden': 'true', focusable: 'false', class: 'mh-svg' }) as SVGSVGElement
  const defs = el('defs', {}, svg)
  const sky = el('linearGradient', { id: 'mh-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  el('stop', { offset: 0, class: 'mh-sky-top' }, sky); el('stop', { offset: 0.7, class: 'mh-sky-mid' }, sky); el('stop', { offset: 1, class: 'mh-sky-low' }, sky)
  const water = el('linearGradient', { id: 'mh-water', x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  el('stop', { offset: 0, class: 'mh-water-top' }, water); el('stop', { offset: 1, class: 'mh-water-low' }, water)
  el('rect', { width: HERO_W, height: WATER_Y, fill: 'url(#mh-sky)' }, svg)
  el('circle', { cx: 1320, cy: 210, r: 120, class: 'mh-sun' }, svg)
  el('path', { d: `M0 ${WATER_Y}c180-34 360-40 560-22s420 30 620 6 300-26 420-10V${WATER_Y}z`, class: 'mh-hills' }, svg)
  el('rect', { y: WATER_Y, width: HERO_W, height: HERO_H - WATER_Y, fill: 'url(#mh-water)' }, svg)
  const ripples = el('g', { class: 'mh-ripples' }, svg)
  ;[[1180, 628], [1330, 652], [1470, 640], [880, 676]].forEach(([x, y], i) => el('ellipse', { cx: x, cy: y, rx: 70 - i * 6, ry: 5, class: `mh-ripple r${i}` }, ripples))
  /* flyers: an outer group travels across, the inner one flaps and bobs */
  for (const band of ['far', 'mid', 'near'] as const) {
    const layer = el('g', { class: `mh-layer is-${band}` }, svg)
    FLYERS.filter(f => f.band === band).forEach((f, i) => {
      const lane = el('g', { class: `mh-flyer f${i}`, style: `--mh-dur:${f.dur}s;--mh-delay:${f.delay}s` }, layer)
      const place = el('g', { transform: `translate(0 ${f.y}) scale(${f.s})` }, lane)
      flying(el('g', { class: 'mh-bob', style: `--mh-delay:${f.delay}s` }, place), f.flap)
    })
  }
  /* landers: fly in, land, wade, take off (flying and standing poses cross-fade) */
  const landers = el('g', { class: 'mh-landers' }, svg)
  LANDERS.forEach((l, i) => {
    const anchor = el('g', { transform: `translate(${l.x} ${WATER_Y + 40 + i * 12}) scale(${l.s})` }, landers)
    const path = el('g', { class: `mh-lander l${i}`, style: `--mh-dur:${l.dur}s;--mh-delay:${l.delay}s` }, anchor)
    const air = el('g', { class: 'mh-pose is-air', style: `--mh-dur:${l.dur}s;--mh-delay:${l.delay}s` }, path)
    flying(el('g', { transform: 'translate(0 -60)' }, air), l.flap)
    const ground = el('g', { class: 'mh-pose is-ground', style: `--mh-dur:${l.dur}s;--mh-delay:${l.delay}s` }, path)
    const wade = el('g', { class: 'mh-wade', style: `--mh-delay:${l.delay}s` }, ground)
    el('path', { d: STAND.legs, class: 'mh-legs is-standing' }, wade)
    el('path', { d: STAND.neck, class: 'mh-neck is-standing' }, wade)
    el('path', { d: STAND.body, class: 'mh-body' }, wade)
    el('path', { d: STAND.wing, class: 'mh-wing-folded' }, wade)
    el('path', { d: STAND.head, class: 'mh-head' }, wade)
    el('path', { d: STAND.water, class: 'mh-wake' }, wade)
  })
  return svg
}
