import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import landingBody from '../../pages/landing-body.html?raw'
import translationsJson from '../../../public/translations.json?raw'
import { fetchCmsTranslations, fetchCmsNavigation, fetchCmsFooterLinks, type CmsNavItem, type CmsFooterLink } from '../../cms/client'
import { RainbowConnect } from '../../wallet/RainbowConnect'
import { labels, type Locale, type InfoPage } from './content'
import './information.css'

const header = landingBody.match(/<header\b[^>]*>[\s\S]*?<\/header>/)![0]
const footer = landingBody.match(/<footer[\s\S]*?<\/footer>/)![0]
const base = import.meta.env.BASE_URL
const fallbackTranslations: Record<string, string> = {
  ...JSON.parse(translationsJson),
  'ناوبری اصلی': 'Main navigation',
  'خانه اوپن‌فاند': 'Openfund home',
  'دریافت برندبوک ↓': 'Download brandbook ↓',
  'بازگشت به بالا ↑': 'Back to top ↑',
  'قلب تپنده': 'Beating heart',
  'Gains Network — منبع دادهٔ بازار': 'Gains Network — market data source',
  'Vela by LuxAlgo — موتور چارت': 'Vela by LuxAlgo — chart engine',
  '←': '→', '↙': '↘',
}

/** Reuses the landing's source markup and public translation pipeline, without
 * loading its page-wide legacy scripts into React-owned editorial content.
 *  Exported so gateway-style pages (Home) can mount the shared header alone. */
export function Chrome({ locale, part, nav = true }: { locale: Locale; part: 'header' | 'footer'; nav?: boolean }) {
  const [dictionary, setDictionary] = useState<Record<string, string>>(fallbackTranslations)
  const [faDictionary, setFaDictionary] = useState<Record<string, string>>({})
  const [walletHost, setWalletHost] = useState<HTMLElement | null>(null)
  const [navItems, setNavItems] = useState<CmsNavItem[] | null>(null)
  const [footerLinks, setFooterLinks] = useState<CmsFooterLink[] | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    let active = true
    void fetchCmsTranslations().then(cms => {
      if (active) {
        setDictionary({ ...fallbackTranslations, ...cms?.landing })
        setFaDictionary(cms?.landingFa || {})
      }
    })
    if (part === 'header') void fetchCmsNavigation().then(items => { if (active) setNavItems(items) })
    if (part === 'footer') void fetchCmsFooterLinks().then(links => { if (active) setFooterLinks(links) })
    return () => { active = false }
  }, [part])
  const markup = useMemo(() => {
    const template = document.createElement('template')
    template.innerHTML = part === 'header' ? header : footer
    const translate = (source: string) => {
      const value = (locale === 'en' ? dictionary : faDictionary)[source.trim()]
      return value ? source.replace(source.trim(), value) : source
    }
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) node.nodeValue = translate(node.nodeValue || '')
    template.content.querySelectorAll<HTMLElement>('*').forEach(el => {
      for (const attr of ['aria-label', 'title', 'alt']) {
        if (el.hasAttribute(attr)) el.setAttribute(attr, translate(el.getAttribute(attr)!))
      }
      const page = el.dataset.infoPage as InfoPage | undefined
      if (page && labels[page]) {
        el.setAttribute('href', `#/${locale}/${page}`)
        el.textContent = labels[page][locale]
        if (location.pathname.endsWith(`/${page}`)) el.setAttribute('aria-current', 'page')
      } else if (el.tagName === 'A') {
        const href = el.getAttribute('href') || ''
        if (href === '#/' || href === '#top' && part === 'header') el.setAttribute('href', `#/${locale}/home`)
        else if (href === '#top') el.setAttribute('href', '#top')
        else if (href.startsWith('#') && !href.startsWith('#/')) el.setAttribute('href', `#/${href}`)
      }
      for (const attr of ['src', 'href']) {
        const value = el.getAttribute(attr)
        if (value?.startsWith('assets/') || value?.startsWith('downloads/')) el.setAttribute(attr, `${base}${value}`)
      }
    })
    /* navigation & footer links from Directus (labels/visibility editable,
       destinations whitelisted). Falls back to the structural defaults. */
    if (part === 'header' && navItems) {
      const nav = template.content.querySelector('#navigation')
      if (nav) {
        nav.textContent = ''
        for (const item of navItems) {
          const a = document.createElement('a')
          a.setAttribute('data-info-page', item.route)
          a.setAttribute('href', `#/${locale}/${item.route}`)
          a.textContent = item.label[locale]
          if (location.pathname.endsWith(`/${item.route}`)) a.setAttribute('aria-current', 'page')
          nav.appendChild(a)
        }
      }
    }
    if (part === 'footer' && footerLinks) {
      const links = template.content.querySelector('#footer-links')
      if (links) {
        links.textContent = ''
        const DEST: Record<string, string> = {
          challenges: `#/${locale}/challenges`, markets: `#/${locale}/markets`,
          rulebook: `#/${locale}/rulebook`, transparency: `#/${locale}/transparency`,
          'accounts-section': '#accounts', 'team-section': '#team', 'faq-section': '#rules',
          github: 'https://github.com/algomanlife/openfund',
        }
        for (const link of footerLinks) {
          const href = DEST[link.destination]
          if (!href) continue /* unknown destination → never rendered */
          const a = document.createElement('a')
          a.setAttribute('href', href)
          a.textContent = link.label[locale]
          if (link.destination === 'github') { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener') }
          links.appendChild(a)
        }
      }
    }
    /* nav-less mode (product gateway): no menu links, no menu button, no header CTA */
    if (part === 'header' && !nav) {
      template.content.querySelector('#navigation')?.remove()
      template.content.querySelector('.menu')?.remove()
      template.content.querySelector('.nav-cta')?.remove()
    }
    const language = template.content.querySelector('#language-toggle span')
    if (language) language.textContent = locale === 'fa' ? 'EN' : 'فا'
    const theme = template.content.querySelector('#theme-toggle')
    if (theme) theme.textContent = document.documentElement.dataset.theme === 'light' ? '◑' : '◐'
    return template.innerHTML
  }, [locale, part, dictionary, faDictionary, location.pathname, navItems, footerLinks])

  useEffect(() => { setWalletHost(host.current?.querySelector<HTMLElement>('#wallet-root') || null) }, [markup])

  return <div ref={host} className="info-chrome" onClick={e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('button, a')
    if (!target) return
    if (target.id === 'language-toggle') {
      navigate(location.pathname.replace(`/${locale}/`, `/${locale === 'fa' ? 'en' : 'fa'}/`))
    } else if (target.id === 'theme-toggle') {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'
      document.documentElement.dataset.theme = next
      target.textContent = next === 'dark' ? '◐' : '◑'
      try { localStorage.setItem('of-theme', next) } catch { /* private browsing */ }
    } else if (target.classList.contains('menu')) {
      const open = target.getAttribute('aria-expanded') !== 'true'
      target.setAttribute('aria-expanded', String(open))
      host.current?.querySelector('#navigation')?.classList.toggle('open', open)
    } else if (target.dataset.menuPreset) {
      try { sessionStorage.setItem('ofScrollTo', 'accounts') } catch { /* optional */ }
      navigate(`/${locale}/challenges`)
    } else if (target.tagName === 'A') {
      host.current?.querySelector('#navigation')?.classList.remove('open')
      host.current?.querySelector('.menu')?.setAttribute('aria-expanded', 'false')
    }
  }} onKeyDown={e => {
    if (e.key === 'Escape') {
      host.current?.querySelector('#navigation')?.classList.remove('open')
      const menu = host.current?.querySelector<HTMLButtonElement>('.menu')
      menu?.setAttribute('aria-expanded', 'false')
      menu?.focus()
    }
  }}>
    <div dangerouslySetInnerHTML={{ __html: markup }} />
    {part === 'header' && walletHost && createPortal(<RainbowConnect />, walletHost)}
  </div>
}

