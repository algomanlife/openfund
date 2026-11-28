/* Openfund gateway scene: a miniature solar system on a dusty orbital disc,
 * seen from a low oblique angle, in the Openfund green palette.
 *
 * Original procedural drawing (no images): the disc is a top-down dust
 * texture rendered once and projected every frame (rotate, then squash),
 * the planets are shaded spheres with shadows cast across the disc, and the
 * miniature (tilt-shift) look comes from CSS blur bands over the canvas.
 * Canvas 2D only; no dependencies. Pauses while the tab is hidden; a single
 * still frame under prefers-reduced-motion.
 *
 * A fixed black hole sits between the hero copy and the actions (blackHole.ts).
 * Rocks and spacecraft that stray within its reach leave their orbits, spiral
 * in faster and faster, stretch along their path, heat up and fade into the
 * throat; they return later elsewhere on their orbits. Planets never fall in:
 * their paths bend around it. */

import { BlackHole, type BlackHoleLayout } from './blackHole'
import { drawCraft, type CraftKind } from './spacecraft'

export interface SolarSceneOptions {
  /** draw one frame and stop (reduced motion) */
  still?: boolean
  /** site theme: deep green space, or a pale mint sky for the light theme */
  theme?: 'dark' | 'light'
  /** seconds of simulated time before the first frame (positions planets) */
  startAt?: number
  /** where the black hole sits (canvas CSS px) and the free height around it */
  anchor?: () => { x: number; y: number; room: number } | null
  /** the Openfund mark at the bottom of the black hole */
  logoSrc?: string
}

interface Planet {
  orbit: number      // orbit radius, fraction of disc radius
  size: number       // radius, fraction of the planet scale
  phase: number      // starting angle (rad)
  colors: [string, string, string] // light, base, dark
  bands?: string[]   // gas giant bands
  ring?: boolean
  spots?: string     // terrestrial patches
}

/* angles: 0 is "toward the right of the screen" in the disc plane; a positive
   angle moves toward the viewer. Planets start scattered around their orbits
   (owner request 2026-11-28: never in one row) and pass at their own pace. */
/* The sun sits on the screen edge, so half of every orbit is off screen.
   Inner orbits are faster (ω ∝ r^-½, gentler than Kepler's r^-1.5) so
   planets keep crossing the visible half. Radians per second at radius 1. */
const ORBIT_SPEED = .025
/* rocks stream visibly faster than the planets around them */
const ROCK_SPEED = 2.6

const PLANETS: Planet[] = [
  { orbit: .19, size: .0075, phase: 2.4, colors: ['#d9d2c6', '#9a9085', '#3b352f'] },
  { orbit: .245, size: .0115, phase: -1.1, colors: ['#fff0c8', '#e0b878', '#6d4f25'] },
  { orbit: .305, size: .0125, phase: .7, colors: ['#bfe8ff', '#3f8fd0', '#123257'], spots: '#5fae6a' },
  { orbit: .365, size: .0095, phase: 3.9, colors: ['#ffc7a3', '#c8643a', '#4f1e10'] },
  { orbit: .55, size: .042, phase: -.45, colors: ['#fff1dc', '#d9b48c', '#5b3d22'], bands: ['#b5835a', '#efd8b8', '#a06f48', '#f4e2c6', '#c79a72'] },
  { orbit: .69, size: .034, phase: 1.35, colors: ['#fff3d6', '#dcbf8a', '#5e4624'], bands: ['#c9a46c', '#f1deb4', '#b8915c'], ring: true },
  { orbit: .83, size: .019, phase: -2.2, colors: ['#e6fbff', '#8fd3df', '#24545e'] },
  { orbit: .955, size: .0185, phase: .15, colors: ['#cfe3ff', '#3f6fd6', '#13255c'] },
]

/* mulberry32: deterministic noise so every visit draws the same disc */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

interface Palette {
  warm: number[]; sage: number[]; grain: number[]
  base: [number, string][]            // disc base gradient stops
  lane: string                        // planet lanes
  sky: [number, string][]             // background gradient stops
  haze: number                        // mint haze strength
  stars: number                       // star brightness (0: none)
  shade: string                       // shadow colour (rgb triplet)
  shadeAlpha: number
  glow: GlobalCompositeOperation      // how the sun's light is added
  corona: [number, string][]
  vignette: string
  atmosphere: string                  // planet halo (rgb triplet)
  depthHaze: string                   // colour far planets fade into (rgb triplet)
}
const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    warm: [244, 222, 182], sage: [168, 214, 190], grain: [130, 231, 189],
    base: [[0, 'rgba(255,238,200,.95)'], [.1, 'rgba(246,224,184,.7)'], [.26, 'rgba(222,206,172,.42)'], [.5, 'rgba(176,196,168,.2)'], [.78, 'rgba(130,190,160,.08)'], [1, 'rgba(120,190,160,0)']],
    lane: 'rgba(4,18,12,.1)',
    sky: [[0, '#173627'], [.22, '#0b2219'], [.55, '#06150e'], [1, '#020806']],
    haze: .045, stars: 1, shade: '1,8,5', shadeAlpha: 1, glow: 'lighter',
    corona: [[0, 'rgba(255,196,110,.5)'], [.12, 'rgba(255,160,70,.24)'], [.35, 'rgba(200,170,110,.08)'], [.7, 'rgba(130,231,189,.025)'], [1, 'rgba(130,231,189,0)']],
    vignette: 'rgba(2,8,5,.5)',
    atmosphere: '130,231,189', depthHaze: '8,34,24',
  },
  light: {
    warm: [176, 132, 74], sage: [74, 140, 110], grain: [40, 110, 80],
    base: [[0, 'rgba(255,214,150,.9)'], [.1, 'rgba(226,190,132,.6)'], [.26, 'rgba(190,170,126,.36)'], [.5, 'rgba(132,170,144,.2)'], [.78, 'rgba(96,160,128,.09)'], [1, 'rgba(96,160,128,0)']],
    lane: 'rgba(255,255,255,.22)',
    sky: [[0, '#fff4df'], [.2, '#f3f9f3'], [.55, '#e4f2ea'], [1, '#cfe6da']],
    haze: .05, stars: 0, shade: '28,64,48', shadeAlpha: .55, glow: 'source-over',
    corona: [[0, 'rgba(255,200,120,.55)'], [.15, 'rgba(255,190,110,.25)'], [.4, 'rgba(255,214,160,.08)'], [1, 'rgba(255,230,190,0)']],
    vignette: 'rgba(196,224,210,.45)',
    atmosphere: '255,255,255', depthHaze: '214,236,224',
  },
}

