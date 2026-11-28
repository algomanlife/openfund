/* Openfund gateway scene: a miniature solar system on a dusty orbital disc,
 * seen from a low oblique angle, in the Openfund green palette.
 *
 * Original procedural drawing (no images): the disc is a top-down dust
 * texture rendered once and projected every frame (rotate, then squash),
 * the planets are shaded spheres with shadows cast across the disc, and the
 * miniature (tilt-shift) look comes from CSS blur bands over the canvas.
 * Canvas 2D only; no dependencies. Pauses while the tab is hidden; a single
 * still frame under prefers-reduced-motion. */

export interface SolarSceneOptions {
  /** draw one frame and stop (reduced motion) */
  still?: boolean
  /** site theme: deep green space, or a pale mint sky for the light theme */
  theme?: 'dark' | 'light'
  /** seconds of simulated time before the first frame (positions planets) */
  startAt?: number
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
   angle moves toward the viewer. Planets start loosely lined up, like a
   portrait of the system, and drift apart with their own periods. */
const PLANETS: Planet[] = [
  { orbit: .19, size: .0075, phase: -.3, colors: ['#d9d2c6', '#9a9085', '#3b352f'] },
  { orbit: .245, size: .0115, phase: .2, colors: ['#fff0c8', '#e0b878', '#6d4f25'] },
  { orbit: .305, size: .0125, phase: .42, colors: ['#bfe8ff', '#3f8fd0', '#123257'], spots: '#5fae6a' },
  { orbit: .365, size: .0095, phase: -.1, colors: ['#ffc7a3', '#c8643a', '#4f1e10'] },
  { orbit: .55, size: .042, phase: .02, colors: ['#fff1dc', '#d9b48c', '#5b3d22'], bands: ['#b5835a', '#efd8b8', '#a06f48', '#f4e2c6', '#c79a72'] },
  { orbit: .69, size: .034, phase: .03, colors: ['#fff3d6', '#dcbf8a', '#5e4624'], bands: ['#c9a46c', '#f1deb4', '#b8915c'], ring: true },
  { orbit: .83, size: .019, phase: .04, colors: ['#e6fbff', '#8fd3df', '#24545e'] },
  { orbit: .955, size: .0185, phase: .05, colors: ['#cfe3ff', '#3f6fd6', '#13255c'] },
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
  },
  light: {
    warm: [176, 132, 74], sage: [74, 140, 110], grain: [40, 110, 80],
    base: [[0, 'rgba(255,214,150,.9)'], [.1, 'rgba(226,190,132,.6)'], [.26, 'rgba(190,170,126,.36)'], [.5, 'rgba(132,170,144,.2)'], [.78, 'rgba(96,160,128,.09)'], [1, 'rgba(96,160,128,0)']],
    lane: 'rgba(255,255,255,.22)',
    sky: [[0, '#fff4df'], [.2, '#f3f9f3'], [.55, '#e4f2ea'], [1, '#cfe6da']],
    haze: .05, stars: 0, shade: '28,64,48', shadeAlpha: .55, glow: 'source-over',
    corona: [[0, 'rgba(255,200,120,.55)'], [.15, 'rgba(255,190,110,.25)'], [.4, 'rgba(255,214,160,.08)'], [1, 'rgba(255,230,190,0)']],
    vignette: 'rgba(196,224,210,.45)',
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

interface Rock { r: number; a: number; size: number; shape: number[]; tone: number; speed: number }
function makeRocks(): Rock[] {
  const rand = rng(77), rocks: Rock[] = []
  const add = (rMin: number, rMax: number, n: number, sMin: number, sMax: number) => {
    for (let i = 0; i < n; i++) {
      const pts = 6 + Math.floor(rand() * 4), shape: number[] = []
      for (let k = 0; k < pts; k++) shape.push(.65 + rand() * .45)
      const r = rMin + rand() * (rMax - rMin)
      rocks.push({ r, a: rand() * Math.PI * 2, size: sMin + rand() * (sMax - sMin), shape, tone: rand(), speed: .9 + rand() * .2 })
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

  let W = 0, H = 0, dpr = 1, frame = 0, last = 0, running = true
  let simTime = options.startAt ?? 0

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2)
    W = Math.max(1, rect.width); H = Math.max(1, rect.height)
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
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
    g.translate(sx, sy); g.rotate(phi); g.scale(1, k); g.rotate(simTime * .006)
    g.globalAlpha = .95
    g.drawImage(disc, -R, -R, R * 2, R * 2)
    g.rotate(-simTime * .003) /* a second, slower pass: differential swirl */
    g.globalAlpha = .35
    g.drawImage(disc, -R * .62, -R * .62, R * 1.24, R * 1.24)
    g.restore()
    g.globalAlpha = 1

    /* rocks on the disc, with short shadows */
    for (const rock of rocks) {
      const a = rock.a + simTime * .012 * rock.speed / Math.pow(rock.r, 1.5)
      const p = project(R * rock.r, a)
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue
      const s = P * rock.size * (1 + p.depth * .25)
      const dx = p.x - sx, dy = p.y - sy, d = Math.hypot(dx, dy) || 1
      g.fillStyle = shade(.35)
      g.beginPath(); g.ellipse(p.x + dx / d * s * 2.2, p.y + s * .7 + dy / d * s * .5, s * 2.6, s * .55, Math.atan2(dy * .4, dx), 0, Math.PI * 2); g.fill()
      const tone = Math.round(70 + rock.tone * 70)
      const lit = g.createLinearGradient(p.x - dx / d * s, p.y - dy / d * s, p.x + dx / d * s, p.y + dy / d * s)
      lit.addColorStop(0, `rgb(${tone + 90},${tone + 70},${tone + 40})`); lit.addColorStop(1, `rgb(${tone * .35 | 0},${tone * .35 | 0},${tone * .3 | 0})`)
      g.fillStyle = lit
      rockPath(g, p.x, p.y - s * .4, s, rock.shape, rock.a)
      g.fill()
    }

    /* planets: back ones first, the sun, then the near ones */
    const placed = PLANETS.map(pl => {
      const a = pl.phase + simTime * .016 / Math.pow(pl.orbit, 1.5)
      const p = project(R * pl.orbit, a)
      return { pl, ...p, s: P * pl.size * (1 + p.depth * .22) }
    }).sort((a, b) => a.depth - b.depth)

    const drawPlanet = ({ pl, x, y, s }: typeof placed[number]) => {
      if (x < -s * 4 || x > W + s * 4) return
      const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy) || 1
      const ux = dx / d, uy = dy / d
      const lift = s * 1.15  // the planet floats above the disc
      /* shadow cast across the disc, away from the sun */
      const len = s * (4.5 + pl.orbit * 4)
      g.save()
      g.translate(x + ux * s * .6, y + lift * .9)
      g.rotate(Math.atan2(uy * k * 1.6, ux))
      const sh = g.createLinearGradient(0, 0, len, 0)
      sh.addColorStop(0, shade(.5)); sh.addColorStop(.5, shade(.2)); sh.addColorStop(1, shade(0))
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
      ring(true)
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

    for (const p of placed) if (p.depth >= 0) drawPlanet(p)

    /* near debris: below the disc, closer to the viewer */
    for (const d of debris) {
      const x = ((d.x + d.drift * simTime * .2) % 1 + 1) % 1 * W
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
