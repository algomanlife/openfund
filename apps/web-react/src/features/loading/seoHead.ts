import type { Location } from 'react-router-dom'

/* ---- route-driven SEO head ---------------------------------------------------
   Clean canonical URLs, locale alternates (hreflang) and indexability follow
   the browser-history route. Public translated pages are indexable with
   fa/en alternates; the authenticated product application (terminal,
   portfolio, purchases…) and legacy helper routes are noindex so search
   engines never index private surfaces. The canonical domain policy is
   self-canonical on the serving origin — both production domains keep
   their own canonical, none is demoted. */

const PUBLIC_ROUTES = /^\/(?:fa|en)\/(?:home|challenges|markets|rulebook|transparency|faq|tools|learn|glossary|referral)(?:\/|$)/

const isPublic = (pathname: string) => PUBLIC_ROUTES.test(pathname)
const routeLocale = (pathname: string) => (/^\/en(\/|$)/.test(pathname) ? 'en' : 'fa')
const swapLocale = (pathname: string, locale: 'fa' | 'en') =>
  pathname.replace(/^\/(?:fa|en)(\/|$)/, `/${locale}$1`)

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
  const canonical = origin + (pathname === '/' ? '/' : pathname)
  const public_ = isPublic(pathname)
  upsertMeta('robots', public_ ? 'index,follow' : 'noindex')
  if (!public_) {
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(l => l.remove())
    document.head.querySelector('link[rel="canonical"]')?.remove()
    return
  }
  upsertLink('canonical', canonical)
  const current = routeLocale(pathname)
  const fa = swapLocale(pathname, 'fa')
  const en = swapLocale(pathname, 'en')
  upsertLink('alternate', origin + fa, 'fa')
  upsertLink('alternate', origin + en, 'en')
  upsertLink('alternate', origin + (current === 'en' ? en : fa), 'x-default')
}
