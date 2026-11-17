/* Cloudflare configuration for Openfund (ADR 0043). Source of truth for the
   two Cloudflare zones; openfi.live is on Liara DNS and is not managed here.
   scripts/cloudflare/plan.mjs prints the rules; scripts/cloudflare/verify-public.mjs
   checks the live behaviour over HTTPS. No credentials live in this file. */

export const CANONICAL = Object.freeze({ GLOBAL: 'https://openfi.cloud', IRAN: 'https://openfi.live' })

export const ZONES = Object.freeze({
  'openfi.cloud': { id: 'b6dd98ace3338cf967451697ae2aca61', region: 'GLOBAL' },
  'openfund.cloud': { id: '82d2772059c9047997aa4dcaeca027cd', region: 'GLOBAL' },
})
/* zones that are NOT on Cloudflare: redirects for their aliases run in the app */
export const NOT_ON_CLOUDFLARE = Object.freeze({ 'openfi.live': 'Liara DNS (ns1/ns2.liara.zone)' })

/* Expected DNS. `proxied` decides whether Cloudflare rules can see a host. */
export const DNS = Object.freeze({
  'openfi.cloud': { type: 'CNAME', content: 'openfund-our6.onrender.com', proxied: true, role: 'GLOBAL canonical website' },
  'www.openfi.cloud': { type: 'CNAME', content: 'openfi.cloud', proxied: true, role: 'GLOBAL alias → 301' },
  'openfund.cloud': { type: 'CNAME', content: 'openfund-our6.onrender.com', proxied: true, role: 'GLOBAL alias → 301' },
  'www.openfund.cloud': { type: 'CNAME', content: 'openfi.cloud', proxied: true, role: 'GLOBAL alias → 301 (proxied so the rule applies)' },
  'cms.openfi.cloud': { type: 'CNAME', content: 'openfund-cms.onrender.com', proxied: false, role: 'operational: Directus, never redirected' },
  'backstage.openfi.cloud': { type: 'CNAME', content: 'openfund-backstage.onrender.com', proxied: false, role: 'operational: Backstage, never redirected' },
  'iran.openfi.cloud': { type: 'CNAME', content: 'table-mountain.liara.cloud', proxied: false, role: 'IRAN alias, served by Liara (app redirect)' },
  'iran.openfund.cloud': { type: 'CNAME', content: 'table-mountain.liara.cloud', proxied: false, role: 'IRAN alias, served by Liara (app redirect)' },
})

export const SETTINGS = Object.freeze({ ssl: 'strict', min_tls_version: '1.2', always_use_https: 'on' })

/* Paths that are never redirected by any rule: machine traffic, APIs,
   payments, sync, probes, CMS snapshot and admin. Mirrors canonical-host.js. */
export const MACHINE_PREFIXES = Object.freeze([
  '/sync/', '/health', '/ready', '/version', '/runtime/', '/runtime-config.js', '/.well-known/', '/cms/', '/admin',
  '/auth/', '/products/', '/purchases/', '/invoices/', '/api/', '/notifications/', '/support/', '/rewards/',
  '/referral', '/chart/', '/governance/', '/live/', '/economy/', '/certificates/', '/assets/', '/legacy/', '/vendor/',
])

const notMachine = () => `not (${MACHINE_PREFIXES.map(p => `starts_with(http.request.uri.path, "${p}")`).join(' or ')})`
const readOnly = '(http.request.method in {"GET" "HEAD"})'

/** zone → canonical alias rule (301, path and query kept) */
export function canonicalRule(zone) {
  const hosts = { 'openfi.cloud': ['www.openfi.cloud'], 'openfund.cloud': ['openfund.cloud', 'www.openfund.cloud'] }[zone]
  if (!hosts) throw Error(`no canonical rule for ${zone}`)
  return {
    ref: `openfund_canonical_${zone.replace('.', '_')}`,
    description: `Openfund ADR 0043: ${hosts.join(', ')} → ${CANONICAL.GLOBAL} (301)`,
    enabled: true,
    action: 'redirect',
    expression: `(http.host in {${hosts.map(h => `"${h}"`).join(' ')}}) and ${readOnly} and ${notMachine()}`,
    action_parameters: { from_value: { status_code: 301, preserve_query_string: true,
      target_url: { expression: `concat("${CANONICAL.GLOBAL}", http.request.uri.path)` } } },
  }
}

/** IR visitors' top-level document navigations on openfi.cloud → openfi.live
 *  (302: geography changes). Disabled until the readiness gates pass. */
export function geoRule({ enabled = false } = {}) {
  const document = '(any(http.request.headers["sec-fetch-dest"][*] eq "document")' +
    ' or (not any(http.request.headers.names[*] eq "sec-fetch-dest") and any(http.request.headers["accept"][*] contains "text/html")))'
  return {
    ref: 'openfund_geo_iran',
    description: 'Openfund ADR 0043: IR browser navigation → https://openfi.live (302, gated)',
    enabled,
    action: 'redirect',
    expression: [
      '(http.host eq "openfi.cloud")', '(ip.src.country eq "IR")', '(http.request.method eq "GET")', document, notMachine(),
      'not http.cookie contains "of-region=global"', 'not http.cookie contains "openfund_session="',
      'not http.request.uri.query contains "region=global"',
    ].join(' and '),
    action_parameters: { from_value: { status_code: 302, preserve_query_string: true,
      target_url: { expression: `concat("${CANONICAL.IRAN}", http.request.uri.path)` } } },
  }
}

/** the legacy rule found on 2026-11-17: compares http.host with a literal that
 *  contains an expression, so it never matched; target was port 8443 */
export const OBSOLETE_RULES = Object.freeze([{ zone: 'openfi.cloud', id: '025b2b6238574c5c996022b6d4eb9037', description: 'Static' }])