export function useInformationLocale(): Locale {
  return useParams().locale === 'en' ? 'en' : 'fa'
}

export default function InformationShell({ page, description, footer = true, nav = true, title, children }: {
  page: InfoPage; description: string; footer?: boolean; nav?: boolean; title?: string; children: ReactNode
}) {
  const { locale: routeLocale } = useParams()
  const locale = useInformationLocale()
  useEffect(() => {
    const previousTitle = document.title
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'
    // Existing wallet/session controls subscribe to this landing locale contract.
    const runtime = window as Window & { ofLang?: Locale; __ofLegacyLandingLoaded?: boolean; __ofLegacyTerminalLoaded?: boolean }
    runtime.ofLang = locale
    // Classic pages reload on exit. During that short teardown window their
    // locale listeners still reference removed DOM; the wallet mounts fresh.
    if (!runtime.__ofLegacyLandingLoaded && !runtime.__ofLegacyTerminalLoaded) {
      dispatchEvent(new CustomEvent('of-language'))
    }
    try {
      localStorage.setItem('of-language', locale)
      document.documentElement.dataset.theme = localStorage.getItem('of-theme') || 'dark'
    } catch { document.documentElement.dataset.theme ||= 'dark' }
    document.title = title || `${labels[page][locale]} | Openfund`
    const tags: HTMLElement[] = []
    const meta = document.createElement('meta')
    meta.name = 'description'; meta.content = description
    tags.push(meta)
    const url = (lang: Locale) => new URL(`${base}#/${lang}/${page}`, window.location.origin).href
    const canonical = document.createElement('link')
    canonical.rel = 'canonical'; canonical.href = url(locale)
    tags.push(canonical)
    for (const lang of ['en', 'fa', 'x-default']) {
      const link = document.createElement('link')
      link.rel = 'alternate'; link.hreflang = lang; link.href = url(lang === 'en' ? 'en' : 'fa')
      tags.push(link)
    }
    tags.forEach(tag => document.head.appendChild(tag))
    return () => { tags.forEach(tag => tag.remove()); document.title = previousTitle }
  }, [locale, page, description, title])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [page])
  if (routeLocale !== 'en' && routeLocale !== 'fa') return <Navigate to={`/fa/${page}`} replace />
  return <div className={`information-page${footer ? '' : ' chrome-only'}`}>
    <link rel="stylesheet" href={`${base}legacy/style.css`} precedence="openfund" />
    <link rel="stylesheet" href={`${base}legacy/wallet.css`} precedence="openfund" />
    <a className="skip" href="#main">{labels.skip[locale]}</a>
    <Chrome locale={locale} part="header" nav={nav} />
    <main id="main" className="info-main" tabIndex={-1}>{children}</main>
    {footer && <Chrome locale={locale} part="footer" />}
  </div>
}

export function Hero({ locale, page, title, accent, intro, children }: {
  locale: Locale; page: InfoPage; title: string; accent: string; intro: string; children?: ReactNode
}) {
  return <section className="container info-hero" id="top">
    <div className="hero-atmosphere" aria-hidden="true"><i /><i /><i /></div>
    <div className="eyebrow"><span className="tiny-mark" aria-hidden="true">✳</span> OPENFUND / {labels[page][locale]}</div>
    <h1>{title}<br /><em>{accent}</em></h1>
    <p className="hero-intro">{intro}</p>
    {children}
  </section>
}
