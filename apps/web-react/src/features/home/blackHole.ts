/* Openfund gateway: a fixed black hole between the hero copy and the actions.
 *
 * Original procedural drawing (no images apart from the Openfund mark):
 * a thin accretion disc seen almost edge-on, the far side of the disc bent
 * over and under the shadow by gravitational lensing, a photon ring at the
 * shadow's edge and a throat that fades into depth, with the Openfund mark
 * dimly visible at the bottom. The side of the disc turning toward the viewer
 * is brighter (Doppler beaming). Canvas 2D only. */

export interface BlackHoleLayout {
  x: number      // centre, CSS px
  y: number
  rh: number     // shadow radius, CSS px
  roll: number   // disc roll (rad), the scene's own roll
  k: number      // disc squash (viewing angle)
}

/* the disc's inner edge, outer edge and the lensed ring, in shadow radii */
export const DISC_IN = 1.55
export const DISC_OUT = 4.4
const RING_IN = 1.04
const RING_OUT = 1.6

function rng(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/** top-down accretion disc: white-hot at the inner edge, amber, then a faint
 *  mint rim that dissolves into the scene; streaked by differential rotation */
function paintAccretion(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const R = size / 2, inner = R * DISC_IN / DISC_OUT, rand = rng(1915)
  g.translate(R, R)
  const base = g.createRadialGradient(0, 0, inner * .96, 0, 0, R)
  base.addColorStop(0, 'rgba(255,255,255,0)')
  base.addColorStop(.02, 'rgba(255,250,236,.9)')
  base.addColorStop(.1, 'rgba(255,226,170,.68)')
  base.addColorStop(.28, 'rgba(250,176,96,.4)')
  base.addColorStop(.55, 'rgba(206,142,84,.16)')
  base.addColorStop(.8, 'rgba(130,231,189,.08)')
  base.addColorStop(1, 'rgba(130,231,189,0)')
  g.fillStyle = base
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.arc(0, 0, inner * .96, 0, Math.PI * 2, true); g.fill('evenodd')
  /* streaks: hot and thin near the edge, cooler and wider outside */
  g.lineCap = 'round'
  for (let i = 0; i < 1500; i++) {
    const t = Math.pow(rand(), 1.6), r = inner + (R - inner) * t
    const a0 = rand() * Math.PI * 2, len = .3 + rand() * 1.4
    const hot = 1 - t
    const col = hot > .7 ? '255,246,226' : hot > .4 ? '255,214,150' : '232,170,110'
    g.strokeStyle = `rgba(${col},${((.04 + rand() * .2) * (.25 + hot)).toFixed(3)})`
    g.lineWidth = (.4 + rand() * 2.2) * size / 1024
    g.beginPath(); g.arc(0, 0, r, a0, a0 + len); g.stroke()
  }
  /* darker lanes give the gas its texture */
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 260; i++) {
    const r = inner + (R - inner) * Math.pow(rand(), 1.2), a0 = rand() * Math.PI * 2
    g.strokeStyle = `rgba(0,0,0,${(.12 + rand() * .3).toFixed(3)})`
    g.lineWidth = (.6 + rand() * 2.5) * size / 1024
    g.beginPath(); g.arc(0, 0, r, a0, a0 + .4 + rand() * 1.6); g.stroke()
  }
  return c
}

export class BlackHole {
  private disc = paintAccretion(768)
  private layer = document.createElement('canvas')
  private lg = this.layer.getContext('2d')!
  /* bloom: the layer shrunk to a quarter and scaled back up blurs it for
     free (no per-frame filters, which are slow without a GPU) */
  private small = document.createElement('canvas')
  private sg = this.small.getContext('2d')!
  /* the mark, blurred once at the size it is drawn */
  private mark: HTMLCanvasElement | null = null
  private markSize = 0
  private logo: HTMLImageElement | null = null
  private saved = false

  constructor(private glow: GlobalCompositeOperation, logoSrc?: string) {
    if (logoSrc) { const img = new Image(); img.decoding = 'async'; img.src = logoSrc; this.logo = img }
  }

  /** a layer the size of the black hole's light, in device pixels */
  private prepare(l: BlackHoleLayout, dpr: number) {
    const w = Math.ceil(l.rh * DISC_OUT * 2.2 * dpr), h = Math.ceil(l.rh * RING_OUT * 2.4 * dpr)
    if (this.layer.width !== w || this.layer.height !== h) { this.layer.width = w; this.layer.height = h }
    const g = this.lg
    /* every pass starts clean: no clip, transform or blending left from the last one */
    if (this.saved) g.restore()
    g.save(); this.saved = true
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'
    g.clearRect(0, 0, w, h)
    g.setTransform(dpr, 0, 0, dpr, w / 2, h / 2)
    return g
  }

