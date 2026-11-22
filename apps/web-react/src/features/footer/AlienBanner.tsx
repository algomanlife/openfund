import { useEffect, useRef, useState, type ReactNode } from 'react'
import './alien-banner.css'

/** Footer banner: an original illustrated scene — a slender grey alien, seen
 *  from behind, at a trading desk facing six monitors in two rows; the
 *  Openfund mark glows as a patch on the chair back; mint and teal rim light
 *  and haze in a dark room. DECORATIVE ONLY (aria-hidden, no text for
 *  assistive technology). The screens show illustrative motion (scrolling
 *  candles, a symbol ticker without prices, depth bars, a heat grid) and one
 *  real Open Trade capture from public/assets/apps/open-trade/.
 *
 *  Layers (one 2100×900 = 21:9 coordinate frame):
 *    1. room   — the illustrated SVG room, desk, chair and alien, OR a raster
 *                artwork when ROOM_ART is set (see below);
 *    2. screens — the animated monitor content, drawn into SCREENS rects;
 *    3. haze   — glow and haze that breathe and drift with scroll.
 *
 *  RASTER SWAP (one asset path): to replace the illustrated room with
 *  generated artwork, export it at 21:9 with the six monitor screens flat
 *  black, save it as public/assets/footer/alien-trader-room.webp (plus -1280
 *  and -2560 widths for srcset) and set ROOM_ART.src to that path. Adjust the
 *  SCREENS rects so the animated content sits on the artwork's screens. The
 *  image-generation prompt is in the PR that added this banner and in
 *  docs/website/FOOTER_BANNER.md. Until then ROOM_ART is null and the SVG room
 *  is used (no raster is downloaded). */
export const ROOM_ART: { src: string; widths: number[] } | null = null

const W = 2100, H = 900
type Rect = { x: number; y: number; w: number; h: number; skew?: number }
/** monitor screens in the 21:9 frame; skew turns the side monitors toward the desk */
export const SCREENS: Record<'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br', Rect> = {
  tl: { x: 318, y: 132, w: 452, h: 236, skew: 4 },
  tc: { x: 806, y: 104, w: 488, h: 282 },
  tr: { x: 1330, y: 132, w: 452, h: 236, skew: -4 },
  bl: { x: 330, y: 404, w: 440, h: 214, skew: 4 },
  bc: { x: 818, y: 410, w: 464, h: 224 },
  br: { x: 1330, y: 404, w: 440, h: 214, skew: -4 },
}
const base = import.meta.env.BASE_URL
const CAPTURE = `${base}assets/apps/open-trade/chart.webp`
const MARK = `${base}assets/mark-mint.svg`

/* deterministic pseudo-random series (same picture on every load) */
function series(seed: number, n: number) {
  let s = seed, v = 0.5
  const out: number[] = []
  for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; v = Math.min(0.92, Math.max(0.08, v + ((s / 2147483647) - 0.47) * 0.16)); out.push(v) }
  return out
}
const CANDLES = series(7, 36)
const LINE = series(19, 48)
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'EUR/USD', 'XAU/USD', 'NAS100', 'GBP/USD', 'ARB', 'LINK', 'USD/JPY']
const TICKS = SYMBOLS.map((_, i) => i % 3 !== 1)

/** skewed monitor group: bezel, clipped screen, stand */
function Monitor({ id, r, children }: { id: string; r: Rect; children: ReactNode }) {
  const t = r.skew ? `translate(${r.x + (r.skew > 0 ? r.w : 0)} ${r.y}) skewY(${r.skew}) translate(${-(r.skew > 0 ? r.w : 0)} 0)` : `translate(${r.x} ${r.y})`
  return <g transform={t} className="ab-monitor">
    <rect className="ab-bezel" x={-9} y={-9} width={r.w + 18} height={r.h + 18} rx={10} />
    <clipPath id={`ab-clip-${id}`}><rect width={r.w} height={r.h} rx={4} /></clipPath>
    <rect className="ab-screen" width={r.w} height={r.h} rx={4} />
    <g clipPath={`url(#ab-clip-${id})`}>{children}<rect className="ab-glass" width={r.w} height={r.h} /></g>
  </g>
}

