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
    let current = theme()
    let stop = startSolarScene(element, { still: reduced.matches, theme: current })
    const restart = () => { current = theme(); stop(); stop = startSolarScene(element, { still: reduced.matches, theme: current }) }
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
    <h1 className="visually-hidden">{pick(locale, 'اوپن‌فاند', 'Openfund')}</h1>
    <nav className="solar-actions" aria-label={pick(locale, 'شروع', 'Get started')}>
      <Link className="button solar-buy" to={CHECKOUT_HREF(locale)} data-cta="home-quick-buy">
        {pick(locale, 'خرید سریع چلنج', 'Buy a challenge')}
      </Link>
      <Link className="button button-secondary solar-rules" to={`/${locale}/rulebook`} data-cta="home-rulebook">
        {pick(locale, 'قوانین معاملاتی', 'Trading rules')}
      </Link>
    </nav>
  </div>
}