/** top-down dust disc, radius = size/2 */
function paintDisc(size: number, pal: Palette): HTMLCanvasElement {
  const WARM = pal.warm, SAGE = pal.sage, MINT = pal.grain
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const R = size / 2, rand = rng(20261128)
  g.translate(R, R)

  /* soft base: bright and warm near the sun, sage-green toward the edge */
  const base = g.createRadialGradient(0, 0, R * .06, 0, 0, R)
  for (const [at, colour] of pal.base) base.addColorStop(at, colour)
  g.fillStyle = base
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill()

  /* swirl streaks: thin, slightly spiralling arcs */
  /* streaks go on their own layer, blurred once when composited */
  const layer = document.createElement('canvas')
  layer.width = layer.height = size
  const main = g
  const sg = layer.getContext('2d')!
  sg.translate(R, R)
  sg.lineCap = 'round'
  for (let i = 0; i < 3400; i++) {
    const r0 = R * (.07 + Math.pow(rand(), 1.45) * .93)
    const a0 = rand() * Math.PI * 2, len = .25 + rand() * 1.6
    const t = r0 / R, col = mix(WARM, SAGE, Math.min(1, t * 1.25))
    const clump = .5 + .25 * Math.sin(r0 / R * 23.7 + Math.sin(a0 * 2) * 2.1) + .25 * Math.sin(r0 / R * 61.3 + a0 * 1.3)
    const alpha = (.015 + rand() * .085) * (1.2 - t * .75) * clump
    sg.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`
    sg.lineWidth = (.5 + Math.pow(rand(), 2) * 6) * size / 2048
    sg.beginPath()
    const steps = 18, drift = (rand() - .5) * R * (rand() < .35 ? .09 : .02)
    for (let s = 0; s <= steps; s++) {
      const a = a0 + len * s / steps, r = r0 + drift * s / steps
      s ? sg.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sg.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    sg.stroke()
  }

  main.save()
  main.setTransform(1, 0, 0, 1, 0, 0)
  main.filter = `blur(${(size / 2048 * 1.2).toFixed(2)}px)` /* soft streaks; ignored where unsupported */
  main.drawImage(layer, 0, 0)
  main.filter = 'none'
  main.globalAlpha = .45
  main.drawImage(layer, 0, 0) /* plus a crisp pass at partial strength */
  main.globalAlpha = 1
  main.restore()
  /* quiet lanes swept clear by the planets */
  for (const p of PLANETS) {
    g.strokeStyle = pal.lane
    g.lineWidth = R * (p.size * .9 + .004)
    g.beginPath(); g.arc(0, 0, R * p.orbit, 0, Math.PI * 2); g.stroke()
  }

  /* fine grains */
  for (let i = 0; i < 9000; i++) {
    const r = R * (.06 + Math.pow(rand(), 1.2) * .94), a = rand() * Math.PI * 2
    const t = r / R, col = mix(WARM, MINT, Math.min(1, t))
    g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(.15 + rand() * .55) * (1.1 - t * .6)})`
    const s = (.5 + rand() * 1.6) * size / 2048
    g.fillRect(Math.cos(a) * r, Math.sin(a) * r, s, s)
  }
  return c
}

interface Rock { r: number; a: number; size: number; base: number; shape: number[]; tone: number; speed: number; born: number }
function makeRocks(): Rock[] {
  const rand = rng(77), rocks: Rock[] = []
  const add = (rMin: number, rMax: number, n: number, sMin: number, sMax: number) => {
    for (let i = 0; i < n; i++) {
      const pts = 6 + Math.floor(rand() * 4), shape: number[] = []
      for (let k = 0; k < pts; k++) shape.push(.65 + rand() * .45)
      const r = rMin + rand() * (rMax - rMin)
      const size = sMin + rand() * (sMax - sMin)
      rocks.push({ r, a: rand() * Math.PI * 2, size, base: size, shape, tone: rand(), speed: .6 + rand() * 1.1, born: -1e9 })
    }
  }
  add(.41, .49, 130, .0018, .0055)  // the belt between Mars and Jupiter
  add(.18, 1.02, 70, .0016, .0065)  // strays across the disc
  return rocks
}

interface Debris { x: number; y: number; size: number; shape: number[]; tone: number; drift: number; phase: number }
function makeDebris(): Debris[] {
  const rand = rng(4242), out: Debris[] = []
  for (let i = 0; i < 16; i++) {
    const shape: number[] = []
    for (let k = 0; k < 7; k++) shape.push(.6 + rand() * .5)
    /* below the disc, nearer the viewer: larger and later blurred */
    out.push({ x: rand(), y: .66 + rand() * .3, size: .004 + rand() * .007, shape, tone: rand(), drift: (rand() - .5) * .004, phase: rand() * 6.28 })
  }
  return out
}

