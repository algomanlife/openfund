/* /migrate hero: a full-bleed, frameless flamingo scene (owner fix 2,
 * 2026-11-23: motion rewritten from scratch). Original SVG; no mark.
 *
 * Every bird is a TRACK: a list of keyframes (time, position, scale,
 * opacity, facing, pose) in scene units (HERO_W × HERO_H; water at WATER_Y).
 * The CSS @keyframes are generated from the same data, so the unit test
 * (test/flamingo-flight.test.mjs) checks exactly what the browser plays:
 *
 *   - the head always leads: between two keys a bird moves only in the
 *     direction it faces; facing changes only while standing still (the body
 *     turns first). The scene mirrors in RTL, which flips movement and facing
 *     together, so the rule holds in both directions;
 *   - depth: some birds appear small and faint near the horizon and fly
 *     towards the camera on a curved path (larger, brighter, higher) until
 *     they leave the frame; one recedes from the foreground to the horizon;
 *     others cross at three depths;
 *   - landing: approach from behind the heading, descend, glide with fixed
 *     wings, lower the legs and flare, fold the wings on touchdown (a ripple);
 *     wade forward, dip the head to feed, turn before walking back; take off
 *     forward with running steps on the water and fast wingbeats, climb and
 *     leave on the same heading. A far (small) and two nearer birds do this;
 *   - always alive: every loop divides MASTER_S, and the test counts at
 *     least four visible birds at every instant (three on phones);
 *   - wingbeats scale with size (small, far birds flap faster) and no two
 *     birds share a phase.
 *
 * Birds never cross the copy or the calls to action: at desktop widths the
 * copy sits at the inline start below SKY_LIMIT_Y, so a bird is either above
 * SKY_LIMIT_Y or entirely beyond SAFE_X (checked in the unit test against
 * these constants and in e2e/test-migration-flight.cjs against the real page
 * at several widths and locales). At 1180 px and below the scene sits above
 * the copy (migration.css). Motion is transform/opacity only and runs only
 * while the hero is on screen and the tab is visible ([data-live]); reduced
 * motion shows a composed still (STILL): one bird flying, one landing, two
 * standing. Phones show fewer birds (mobile: false). */

const SVG_NS = 'http://www.w3.org/2000/svg'
export const HERO_W = 1600, HERO_H = 720, WATER_Y = 600
/** desktop copy keep-out: the copy lies at x < SAFE_X and y > SKY_LIMIT_Y (scene units) */
export const SAFE_X = 1060, SKY_LIMIT_Y = 160
/** one loop of the whole scene; every track duration divides it */
export const MASTER_S = 48

export type Pose = 'fly' | 'glide' | 'flare' | 'run' | 'stand' | 'wade' | 'feed'
export const FLIGHT_POSES: Pose[] = ['fly', 'glide', 'flare', 'run']
export interface Key { t: number; x: number; y: number; s: number; o: number; face: 1 | -1; pose: Pose }
export interface Track {
  id: string
  kind: 'cross' | 'approach' | 'recede' | 'lander'
  depth: 'far' | 'mid' | 'near'
  /** seconds per loop and start offset (negative: already under way) */
  dur: number; delay: number
  /** reference size, wingbeat seconds (flapFor(size)) and its phase offset */
  size: number; flap: number; phase: number
  /** body: (x, y) is the body centre; feet: (x, y) is where the feet touch the water */
  anchor: 'body' | 'feet'
  mobile: boolean
  keys: Key[]
  /** touchdown and running-step splashes: time (%) and x */
  splashes?: { t: number; x: number }[]
}

