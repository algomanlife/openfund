import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { bindNavigation, renderNavigation, navigationClick, navigationKeyDown } from '../features/information/navigation'
import '../features/information/information.css'
import landingBody from './landing-body.html?raw'
import { RainbowConnect } from '../wallet/RainbowConnect'
import { fetchCmsNavigation, fetchCmsTranslations, fetchCmsLegacyPlans, fetchCmsFaqs, fetchCmsLegal, fetchCmsFooterLinks, invalidateCmsCache } from '../cms/client'

/**
 * Phase 2a: the landing runs inside the React shell with its proven markup
 * and logic (locale/market/motion scripts) loaded as modules after mount.
 * Phase 2b progressively extracts real React components (see MIGRATION_STATUS).
 *
 * Public-website role: this page is the "Trading Challenges" destination at
 * /:locale/challenges. The route locale is the source of truth on entry (it
 * wins over the stored preference before the legacy scripts read it), and the
 * in-page language toggle silently rewrites the hash to stay in sync without
 * remounting the legacy runtime.
 *
 * Legacy-script contract (classic page assumptions we must satisfy):
 *  - locale.js waits for DOMContentLoaded on WINDOW. React injects scripts
 *    after that event fired, so we re-dispatch it once the chain loads.
 *    The synthetic event MUST bubble (document → window) or window
 *    listeners never see it.
 *  - In dev, StrictMode mounts/unmounts effects twice. We must inject the
 *    legacy script chain ONCE per browser page (window guard), otherwise
 *    every listener is wired twice and clicks toggle twice (net no-op).
 *  - Leaving this page fully tears the legacy runtime down by reloading
 *    (classic pages were separate documents). The reload is scheduled on
 *    unmount and only cancelled by a re-mount of the SAME page.
 */

const SCRIPTS = [
  'legacy/locale.js',
  'legacy/app.js',
  'legacy/features.js',
  'legacy/market.js',
  'legacy/motion.js'
]
const STYLES = [
  'legacy/style.css',
  'legacy/wallet.css'
]

const w = () => window as any