function Candles({ r }: { r: Rect }) {
  const step = r.w / 18, body = step * 0.46
  const one = CANDLES.map((v, i) => {
    const prev = CANDLES[i - 1] ?? v, up = v >= prev
    const o = (1 - prev) * r.h * 0.8 + r.h * 0.1, c = (1 - v) * r.h * 0.8 + r.h * 0.1
    const hi = Math.min(o, c) - 6 - (i % 3) * 4, lo = Math.max(o, c) + 5 + (i % 4) * 3
    const x = i * step + step / 2
    return <g key={i} className={up ? 'ab-up' : 'ab-down'}>
      <path d={`M${x} ${hi}V${lo}`} />
      <rect x={x - body / 2} y={Math.min(o, c)} width={body} height={Math.max(2, Math.abs(c - o))} />
    </g>
  })
  return <>
    <g className="ab-grid">{[1, 2, 3, 4].map(i => <path key={i} d={`M0 ${(r.h / 5) * i}H${r.w}`} />)}</g>
    {/* two copies side by side: the strip scrolls by exactly one copy */}
    <g className="ab-scroll" style={{ ['--ab-shift' as string]: `${-CANDLES.length * step}px` }}>
      {one}<g transform={`translate(${CANDLES.length * step} 0)`}>{one}</g>
    </g>
  </>
}

function Line({ r }: { r: Rect }) {
  const step = r.w / 24
  const pts = LINE.map((v, i) => `${(i * step).toFixed(1)},${((1 - v) * r.h * 0.7 + r.h * 0.18).toFixed(1)}`)
  const d = `M${pts.join('L')}`, len = LINE.length * step
  return <>
    <g className="ab-grid">{[1, 2, 3].map(i => <path key={i} d={`M${(r.w / 4) * i} 0V${r.h}`} />)}</g>
    <g className="ab-scroll is-slow" style={{ ['--ab-shift' as string]: `${-len}px` }}>
      {[0, len].map(o => <g key={o} transform={`translate(${o} 0)`}>
        <path className="ab-area" d={`${d}L${len - step},${r.h}L0,${r.h}Z`} />
        <path className="ab-line" d={d} />
      </g>)}
    </g>
  </>
}

function Ticker({ r }: { r: Rect }) {
  const rowH = r.h / 5
  const rows = SYMBOLS.map((s, i) => <g key={s} transform={`translate(0 ${i * rowH})`} className={TICKS[i] ? 'ab-up' : 'ab-down'}>
    <text x={22} y={rowH * 0.62} className="ab-sym">{s}</text>
    <path className="ab-tri" d={TICKS[i] ? `M${r.w - 40} ${rowH * 0.62}l8 -12 8 12z` : `M${r.w - 40} ${rowH * 0.4}l8 12 8 -12z`} />
    {series(41 + i, 8).map((v, k) => <rect key={k} className="ab-mini" x={r.w * 0.45 + k * 16} y={rowH * (0.75 - v * 0.5)} width={9} height={rowH * v * 0.5} />)}
    <path className="ab-row" d={`M14 ${rowH - 1}H${r.w - 14}`} />
  </g>)
  return <g className="ab-roll" style={{ ['--ab-shift' as string]: `${-SYMBOLS.length * rowH}px` }}>
    {rows}<g transform={`translate(0 ${SYMBOLS.length * rowH})`}>{rows}</g>
  </g>
}

function Depth({ r }: { r: Rect }) {
  const n = 9, rowH = r.h / (n + 1)
  return <>{Array.from({ length: n }, (_, i) => <g key={i}>
    <rect className="ab-bid" x={r.w / 2 - 4} y={rowH * (i + 0.6)} width={r.w * (0.1 + 0.035 * i)} height={rowH * 0.62} transform={`scale(-1 1) translate(${-r.w + 8} 0)`} style={{ animationDelay: `${-i * 0.7}s` }} />
    <rect className="ab-ask" x={r.w / 2 + 4} y={rowH * (i + 0.6)} width={r.w * (0.38 - 0.03 * i)} height={rowH * 0.62} style={{ animationDelay: `${-i * 0.9 - 0.3}s` }} />
  </g>)}<path className="ab-mid" d={`M${r.w / 2} 0V${r.h}`} /></>
}

function Heat({ r }: { r: Rect }) {
  const cols = 8, rows = 5, cw = r.w / cols, ch = r.h / rows
  const v = series(57, cols * rows)
  return <>{v.map((x, i) => <rect key={i} className={x > 0.5 ? 'ab-heat is-up' : 'ab-heat is-down'} x={(i % cols) * cw + 3} y={Math.floor(i / cols) * ch + 3} width={cw - 6} height={ch - 6} rx={3}
    style={{ opacity: 0.25 + Math.abs(x - 0.5) * 1.2, animationDelay: `${-(i * 0.37) % 6}s` }} />)}</>
}

