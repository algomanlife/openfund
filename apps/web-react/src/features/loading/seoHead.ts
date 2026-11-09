import type { Location } from 'react-router-dom'
import { contentLocale, normalizeLocale } from '../../i18n/locales'

/* ---- route-driven SEO head ---------------------------------------------------
   Clean canonical URLs, locale alternates (hreflang) and indexability follow
   the browser-history route. Public translated pages are indexable with
   fa/en alternates; the authenticated product application (terminal,
   portfolio, purchases…) and legacy helper routes are noindex so search
   engines never index private surfaces. Added interface locales display
   English editorial content until translated, so they canonicalize to the
   English path. Each serving origin keeps its own canonical domain. */

const PUBLIC_ROUTES = /^\/(?:fa|en|ar|ru|zh-CN)\/(?:home|challenges|markets|rulebook|transparency|governance|faq|tools|learn|glossary|referral)(?:\/|$)/

const isPublic = (pathname: string) => PUBLIC_ROUTES.test(pathname)
const routeLocale = (pathname: string) => normalizeLocale(pathname.split('/')[1], 'fa')
const swapLocale = (pathname: string, locale: 'fa' | 'en') =>
  pathname.replace(/^\/(?:fa|en|ar|ru|zh-CN)(\/|$)/, `/${locale}$1`)

const upsertLink = (rel: string, href: string, hreflang?: string) => {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`
  let link = document.head.querySelector<HTMLLinkElement>(selector)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    if (hreflang) link.hreflang = hreflang
    document.head.append(link)
  }
  link.href = href
}

const upsertMeta = (name: string, content: string) => {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.append(meta)
  }
  meta.content = content
}

export function updateSeoHead(location: Location) {
  const { pathname } = location
  const origin = window.location.origin
  /* canonical: clean path, no query, no hash */
  const current = routeLocale(pathname)
  const canonical = origin + (pathname === '/' ? '/' : swapLocale(pathname, contentLocale(current)))
  const public_ = isPublic(pathname)
  upsertMeta('robots', public_ ? 'index,follow' : 'noindex')
  if (!public_) {
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(l => l.remove())
    document.head.querySelector('link[rel="canonical"]')?.remove()
    return
  }
  upsertLink('canonical', canonical)
  const fa = swapLocale(pathname, 'fa')
  const en = swapLocale(pathname, 'en')
  upsertLink('alternate', origin + fa, 'fa')
  upsertLink('alternate', origin + en, 'en')
  upsertLink('alternate', origin + (current === 'en' ? en : fa), 'x-default')
}