/* ---- drawings (facing +x) ------------------------------------------------ */
/* flying: body centre at (0, 0); about 86 × 32 units at scale 1 */
const FLY = {
  body: 'M-12 0c4-5 16-6 24-2 3 2 2 4-2 5-8 2-17 2-22-3z', neck: 'M10 -1c8-3 16-4 24-3',
  head: 'M33 -5c3-1 6 0 6 2l5 3c-3 0-6-1-8-1-2 1-4 0-3-4z', legs: 'M-11 1c-10 1-20 2-31 2M-11 2c-10 2-19 4-29 5',
  near: 'M-4 -2c2-10 8-19 18-24-1 9-3 17-8 24z', far: 'M-1 -2c4-7 10-13 19-16-2 7-6 13-11 16z',
  /* wings held out flat for a glide */
  glideNear: 'M-8 -2c8-5 22-8 36-8-9 5-22 9-36 8z', glideFar: 'M-4 -3c8-4 18-6 28-6-7 4-17 7-28 6z',
  /* flare: body raised, wings up and back, legs lowered forward */
  flareBody: 'M-12 2c3-6 14-9 23-6 3 1 3 4-1 6-7 3-16 4-22 0z', flareNeck: 'M9 -3c6-6 13-10 20-12',
  flareHead: 'M28 -18c3-1 6 0 6 3l4 4c-3 0-6-2-8-2-2 0-3-1-2-5z',
  flareNear: 'M-6 -3c-6-10-6-22 0-32 3 10 6 20 8 30z', flareFar: 'M-2 -3c-4-8-3-18 2-26 2 8 4 17 4 25z',
  flareLegs: 'M-4 3c2 8 5 16 9 23M0 3c3 7 7 14 12 20',
  /* running on the water: legs reach down */
  runLegs: 'M-6 2c1 9 3 18 4 27M-2 2c3 8 6 15 10 22',
}
/* on the water: feet at (0, 0); about 46 × 96 units at scale 1 */
const STAND = {
  body: 'M-14 -46c2-9 14-13 25-8 7 3 7 9 0 12-9 4-22 4-25-4z', wing: 'M-10 -48c6-6 16-7 22-2-6 4-15 5-22 2z',
  neck: 'M9 -50c8-6 6-18-1-26-6-7-3-15 6-16', head: 'M14 -92c4-2 8 0 8 3l6 5c-4 0-7-1-9-1-3 1-6-1-5-7z',
  legs: 'M-2 -40l-3 40M3 -40l6 22-9 18', legsStep: 'M-2 -40l4 40M3 -40l-2 22 4 18',
  /* feeding: the neck curves down so the head dips to the water ahead */
  feedNeck: 'M9 -50c10-2 16 10 18 22 2 10 2 18 2 24', feedHead: 'M24 -6c3-2 7-1 8 1l5 5c-4 0-7-1-9-1-3 0-5-1-4-5z',
}
/** flight poses are drawn this far above the feet point of a lander */
export const FLIGHT_LIFT = 46

/* ---- tracks --------------------------------------------------------------- */
/** wingbeat period from size: small (far) birds flap faster, near birds slower */
export const flapFor = (s: number) => +(0.42 + 0.26 * Math.sqrt(s)).toFixed(3)

const k = (t: number, x: number, y: number, s: number, o: number, face: 1 | -1, pose: Pose): Key => ({ t, x, y, s, o, face, pose })
/** a smooth curved path as keys: quadratic Bézier from p0 via c to p1, sampled.
 *  `grow: 'in'` eases the size in (perspective: a far bird grows slowly, then
 *  quickly as it nears the camera). */
function curve(t0: number, t1: number, p0: [number, number], c: [number, number], p1: [number, number], s0: number, s1: number, o0: number, o1: number, face: 1 | -1, pose: Pose, n = 6, grow: 'linear' | 'in' = 'linear'): Key[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n, a = (1 - u) ** 2, b = 2 * (1 - u) * u, d = u ** 2, g = grow === 'in' ? u * u : u
    return k(+(t0 + (t1 - t0) * u).toFixed(3), +(a * p0[0] + b * c[0] + d * p1[0]).toFixed(1), +(a * p0[1] + b * c[1] + d * p1[1]).toFixed(1),
      +(s0 + (s1 - s0) * g).toFixed(3), +(o0 + (o1 - o0) * u).toFixed(3), face, pose)
  })
}
const join = (...parts: Key[][]) => parts.flat().filter((key, i, all) => i === 0 || key.t > all[i - 1].t)
/** invisible return to the start (both keys at opacity 0, so nothing is seen moving) */
const reset = (last: Key, first: Key): Key[] => [{ ...last, t: +(last.t + 0.1).toFixed(3), o: 0 }, { ...first, t: 100, o: 0 }]

const sized = (base: Omit<Track, 'flap' | 'size'>, s: number): Track => ({ ...base, size: s, flap: flapFor(s) })

