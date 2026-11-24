/* "Migration to Openfund" scene: a V-formation of flamingos flies across and
 * settles over a calm lake. Original SVG. The menu banner and drawer card
 * show no mark (owner update 2026-11-23); `mark` is 0 for them. The /migrate
 * page hero is features/migration/heroScene.ts.
 *
 * Three variants share one drawing:
 *   panel    the mega-menu banner (7 birds)
 *   compact  the drawer card (3 smaller birds)
 *   hero     the /migrate page hero (11 birds, wider lake)
 *
 * Motion (flamingo.css) is transform/opacity only. It runs only while the
 * host says so: `.resources-open` for the menu, `.is-live` for the page
 * (visible, tab active, motion allowed). Reduced motion shows a static frame.
 * Wing timing is offset per bird so the flock never flaps in unison, and the
 * wingbeat period scales with size (flapFor). The flock moves only towards
 * +x, the way every head faces (owner fix 2). */

const SVG_NS = 'http://www.w3.org/2000/svg'
export type FlamingoVariant = 'panel' | 'compact' | 'hero'

interface Bird { x: number; y: number; s: number; flap: number; delay: number; bob: number }
interface Layout { w: number; h: number; lakeY: number; birds: Bird[]; mark: number }

/* V-formation: a leader and alternating wings behind it. Offsets are fixed
   (not random) so the drawing is deterministic and testable. */
function formation(count: number, lead: [number, number], dx: number, dy: number, scale: number): Bird[] {
  /* distinct phases: no two birds flap in sync (owner fix 2) */
  const delays = [0, -0.37, -0.71, -0.18, -0.93, -0.52, -0.11, -0.64, -0.29, -0.83, -0.45]
  return Array.from({ length: count }, (_, i) => {
    const rank = Math.ceil(i / 2), side = i % 2 ? -1 : 1
    const s = scale * (1 - rank * 0.035)
    /* wingbeat period from size, as in the /migrate hero: smaller birds flap faster */
    return { x: lead[0] - rank * dx, y: lead[1] + side * rank * dy + (i % 3) * 1.5, s, flap: flapFor(s), delay: delays[i % delays.length], bob: 3.2 + (i % 4) * 0.45 }
  })
}
/** wingbeat period from size (shared rule with features/migration/heroScene.ts) */
export const flapFor = (s: number) => +(0.42 + 0.26 * Math.sqrt(s)).toFixed(3)
/** Every bird in this scene faces +x (head at +x) and the flock only ever
 *  moves +x (flamingo.css fl-glide), so heads lead in both directions; the
 *  scene is not mirrored in RTL. Exported for the facing test. */
export const FLOCK_FACING = 1

const LAYOUTS: Record<FlamingoVariant, Layout> = {
  panel: { w: 320, h: 200, lakeY: 136, mark: 0, birds: formation(7, [236, 70], 30, 14, 0.95) },
  compact: { w: 240, h: 120, lakeY: 84, mark: 0, birds: formation(3, [176, 38], 34, 13, 0.7) },
  hero: { w: 1200, h: 560, lakeY: 392, mark: 92, birds: formation(11, [820, 190], 64, 30, 1.7) },
}

/* one flying flamingo facing +x, about 80 × 30 units at scale 1 */
const BODY = 'M-12 0c4-5 16-6 24-2 3 2 2 4-2 5-8 2-17 2-22-3z'
const NECK = 'M10 -1c8-3 16-4 24-3'
const HEAD = 'M33 -5c3-1 6 0 6 2l5 3c-3 0-6-1-8-1-2 1-4 0-3-4z'
const LEGS = 'M-11 1c-10 1-20 2-31 2M-11 2c-10 2-19 4-29 5'
const WING_NEAR = 'M-4 -2c2-10 8-19 18-24-1 9-3 17-8 24z'
const WING_FAR = 'M-1 -2c4-7 10-13 19-16-2 7-6 13-11 16z'

function el(tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  parent?.append(node)
  return node
}

