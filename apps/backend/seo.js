/**
 * Public SEO documents: /sitemap.xml and /robots.txt.
 *
 * The indexable website routes are listed once here and mirrored by the
 * client-side head manager (apps/web-react/src/features/loading/seoHead.ts);
 * apps/web-react/test/public-content.test.mjs fails when the two disagree.
 * Each serving domain is self-canonical, so absolute URLs use the request
 * origin. The host is validated and responses vary by Host, so a forged Host
 * header cannot produce a document for another domain from a shared cache.
 * Authenticated product routes (terminal, portfolio, purchases) are excluded
 * and stay noindex.
 */
export const SITE_LOCALES = ['fa', 'en', 'ar', 'ru', 'zh-CN']

/** route → locales that publish it (the whitepaper is a fa/en publication) */
export const PUBLIC_SITE_ROUTES = [
  'home', 'challenges', 'markets', 'rulebook', 'transparency', 'revenue-model', 'live-market-access',
  'ambassador', 'coach', 'governance', 'faq', 'tools', 'learn', 'learn/glossary', 'referral', 'whitepaper',
]
const ROUTE_LOCALES = { whitepaper: ['fa', 'en'] }
export const localesFor = route => ROUTE_LOCALES[route] || SITE_LOCALES

const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$|^localhost$|^127\.0\.0\.1$/i
const escapeXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** https origin for a validated public host; null for anything else */
export function siteOrigin(hostHeader, protocol = 'https') {
  const raw = String(hostHeader || '').trim().toLowerCase()
  const [host, port, extra] = raw.split(':')
  if (extra !== undefined || !HOST.test(host || '')) return null
  if (port !== undefined && !/^\d{2,5}$/.test(port)) return null
  const local = host === 'localhost' || host === '127.0.0.1'
  return `${local ? protocol : 'https'}://${host}${port ? `:${port}` : ''}`
}

export function sitemapXml(origin) {
  const urls = []
  for (const route of PUBLIC_SITE_ROUTES) {
    const locales = localesFor(route)
    for (const locale of locales) {
      const alternates = locales.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(`${origin}/${l}/${route}`)}"/>`)
      alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}/fa/${route}`)}"/>`)
      urls.push(`  <url>\n    <loc>${escapeXml(`${origin}/${locale}/${route}`)}</loc>\n${alternates.join('\n')}\n  </url>`)
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
}

export function robotsTxt(origin) {
  return [
    'User-agent: *',
    'Allow: /',
    ...SITE_LOCALES.flatMap(l => [`Disallow: /${l}/prop/`, `Disallow: /${l}/perpetual/`]),
    'Disallow: /terminal', 'Disallow: /portfolio', 'Disallow: /admin', 'Disallow: /purchases/', 'Disallow: /invoices/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

/** Express routes; registered before the static mount and the SPA fallback. */
export function seoRoutes(app) {
  const send = (type, render) => (req, res) => {
    const origin = siteOrigin(req.headers.host, req.protocol)
    if (!origin) return res.set('Cache-Control', 'no-store').status(400).type('text/plain').send('invalid host')
    res.set('Cache-Control', 'public, max-age=3600').vary('Host').type(type).send(render(origin))
  }
  app.get('/sitemap.xml', send('application/xml', sitemapXml))
  app.get('/robots.txt', send('text/plain', robotsTxt))
}