export const TRACKS: Track[] = [
  /* far crossers: small, faint, high (one each way) */
  sized({ id: 'cf1', kind: 'cross', depth: 'far', dur: 24, delay: -3, phase: -0.11, anchor: 'body', mobile: true,
    keys: join([k(0, -80, 140, 0.5, 0.55, 1, 'fly'), k(96, 1700, 142, 0.5, 0.55, 1, 'fly')], reset(k(96, 1700, 142, 0.5, 0.55, 1, 'fly'), k(0, -80, 140, 0.5, 0.55, 1, 'fly'))) }, 0.5),
  sized({ id: 'cf2', kind: 'cross', depth: 'far', dur: 24, delay: -15, phase: -0.29, anchor: 'body', mobile: false,
    keys: join([k(0, 1700, 140, 0.45, 0.5, -1, 'fly'), k(96, -80, 136, 0.45, 0.5, -1, 'fly')], reset(k(96, -80, 136, 0.45, 0.5, -1, 'fly'), k(0, 1700, 140, 0.45, 0.5, -1, 'fly'))) }, 0.45),
  /* mid crosser: high over the copy, then dips into the open inline-end sky */
  sized({ id: 'cm1', kind: 'cross', depth: 'mid', dur: 16, delay: -6, phase: -0.37, anchor: 'body', mobile: false,
    keys: join([k(0, -120, 92, 1, 0.8, 1, 'fly'), k(40, 1040, 104, 1, 0.82, 1, 'fly')], curve(40, 92, [1040, 104], [1300, 150], [1760, 262], 1, 1.1, 0.82, 0.85, 1, 'fly', 5),
      reset(k(92, 1760, 262, 1.1, 0.85, 1, 'fly'), k(0, -120, 92, 1, 0.8, 1, 'fly'))) }, 1),
  /* near crosser: large, from the inline-end edge, climbing out over the top */
  sized({ id: 'cn1', kind: 'cross', depth: 'near', dur: 16, delay: -13, phase: -0.53, anchor: 'body', mobile: true,
    keys: join(curve(0, 46, [1780, 300], [1300, 250], [1150, 96], 2, 2, 0.95, 0.95, -1, 'fly', 5), [k(90, -220, 40, 2, 0.95, -1, 'fly')],
      reset(k(90, -220, 40, 2, 0.95, -1, 'fly'), k(0, 1780, 300, 2, 0.95, -1, 'fly'))) }, 2),
  /* towards the camera from the horizon: small and faint, then larger, brighter and higher */
  sized({ id: 'ap1', kind: 'approach', depth: 'far', dur: 24, delay: 0, phase: -0.07, anchor: 'body', mobile: true,
    keys: join(curve(0, 84, [1190, 548], [1360, 520], [1760, -140], 0.22, 3.2, 0, 1, 1, 'fly', 8, 'in'),
      reset(k(84, 1760, -140, 3.2, 1, 1, 'fly'), k(0, 1190, 548, 0.22, 0, 1, 'fly'))) }, 1.2),
  sized({ id: 'ap2', kind: 'approach', depth: 'mid', dur: 24, delay: -12, phase: -0.41, anchor: 'body', mobile: false,
    keys: join(curve(0, 80, [1330, 560], [1400, 520], [1720, -120], 0.2, 2.8, 0, 1, 1, 'fly', 8, 'in'),
      reset(k(80, 1720, -120, 2.8, 1, 1, 'fly'), k(0, 1330, 560, 0.2, 0, 1, 'fly'))) }, 1.1),
  /* away from the camera: from the foreground towards the horizon, shrinking */
  sized({ id: 'rc1', kind: 'recede', depth: 'near', dur: 24, delay: -6, phase: -0.23, anchor: 'body', mobile: true,
    keys: join([k(0, -260, 62, 3, 1, 1, 'fly'), k(20, 300, 88, 2.3, 1, 1, 'fly'), k(40, 800, 100, 1.6, 0.95, 1, 'fly'), k(50, 1120, 128, 1.15, 0.9, 1, 'fly')],
      curve(50, 90, [1120, 128], [1330, 220], [1440, 540], 1.15, 0.2, 0.9, 0.05, 1, 'fly', 6),
      reset(k(90, 1440, 540, 0.2, 0.05, 1, 'fly'), k(0, -260, 62, 3, 1, 1, 'fly'))) }, 1.6),
  /* landers: approach, glide, flare, touchdown, wade, feed, turn, take off */
  sized({ id: 'ln', kind: 'lander', depth: 'near', dur: 24, delay: -11, phase: -0.19, anchor: 'feet', mobile: true,
    keys: [
      k(0, 1100, 120, 1.6, 0, 1, 'fly'), k(4, 1140, 190, 1.6, 1, 1, 'fly'), k(10, 1190, 330, 1.6, 1, 1, 'fly'),
      k(12, 1205, 380, 1.6, 1, 1, 'glide'), k(18, 1258, 540, 1.6, 1, 1, 'glide'),
      k(20, 1276, 590, 1.6, 1, 1, 'flare'), k(23, 1296, 638, 1.6, 1, 1, 'flare'),
      k(24, 1300, 640, 1.6, 1, 1, 'stand'), k(27, 1300, 640, 1.6, 1, 1, 'stand'),
      k(28, 1301, 640, 1.6, 1, 1, 'wade'), k(36, 1328, 640, 1.6, 1, 1, 'wade'),
      k(37, 1328, 640, 1.6, 1, 1, 'feed'), k(44, 1328, 640, 1.6, 1, 1, 'feed'),
      k(45, 1328, 640, 1.6, 1, 1, 'stand'), k(46, 1329, 640, 1.6, 1, 1, 'wade'), k(54, 1356, 640, 1.6, 1, 1, 'wade'),
      k(55, 1356, 640, 1.6, 1, 1, 'stand'), k(57, 1356, 640, 1.6, 1, -1, 'stand'),
      k(58, 1355, 640, 1.6, 1, -1, 'wade'), k(64, 1334, 640, 1.6, 1, -1, 'wade'),
      k(65, 1334, 640, 1.6, 1, -1, 'stand'), k(67, 1334, 640, 1.6, 1, 1, 'stand'),
      k(68, 1336, 640, 1.6, 1, 1, 'run'), k(74, 1392, 636, 1.6, 1, 1, 'run'), k(77, 1440, 612, 1.6, 1, 1, 'fly'),
      k(81, 1520, 520, 1.6, 1, 1, 'fly'), k(86, 1650, 380, 1.6, 1, 1, 'fly'), k(86.1, 1650, 380, 1.6, 0, 1, 'fly'), k(100, 1100, 120, 1.6, 0, 1, 'fly'),
    ],
    splashes: [{ t: 24, x: 1300 }, { t: 69.5, x: 1350 }, { t: 71.5, x: 1370 }, { t: 73.5, x: 1388 }] }, 1.6),
  sized({ id: 'lm', kind: 'lander', depth: 'mid', dur: 24, delay: -14, phase: -0.61, anchor: 'feet', mobile: true,
    keys: [
      k(0, 1060, 70, 1.1, 0, 1, 'fly'), k(4, 1110, 120, 1.1, 0.95, 1, 'fly'), k(9, 1140, 250, 1.1, 0.95, 1, 'fly'),
      k(11, 1145, 300, 1.1, 0.95, 1, 'glide'), k(17, 1182, 520, 1.1, 0.95, 1, 'glide'),
      k(19, 1190, 580, 1.1, 0.95, 1, 'flare'), k(22, 1197, 628, 1.1, 0.95, 1, 'flare'),
      k(23, 1199, 630, 1.1, 0.95, 1, 'stand'), k(26, 1199, 630, 1.1, 0.95, 1, 'stand'),
      k(27, 1200, 630, 1.1, 0.95, 1, 'wade'), k(37, 1226, 630, 1.1, 0.95, 1, 'wade'),
      k(38, 1226, 630, 1.1, 0.95, 1, 'feed'), k(47, 1226, 630, 1.1, 0.95, 1, 'feed'),
      k(48, 1226, 630, 1.1, 0.95, 1, 'stand'), k(50, 1227, 630, 1.1, 0.95, 1, 'wade'), k(60, 1252, 630, 1.1, 0.95, 1, 'wade'),
      k(62, 1253, 630, 1.1, 0.95, 1, 'run'), k(69, 1300, 626, 1.1, 0.95, 1, 'run'), k(72, 1340, 600, 1.1, 0.95, 1, 'fly'),
      k(78, 1440, 470, 1.1, 0.95, 1, 'fly'), k(85, 1560, 300, 1.1, 0.95, 1, 'fly'), k(89, 1680, 200, 1.1, 0.95, 1, 'fly'),
      k(89.1, 1680, 200, 1.1, 0, 1, 'fly'), k(100, 1060, 70, 1.1, 0, 1, 'fly'),
    ],
    splashes: [{ t: 23, x: 1199 }, { t: 63.5, x: 1262 }, { t: 65.5, x: 1278 }, { t: 67.5, x: 1292 }] }, 1.1),
  /* far lander, small near the horizon: comes from the inline end (facing -x), lands, feeds, leaves high over the copy */
  sized({ id: 'lf', kind: 'lander', depth: 'far', dur: 24, delay: -9, phase: -0.83, anchor: 'feet', mobile: true,
    keys: [
      k(0, 1700, 300, 0.7, 0, -1, 'fly'), k(4, 1640, 380, 0.7, 0.75, -1, 'fly'), k(10, 1560, 520, 0.7, 0.75, -1, 'glide'),
      k(13, 1525, 584, 0.7, 0.75, -1, 'flare'), k(15, 1516, 610, 0.7, 0.75, -1, 'flare'),
      k(16, 1514, 612, 0.7, 0.75, -1, 'stand'), k(19, 1514, 612, 0.7, 0.75, -1, 'stand'),
      k(20, 1513, 612, 0.7, 0.75, -1, 'wade'), k(30, 1496, 612, 0.7, 0.75, -1, 'wade'),
      k(31, 1496, 612, 0.7, 0.75, -1, 'feed'), k(42, 1496, 612, 0.7, 0.75, -1, 'feed'),
      k(43, 1496, 612, 0.7, 0.75, -1, 'stand'), k(44, 1495, 612, 0.7, 0.75, -1, 'wade'), k(54, 1478, 612, 0.7, 0.75, -1, 'wade'),
      k(56, 1477, 612, 0.7, 0.75, -1, 'run'), k(62, 1446, 608, 0.7, 0.75, -1, 'run'), k(65, 1420, 590, 0.7, 0.75, -1, 'fly'),
      k(70, 1330, 450, 0.7, 0.75, -1, 'fly'), k(76, 1210, 270, 0.7, 0.75, -1, 'fly'), k(80, 1130, 170, 0.7, 0.75, -1, 'fly'),
      k(84, 1060, 110, 0.7, 0.75, -1, 'fly'), k(96, -80, 50, 0.7, 0.75, -1, 'fly'), k(96.1, -80, 50, 0.7, 0, -1, 'fly'), k(100, 1700, 300, 0.7, 0, -1, 'fly'),
    ],
    splashes: [{ t: 16, x: 1514 }, { t: 57.5, x: 1470 }, { t: 59.5, x: 1460 }, { t: 61.5, x: 1450 }] }, 0.7),
]

