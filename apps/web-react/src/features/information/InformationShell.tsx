import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import landingBody from '../../pages/landing-body.html?raw'
import translationsJson from '../../../public/translations.json?raw'
import { fetchCmsTranslations, fetchCmsNavigation, fetchCmsFooterLinks, type CmsNavItem, type CmsFooterLink } from '../../cms/client'
import { RainbowConnect } from '../../wallet/RainbowConnect'
import { labels, type Locale, type InfoPage } from './content'
import './information.css'
import TelegramCommunity from '../community/TelegramCommunity'
import { bindNavigation, renderNavigation, navigationClick, navigationKeyDown } from './navigation'
import { chooseTheme, currentTheme, decorateThemeToggle } from '../../theme'
import LanguageSelect from '../../i18n/LanguageSelect'
import UntranslatedNotice from '../../i18n/UntranslatedNotice'
import { dirOf, isLocale, normalizeLocale, pick, pickRecord, switchLocalePath, type AppLocale } from '../../i18n/locales'

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
export function Chrome({ locale, part, nav = true }: { locale: AppLocale; part: 'header' | 'footer'; nav?: boolean }) {
  const [dictionary, setDictionary] = useState<Record<string, string>>(fallbackTranslations)
  const [faDictionary, setFaDictionary] = useState<Record<string, string>>({})
  const [communityHost, setCommunityHost] = useState<HTMLElement | null>(null)
  const [walletHost, setWalletHost] = useState<HTMLElement | null>(null)
  const [languageHost, setLanguageHost] = useState<HTMLElement | null>(null)
  const [navItems, setNavItems] = useState<CmsNavItem[] | null>(null)
  const [footerLinks, setFooterLinks] = useState<CmsFooterLink[] | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    let active = true
    void fetchCmsTranslations().then(cms => {
      if (active && cms) {
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
    /* fa: CMS Persian overrides; en: the fa→en dictionary; added locales
       translate the English text, falling back to English */
    const translate = (source: string) => {
      const key = source.trim(), en = dictionary[key]
      const value = locale === 'fa' ? faDictionary[key] : en && (locale === 'en' ? en : pick(locale, key, en))
      return value ? source.replace(key, value) : source
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
        el.setAttribute('href', `/${locale}/${page}`)
        el.textContent = pickRecord(locale, labels[page])
        if (location.pathname.endsWith(`/${page}`)) el.setAttribute('aria-current', 'page')
      } else if (el.tagName === 'A') {
        const href = el.getAttribute('href') || ''
        if (href === '/' || href === '#/' || href === '#top' && part === 'header') el.setAttribute('href', `/${locale}/home`)
        else if (href === '#top') el.setAttribute('href', '#top')
        else if (href.startsWith('#') && !href.startsWith('#/')) el.setAttribute('href', href)
      }
      for (const attr of ['src', 'href']) {
        const value = el.getAttribute(attr)
        if (value?.startsWith('assets/') || value?.startsWith('downloads/')) el.setAttribute(attr, `${base}${value}`)
      }
    })
    renderNavigation(template.content, locale, location.pathname, navItems, footerLinks)
    /* nav-less mode (product gateway): no menu links or menu button; retain the terminal CTA */
    if (part === 'header' && !nav) {
      template.content.querySelector('#navigation')?.remove()
      template.content.querySelector('.menu')?.remove()
    }
    /* the five-language selector replaces the legacy two-way toggle */
    const toggle = template.content.querySelector('#language-toggle')
    if (toggle) { const slot = document.createElement('span'); slot.id = 'language-slot'; slot.className = 'language-slot'; toggle.replaceWith(slot) }
    const theme = template.content.querySelector('#theme-toggle')
    if (theme) decorateThemeToggle(theme)
    return template.innerHTML
  }, [locale, part, nav, dictionary, faDictionary, location.pathname, navItems, footerLinks])

  useEffect(() => { if (part === 'header' && host.current) return bindNavigation(host.current) }, [markup, part])
  useEffect(() => { setWalletHost(host.current?.querySelector<HTMLElement>('#wallet-root') || null); setLanguageHost(host.current?.querySelector<HTMLElement>('#language-slot') || null); setCommunityHost(host.current?.querySelector<HTMLElement>('[data-community-slot]') || null) }, [markup])

  return <div ref={host} className="info-chrome" onClick={e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('button, a')
    if (!target) return
    if (navigationClick(e.nativeEvent, host.current!)) return
    if (target.id === 'theme-toggle') {
      const next = currentTheme() === 'light' ? 'dark' : 'light'
      chooseTheme(next)
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
    if (navigationKeyDown(e.nativeEvent, host.current!)) return
    if (e.key === 'Escape') {
      host.current?.querySelector('#navigation')?.classList.remove('open')
      const menu = host.current?.querySelector<HTMLButtonElement>('.menu')
      menu?.setAttribute('aria-expanded', 'false')
      menu?.focus()
    }
  }}>
    <div dangerouslySetInnerHTML={{ __html: markup }} />
    {part === 'header' && walletHost && createPortal(<RainbowConnect />, walletHost)}
    {part === 'header' && languageHost && createPortal(<LanguageSelect locale={locale} onChange={next => navigate(switchLocalePath(location.pathname, next) + location.search)} />, languageHost)}
    {part === 'footer' && communityHost && createPortal(<TelegramCommunity locale={locale} />, communityHost)}
  </div>
}