  /* the disc texture, turning: two passes at different rates (inner gas is faster) */
  private spinDisc(g: CanvasRenderingContext2D, l: BlackHoleLayout, spin: number, scale = 1, inner = true) {
    const D = l.rh * DISC_OUT * scale
    g.save(); g.rotate(spin); g.drawImage(this.disc, -D, -D, D * 2, D * 2); g.restore()
    if (!inner) return
    g.save(); g.globalAlpha *= .55; g.rotate(spin * 1.7 + 1.3); g.drawImage(this.disc, -D * .8, -D * .8, D * 1.6, D * 1.6); g.restore()
  }

  /* the approaching side (screen right) is brighter, the receding side dimmer */
  private doppler(g: CanvasRenderingContext2D, l: BlackHoleLayout) {
    const span = l.rh * DISC_OUT
    g.save()
    g.globalCompositeOperation = 'source-atop'
    const d = g.createLinearGradient(-span, 0, span, 0)
    d.addColorStop(0, 'rgba(8,10,8,.4)'); d.addColorStop(.45, 'rgba(0,0,0,0)'); d.addColorStop(1, 'rgba(255,248,230,.35)')
    g.fillStyle = d; g.fillRect(-span, -span, span * 2, span * 2)
    g.restore()
  }

  /** composite the layer, with a soft bloom, onto the scene */
  private flush(g: CanvasRenderingContext2D, l: BlackHoleLayout, dpr: number, alpha = 1, bloom = .45) {
    const w = this.layer.width / dpr, h = this.layer.height / dpr
    const sw = Math.max(1, Math.round(this.layer.width / 6)), sh = Math.max(1, Math.round(this.layer.height / 6))
    if (this.small.width !== sw || this.small.height !== sh) { this.small.width = sw; this.small.height = sh }
    this.sg.clearRect(0, 0, sw, sh)
    this.sg.imageSmoothingQuality = 'high'
    this.sg.drawImage(this.layer, 0, 0, sw, sh)
    g.save()
    g.globalCompositeOperation = this.glow
    g.globalAlpha = alpha * bloom
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
    g.drawImage(this.small, l.x - w / 2 - 2, l.y - h / 2 - 2, w + 4, h + 4)
    g.globalAlpha = alpha
    g.drawImage(this.layer, l.x - w / 2, l.y - h / 2, w, h)
    g.restore()
  }

  /** behind the shadow: the far half of the disc and its lensed image
   *  (the arc over the top and the thinner one underneath) */
  drawBack(g: CanvasRenderingContext2D, l: BlackHoleLayout, time: number, dpr: number) {
    dpr = Math.min(dpr, 1.5) /* the glow is soft: no need for full retina resolution */
    const spin = time * .00042
    /* gravity darkens and bends the space around it */
    /* (on the pale light theme only a trace, or it reads as a grey smudge) */
    /* lying in the system's plane like the disc itself, never a round halo */
    const dark = this.glow === 'lighter', reach = dark ? 6 : 4, dimA = dark ? .8 : .25
    g.save()
    g.translate(l.x, l.y); g.rotate(l.roll); g.scale(1, l.k)
    const dim = g.createRadialGradient(0, 0, l.rh, 0, 0, l.rh * reach)
    dim.addColorStop(0, `rgba(0,4,2,${(.5 * dimA).toFixed(3)})`); dim.addColorStop(.4, `rgba(0,4,2,${(.2 * dimA).toFixed(3)})`); dim.addColorStop(1, 'rgba(0,4,2,0)')
    g.fillStyle = dim
    g.beginPath(); g.arc(0, 0, l.rh * reach, 0, Math.PI * 2); g.fill()
    g.restore()

    /* far half of the flat disc */
    let c = this.prepare(l, dpr)
    c.rotate(l.roll)
    c.beginPath(); c.rect(-l.rh * DISC_OUT * 1.1, -l.rh * 3, l.rh * DISC_OUT * 2.2, l.rh * 3); c.clip()
    c.scale(1, l.k)
    this.spinDisc(c, l, spin)
    c.setTransform(dpr, 0, 0, dpr, this.layer.width / 2, this.layer.height / 2)
    this.doppler(c, l)
    this.flush(g, l, dpr, .9)

    /* lensed image of the far disc: a ring hugging the shadow, strong on
       top, thinner underneath */
    c = this.prepare(l, dpr)
    c.rotate(l.roll)
    c.beginPath(); c.arc(0, 0, l.rh * RING_OUT, 0, Math.PI * 2); c.arc(0, 0, l.rh * RING_IN, 0, Math.PI * 2, true); c.clip('evenodd')
    this.spinDisc(c, l, -spin * 1.2, RING_IN / (DISC_IN / DISC_OUT) / DISC_OUT * 1.02, false)
    c.globalCompositeOperation = 'destination-in'
    const fall = c.createRadialGradient(0, 0, l.rh * RING_IN, 0, 0, l.rh * RING_OUT)
    fall.addColorStop(0, 'rgba(0,0,0,1)'); fall.addColorStop(.25, 'rgba(0,0,0,.65)'); fall.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = fall; c.fillRect(-l.rh * 3, -l.rh * 3, l.rh * 6, l.rh * 6)
    const vert = c.createLinearGradient(0, -l.rh * RING_OUT, 0, l.rh * RING_OUT)
    vert.addColorStop(0, 'rgba(0,0,0,1)'); vert.addColorStop(.5, 'rgba(0,0,0,.85)'); vert.addColorStop(1, 'rgba(0,0,0,.42)')
    c.fillStyle = vert; c.fillRect(-l.rh * 3, -l.rh * 3, l.rh * 6, l.rh * 6)
    c.globalCompositeOperation = 'source-over'
    this.doppler(c, l)
    this.flush(g, l, dpr, .95, .15)
  }