/** reduced motion: a composed still (track id → loop time %): one flying, one landing, two standing */
export const STILL: { id: string; t: number }[] = [{ id: 'cm1', t: 62 }, { id: 'lf', t: 14 }, { id: 'ln', t: 40 }, { id: 'lm', t: 30 }]

/* ---- sampling (shared by the still frame and the tests) ------------------- */
export interface Sample { x: number; y: number; sx: number; s: number; o: number; face: 1 | -1; pose: Pose }
export function sample(track: Track, t: number): Sample {
  const keys = track.keys
  let i = keys.findIndex((key, j) => j < keys.length - 1 && t >= key.t && t <= keys[j + 1].t)
  if (i < 0) i = keys.length - 2
  const a = keys[i], b = keys[i + 1], u = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t)
  const lerp = (p: number, q: number) => p + (q - p) * u
  return { x: lerp(a.x, b.x), y: lerp(a.y, b.y), sx: lerp(a.face * a.s, b.face * b.s), s: lerp(a.s, b.s), o: lerp(a.o, b.o), face: u < 1 ? a.face : b.face, pose: u < 1 ? a.pose : b.pose }
}
/** loop time (%) of a track at scene time `sec` (CSS: negative delay = already under way) */
export const loopT = (track: Track, sec: number) => ((((sec - track.delay) % track.dur) + track.dur) % track.dur) / track.dur * 100