/** Page locale. Every supported locale renders its own editorial text:
 *  bilingual `{fa, en}` records are resolved with `tx` / `pickRecord`. */
export function useInformationLocale(): AppLocale {
  return normalizeLocale(useParams().locale, 'fa')
}
export function useUiLocale(): AppLocale {
  return normalizeLocale(useParams().locale, 'fa')
}

export default function InformationShell({ page, description, footer = true, nav = true, title, children }: {
  page: InfoPage; description: string; footer?: boolean; nav?: boolean; title?: string; children: ReactNode
}) {
  const { locale: routeLocale } = useParams()
  const locale = useUiLocale()
  useEffect(() => {
    const previousTitle = document.title
    document.documentElement.lang = locale
    document.documentElement.dir = dirOf(locale)
    // Existing wallet/session controls subscribe to this landing locale contract.
    const runtime = window as Window & { ofLang?: AppLocale; __ofLegacyLandingLoaded?: boolean; __ofLegacyTerminalLoaded?: boolean }
    runtime.ofLang = locale
    // Classic pages reload on exit. During that short teardown window their
    // locale listeners still reference removed DOM; the wallet mounts fresh.
    if (!runtime.__ofLegacyLandingLoaded && !runtime.__ofLegacyTerminalLoaded) {
      dispatchEvent(new CustomEvent('of-language'))
    }
    try { localStorage.setItem('of-language', locale) } catch { /* Storage is optional. */ }
    document.title = title || `${pickRecord(locale, labels[page])} | Openfund`
    const tags: HTMLElement[] = []
    const meta = document.createElement('meta')
    meta.name = 'description'; meta.content = description
    tags.push(meta)
    const url = (lang: Locale) => new URL(`/${lang}/${page}`, window.location.origin).href
    /* social sharing metadata mirrors the CMS-edited title/description */
    const og = (property: string, content: string) => {
      const tag = document.createElement('meta')
      tag.setAttribute('property', property); tag.content = content
      tags.push(tag)
    }
    og('og:title', document.title)
    og('og:description', description)
    og('og:url', url(locale))
    tags.forEach(tag => document.head.appendChild(tag))
    return () => { tags.forEach(tag => tag.remove()); document.title = previousTitle }
  }, [locale, page, description, title])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [page])
  if (!isLocale(routeLocale)) return <Navigate to={`/fa/${page}`} replace />
  return <div className={`information-page${footer ? '' : ' chrome-only'}`}>
    <link rel="stylesheet" href={`${base}legacy/style.css`} precedence="openfund" />
    <link rel="stylesheet" href={`${base}legacy/wallet.css`} precedence="openfund" />
    <a className="skip" href="#main">{pickRecord(locale, labels.skip)}</a>
    <Chrome locale={locale} part="header" nav={nav} />
    <main id="main" className="info-main" tabIndex={-1}>
      <UntranslatedNotice locale={locale} />
      {children}
    </main>
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