  /** the shadow, the throat fading into depth with the mark at its bottom,
   *  the photon ring, then the near half of the disc crossing in front */
  drawFront(g: CanvasRenderingContext2D, l: BlackHoleLayout, time: number, dpr: number, still = false) {
    dpr = Math.min(dpr, 1.5)
    const { x, y, rh } = l
    /* shadow with a soft edge */
    const sh = g.createRadialGradient(x, y, rh * .2, x, y, rh * 1.08)
    sh.addColorStop(0, '#000000'); sh.addColorStop(.86, '#000201'); sh.addColorStop(.93, 'rgba(0,3,2,.96)'); sh.addColorStop(1, 'rgba(0,3,2,0)')
    g.fillStyle = sh
    g.beginPath(); g.arc(x, y, rh * 1.08, 0, Math.PI * 2); g.fill()

    /* the throat: faint spiral arms winding inward and fading out */
    g.save()
    g.beginPath(); g.arc(x, y, rh * .98, 0, Math.PI * 2); g.clip()
    const turn = still ? 0 : time * .0005
    g.lineCap = 'round'
    for (let arm = 0; arm < 5; arm++) {
      g.beginPath()
      for (let s = 0; s <= 40; s++) {
        const t = s / 40, r = rh * .95 * (1 - t) ** 1.4
        const a = turn + arm * Math.PI * 2 / 5 + t * 5.2
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * .9
        s ? g.lineTo(px, py) : g.moveTo(px, py)
      }
      g.strokeStyle = `rgba(130,231,189,${(.05 + .025 * Math.sin(time * .001 + arm)).toFixed(3)})`
      g.lineWidth = Math.max(.6, rh * .035)
      g.stroke()
    }
    /* the Openfund mark at the bottom of the throat, out of focus */
    if (this.logo && this.logo.complete && this.logo.naturalWidth) {
      const h = rh * .78, w = h * this.logo.naturalWidth / this.logo.naturalHeight
      const px = Math.round(h * dpr)
      if (!this.mark || this.markSize !== px) {
        const pad = Math.ceil(px * .1), m = document.createElement('canvas')
        m.width = Math.round(w * dpr) + pad * 2; m.height = px + pad * 2
        const mg = m.getContext('2d')!
        mg.filter = `blur(${Math.max(.6, rh * .028 * dpr).toFixed(1)}px)`
        mg.drawImage(this.logo, pad, pad, m.width - pad * 2, px)
        this.mark = m; this.markSize = px
      }
      const mw = this.mark.width / dpr, mh = this.mark.height / dpr
      g.globalAlpha = .26 + (still ? 0 : .08 * Math.sin(time * .0009))
      g.drawImage(this.mark, x - mw / 2, y - mh / 2, mw, mh)
      g.globalAlpha = 1
    }
    /* depth: everything dissolves toward the centre */
    const deep = g.createRadialGradient(x, y, 0, x, y, rh)
    deep.addColorStop(0, 'rgba(0,0,0,.2)'); deep.addColorStop(.55, 'rgba(0,0,0,.1)'); deep.addColorStop(.85, 'rgba(0,0,0,.55)'); deep.addColorStop(1, 'rgba(0,0,0,.95)')
    g.fillStyle = deep; g.fillRect(x - rh, y - rh, rh * 2, rh * 2)
    g.restore()

    /* photon ring: a hairline of light at the edge, brighter on the approaching side */
    g.save()
    g.globalCompositeOperation = this.glow
    const pr = g.createLinearGradient(x - rh, y, x + rh, y)
    pr.addColorStop(0, 'rgba(255,190,120,.35)'); pr.addColorStop(1, 'rgba(255,250,236,.95)')
    g.strokeStyle = pr
    g.lineWidth = Math.max(.8, rh * .035)
    g.beginPath(); g.arc(x, y, rh * 1.015, 0, Math.PI * 2); g.stroke()
    g.restore()

    /* near half of the disc, crossing in front of the shadow */
    const c = this.prepare(l, dpr)
    c.rotate(l.roll)
    c.beginPath(); c.rect(-rh * DISC_OUT * 1.1, 0, rh * DISC_OUT * 2.2, rh * 3); c.clip()
    c.scale(1, l.k)
    /* the near side: one thin bright band across the shadow */
    this.spinDisc(c, l, time * .00042, 1, false)
    c.setTransform(dpr, 0, 0, dpr, this.layer.width / 2, this.layer.height / 2)
    this.doppler(c, l)
    this.flush(g, l, dpr, .88)
  }
}
