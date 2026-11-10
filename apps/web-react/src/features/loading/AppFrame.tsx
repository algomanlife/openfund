import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'
import { BrandedLoading, loadingGate } from './BrandedLoading'
import { updateSeoHead } from './seoHead'
import { dirOf, normalizeLocale, pick, type AppLocale } from '../../i18n/locales'
import { contentLoaded, ensureLocaleContent } from '../../i18n/messages'
import './loading.css'

/* ---- app frame ---------------------------------------------------------------
   Wraps every route so the whole platform shares:
   - pre-paint locale/direction sync (no RTL/LTR flash on language switch),
   - the branded loading gate during genuine locale transitions,
   - route-driven SEO head (canonical / hreflang / robots),
   - a click bridge that routes legacy DOM links (<a href="/fa/...">, the
     landing markup) through the router instead of full document reloads,
   - browser Back/Forward scroll restoration,
   - a recoverable error state (the loader never masks a broken route). */

const routeLocale = (pathname: string): AppLocale => normalizeLocale(pathname.split('/')[1], 'fa')

class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) { return { error } }
  componentDidCatch(error: unknown) {
    loadingGate.reset()
    console.error('Openfund route error:', error)
  }
  render() {
    if (this.state.error) {
      const locale = routeLocale(window.location.pathname)
      return (
        <div className="of-route-error" role="alert" dir={dirOf(locale)} lang={locale}>
          <p>{pick(locale, 'صفحه بارگذاری نشد.', 'This page could not be loaded.')}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {pick(locale, 'تلاش دوباره', 'Try again')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function AppFrame() {
  const navigate = useNavigate()
  const location = useLocation()
  const locale = routeLocale(location.pathname)
  const previousLocale = useRef(locale)
  /* the route locale's editorial dictionary is loaded before its pages
     render (direct URL entry, refresh, Back/Forward and language switch) */
  const [readyLocale, setReadyLocale] = useState<AppLocale | null>(() => contentLoaded(locale) ? locale : null)
  const [dictionaryError, setDictionaryError] = useState(false)
  useEffect(() => {
    if (contentLoaded(locale)) { setReadyLocale(locale); return }
    let active = true
    loadingGate.hold('dictionary')
    ensureLocaleContent(locale)
      .then(() => { if (active) { setDictionaryError(false); setReadyLocale(locale) } })
      .catch(() => { if (active) setDictionaryError(true) })
      .finally(() => loadingGate.release('dictionary'))
    return () => { active = false; loadingGate.release('dictionary') }
  }, [locale])

  /* Direction and language are applied before the browser paints the new
     locale — Persian text can never appear inside an LTR layout (or the
     reverse) during a language switch. Genuine transitions are covered by
     the branded loader; instant ones stay instant (threshold in the gate). */
  useLayoutEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dirOf(locale)
    const changed = previousLocale.current !== locale
    previousLocale.current = locale
    if (!changed) return
    loadingGate.hold('locale')
    /* release once the new-locale render has painted (double rAF) */
    requestAnimationFrame(() => requestAnimationFrame(() => loadingGate.release('locale')))
  }, [locale])

  /* SEO head follows every route change. */
  useEffect(() => { updateSeoHead(location) }, [location])

  /* Bridge legacy DOM anchors into the router:
     - '/...' same-origin path links navigate without a document reload;
     - '#/#section' are the landing's cross-page anchors (terminal → website
       content): route to the page that owns the section and remember the
       scroll target (the same contract the hash router had);
     - plain '#section' stay in-page smooth scrolls.
     Modified/middle clicks and external targets keep native behavior. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.relList?.contains?.('external')) return
      const href = a.getAttribute('href') || ''
      if (href.startsWith('/')) {
        e.preventDefault()
        navigate(href)
        return
      }
      if (href.startsWith('#/#')) {
        e.preventDefault()
        const id = href.slice(3)
        const lang = routeLocale(location.pathname)
        if (id === 'markets') { navigate(`/${lang}/markets`); return }
        try { sessionStorage.setItem('ofScrollTo', id) } catch { /* optional */ }
        navigate(`/${lang}/challenges`)
        return
      }
      if (href.startsWith('#/') || href.length <= 1) return
      /* in-page anchor (legacy markup: #accounts, #top, …) */
      e.preventDefault()
      const id = href.slice(1)
      if (id === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [navigate, location.pathname])

  /* boot readiness: the first route has painted — retire the static
     index.html loader (unless a page has declared pending work). */
  useEffect(() => {
    const release = () => loadingGate.release('locale')
    const done = () => requestAnimationFrame(() => requestAnimationFrame(() => loadingGate.bootReady()))
    done()
    window.addEventListener('beforeunload', release)
    return () => { window.removeEventListener('beforeunload', release) }
  }, [])

  return (
    <ErrorBoundary>
      {readyLocale === locale ? <Outlet /> : dictionaryError ? (
        <div className="of-route-error" role="alert" dir={dirOf(locale)} lang={locale}>
          <p>{pick(locale, 'بارگذاری زبان انجام نشد.', 'The language could not be loaded.')}</p>
          <button type="button" onClick={() => window.location.reload()}>{pick(locale, 'تلاش دوباره', 'Try again')}</button>
        </div>
      ) : null}
      <BrandedLoading />
      <ScrollRestoration />
    </ErrorBoundary>
  )
}
