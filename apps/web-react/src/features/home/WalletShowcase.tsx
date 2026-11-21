import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from 'react'
import { dirOf, pick, pickFormat, intlLocale, type AppLocale } from '../../i18n/locales'
import './wallet-showcase.css'

/** Animated wallet showcase (Challenges page, directly after Market Pulse).
 *
 *  ILLUSTRATIVE DEMO DATA ONLY. The addresses, returns, risk levels and trade
 *  counts below are generated from a fixed seed: they are not Openfund
 *  traders, accounts or verified results, and every card and the section say
 *  so. The seed makes server and client output identical and stable across
 *  re-renders.
 *
 *  Motion is CSS transforms and opacity only. The strip spans the full
 *  viewport; its viewport is anchored left-to-right (only the cards are RTL)
 *  so the track never runs out on either side. It holds as many copies of
 *  the list as needed for one copy to be wider than the viewport plus a card
 *  (copies after the first are aria-hidden), and one linear CSS animation
 *  moves it by exactly one copy, so the loop is seamless at every width.
 *
 *  A fixed mint scanner beam sits at the horizontal centre. Two layers run
 *  the same animation: the card layer is clipped to the entry side of the
 *  beam and a "data" layer (monospace figures derived from each card's seed)
 *  to the exit side, so cards dissolve into data as they cross it. RTL
 *  locales enter from the right; LTR mirrors it. Below 768 px the data layer
 *  is dropped and only the strip and the beam glow remain.
 *
 *  It runs only while the section is on screen and the tab is visible,
 *  pauses while one card is hovered or the strip has keyboard focus (arrow
 *  keys then step card by card), and is replaced by a static, scrollable row
 *  for prefers-reduced-motion. */

type Category = 'crypto' | 'forex' | 'stocks' | 'indices' | 'commodities'
export interface DemoWallet { address: string; short: string; category: Category; returnPct: number; risk: 1 | 2 | 3; trades: number; seed: number }

/* mulberry32: small, deterministic PRNG */
function prng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const CATEGORIES: Category[] = ['crypto', 'forex', 'stocks', 'indices', 'commodities']
export function demoWallets(count = 14, seed = 0x0f3d2026): DemoWallet[] {
  const rand = prng(seed)
  return Array.from({ length: count }, (_, i) => {
    const hex = Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(rand() * 16)])
      .map(c => (/[a-f]/.test(c) && rand() > 0.5 ? c.toUpperCase() : c)).join('')
    const address = '0x' + hex
    const returnPct = Math.round((rand() * 21 - 4) * 10) / 10
    return {
      address, short: `${address.slice(0, 6)}…${address.slice(-4)}`, category: CATEGORIES[i % CATEGORIES.length],
      returnPct: returnPct === 0 ? 0.4 : returnPct, risk: (1 + Math.floor(rand() * 3)) as 1 | 2 | 3,
      trades: 12 + Math.floor(rand() * 180), seed: Math.floor(rand() * 2 ** 31),
    }
  })
}
export const WALLETS = demoWallets()
const FIGURES = ['+2.4%', '0.81', '−1.2%', '3.6×', '+0.9%', '14.2', '+6.1%', '0.35', '−0.4%', '9.8']

/** 5×5 mirrored identicon from the wallet's seed (no network, no library). */
function Identicon({ seed }: { seed: number }) {
  const rand = prng(seed)
  const hue = Math.floor(rand() * 360)
  const cells: ReactElement[] = []
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    if (rand() < 0.5) continue
    for (const cx of x === 2 ? [2] : [x, 4 - x]) cells.push(<rect key={`${cx}-${y}`} x={cx} y={y} width="1" height="1" />)
  }
  return (
    <svg className="ws-identicon" viewBox="0 0 5 5" aria-hidden="true" style={{ '--ws-hue': hue } as CSSProperties}>
      <rect width="5" height="5" className="ws-identicon-bg" />{cells}
    </svg>
  )
}

/** Deterministic "data" rendition of a card for the far side of the beam:
 *  figures, percentages and hex derived from the wallet's own seed. Glyphs
 *  only (no words), decorative and aria-hidden. */
