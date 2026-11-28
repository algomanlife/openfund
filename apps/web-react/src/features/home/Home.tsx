import { normalizeLocale, pick } from '../../i18n/locales'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import InformationShell from '../information/InformationShell'
import type { Locale } from '../information/content'
import { fetchCmsHome, type CmsHome } from '../../cms/client'
import { startSolarScene } from './solarScene'
import './home.css'

/* the single shared checkout route (also used by the wallet card and the campaign page) */
export const CHECKOUT_HREF = (locale: string) => `/${locale}/checkout`

/** Openfund gateway: one fixed screen under the site header — a miniature
 *  solar system turning on its dusty disc, and two actions. The page never
 *  scrolls; the scene fills whatever space the header, the announcement bar
 *  and the Persian price strip leave. SEO title and description stay owned
 *  by Directus; the scene connects to no market, wallet or execution API. */
export default function Home() {
  const locale: Locale = normalizeLocale(useParams().locale, 'fa')
  const [content, setContent] = useState<CmsHome | null>(null)
  useEffect(() => {
    let active = true
    void fetchCmsHome().then(data => { if (active && data) setContent(data) })
    return () => { active = false }
  }, [])
  const seo = content?.translations[locale]
  return <InformationShell page="home" footer={false}
      title={seo?.seoTitle || 'Openfund'}
      description={seo?.seoDescription || pick(locale, 'اوپن‌فاند: چلنج‌های معاملاتی شفاف در محیط شبیه‌سازی‌شده.', 'Openfund: transparent trading challenges in a simulated environment.')}>
    <SolarGateway locale={locale} />
  </InformationShell>
}

function SolarGateway({ locale }: { locale: Locale }) {
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  /* one screen: the stage spans from the bottom of the header (and the
     announcement bar above it) to the top of the fixed price strip */
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const root = document.documentElement
    root.classList.add('of-gateway-locked')
    const page = element.closest('.information-page')
    const measure = () => {
      const header = page?.querySelector('header')
      const strip = document.querySelector<HTMLElement>('.bitpin-ticker')
      const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0)
      element.style.setProperty('--gateway-top', `${top}px`)
      element.style.setProperty('--gateway-bottom', `${strip?.getBoundingClientRect().height ?? 0}px`)
    }
    const resize = new ResizeObserver(measure)
    const watch = () => {
      const header = page?.querySelector('header'), strip = document.querySelector('.bitpin-ticker')
      const bar = page?.querySelector('.of-announcement')
      for (const el of [header, strip, bar]) if (el) resize.observe(el)
      measure()
    }
    watch()
    addEventListener('of-announcement', watch)
    addEventListener('resize', measure)
    /* the strip mounts after the page: pick it up when it arrives */
    const late = new MutationObserver(watch)
    late.observe(document.body, { childList: true })
    return () => {
      root.classList.remove('of-gateway-locked')
      resize.disconnect(); late.disconnect()
      removeEventListener('of-announcement', watch)
      removeEventListener('resize', measure)
    }
  }, [])

  /* the scene follows the site theme and the reduced-motion preference */
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const html = document.documentElement
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const theme = () => html.getAttribute('data-theme') === 'light' ? 'light' as const : 'dark' as const
    /* the black hole sits midway between the hero copy and the actions */
    const anchor = () => {
      const box = element.getBoundingClientRect()
      const hero = stage.current?.querySelector('.solar-hero')?.getBoundingClientRect()
      const actions = stage.current?.querySelector('.solar-actions')?.getBoundingClientRect()
      if (!hero || !actions || !box.height) return null
      return { x: box.width / 2, y: (hero.bottom + actions.top) / 2 - box.top, room: Math.max(0, actions.top - hero.bottom) }
    }
    const logoSrc = `${import.meta.env.BASE_URL}assets/mark-mint.svg`
    const start = () => startSolarScene(element, { still: reduced.matches, theme: current, anchor, logoSrc })
    let current = theme()
    let stop = start()
    const restart = () => { current = theme(); stop(); stop = start() }
    const themeWatch = new MutationObserver(() => { if (theme() !== current) restart() })
    themeWatch.observe(html, { attributes: true, attributeFilter: ['data-theme'] })
    reduced.addEventListener('change', restart)
    return () => { themeWatch.disconnect(); reduced.removeEventListener('change', restart); stop() }
  }, [])

  return <div id="top" ref={stage} className="home-gateway solar-gateway">
    <canvas ref={canvas} className="solar-canvas" aria-hidden="true" />
    {/* miniature look: the near and far parts of the scene fall out of focus */}
    <div className="solar-focus solar-focus-top" aria-hidden="true" />
    <div className="solar-focus solar-focus-bottom" aria-hidden="true" />
    <div className="solar-hero">
      <h1>{pick(locale, 'داستان معامله‌گری تو از اینجا شروع خواهد شد…', 'Your trading story starts here…')}</h1>
      <p><span>{pick(locale, 'همهٔ بازارها در کنار تمام ابزارها', 'Every market alongside every tool')}</span>
        <span>{pick(locale, 'همه و همه در یک پلتفرم', 'All of it on one platform')}</span></p>
    </div>
    <nav className="solar-actions" aria-label={pick(locale, 'شروع', 'Get started')}>
      <Link className="button solar-trade" to={`/${locale}/prop/trade`} data-cta="home-start-trading">
        {pick(locale, 'شروع معاملات', 'Start trading')}
      </Link>
      <Link className="button solar-buy" to={CHECKOUT_HREF(locale)} data-cta="home-quick-buy">
        {pick(locale, 'خرید سریع چلنج', 'Buy a challenge')}
      </Link>
      <Link className="button button-secondary solar-rules" to={`/${locale}/rulebook`} data-cta="home-rulebook">
        {pick(locale, 'قوانین معاملاتی', 'Trading rules')}
      </Link>
      <BlackHoleSound locale={locale} />
    </nav>
  </div>
}