function useLive<T extends Element>() {
  const ref = useRef<T>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return
    let on = false, raf = 0
    const scene = el.querySelector<HTMLElement>('.ab-scene'), haze = el.querySelector<HTMLElement>('.ab-haze')
    /* light scroll parallax: scene and haze drift apart by a few pixels */
    const parallax = () => {
      raf = 0
      const b = el.getBoundingClientRect(), p = Math.max(-1, Math.min(1, (b.top + b.height / 2 - innerHeight / 2) / innerHeight))
      scene?.style.setProperty('transform', `translate3d(0, ${(p * 18).toFixed(1)}px, 0) scale(1.04)`)
      haze?.style.setProperty('transform', `translate3d(0, ${(p * -30).toFixed(1)}px, 0)`)
    }
    const onScroll = () => { if (on && !raf) raf = requestAnimationFrame(parallax) }
    const sync = () => { setLive(on && !document.hidden); if (on) onScroll() }
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; sync() })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    addEventListener('scroll', onScroll, { passive: true })
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])
  return [ref, live] as const
}

export default function AlienBanner() {
  const [ref, live] = useLive<HTMLDivElement>()
  const S = SCREENS
  /* chair and head centre */
  const cx = 1050
  return <div ref={ref} className={`ab-root${live ? ' is-live' : ''}`} data-live={live ? 'true' : 'false'}>
    <div className="ab-scene">
      {ROOM_ART
        ? <img className="ab-room-art" src={ROOM_ART.src} srcSet={ROOM_ART.widths.map(w => `${ROOM_ART.src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`).join(', ')}
            sizes="100vw" alt="" loading="lazy" decoding="async" />
        : null}
      <svg className="ab-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="ab-wall" cx="50%" cy="38%" r="62%"><stop offset="0" stopColor="#82e7bd" stopOpacity=".2" /><stop offset=".45" stopColor="#4fb8a8" stopOpacity=".07" /><stop offset="1" stopColor="#040706" stopOpacity="0" /></radialGradient>
          <linearGradient id="ab-desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16211e" /><stop offset=".18" stopColor="#0a100e" /><stop offset="1" stopColor="#030504" /></linearGradient>
          <linearGradient id="ab-deskedge" x1="0" x2="1"><stop offset="0" stopColor="#82e7bd" stopOpacity="0" /><stop offset=".5" stopColor="#82e7bd" stopOpacity=".75" /><stop offset="1" stopColor="#82e7bd" stopOpacity="0" /></linearGradient>
          <linearGradient id="ab-chair" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#050706" /><stop offset=".35" stopColor="#141a18" /><stop offset=".5" stopColor="#1b2421" /><stop offset=".65" stopColor="#141a18" /><stop offset="1" stopColor="#050706" /></linearGradient>
          <radialGradient id="ab-head" cx="50%" cy="58%" r="60%"><stop offset="0" stopColor="#1a1f20" /><stop offset=".72" stopColor="#2c3335" /><stop offset="1" stopColor="#5d6a6a" /></radialGradient>
          <linearGradient id="ab-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8f5da" /><stop offset=".5" stopColor="#82e7bd" stopOpacity=".7" /><stop offset="1" stopColor="#4fb8a8" stopOpacity="0" /></linearGradient>
          <radialGradient id="ab-patch" r="50%"><stop offset="0" stopColor="#82e7bd" stopOpacity=".55" /><stop offset="1" stopColor="#82e7bd" stopOpacity="0" /></radialGradient>
          <linearGradient id="ab-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#82e7bd" stopOpacity=".16" /><stop offset="1" stopColor="#82e7bd" stopOpacity="0" /></linearGradient>
        </defs>

        {!ROOM_ART && <g className="ab-room">
          <rect width={W} height={H} fill="#040706" />
          <rect className="ab-wallglow" width={W} height={H} fill="url(#ab-wall)" />
          {/* wall panels */}
          <g className="ab-panels">{Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${120 + i * 186} 0V700`} />)}</g>
          {/* monitor arms down to the desk */}
          <g className="ab-arms"><path d="M560 640V368M1050 640V388M1540 640V368" /></g>
        </g>}

        {/* 2: screens (always drawn; on a raster room they overlay its black screens) */}
        <g className="ab-screens">
          <Monitor id="tl" r={S.tl}><Candles r={S.tl} /></Monitor>
          <Monitor id="tc" r={S.tc}>
            <image href={CAPTURE} width={S.tc.w} height={S.tc.h} preserveAspectRatio="xMidYMid slice" className="ab-capture" />
            <rect className="ab-scan" width={S.tc.w} height={S.tc.h * 0.18} />
          </Monitor>
          <Monitor id="tr" r={S.tr}><Line r={S.tr} /></Monitor>
          <Monitor id="bl" r={S.bl}><Ticker r={S.bl} /></Monitor>
          <Monitor id="bc" r={S.bc}><Depth r={S.bc} /></Monitor>
          <Monitor id="br" r={S.br}><Heat r={S.br} /></Monitor>
        </g>

        {!ROOM_ART && <g className="ab-front">
          {/* light falling from the screens onto the desk */}
          <path className="ab-beam" d="M300 640L120 900H1980L1800 640Z" fill="url(#ab-beam)" />
          {/* desk */}
          <path d="M150 652H1950L2060 742H40Z" fill="url(#ab-desk)" />
          <path d="M40 742H2060V770H40Z" fill="#020303" />
          <path className="ab-deskedge" d="M150 652H1950" stroke="url(#ab-deskedge)" />
          {/* keyboard and mouse silhouettes */}
          <path d="M880 674H1220L1236 702H864Z" fill="#0d1412" />
          <path className="ab-keys" d="M890 684H1210M884 692H1218" />
          <rect x="1290" y="680" width="30" height="20" rx="10" fill="#0d1412" />
          {/* slender arm reaching the mouse */}
          <path className="ab-arm" d="M1196 744C1236 724 1268 706 1296 692" />
          <path className="ab-fingers" d="M1294 693l18 -6M1295 695l20 -1M1294 697l17 4" />
          {/* head: large smooth cranium, narrow jaw, thin neck — seen from behind */}
          <path className="ab-neck" d={`M${cx - 13} 590C${cx - 11} 630 ${cx - 13} 668 ${cx - 18} 700H${cx + 18}C${cx + 13} 668 ${cx + 11} 630 ${cx + 13} 590Z`} />
          <path className="ab-headshape" d={`M${cx} 318C${cx + 104} 318 ${cx + 130} 396 ${cx + 114} 470C${cx + 98} 540 ${cx + 46} 598 ${cx} 604C${cx - 46} 598 ${cx - 98} 540 ${cx - 114} 470C${cx - 130} 396 ${cx - 104} 318 ${cx} 318Z`} fill="url(#ab-head)" />
          <path className="ab-headrim" d={`M${cx - 116} 462C${cx - 128} 392 ${cx - 102} 318 ${cx} 318C${cx + 102} 318 ${cx + 128} 392 ${cx + 116} 462`} stroke="url(#ab-rim)" />
          <path className="ab-skull" d={`M${cx - 38} 352C${cx - 14} 344 ${cx + 14} 344 ${cx + 38} 352`} />
          {/* high-back leather chair */}
          <path className="ab-chair" d={`M${cx - 150} 668C${cx - 156} 626 ${cx - 120} 604 ${cx} 602C${cx + 120} 604 ${cx + 156} 626 ${cx + 150} 668L${cx + 176} 900H${cx - 176}Z`} fill="url(#ab-chair)" />
          <path className="ab-chairrim" d={`M${cx - 150} 668C${cx - 156} 626 ${cx - 120} 604 ${cx} 602C${cx + 120} 604 ${cx + 156} 626 ${cx + 150} 668`} />
          <path className="ab-seam" d={`M${cx - 92} 640C${cx - 98} 720 ${cx - 104} 800 ${cx - 110} 900M${cx + 92} 640C${cx + 98} 720 ${cx + 104} 800 ${cx + 110} 900`} />
          {/* glowing Openfund mark patch on the chair back */}
          <circle className="ab-patchglow" cx={cx} cy={706} r={58} fill="url(#ab-patch)" />
          <path className="ab-patch" d={`M${cx} 676l30 17v35l-30 17-30-17v-35z`} />
          <image href={MARK} x={cx - 17} y={690} width={34} height={38} className="ab-mark" />
        </g>}
      </svg>
    </div>
    {/* 3: haze — breathing glow over the room */}
    <div className="ab-haze"><i /><i /><i /></div>
  </div>
}