/* ---- CSS generation ------------------------------------------------------- */
const POSES: Pose[] = ['fly', 'glide', 'flare', 'run', 'stand', 'wade', 'feed']
const BLEND = 0.6 /* % of a loop to cross-fade one pose into the next */
const f = (n: number) => +n.toFixed(3)
const transformOf = (key: { x: number; y: number }, sx: number, s: number) => `translate(${f(key.x)}px,${f(key.y)}px) scale(${f(sx)},${f(s)})`

/** @keyframes for one track: its path, its poses and its splashes */
export function trackCss(track: Track): string {
  const path = track.keys.map(key => `${f(key.t)}%{transform:${transformOf(key, key.face * key.s, key.s)};opacity:${f(key.o)}}`).join('')
  let css = `@keyframes mh-${track.id}{${path}}`
  for (const pose of POSES) {
    if (!track.keys.some(key => key.pose === pose)) continue
    const points: [number, number][] = []
    track.keys.forEach((key, i) => {
      const on = key.pose === pose ? 1 : 0
      points.push([key.t, on])
      const next = track.keys[i + 1]
      if (next && next.pose !== key.pose) points.push([Math.max(key.t, next.t - BLEND), on])
    })
    css += `@keyframes mh-${track.id}-${pose}{${points.map(([t, o]) => `${f(t)}%{opacity:${o}}`).join('')}}`
  }
  track.splashes?.forEach((sp, i) => {
    const a = Math.max(0, sp.t - 0.05), b = Math.min(100, sp.t + 7)
    css += `@keyframes mh-${track.id}-sp${i}{0%,${f(a)}%{transform:scale(.3);opacity:0}${f(sp.t)}%{transform:scale(.45);opacity:.75}${f(b)}%,100%{transform:scale(1.6);opacity:0}}`
  })
  return css
}
/** the still frame for reduced motion (only the STILL birds, at their times) */
export function stillCss(): string {
  let css = '@media (prefers-reduced-motion:reduce){.mh-root .mh-bird,.mh-root .mh-splash{display:none}'
  for (const { id, t } of STILL) {
    const track = TRACKS.find(tr => tr.id === id)!
    const p = sample(track, t)
    css += `.mh-root .mh-bird.b-${id}{display:inline;transform:${transformOf(p, p.face * p.s, p.s)};opacity:${f(Math.max(p.o, 0.6))}}`
    css += `.mh-root .b-${id} .mh-pose{opacity:0}.mh-root .b-${id} .mh-pose.is-${p.pose}{opacity:1}`
  }
  return css + '}'
}

