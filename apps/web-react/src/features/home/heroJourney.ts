/* Home hero "trader journey": drives the legacy .hero-product card through a
 * 13.5 s loop by setting data-stage (styles in public/legacy/style.css):
 *   eval (0–4.2 s, the sparkline draws with a glowing head) → target (ripple,
 *   first timeline tick) → verified (flip to the rules and back) → funded
 *   (brushed mint metal, orbiting light, glint) → reset.
 * Also: pointer tilt and a following specular on fine pointers, and a few
 * mint particles on one small canvas (desktop only). Starts after the page
 * has loaded, runs only while the card is on screen and the tab is visible;
 * reduced motion shows the static Funded frame. Returns a cleanup function. */
const STAGES: [string, number][] = [['eval', 4200], ['target', 1800], ['verified', 3400], ['funded', 3200], ['reset', 900]]
/* sparkline points of the card (viewBox 430×82), for the moving head */
const POINTS = [[0, 68], [20, 63], [42, 67], [60, 52], [80, 58], [100, 43], [122, 49], [145, 36], [165, 44], [186, 28], [205, 38], [225, 20], [245, 30], [265, 22], [285, 29], [308, 12], [330, 22], [350, 9], [370, 17], [390, 4], [410, 11], [430, 3]]

function pointAt(t: number): [number, number] {
  const x = t * 430
  for (let i = 1; i < POINTS.length; i++) if (x <= POINTS[i][0]) {
    const [x0, y0] = POINTS[i - 1], [x1, y1] = POINTS[i], k = (x - x0) / (x1 - x0)
    return [x, y0 + (y1 - y0) * k]
  }
  return [430, 3]
}

export function mountHeroJourney(root: HTMLElement): () => void {
  const card = root.querySelector<HTMLElement>('.hero-account')
  const head = root.querySelector<SVGGElement>('.spark-head')
  if (!card || !head) return () => {}
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) { root.dataset.stage = 'funded'; root.style.setProperty('--spark', '1'); return () => { delete root.dataset.stage } }
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  const desktop = innerWidth >= 768
  let onScreen = false, running = false, stage = 0, stageTimer = 0, frame = 0, stageStart = 0
  const timers: number[] = []

  const setStage = (i: number) => {
    stage = i; stageStart = performance.now()
    root.dataset.stage = STAGES[i][0]
    clearTimeout(stageTimer)
    stageTimer = window.setTimeout(() => setStage((i + 1) % STAGES.length), STAGES[i][1])
  }
  /* sparkline draw during the evaluation stage (transform of the mask wipe + head) */
  const tick = (now: number) => {
    frame = 0
    if (!running) return
    const p = STAGES[stage][0] === 'eval' ? Math.min(1, (now - stageStart) / (STAGES[0][1] - 400)) : STAGES[stage][0] === 'reset' ? 0 : 1
    root.style.setProperty('--spark', p.toFixed(3))
    const [x, y] = pointAt(p)
    head.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
    if (particles) particles()
    frame = requestAnimationFrame(tick)
  }

  /* a few mint particles drifting up from the floor (one small canvas, desktop) */
  let particles: (() => void) | null = null
  let canvas: HTMLCanvasElement | null = null
  if (desktop) {
    canvas = document.createElement('canvas')
    canvas.className = 'hero-particles'; canvas.setAttribute('aria-hidden', 'true')
    root.append(canvas)
    const ctx = canvas.getContext('2d')
    const dots = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100 / 100, y: Math.random(), v: .0006 + (i % 5) * .00025, r: .6 + (i % 3) * .5 }))
    particles = () => {
      if (!ctx || !canvas) return
      const w = canvas.clientWidth, h = canvas.clientHeight
      if (canvas.width !== w) { canvas.width = w; canvas.height = h }
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        d.y -= d.v; if (d.y < 0) d.y = 1
        ctx.globalAlpha = Math.sin(d.y * Math.PI) * .45
        ctx.fillStyle = '#82e7bd'
        ctx.beginPath(); ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  const start = () => {
    if (running) return
    running = true; setStage(stage); frame = requestAnimationFrame(tick)
  }
  const stop = () => { running = false; clearTimeout(stageTimer); cancelAnimationFrame(frame); frame = 0 }
  const sync = () => (onScreen && !document.hidden ? start() : stop())
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync() }, { rootMargin: '40px' })
  /* motion starts after load so the hero text paints first */
  const begin = () => { io.observe(root); document.addEventListener('visibilitychange', sync) }
  if (document.readyState === 'complete') timers.push(window.setTimeout(begin, 300))
  else addEventListener('load', () => timers.push(window.setTimeout(begin, 300)), { once: true })

  /* pointer tilt with a following specular (fine pointers only) */
  let tiltFrame = 0, tx = 0, ty = 0
  const move = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2)) * 6
    ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2)) * -5
    if (!tiltFrame) tiltFrame = requestAnimationFrame(() => { tiltFrame = 0; root.style.setProperty('--tx', tx.toFixed(2)); root.style.setProperty('--ty', ty.toFixed(2)) })
  }
  const leave = () => { root.style.setProperty('--tx', '0'); root.style.setProperty('--ty', '0') }
  if (fine) { root.addEventListener('pointermove', move, { passive: true }); root.addEventListener('pointerleave', leave) }

  return () => {
    stop(); io.disconnect(); timers.forEach(clearTimeout); cancelAnimationFrame(tiltFrame)
    document.removeEventListener('visibilitychange', sync)
    root.removeEventListener('pointermove', move); root.removeEventListener('pointerleave', leave)
    canvas?.remove(); delete root.dataset.stage
  }
}