export function dataLines(wallet: DemoWallet): string[] {
  const rand = prng(wallet.seed ^ 0x5bd1e995)
  const hex = wallet.address.slice(2)
  const sign = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1)
  const bits = Array.from({ length: 22 }, () => (rand() > 0.5 ? '1' : '0')).join('')
  return [
    '0x' + hex.slice(0, 14), hex.slice(14, 28), hex.slice(28, 40) + ' ··',
    `Δ ${sign(wallet.returnPct)}%  σ ${wallet.risk}/3`,
    `# ${String(wallet.trades).padStart(4, '0')}  ${(rand() * 2).toFixed(4)}`,
    `${(rand() * 100).toFixed(2)}%  ${(rand() * 9).toFixed(3)}`,
    bits,
  ]
}

function DataCard({ wallet }: { wallet: DemoWallet }) {
  return (
    <div className="ws-data" data-risk={wallet.risk}>
      {dataLines(wallet).map((line, i) => <i key={i} style={{ '--l': i } as CSSProperties}>{line}</i>)}
    </div>
  )
}

function Card({ wallet, locale }: { wallet: DemoWallet; locale: AppLocale }) {
  const category = {
    crypto: pick(locale, 'رمزارز', 'Crypto'), forex: pick(locale, 'فارکس', 'Forex'), stocks: pick(locale, 'سهام', 'Stocks'),
    indices: pick(locale, 'شاخص‌ها', 'Indices'), commodities: pick(locale, 'کالا', 'Commodities'),
  }[wallet.category]
  /* financial figures: Latin digits, LTR, like the market table */
  const pct = new Intl.NumberFormat('en-US', { signDisplay: 'always', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(wallet.returnPct) + '%'
  return (
    <article className="ws-card" data-risk={wallet.risk}>
      <div className="ws-card-head">
        <Identicon seed={wallet.seed} />
        <div className="ws-id">
          <bdi className="ws-address" dir="ltr" title={wallet.address}>{wallet.short}</bdi>
          <span className="ws-category">{category}<span className="ws-badge">{pick(locale, 'حساب آزمایشی', 'Demo account')}</span></span>
        </div>
      </div>
      <div className="ws-metric">
        <span>{pick(locale, 'بازده روی مارجین', 'Return on margin')}</span>
        <strong className={wallet.returnPct >= 0 ? 'ws-up' : 'ws-down'} dir="ltr">{pct}</strong>
      </div>
      <div className="ws-card-foot">
        <span className="ws-risk" aria-label={`${pick(locale, 'ریسک', 'Risk')} ${wallet.risk}/3`}>
          {pick(locale, 'ریسک', 'Risk')} {[1, 2, 3].map(n => <i key={n} className={n <= wallet.risk ? 'on' : ''} />)}
        </span>
        <span className="ws-trades">{pickFormat(locale, '${count} معاملهٔ آزمایشی', '${count} demo trades', { count: new Intl.NumberFormat(intlLocale(locale)).format(wallet.trades) })}</span>
      </div>
    </article>
  )
}

/** copies needed so one copy is always wider than the viewport plus one card */
export function copiesFor(viewport: number, copyWidth: number, card: number): number {
  if (!(copyWidth > 0)) return 2
  return Math.max(2, Math.ceil((viewport + card) / copyWidth) + 1)
}

export default function WalletShowcase({ locale }: { locale: AppLocale }) {
  const root = useRef<HTMLElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [copies, setCopies] = useState(2)
  useEffect(() => {
    const el = root.current, vp = viewport.current
    if (!el || !vp) return
    /* run the loop only while on screen and visible */
    let onScreen = false
    const sync = () => el.classList.toggle('ws-running', onScreen && !document.hidden)
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() }, { rootMargin: '80px' })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    /* copy count and card height follow the real layout (resize, locale, breakpoint) */
    const measure = () => {
      const list = vp.querySelector<HTMLElement>('.ws-layer-cards .ws-list'), card = list?.querySelector<HTMLElement>('.ws-card')
      if (!list || !card) return
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0
      setCopies(copiesFor(vp.clientWidth, list.offsetWidth + gap, card.offsetWidth))
      el.style.setProperty('--ws-card-h', `${card.offsetHeight}px`)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(vp)
    const firstList = vp.querySelector('.ws-layer-cards .ws-list')
    if (firstList) ro.observe(firstList)
    /* light pointer parallax on the figures layer: one rAF per pointer move, fine pointers only */
    const fine = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    let frame = 0, px = 0, py = 0
    const move = (e: PointerEvent) => {
      if (!fine.matches || !onScreen) return
      const r = el.getBoundingClientRect()
      px = ((e.clientX - r.left) / r.width - 0.5) * 2; py = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; el.style.setProperty('--ws-px', px.toFixed(3)); el.style.setProperty('--ws-py', py.toFixed(3)) })
    }
    el.addEventListener('pointermove', move, { passive: true })
    return () => { io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', sync); el.removeEventListener('pointermove', move); cancelAnimationFrame(frame) }
  }, [])
  /* keyboard: while the strip has focus the loop is paused; arrows move it one card */
  const step = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const vp = e.currentTarget
    const animations = [...vp.querySelectorAll('.ws-track')].flatMap(t => t.getAnimations()).filter(a => (a as CSSAnimation).animationName === 'ws-loop')
    if (!animations.length) return
    e.preventDefault()
    const duration = Number(animations[0].effect?.getComputedTiming().duration) || 0
    /* normal direction moves left (RTL); reverse moves right (LTR) */
    const reverse = animations[0].effect?.getComputedTiming().direction === 'reverse'
    const delta = (duration / WALLETS.length) * ((e.key === 'ArrowLeft') !== reverse ? 1 : -1)
    for (const a of animations) {
      const next = (Number(a.currentTime) || 0) + delta
      a.currentTime = next < 0 ? next + duration : next
    }
  }
  const label = pick(locale, 'کیف پول‌های نمونه · دادهٔ نمایشی', 'Sample wallets · demo data')
  const lists = (data: boolean) => Array.from({ length: copies }, (_, c) => data
    ? <ul key={c} className="ws-list ws-data-list">{WALLETS.map(w => <li key={w.address}><DataCard wallet={w} /></li>)}</ul>
    : <ul key={c} className={c ? 'ws-list ws-clone' : 'ws-list'} aria-hidden={c ? 'true' : undefined} aria-label={c ? undefined : label}>
        {WALLETS.map(w => <li key={w.address} dir={dirOf(locale)}><Card wallet={w} locale={locale} /></li>)}
      </ul>)
  const trackStyle = { '--ws-count': WALLETS.length } as CSSProperties
  return (
    <section ref={root} className="ws-section" aria-labelledby="ws-title" dir={dirOf(locale)} lang={locale} data-locale-owned="react"
      data-flow={dirOf(locale)} style={trackStyle}>
      {/* own container and eyebrow styles: the legacy stylesheet loads after
          mount, and borrowing its classes would reflow this section then */}
      <div className="ws-glow" aria-hidden="true" />
      <div className="ws-figures" aria-hidden="true">
        {FIGURES.map((f, i) => <span key={i} style={{ '--i': i } as CSSProperties} dir="ltr">{f}</span>)}
      </div>
      <div className="ws-head ws-inner">
        <span className="ws-eyebrow">{label}</span>
        <h2 id="ws-title">{pick(locale, 'هر کیف پول، یک مسیر معاملاتی.', 'Every wallet, its own trading path.')}</h2>
      </div>
      {/* full-bleed strip, anchored LTR. Focusable so keyboard users can pause
          and step it, and scroll it under reduced motion. */}
      <div ref={viewport} className="ws-viewport" tabIndex={0} role="region" aria-label={label} onKeyDown={step}>
        <div className="ws-layer ws-layer-cards">
          <div className="ws-track">{lists(false)}</div>
        </div>
        <div className="ws-layer ws-layer-data" aria-hidden="true">
          <div className="ws-track">{lists(true)}</div>
        </div>
        <div className="ws-beam" aria-hidden="true"><i /></div>
      </div>
      <p className="ws-disclaimer ws-inner">{pick(locale,
        'دادهٔ نمایشی و نمونه است؛ این نشانی‌ها معامله‌گران، حساب‌ها یا نتایج تأییدشدهٔ اوپن‌فاند نیستند.',
        'Illustrative demo data. These addresses are not Openfund traders, accounts or verified results.')}</p>
    </section>
  )
}