/* ---- SVG ------------------------------------------------------------------ */
function el(tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [key, v] of Object.entries(attrs)) node.setAttribute(key, String(v))
  parent?.append(node)
  return node
}
function pose(parent: Element, track: Track, name: Pose): SVGElement {
  const lift = track.anchor === 'feet' && FLIGHT_POSES.includes(name) ? -FLIGHT_LIFT : 0
  const g = el('g', { class: `mh-pose is-${name}`, style: `animation-name:mh-${track.id}-${name}`, ...(lift ? { transform: `translate(0 ${lift})` } : {}) }, parent)
  const wingStyle = (rate: number, lag = 0) => `--mh-flap:${f(track.flap * rate)}s;--mh-phase:${f(track.phase - lag)}s`
  if (name === 'fly' || name === 'run') {
    const rate = name === 'run' ? 0.5 : 1
    el('path', { d: FLY.far, class: 'mh-wing is-far', style: wingStyle(rate, 0.06) }, g)
    el('path', { d: name === 'run' ? FLY.runLegs : FLY.legs, class: 'mh-legs' }, g)
    el('path', { d: FLY.neck, class: 'mh-neck' }, g)
    el('path', { d: FLY.body, class: 'mh-body' }, g)
    el('path', { d: FLY.head, class: 'mh-head' }, g)
    el('path', { d: FLY.near, class: 'mh-wing', style: wingStyle(rate) }, g)
  } else if (name === 'glide') {
    el('path', { d: FLY.glideFar, class: 'mh-wing-fixed is-far' }, g)
    el('path', { d: FLY.legs, class: 'mh-legs' }, g)
    el('path', { d: FLY.neck, class: 'mh-neck' }, g)
    el('path', { d: FLY.body, class: 'mh-body' }, g)
    el('path', { d: FLY.head, class: 'mh-head' }, g)
    el('path', { d: FLY.glideNear, class: 'mh-wing-fixed' }, g)
  } else if (name === 'flare') {
    el('path', { d: FLY.flareFar, class: 'mh-wing-fixed is-far' }, g)
    el('path', { d: FLY.flareLegs, class: 'mh-legs' }, g)
    el('path', { d: FLY.flareNeck, class: 'mh-neck' }, g)
    el('path', { d: FLY.flareBody, class: 'mh-body' }, g)
    el('path', { d: FLY.flareHead, class: 'mh-head' }, g)
    el('path', { d: FLY.flareNear, class: 'mh-wing-fixed' }, g)
  } else {
    if (name === 'wade') {
      el('path', { d: STAND.legs, class: 'mh-legs is-standing mh-step a' }, g)
      el('path', { d: STAND.legsStep, class: 'mh-legs is-standing mh-step b' }, g)
    } else el('path', { d: STAND.legs, class: 'mh-legs is-standing' }, g)
    el('path', { d: name === 'feed' ? STAND.feedNeck : STAND.neck, class: 'mh-neck is-standing' }, g)
    el('path', { d: STAND.body, class: 'mh-body' }, g)
    el('path', { d: STAND.wing, class: 'mh-wing-folded' }, g)
    el('path', { d: name === 'feed' ? STAND.feedHead : STAND.head, class: 'mh-head' }, g)
  }
  return g
}