/* NASA's sonification of the black hole at the centre of the Perseus galaxy
   cluster (Chandra X-ray Center). NASA/SAO assert no copyright on Chandra
   content; it is credited here and in THIRD_PARTY_NOTICES.md and implies no
   endorsement. Off until the visitor turns it on; it plays only on this
   page, pauses while the tab is hidden and stops when the page is left.
   The file is a 27 s seamless loop made from NASA's track (see the notice). */
const BLACK_HOLE_SOUND = `${import.meta.env.BASE_URL}assets/audio/perseus-black-hole.mp3`
const BLACK_HOLE_CREDIT = 'Sound: NASA/CXC/SAO/K. Arcand, SYSTEM Sounds (M. Russo, A. Santaguida)'

/* the loop is exactly 27 s (equal-power cross-fade at the seam); playing it
   through Web Audio with a fixed loop end avoids the gap MP3 padding leaves
   in an <audio loop>, and the gain node fades on phones where the element's
   volume is fixed */
const LOOP_SECONDS = 27
const SOUND_LEVEL = .6

function BlackHoleSound({ locale }: { locale: Locale }) {
  const engine = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null)
  const [on, setOn] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const ramp = (gain: GainNode, ctx: AudioContext, to: number, seconds = .9) => {
    const now = ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(to, now + seconds)
  }

  /* pause with the tab; stop for good when the page is left */
  useEffect(() => {
    const onVisibility = () => {
      const e = engine.current
      if (!e || !on) return
      if (document.hidden) void e.ctx.suspend()
      else void e.ctx.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [on])
  useEffect(() => () => { void engine.current?.ctx.close(); engine.current = null }, [])

  const toggle = async () => {
    if (busy) return
    const e = engine.current
    if (on && e) {
      setOn(false)
      ramp(e.gain, e.ctx, 0)
      setTimeout(() => { if (engine.current === e && e.gain.gain.value < .01) void e.ctx.suspend() }, 1000)
      return
    }
    try {
      setBusy(true)
      if (!e) {
        const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctx) throw new Error('no Web Audio')
        const ctx = new Ctx()
        const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination)
        engine.current = { ctx, gain }
        await ctx.resume()   /* inside the click: allowed to start */
        const data = await (await fetch(BLACK_HOLE_SOUND)).arrayBuffer()
        const buffer = await ctx.decodeAudioData(data)
        const source = ctx.createBufferSource()
        source.buffer = buffer; source.loop = true
        source.loopStart = 0; source.loopEnd = Math.min(LOOP_SECONDS, buffer.duration)
        source.connect(gain); source.start()
      } else await e.ctx.resume()
      const current = engine.current!
      ramp(current.gain, current.ctx, SOUND_LEVEL)
      setOn(true); setFailed(false)
    } catch {
      void engine.current?.ctx.close(); engine.current = null
      setFailed(true); setOn(false)
    } finally { setBusy(false) }
  }

  const label = on
    ? pick(locale, 'قطع صدای سیاه‌چاله', 'Mute the black hole')
    : pick(locale, 'پخش صدای سیاه‌چاله', 'Play the sound of the black hole')
  return <button type="button" className={`solar-sound${on ? ' is-on' : ''}${failed ? ' is-failed' : ''}`}
      aria-pressed={on} aria-busy={busy} aria-label={label} title={`${label} — ${BLACK_HOLE_CREDIT}`} onClick={() => void toggle()} data-cta="home-black-hole-sound">
    <span className="solar-sound-bars" aria-hidden="true"><i /><i /><i /><i /></span>
  </button>
}