/** The scene as an SVG node (decorative; hosts give the accessible text). */
export function flamingoSceneNode(variant: FlamingoVariant, markHref: string): SVGSVGElement {
  const L = LAYOUTS[variant]
  const uid = `fl-${variant}`
  const svg = el('svg', { viewBox: `0 0 ${L.w} ${L.h}`, 'aria-hidden': 'true', focusable: 'false', class: `flamingo-scene is-${variant}`, preserveAspectRatio: 'xMidYMid slice' }) as SVGSVGElement
  const defs = el('defs', {}, svg)
  const sky = el('linearGradient', { id: `${uid}-sky`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  el('stop', { offset: 0, class: 'fl-sky-top' }, sky); el('stop', { offset: 1, class: 'fl-sky-low' }, sky)
  const lake = el('linearGradient', { id: `${uid}-lake`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  el('stop', { offset: 0, class: 'fl-lake-top' }, lake); el('stop', { offset: 1, class: 'fl-lake-low' }, lake)
  const fade = el('linearGradient', { id: `${uid}-fade`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.55 }, fade); el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, fade)
  const mask = el('mask', { id: `${uid}-mask` }, defs)
  el('rect', { x: 0, y: L.lakeY, width: L.w, height: L.h - L.lakeY, fill: `url(#${uid}-fade)` }, mask)

  el('rect', { x: 0, y: 0, width: L.w, height: L.lakeY, fill: `url(#${uid}-sky)`, class: 'fl-sky' }, svg)
  /* far shore and the mark standing over the water like a landmark */
  el('path', { d: `M0 ${L.lakeY}c${L.w * 0.18} -${L.h * 0.06} ${L.w * 0.32} -${L.h * 0.02} ${L.w * 0.5} -${L.h * 0.04}s${L.w * 0.34} ${L.h * 0.02} ${L.w * 0.5} ${L.h * 0.04}z`, class: 'fl-shore' }, svg)
  const mw = L.mark, mh = L.mark * 644 / 581, mx = L.w * 0.5 - mw / 2, my = L.lakeY - mh - L.h * 0.035
  if (mw) {
    el('ellipse', { cx: L.w * 0.5, cy: my + mh * 0.55, rx: mw * 1.4, ry: mh * 0.9, class: 'fl-glow' }, svg)
    el('image', { href: markHref, x: mx, y: my, width: mw, height: mh, class: 'fl-mark' }, svg)
  }
  el('rect', { x: 0, y: L.lakeY, width: L.w, height: L.h - L.lakeY, fill: `url(#${uid}-lake)`, class: 'fl-lake' }, svg)
  /* reflection: the same mark flipped about the waterline, fading with depth */
  if (mw) {
    const reflection = el('g', { mask: `url(#${uid}-mask)`, class: 'fl-reflection' }, svg)
    el('image', { href: markHref, x: mx, y: my, width: mw, height: mh, transform: `translate(0 ${2 * L.lakeY}) scale(1 -1)` }, reflection)
  }
  /* calm ripples */
  const ripples = el('g', { class: 'fl-ripples' }, svg)
  ;[0.5, 0.3, 0.7].forEach((fx, i) => el('ellipse', { cx: L.w * fx, cy: L.lakeY + (L.h - L.lakeY) * (0.28 + i * 0.18), rx: L.w * (0.07 + i * 0.02), ry: (L.h - L.lakeY) * 0.05, class: `fl-ripple r${i}` }, ripples))
  /* the flock */
  const flock = el('g', { class: 'fl-flock' }, svg)
  L.birds.forEach((b, i) => {
    const place = el('g', { transform: `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${b.s.toFixed(3)})` }, flock)
    const bird = el('g', { class: 'fl-bird', style: `--fl-bob:${b.bob}s;--fl-delay:${b.delay}s` }, place)
    el('path', { d: WING_FAR, class: 'fl-wing is-far', style: `--fl-flap:${b.flap}s;--fl-delay:${(b.delay - 0.08).toFixed(2)}s` }, bird)
    el('path', { d: LEGS, class: 'fl-legs' }, bird)
    el('path', { d: NECK, class: 'fl-neck' }, bird)
    el('path', { d: BODY, class: 'fl-body' }, bird)
    el('path', { d: HEAD, class: 'fl-head' }, bird)
    el('path', { d: WING_NEAR, class: 'fl-wing', style: `--fl-flap:${b.flap}s;--fl-delay:${b.delay}s` }, bird)
    if (variant !== 'compact' && i < 3) el('ellipse', { cx: (b.x - 6).toFixed(1), cy: L.lakeY + 4 + i * 3, rx: 14 * b.s, ry: 1.6 * b.s, class: 'fl-shadow' }, svg)
  })
  return svg
}

/** Bird count per variant (the drawer shows fewer, smaller birds). */
export const flamingoBirdCount = (variant: FlamingoVariant) => LAYOUTS[variant].birds.length