/** The hero scene as an SVG node (decorative; the page provides the text). */
export function migrationHeroNode(): SVGSVGElement {
  const svg = el('svg', { viewBox: `0 0 ${HERO_W} ${HERO_H}`, preserveAspectRatio: 'xMaxYMax slice', 'aria-hidden': 'true', focusable: 'false', class: 'mh-svg' }) as SVGSVGElement
  el('style', {}, svg).textContent = TRACKS.map(trackCss).join('') + stillCss()
  const defs = el('defs', {}, svg)
  const sky = el('linearGradient', { id: 'mh-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  el('stop', { offset: 0, class: 'mh-sky-top' }, sky); el('stop', { offset: 0.7, class: 'mh-sky-mid' }, sky); el('stop', { offset: 1, class: 'mh-sky-low' }, sky)
  const water = el('linearGradient', { id: 'mh-water', x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  el('stop', { offset: 0, class: 'mh-water-top' }, water); el('stop', { offset: 1, class: 'mh-water-low' }, water)
  el('rect', { width: HERO_W, height: WATER_Y, fill: 'url(#mh-sky)' }, svg)
  el('circle', { cx: 1320, cy: 210, r: 120, class: 'mh-sun' }, svg)
  el('path', { d: `M0 ${WATER_Y}c180-34 360-40 560-22s420 30 620 6 300-26 420-10V${WATER_Y}z`, class: 'mh-hills' }, svg)
  el('rect', { y: WATER_Y, width: HERO_W, height: HERO_H - WATER_Y, fill: 'url(#mh-water)' }, svg)
  /* far to near, so nearer birds are drawn over farther ones */
  const order = { far: 0, mid: 1, near: 2 }
  const birds = el('g', { class: 'mh-birds' }, svg)
  for (const track of [...TRACKS].sort((a, b) => order[a.depth] - order[b.depth])) {
    const timing = `--mh-dur:${track.dur}s;--mh-delay:${track.delay}s`
    track.splashes?.forEach((sp, i) => {
      const feetY = track.keys.find(key => Math.abs(key.t - sp.t) < 2 && !FLIGHT_POSES.includes(key.pose))?.y ?? track.keys.find(key => key.t >= sp.t)!.y
      const at = el('g', { transform: `translate(${sp.x} ${feetY + 2})`, class: `mh-splash-at${track.mobile ? '' : ' is-desktop'}` }, birds)
      el('ellipse', { rx: 34 * track.keys[0].s, ry: 3 * track.keys[0].s, class: 'mh-splash', style: `${timing};animation-name:mh-${track.id}-sp${i}` }, at)
    })
    const bird = el('g', { class: `mh-bird b-${track.id} is-${track.depth}${track.mobile ? '' : ' is-desktop'}`, 'data-track': track.id, style: `${timing};animation-name:mh-${track.id}` }, birds)
    for (const name of POSES) if (track.keys.some(key => key.pose === name)) pose(bird, track, name)
  }
  return svg
}