/* Spacecraft crossing the system in the disc plane: probes drift outward
   toward interstellar space, transfer ships run between the inner orbits.
   r and a as for the planets; vr in disc radii and va in radians per second. */
interface Craft { kind: CraftKind; r: number; a: number; vr: number; va: number; size: number; born: number }
function makeCrafts(): Craft[] {
  return [
    { kind: 'probe', r: .36, a: .55, vr: .0042, va: .004, size: .0058, born: -1e9 },
    { kind: 'probe', r: .8, a: -.75, vr: .0035, va: -.002, size: .0052, born: -1e9 },
    { kind: 'ship', r: .27, a: -.35, vr: .006, va: .03, size: .006, born: -1e9 },
    { kind: 'ship', r: .62, a: 1.05, vr: -.0048, va: .022, size: .0054, born: -1e9 },
  ]
}
function respawnCraft(c: Craft, now: number) {
  const out = c.kind === 'probe'
  c.r = out ? .2 + Math.random() * .12 : .26 + Math.random() * .45
  c.a = (Math.random() - .5) * 1.8
  c.vr = out ? .0032 + Math.random() * .0016 : (Math.random() < .5 ? 1 : -1) * (.004 + Math.random() * .003)
  c.born = now
}

/* satellites and a station circling planets (planet index, orbit in planet radii) */
const ORBITERS: { planet: number; d: number; w: number; ph: number; kind: CraftKind; size: number }[] = [
  { planet: 2, d: 2.1, w: .55, ph: 0, kind: 'satellite', size: .0036 },
  { planet: 2, d: 3.1, w: -.3, ph: 2.2, kind: 'station', size: .0052 },
  { planet: 4, d: 1.85, w: .2, ph: 1, kind: 'satellite', size: .0042 },
  { planet: 5, d: 2.9, w: .14, ph: 4, kind: 'probe', size: .004 },
]

/* a pebble broken off in a collision: it keeps the parent's orbit plus the
   kick of the impact, which drag in the dust slowly takes away */
interface Shard { r: number; a: number; vr: number; va: number; size: number; shape: number[]; tone: number; spin: number; born: number; life: number; speed: number }
/* the flash and dust puff of an impact, in disc coordinates */
interface Impact { r: number; a: number; speed: number; born: number; size: number }

/** an object the black hole has caught: its place on the spiral, in shadow radii */
interface Capture { r: number; th: number; t: number; trail: { x: number; y: number }[] }

function rockPath(g: CanvasRenderingContext2D, x: number, y: number, s: number, shape: number[], rot: number) {
  g.beginPath()
  shape.forEach((k, i) => {
    const a = rot + i / shape.length * Math.PI * 2
    const px = x + Math.cos(a) * s * k, py = y + Math.sin(a) * s * k * .8
    i ? g.lineTo(px, py) : g.moveTo(px, py)
  })
  g.closePath()
}