/* ---- theme (owned by React; was an inline script in the classic page) ---- */
function initTheme() {
  const b = document.getElementById('theme-toggle')
  if (!b) return
  const set = (t: string) => {
    document.documentElement.setAttribute('data-theme', t)
    b.textContent = t === 'dark' ? '◐' : '◑'
    try { localStorage.setItem('of-theme', t) } catch { /* ignore */ }
  }
  let t = 'dark'
  try { t = localStorage.getItem('of-theme') || 'dark' } catch { /* ignore */ }
  set(t)
  if (!(b as any).__ofThemeWired) {
    ;(b as any).__ofThemeWired = true
    b.addEventListener('click', () =>
      set(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'))
  }
}

/* ---- arrow glyph direction (owned by React; was inline) ---- */
const ARROW_MAP: Record<string, string> = {
  '←': '→', '→': '←', '↙': '↘', '↘': '↙', '↖': '↗', '↗': '↖'
}
function swapArrows() {
  document.querySelectorAll<HTMLAnchorElement>('[data-info-page]').forEach(a => {
    a.href = `#/${w().ofLang === "en" ? "en" : "fa"}/${a.dataset.infoPage}`
  })
  const en = w().ofLang === 'en'
  document
    .querySelectorAll('.button>span,.text-link>span,.nav-cta>span,.team-profile-link>span')
    .forEach((sp) => {
      const ch = (sp.textContent || '').trim()
      if (ch.length === 1 && ARROW_MAP[ch]) {
        if (en) {
          if (!(sp as HTMLElement).dataset.orig) (sp as HTMLElement).dataset.orig = ch
          sp.textContent = ARROW_MAP[ch]
        } else if ((sp as HTMLElement).dataset.orig) {
          sp.textContent = (sp as HTMLElement).dataset.orig
          delete (sp as HTMLElement).dataset.orig
        }
      }
    })
}

/* ---- nav state for the shared website header ---------------------------- */
function markCurrentPage() {
  /* this page IS the Trading Challenges destination — highlight it the way
     the information pages do (aria-current + the landing's .active style) */
  document.querySelectorAll<HTMLElement>('[data-info-page]').forEach(a => {
    const active = a.dataset.infoPage === 'challenges'
    a.classList.toggle('active', active)
    if (active) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  })
}

export default function Landing() {
  const navigate = useNavigate()
  const routeLocale = useParams().locale
  const isHome = useLocation().pathname.endsWith("/home")
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const section = searchParams.get('section')
    if (!section || !['accounts', 'team', 'rules', 'how', 'platform', 'model', 'legal'].includes(section)) return
    const timer = setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }), 450)
    return () => clearTimeout(timer)
  }, [searchParams])
  useEffect(() => {
    const unbind = bindNavigation(document)
    let active = true
    let timer: ReturnType<typeof setTimeout>
    let nav: Awaited<ReturnType<typeof fetchCmsNavigation>> = null
    let footer: Awaited<ReturnType<typeof fetchCmsFooterLinks>> = null
    const render = () => {
      if (!active) return
      const locale = w().ofLang === 'en' ? 'en' : 'fa'
      renderNavigation(document, locale, `/${locale}/challenges`, nav, footer)
      document.querySelectorAll<HTMLAnchorElement>('header .brand, footer .brand').forEach(a => { a.href = `#/${locale}/home` })
      document.querySelector<HTMLAnchorElement>('.nav-cta')?.setAttribute('href', `#/${locale}/prop/trade`)
    }
    // Run after the classic translation/footer listeners, including late boot.
    const refresh = () => { clearTimeout(timer); timer = setTimeout(render, 80) }
    void Promise.all([fetchCmsNavigation(), fetchCmsFooterLinks()]).then(([n, f]) => { nav = n; footer = f; refresh() })
    addEventListener('of-language', refresh)
    const click = (event: MouseEvent) => {
      const menu = (event.target as Element)?.closest('.menu')
      if (menu) {
        // Own navigation here so classic boot timing cannot double-toggle it.
        event.preventDefault()
        event.stopPropagation()
        const open = menu.getAttribute('aria-expanded') !== 'true'
        menu.setAttribute('aria-expanded', String(open))
        document.querySelector('#navigation')?.classList.toggle('open', open)
        return
      }
      if (navigationClick(event, document)) return
      if ((event.target as Element)?.closest('#navigation a')) {
        document.querySelector('#navigation')?.classList.remove('open')
        document.querySelector('.menu')?.setAttribute('aria-expanded', 'false')
      }
    }
    const keydown = (event: KeyboardEvent) => { navigationKeyDown(event, document) }
    document.addEventListener('click', click, true)
    document.addEventListener('keydown', keydown, true)
    return () => { unbind(); active = false; clearTimeout(timer); removeEventListener('of-language', refresh); document.removeEventListener('click', click, true); document.removeEventListener('keydown', keydown, true) }
  }, [])
  useEffect(() => {
    /* the route locale is authoritative on entry — sync the stored preference
       BEFORE the legacy scripts boot, so locale.js translates to it */
    if (routeLocale === 'en' || routeLocale === 'fa') {
      w().ofLang = routeLocale
      try { localStorage.setItem('of-language', routeLocale) } catch { /* ignore */ }
      /* direct route change into the other locale (URL edit / nav link, not
         the in-page toggle): the router reuses this component without
         remounting, so re-run the legacy translation pipeline to keep the
         DOM and the URL honest */
      if (w().ofSetLanguage && document.documentElement.lang !== routeLocale) w().ofSetLanguage(routeLocale)
    }
  }, [routeLocale])
  /* wallet connect button in the landing header (#wallet-root placeholder,
     right next to nav-actions). Same RainbowKit mount as the terminal. */
  const [walletHost, setWalletHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const host = document.getElementById('wallet-root')
    if (!host || document.getElementById('rainbow-landing-host')) return
    const mount = document.createElement('div')
    mount.id = 'rainbow-landing-host'
    host.appendChild(mount)
    setWalletHost(mount)
    /* the "Sign in with a Web3 wallet" feature card opens the real RainbowKit modal
       (window.__ofOpenConnect is exposed by RainbowConnect) */
    const trigger = document.getElementById('wallet-trigger')
    const onTrigger = () => { (window as any).__ofOpenConnect?.() }
    trigger?.addEventListener('click', onTrigger)
    return () => {
      trigger?.removeEventListener('click', onTrigger)
      mount.remove()
    }
  }, [])

  useEffect(() => {
    const pageRoot = document.getElementById('builder')
    /* Only the same mounted DOM may cancel its StrictMode cleanup. */
    if (w().__ofReloadLanding && w().__ofReloadLandingRoot === pageRoot) { clearTimeout(w().__ofReloadLanding); w().__ofReloadLanding = null }

    if (!w().__ofLegacyLandingLoaded) {
      w().__ofLegacyLandingLoaded = true
      /* ALL content layers come from Directus before the legacy runtime
         boots (no hardcoded marketing fallbacks):
           ui_messages  → every landing string (ofT overrides)
           challenge_plans → the builder's commercial catalog (window.__ofPlans)
           faqs / legal_documents / footer_links → window.__ofFaqs /
           __ofLegal / __ofFooterLinks, rendered safely by features.js
         Legacy scripts boot AFTER these fetches. */
      void (async () => {
        /* fresh content on every landing boot — the page is often reached via
           client-side navigation and must reflect the latest Directus edits */
        invalidateCmsCache()
        const [cms, plans, faqs, legal, footer] = await Promise.all([
          fetchCmsTranslations(),
          fetchCmsLegacyPlans(),
          fetchCmsFaqs(),
          fetchCmsLegal(),
          fetchCmsFooterLinks(),
        ])
        if (!pageRoot?.isConnected) return
        if (cms) {
          w().ofCmsLanding = cms.landing
          w().ofCmsLandingFa = cms.landingFa
          w().ofCmsTerminal = cms.terminal
        }
        if (plans) w().__ofPlans = plans
        if (faqs) w().__ofFaqs = faqs
        if (legal) w().__ofLegal = legal
        if (footer) w().__ofFooterLinks = footer
        STYLES.forEach(href => {
        const l = document.createElement('link')
        l.rel = 'stylesheet'
        l.href = href
        l.dataset.page = 'landing'
        document.head.appendChild(l)
      })
      // Fetch trusted bundled scripts first. A synchronous ordered insertion
      // prevents queued external scripts from booting after React removes Home.
      const sources = await Promise.all(SCRIPTS.map(async src => {
        const response = await fetch(src)
        if (!response.ok) throw new Error(`Landing asset unavailable: ${src}`)
        return { src, code: await response.text() }
      })).catch(error => { if (pageRoot?.isConnected) console.error(error); return null })
      if (!sources || !pageRoot?.isConnected) return
      for (const { src, code } of sources) {
        const script = document.createElement('script')
        script.dataset.page = 'landing'
        script.textContent = code + '\n//# sourceURL=' + new URL(src, document.baseURI).href
        document.body.appendChild(script)
      }
      /* re-fire DOMContentLoaded for the late-loaded legacy scripts.
         MUST bubble: locale.js listens on window, we dispatch on document. */
      const kick = () => {
        if (!pageRoot?.isConnected || w().__ofLandingKicked) return
        w().__ofLandingKicked = true
        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }))
        setTimeout(() => { if (pageRoot?.isConnected) { initTheme(); swapArrows(); markCurrentPage() } }, 60)
        setTimeout(() => { if (pageRoot?.isConnected) { swapArrows(); markCurrentPage() } }, 600)
      }
      kick()
      })()
    }

    initTheme()
    markCurrentPage()
    /* language toggle: re-run the arrow/nav pass AND keep the route hash in
       sync (silent replaceState — no router remount, no legacy re-boot) */
    const langHandler = () => setTimeout(() => {
      if (!pageRoot?.isConnected) return
      swapArrows()
      markCurrentPage()
      const lang = w().ofLang === 'en' ? 'en' : 'fa'
      if (routeLocale && lang !== routeLocale) {
        navigate(`/${lang}/${isHome ? "home" : "challenges"}${location.hash.includes('?') ? '?' + location.hash.split('?')[1] : ''}`, { replace: true })
      }
    }, 60)
    addEventListener('of-language', langHandler)

    /* pending cross-page scroll (e.g. terminal → "Markets" link) */
    const scrollTo = (() => { try { return sessionStorage.getItem('ofScrollTo') } catch { return null } })()
    if (scrollTo) {
      try { sessionStorage.removeItem('ofScrollTo') } catch { /* ignore */ }
      setTimeout(() => {
        const el = document.getElementById(scrollTo)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 400)
    }

    return () => {
      removeEventListener('of-language', langHandler)
      /* real navigation away: reload to tear the legacy runtime down.
         Cancelled only by a re-mount of THIS page (StrictMode / route return). */
      w().__ofReloadLandingRoot = pageRoot
      w().__ofReloadLanding = setTimeout(() => location.reload(), 120)
    }
  }, [])

  if (routeLocale !== 'en' && routeLocale !== 'fa') return <Navigate to="/fa/challenges" replace />
  return (
    <>
      {walletHost && createPortal(<RainbowConnect />, walletHost)}
      <div dangerouslySetInnerHTML={{ __html: landingBody }} />
    </>
  )
}