export function startSolarScene(canvas: HTMLCanvasElement, options: SolarSceneOptions = {}): () => void {
  const g = canvas.getContext('2d')
  if (!g) return () => {}
  const small = Math.min(innerWidth, innerHeight) < 600
  const pal = PALETTES[options.theme === 'light' ? 'light' : 'dark']
  const disc = paintDisc(small ? 1280 : 2048, pal)
  const shade = (alpha: number) => `rgba(${pal.shade},${(alpha * pal.shadeAlpha).toFixed(3)})`
  const rocks = makeRocks(), debris = makeDebris()
  const stars = (() => { const rand = rng(9); return Array.from({ length: 140 }, () => ({ x: rand(), y: rand(), s: rand(), t: rand() * 6.28 })) })()

  const crafts = makeCrafts()
  const hole = new BlackHole(pal.glow, options.logoSrc)
  const caught = new Map<object, Capture>()
  let shards: Shard[] = []
  let impacts: Impact[] = []
  let nextImpact = (options.startAt ?? 0) + 3

  let W = 0, H = 0, dpr = 1, frame = 0, last = 0, running = true
  let simTime = options.startAt ?? 0, lastSim = simTime
  let anchor: { x: number; y: number; room: number } | null = null, anchorAt = -1e9

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2)
    W = Math.max(1, rect.width); H = Math.max(1, rect.height)
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    anchor = options.anchor?.() ?? null; anchorAt = performance.now()
  }

  const draw = (time: number) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const portrait = H > W
    /* disc radius: reaches past the far edge; the sun sits on the near edge */
    const R = portrait ? W * 1.12 : Math.max(W * .96, H * 1.1)
    const k = portrait ? .33 : .25                       // squash: viewing angle
    const phi = (portrait ? 4 : 3) * Math.PI / 180       // slight roll
    const sunR = Math.min(R * (portrait ? .15 : .1), H * (portrait ? .095 : .17))
    const sx = -sunR * .3, sy = H * (portrait ? .45 : .47)
    const P = portrait ? R * 1.3 : Math.min(R, H * 1.3)  // planet scale
    const cosP = Math.cos(phi), sinP = Math.sin(phi)
    const project = (r: number, a: number) => {
      const u = r * Math.cos(a), v = r * Math.sin(a)
      return { x: sx + u * cosP - v * k * sinP, y: sy + u * sinP + v * k * cosP, depth: Math.sin(a) }
    }

    /* the black hole: fixed between the hero copy and the actions */
    if (options.anchor && time - anchorAt > 1000) { anchor = options.anchor() ?? anchor; anchorAt = time }
    const hx = anchor?.x ?? W * .5, hy = anchor?.y ?? H * (portrait ? .5 : .56)
    const room = anchor?.room || H * .45
    const rh = Math.max(16, Math.min(room * .15, W * (portrait ? .075 : .042), 64))
    /* the hole's disc lies in the plane of the system: same roll, same viewing angle */
    const kd = k
    const hl: BlackHoleLayout = { x: hx, y: hy, rh, roll: phi, k: kd }
    const dt = options.still ? 0 : Math.max(0, Math.min(.05, simTime - lastSim)); lastSim = simTime
    /* positions around the hole, in shadow radii on its own (tilted) disc */
    const toHole = (x: number, y: number) => {
      const dx = x - hx, dy = y - hy
      const u = dx * cosP + dy * sinP, v = (-dx * sinP + dy * cosP) / kd
      return { r: Math.hypot(u, v) / rh, th: Math.atan2(v, u) }
    }
    const fromHole = (r: number, th: number) => {
      const u = Math.cos(th) * r * rh, v = Math.sin(th) * r * rh * kd
      return { x: hx + u * cosP - v * sinP, y: hy + u * sinP + v * cosP }
    }
    const REACH = 6.2
    const smooth = (t: number) => t * t * (3 - 2 * t)
    interface Caught { x: number; y: number; r: number; th: number; ang: number; trail: { x: number; y: number }[]; size: number; body: () => void; alpha: number }
    const caughtNow: Caught[] = []
    /** follow an object into the hole once it strays within reach; returns
     *  false when it has crossed the horizon (the caller respawns it) */
    const fall = (key: object, x: number, y: number, size: number, alpha: number, body: () => void): boolean | 'free' => {
      let c = caught.get(key)
      if (!c) {
        if (options.still) return 'free'
        const h = toHole(x, y)
        if (h.r > REACH) return 'free'
        c = { r: h.r, th: h.th, t: 0, trail: [] }
        caught.set(key, c)
      }
      /* inflow quickens and the orbit tightens as it nears the horizon */
      c.t += dt
      c.r -= dt * (.34 + 1.7 / (c.r * c.r))
      c.th += dt * .32 * Math.pow(REACH / Math.max(c.r, .9), 1.5)
      if (c.r <= 1) { caught.delete(key); return false }
      const sp = fromHole(c.r, c.th), w = smooth(Math.min(1, c.t / 1.8))
      const px = x + (sp.x - x) * w, py = y + (sp.y - y) * w
      const ahead = fromHole(c.r, c.th + .02)
      c.trail.push({ x: px, y: py }); if (c.trail.length > 26) c.trail.shift()
      caughtNow.push({ x: px, y: py, r: c.r, th: c.th, ang: Math.atan2(ahead.y - sp.y, ahead.x - sp.x), trail: c.trail, size, body, alpha })
      return true
    }
    const drawCaught = (it: Caught) => {
      const near = Math.max(0, Math.min(1, (3.6 - it.r) / 2.4))
      const fade = Math.max(0, Math.min(1, (it.r - 1) / .75)) * it.alpha
      /* tidal stream: a warm trail along the path */
      if (it.trail.length > 2) {
        g.save()
        g.globalCompositeOperation = pal.glow
        g.lineCap = 'butt'; g.lineJoin = 'round'
        for (let i = 1; i < it.trail.length; i++) {
          const t = i / it.trail.length
          g.strokeStyle = `rgba(255,${(200 - near * 60) | 0},${(140 - near * 70) | 0},${(t * (.12 + near * .35) * fade).toFixed(3)})`
          g.lineWidth = Math.max(.6, it.size * (.4 + t * .9))
          g.beginPath(); g.moveTo(it.trail[i - 1].x, it.trail[i - 1].y); g.lineTo(it.trail[i].x, it.trail[i].y); g.stroke()
        }
        g.restore()
      }
      /* spaghettification: longer and thinner along the path near the hole */
      const st = 1 + 2.8 * near * near
      g.save()
      g.globalAlpha = fade * (1 - near * .75)
      g.translate(it.x, it.y); g.rotate(it.ang); g.scale(st, 1 / Math.sqrt(st))
      it.body()
      g.restore()
      if (near > 0) {
        g.save()
        g.globalCompositeOperation = pal.glow
        const heat = g.createRadialGradient(it.x, it.y, 0, it.x, it.y, it.size * (2 + near * 3))
        heat.addColorStop(0, `rgba(255,214,160,${(.55 * near * fade).toFixed(3)})`); heat.addColorStop(1, 'rgba(255,150,80,0)')
        g.fillStyle = heat
        g.beginPath(); g.arc(it.x, it.y, it.size * (2 + near * 3), 0, Math.PI * 2); g.fill()
        g.restore()
      }
    }

    /* space: deep Openfund green, warmer toward the sun */
    const bg = g.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 1.15)
    for (const [at, colour] of pal.sky) bg.addColorStop(at, colour)
    g.fillStyle = bg; g.fillRect(0, 0, W, H)
    const haze = g.createLinearGradient(0, sy - H * .5, 0, sy + H * .5)
    haze.addColorStop(0, 'rgba(130,231,189,0)'); haze.addColorStop(.5, `rgba(130,231,189,${pal.haze})`); haze.addColorStop(1, 'rgba(130,231,189,0)')
    g.fillStyle = haze; g.fillRect(0, 0, W, H)
    if (pal.stars) for (const s of stars) {
      const tw = .5 + .5 * Math.sin(s.t + time * .0006 * (.5 + s.s))
      g.fillStyle = `rgba(214,255,236,${(.08 + s.s * .3) * tw})`
      g.fillRect(s.x * W, s.y * H, s.s > .85 ? 1.6 : 1, s.s > .85 ? 1.6 : 1)
    }

    /* the disc: rotate in its own plane, then project */
    g.save()
    g.translate(sx, sy); g.rotate(phi); g.scale(1, k); g.rotate(simTime * ORBIT_SPEED * .6)
    g.globalAlpha = .95
    g.drawImage(disc, -R, -R, R * 2, R * 2)
    g.rotate(-simTime * ORBIT_SPEED * .3) /* a second, slower pass: differential swirl */
    g.globalAlpha = .35
    g.drawImage(disc, -R * .62, -R * .62, R * 1.24, R * 1.24)
    g.restore()
    g.globalAlpha = 1

    /* rocks on the disc, with short shadows */
    const rockBody = (rock: Rock, s: number, ux: number, uy: number) => {
      const tone = Math.round(70 + rock.tone * 70)
      const lit = g.createLinearGradient(-ux * s, -uy * s, ux * s, uy * s)
      lit.addColorStop(0, `rgb(${tone + 90},${tone + 70},${tone + 40})`); lit.addColorStop(1, `rgb(${tone * .35 | 0},${tone * .35 | 0},${tone * .3 | 0})`)
      g.fillStyle = lit
      rockPath(g, 0, 0, s, rock.shape, rock.a)
      g.fill()
    }
    const rockRate = (r: number, speed: number) => ORBIT_SPEED * ROCK_SPEED * speed / Math.sqrt(r)
    const free: { rock: Rock; a: number; x: number; y: number }[] = []
    for (const rock of rocks) {
      const a = rock.a + simTime * rockRate(rock.r, rock.speed)
      const p = project(R * rock.r, a)
      const caughtAlready = caught.has(rock)
      if (!caughtAlready && (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20)) continue
      const s = P * rock.size * (1 + p.depth * .25)
      const dx = p.x - sx, dy = p.y - sy, d = Math.hypot(dx, dy) || 1
      const alpha = Math.min(1, (simTime - rock.born) / 2.5)
      const state = fall(rock, p.x, p.y - s * .4, s, alpha, () => rockBody(rock, s, -1, 0))
      if (state === false) { rock.a += Math.PI * (.7 + Math.random() * .6); rock.born = simTime; rock.size = rock.base; continue }
      if (state === true) continue
      if (alpha <= 0) continue
      if (alpha >= 1) free.push({ rock, a, x: p.x, y: p.y })
      g.globalAlpha = alpha
      g.fillStyle = shade(.35)
      g.beginPath(); g.ellipse(p.x + dx / d * s * 2.2, p.y + s * .7 + dy / d * s * .5, s * 2.6, s * .55, Math.atan2(dy * .4, dx), 0, Math.PI * 2); g.fill()
      g.save(); g.translate(p.x, p.y - s * .4); rockBody(rock, s, dx / d, dy / d); g.restore()
      g.globalAlpha = 1
    }

    /* now and then two rocks on crossing paths collide: the smaller one
       breaks into pebbles, the larger one loses a piece */
    if (!options.still && simTime > nextImpact) {
      let best: [typeof free[number], typeof free[number]] | null = null
      for (let i = 0; i < free.length && !best; i++) for (let j = i + 1; j < free.length; j++) {
        const A = free[i], B = free[j]
        if (Math.abs(A.rock.r - B.rock.r) > .02) continue
        const du = A.rock.r * Math.cos(A.a) - B.rock.r * Math.cos(B.a), dv = A.rock.r * Math.sin(A.a) - B.rock.r * Math.sin(B.a)
        if (Math.hypot(du, dv) * R < (A.rock.size + B.rock.size) * P * 1.1 && toHole(A.x, A.y).r > REACH * 1.3) { best = [A, B]; break }
      }
      if (best) {
        const [A, B] = best
        const big = A.rock.size >= B.rock.size ? A : B, small = big === A ? B : A
        const r = (A.rock.r + B.rock.r) / 2, a = (A.a + B.a) / 2, speed = (A.rock.speed + B.rock.speed) / 2
        impacts.push({ r, a, speed, born: simTime, size: small.rock.size + big.rock.size })
        const n = 5 + Math.floor(Math.random() * 5)
        for (let i = 0; i < n; i++) {
          const dir = Math.random() * Math.PI * 2, kick = .004 + Math.random() * .012
          const shape: number[] = []
          for (let q = 0; q < 6; q++) shape.push(.55 + Math.random() * .5)
          shards.push({ r, a, vr: Math.cos(dir) * kick, va: Math.sin(dir) * kick / r, size: small.rock.size * (.22 + Math.random() * .3),
            shape, tone: small.rock.tone, spin: (Math.random() - .5) * 6, born: simTime, life: 7 + Math.random() * 6, speed })
        }
        /* the broken rock reappears much later elsewhere on its orbit */
        small.rock.a += Math.PI * (.6 + Math.random() * .8); small.rock.born = simTime + 10 + Math.random() * 10
        big.rock.size = Math.max(big.rock.base * .55, big.rock.size * .8)
        nextImpact = simTime + 6 + Math.random() * 8
      } else nextImpact = simTime + .5
    }
    shards = shards.filter(sh => {
      const age = simTime - sh.born
      if (age > sh.life) return false
      const drag = Math.exp(-dt * .35)
      sh.vr *= drag; sh.va *= drag
      sh.r += sh.vr * dt; sh.a += (rockRate(sh.r, sh.speed) + sh.va) * dt
      const p = project(R * sh.r, sh.a)
      const s = P * sh.size * (1 + p.depth * .25)
      const alpha = Math.min(1, age * 4) * Math.min(1, (sh.life - age) / 2.5)
      const body = () => {
        const tone = Math.round(80 + sh.tone * 70)
        g.fillStyle = `rgb(${tone + 70},${tone + 52},${tone + 30})`
        rockPath(g, 0, 0, s, sh.shape, sh.spin * age)
        g.fill()
      }
      const state = fall(sh, p.x, p.y - s * .4, s, alpha, body)
      if (state === false) return false
      if (state === true) return true
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) return true
      g.globalAlpha = alpha
      g.fillStyle = shade(.3)
      g.beginPath(); g.ellipse(p.x + s * 1.6, p.y + s * .6, s * 2, s * .45, .1, 0, Math.PI * 2); g.fill()
      g.save(); g.translate(p.x, p.y - s * .4); body(); g.restore()
      g.globalAlpha = 1
      return true
    })
    impacts = impacts.filter(im => {
      const age = simTime - im.born
      if (age > 3.5) return false
      const p = project(R * im.r, im.a + (simTime - im.born) * rockRate(im.r, im.speed))
      const s = P * im.size
      g.save()
      g.globalCompositeOperation = pal.glow
      /* a brief flash, then an expanding, thinning puff of dust */
      if (age < .5) {
        const f = 1 - age / .5
        const flash = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * (3 + age * 8))
        flash.addColorStop(0, `rgba(255,244,214,${(.9 * f).toFixed(3)})`); flash.addColorStop(.4, `rgba(255,190,120,${(.4 * f).toFixed(3)})`); flash.addColorStop(1, 'rgba(255,170,90,0)')
        g.fillStyle = flash
        g.beginPath(); g.arc(p.x, p.y, s * (3 + age * 8), 0, Math.PI * 2); g.fill()
      }
      g.restore()
      const spread = s * (1.5 + age * 5), fade = Math.max(0, 1 - age / 3.5)
      const puff = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, spread)
      puff.addColorStop(0, `rgba(${pal.warm.join(',')},${(.32 * fade).toFixed(3)})`); puff.addColorStop(1, `rgba(${pal.warm.join(',')},0)`)
      g.fillStyle = puff
      g.beginPath(); g.ellipse(p.x, p.y, spread, spread * k * 1.6, phi, 0, Math.PI * 2); g.fill()
      return true
    })

    /* spacecraft crossing the system */
    for (const c of crafts) {
      c.r += c.vr * dt; c.a += c.va * dt
      if (c.r > 1.08 || c.r < .17) respawnCraft(c, simTime)
      const p = project(R * c.r, c.a)
      if (!caught.has(c) && (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30)) continue
      const S = P * c.size * (1 + p.depth * .25)
      const next = project(R * (c.r + c.vr * 4), c.a + c.va * 4)
      const heading = c.kind === 'ship' ? Math.atan2(next.y - p.y, next.x - p.x) : Math.atan2(sy - p.y, sx - p.x)
      const sunIn = Math.atan2(sy - p.y, sx - p.x) - heading
      const alpha = Math.min(1, (simTime - c.born) / 3)
      const body = () => { g.scale(S, S); drawCraft(g, c.kind, sunIn, c.kind === 'ship' ? .75 : 0) }
      const state = fall(c, p.x, p.y - S * .7, S, alpha, () => { g.save(); body(); g.restore() })
      if (state === false) { respawnCraft(c, simTime); continue }
      if (state === true) continue
      const dx = p.x - sx, dy = p.y - sy, d = Math.hypot(dx, dy) || 1
      g.globalAlpha = alpha
      g.fillStyle = shade(.3)
      g.beginPath(); g.ellipse(p.x + dx / d * S * 1.8, p.y + S * .6, S * 2, S * .4, Math.atan2(dy * .4, dx), 0, Math.PI * 2); g.fill()
      g.save(); g.translate(p.x, p.y - S * .7); g.rotate(heading); body(); g.restore()
      g.globalAlpha = 1
    }

    /* planets: back ones first, the sun, then the near ones */
    /* the hole's place on the scene's disc; planet paths bend around it */
    const hdx = hx - sx, hdy = hy - sy
    const hu = hdx * cosP + hdy * sinP, hv = (-hdx * sinP + hdy * cosP) / k
    const rB = Math.hypot(hu, hv) / R, aB = Math.atan2(hv, hu)
    const radialPx = R * Math.hypot(Math.cos(aB), k * Math.sin(aB))
    const tangentPx = R * rB * Math.hypot(Math.sin(aB), k * Math.cos(aB))
    const placed = PLANETS.map((pl, index) => {
      const a = pl.phase + simTime * ORBIT_SPEED / Math.sqrt(pl.orbit)
      const s0 = P * pl.size
      const clear = rh * 5.6 + s0 * 2.6
      const gap = clear / radialPx, width = clear * 1.8 / Math.max(1, tangentPx)
      const da = Math.atan2(Math.sin(a - aB), Math.cos(a - aB))
      const sep = pl.orbit - rB, need = gap - Math.abs(sep)
      const r = need > 0 ? pl.orbit + (sep >= 0 ? 1 : -1) * need * Math.exp(-((da / width) ** 2)) : pl.orbit
      const p = project(R * r, a)
      return { pl, index, ...p, s: P * pl.size * (1 + p.depth * .32) }
    }).sort((a, b) => a.depth - b.depth)

    const orbiters = (index: number, x: number, cy: number, s: number, front: boolean) => {
      for (const o of ORBITERS) {
        if (o.planet !== index) continue
        const th = o.ph + simTime * o.w
        if ((Math.sin(th) >= 0) !== front) continue
        const ox = Math.cos(th) * o.d * s, oy = Math.sin(th) * o.d * s * .32
        const px = x + ox * Math.cos(-.22) - oy * Math.sin(-.22), py = cy + ox * Math.sin(-.22) + oy * Math.cos(-.22)
        const S = P * o.size, heading = Math.atan2(sy - py, sx - px)
        g.save(); g.translate(px, py); g.rotate(o.kind === 'probe' ? heading : th * .2); g.scale(S, S)
        drawCraft(g, o.kind, o.kind === 'probe' ? 0 : heading - th * .2)
        g.restore()
      }
    }
    const drawPlanet = ({ pl, index, x, y, s, depth }: typeof placed[number]) => {
      if (x < -s * 4 || x > W + s * 4) return
      const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy) || 1
      const ux = dx / d, uy = dy / d
      const lift = s * .6  // the planet rides just above the dust
      /* shadow cast across the disc, away from the sun */
      const len = s * (2.6 + pl.orbit * 2.2)
      g.save()
      g.translate(x + ux * s * .6, y + lift * .9)
      g.rotate(Math.atan2(uy * k * 1.6, ux))
      const sh = g.createLinearGradient(0, 0, len, 0)
      sh.addColorStop(0, shade(.32)); sh.addColorStop(.5, shade(.12)); sh.addColorStop(1, shade(0))
      g.fillStyle = sh
      g.beginPath(); g.ellipse(len * .45, 0, len * .55, s * .36, 0, 0, Math.PI * 2); g.fill()
      g.restore()

      const cy = y - lift
      const ring = (front: boolean) => {
        if (!pl.ring) return
        g.save()
        g.translate(x, cy); g.rotate(-.22)
        g.lineWidth = s * .32
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = ['rgba(235,214,170,.85)', 'rgba(201,174,128,.7)', 'rgba(240,226,196,.55)'][i]
          g.beginPath()
          g.ellipse(0, 0, s * (1.55 + i * .32), s * (1.55 + i * .32) * .3, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2)
          g.stroke()
        }
        g.restore()
      }
      ring(false)
      /* atmosphere: a soft halo in the scene's own light, so the planet sits in the space */
      const halo = g.createRadialGradient(x, cy, s * .85, x, cy, s * 2.1)
      halo.addColorStop(0, `rgba(${pal.atmosphere},.28)`); halo.addColorStop(1, `rgba(${pal.atmosphere},0)`)
      g.fillStyle = halo
      g.beginPath(); g.arc(x, cy, s * 2.1, 0, Math.PI * 2); g.fill()
      orbiters(index, x, cy, s, false)
      /* sphere lit from the sun */
      const body = g.createRadialGradient(x - ux * s * .45, cy - uy * s * .25 - s * .25, s * .1, x, cy, s * 1.05)
      body.addColorStop(0, pl.colors[0]); body.addColorStop(.45, pl.colors[1]); body.addColorStop(1, pl.colors[2])
      g.fillStyle = body
      g.beginPath(); g.arc(x, cy, s, 0, Math.PI * 2); g.fill()
      if (pl.bands || pl.spots) {
        g.save()
        g.beginPath(); g.arc(x, cy, s, 0, Math.PI * 2); g.clip()
        if (pl.bands) pl.bands.forEach((c, i) => {
          g.globalAlpha = .42
          g.fillStyle = c
          const yy = cy - s + (i + .5) * (2 * s / pl.bands!.length)
          g.fillRect(x - s, yy - s * .09, s * 2, s * (.11 + (i % 2) * .07))
        })
        if (pl.spots) {
          g.globalAlpha = .55; g.fillStyle = pl.spots
          g.beginPath(); g.ellipse(x - s * .2, cy - s * .15, s * .35, s * .22, .5, 0, Math.PI * 2); g.fill()
          g.beginPath(); g.ellipse(x + s * .35, cy + s * .3, s * .22, s * .16, -.3, 0, Math.PI * 2); g.fill()
        }
        /* terminator: night side away from the sun */
        g.globalAlpha = 1
        const night = g.createLinearGradient(x - ux * s, cy, x + ux * s, cy)
        night.addColorStop(0, 'rgba(0,0,0,0)'); night.addColorStop(.55, 'rgba(0,6,4,.15)'); night.addColorStop(1, 'rgba(0,6,4,.7)')
        g.fillStyle = night; g.fillRect(x - s, cy - s, s * 2, s * 2)
        g.restore()
      }
      /* thin atmosphere rim on the lit side */
      g.strokeStyle = 'rgba(255,248,230,.25)'; g.lineWidth = Math.max(.6, s * .06)
      g.beginPath(); g.arc(x, cy, s * .98, Math.atan2(-uy, -ux) - 1, Math.atan2(-uy, -ux) + 1); g.stroke()
      /* depth haze: farther planets take on the colour of the space around them */
      const far = (1 - depth) / 2
      g.fillStyle = `rgba(${pal.depthHaze},${(.1 + far * .32).toFixed(3)})`
      g.beginPath(); g.arc(x, cy, s * 1.01, 0, Math.PI * 2); g.fill()
      ring(true)
      orbiters(index, x, cy, s, true)
    }

    for (const p of placed) if (p.depth < 0) drawPlanet(p)
    /* vignette under the sun's light, so the star never greys out */
    const vig = g.createRadialGradient(W * .45, H * .5, Math.min(W, H) * .4, W * .45, H * .5, Math.max(W, H) * .9)
    vig.addColorStop(0, pal.vignette.replace(/[\d.]+\)$/, '0)')); vig.addColorStop(1, pal.vignette)
    g.fillStyle = vig; g.fillRect(0, 0, W, H)


    /* the sun: corona, then the disc of the star; light spills on the dust */
    g.save()
    g.globalCompositeOperation = pal.glow
    const corona = g.createRadialGradient(sx, sy, sunR * .6, sx, sy, sunR * 7)
    for (const [at, colour] of pal.corona) corona.addColorStop(at, colour)
    g.fillStyle = corona; g.fillRect(0, 0, W, H)
    g.restore()
    const pulse = 1 + Math.sin(time * .0011) * .012
    const sun = g.createRadialGradient(sx + sunR * .15, sy - sunR * .1, sunR * .05, sx, sy, sunR * pulse)
    sun.addColorStop(0, '#ffffff'); sun.addColorStop(.55, '#fff6d8'); sun.addColorStop(.8, '#ffe3a0'); sun.addColorStop(.92, 'rgba(255,206,120,.85)'); sun.addColorStop(1, 'rgba(255,190,100,0)')
    g.fillStyle = sun
    g.beginPath(); g.arc(sx, sy, sunR * pulse, 0, Math.PI * 2); g.fill()
    /* soft limb: a wide glow hides any hard edge */
    const limb = g.createRadialGradient(sx, sy, sunR * .7, sx, sy, sunR * 1.35)
    limb.addColorStop(0, 'rgba(255,246,214,.55)'); limb.addColorStop(.5, 'rgba(255,222,150,.25)'); limb.addColorStop(1, 'rgba(255,200,120,0)')
    g.fillStyle = limb
    g.beginPath(); g.arc(sx, sy, sunR * 1.35, 0, Math.PI * 2); g.fill()
    /* granulation */
    g.save()
    g.beginPath(); g.arc(sx, sy, sunR * pulse, 0, Math.PI * 2); g.clip()
    g.globalAlpha = .12
    const gr = rng(5)
    for (let i = 0; i < 90; i++) {
      const a = gr() * 6.28, r = Math.sqrt(gr()) * sunR
      g.fillStyle = gr() > .5 ? '#ffffff' : '#ffb347'
      g.beginPath(); g.arc(sx + Math.cos(a + time * .00003) * r, sy + Math.sin(a + time * .00003) * r, sunR * (.03 + gr() * .06), 0, 6.28); g.fill()
    }
    g.restore()
    g.save()
    g.globalCompositeOperation = pal.glow
    const flare = g.createRadialGradient(sx, sy, sunR * .9, sx, sy, sunR * 2.2)
    flare.addColorStop(0, 'rgba(255,214,150,.42)'); flare.addColorStop(.4, 'rgba(255,170,90,.14)'); flare.addColorStop(1, 'rgba(255,170,90,0)')
    g.fillStyle = flare
    g.beginPath(); g.arc(sx, sy, sunR * 2.2, 0, 6.28); g.fill()
    /* light streak along the disc plane */
    g.translate(sx, sy); g.rotate(phi); g.scale(1, .06)
    const streak = g.createRadialGradient(0, 0, 0, 0, 0, R * .6)
    streak.addColorStop(0, 'rgba(255,230,180,.4)'); streak.addColorStop(.5, 'rgba(255,230,180,.1)'); streak.addColorStop(1, 'rgba(255,230,180,0)')
    g.fillStyle = streak
    g.beginPath(); g.arc(0, 0, R * .6, 0, 6.28); g.fill()
    g.restore()

    /* the black hole, with whatever it has caught on either side of it */
    hole.drawBack(g, hl, time, dpr)
    for (const it of caughtNow) if (Math.sin(it.th) < 0) drawCaught(it)
    hole.drawFront(g, hl, time, dpr, options.still)
    for (const it of caughtNow) if (Math.sin(it.th) >= 0) drawCaught(it)

    for (const p of placed) if (p.depth >= 0) drawPlanet(p)

    /* near debris: below the disc, closer to the viewer */
    for (const d of debris) {
      const x = ((d.x + d.drift * simTime * 2.2) % 1 + 1) % 1 * W
      const y = d.y * H + Math.sin(d.phase + time * .0004) * 3
      const s = P * d.size
      const tone = Math.round(60 + d.tone * 60)
      g.fillStyle = shade(.4)
      g.beginPath(); g.ellipse(x + s * 2.4, y + s * 2.2, s * 2.4, s * .5, .25, 0, 6.28); g.fill()
      const lit = g.createLinearGradient(x - s, y - s, x + s, y + s)
      lit.addColorStop(0, `rgb(${tone + 80},${tone + 60},${tone + 35})`); lit.addColorStop(1, `rgb(${tone * .3 | 0},${tone * .32 | 0},${tone * .28 | 0})`)
      g.fillStyle = lit
      rockPath(g, x, y, s, d.shape, d.phase)
      g.fill()
    }

  }

  const tick = (now: number) => {
    if (!running) return
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0
    last = now
    simTime += dt
    draw(now)
    frame = requestAnimationFrame(tick)
  }

  const onVisibility = () => {
    if (options.still) return
    if (document.hidden) { cancelAnimationFrame(frame); last = 0 }
    else if (running) frame = requestAnimationFrame(tick)
  }
  const ro = new ResizeObserver(() => { resize(); if (options.still || document.hidden) draw(performance.now()) })
  resize()
  ro.observe(canvas)
  document.addEventListener('visibilitychange', onVisibility)
  if (options.still) draw(performance.now())
  else frame = requestAnimationFrame(tick)

  return () => {
    running = false
    cancelAnimationFrame(frame)
    ro.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
