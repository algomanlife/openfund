/* Redirect policy shared by the application and Cloudflare (ADR 0043).

   One expression tree decides which requests may be redirected. The backend
   evaluates it (canonical-host.js). infra/cloudflare/policy.mjs serializes
   the same tree into Cloudflare rule expressions. A test evaluates both
   against every route the backend declares, so they cannot drift apart.

   ALLOW-LIST, not deny-list: only a top-level browser DOCUMENT navigation
   (GET/HEAD with `Sec-Fetch-Dest: document`, or without Sec-Fetch headers
   and an Accept that includes text/html) to a known WEBSITE PAGE path may be
   redirected. API calls (fetch/XHR send `Sec-Fetch-Dest: empty`), event
   streams, WebSocket upgrades, payment callbacks, signed sync, probes and
   assets are never page navigations, so no route list needs updating when
   the API grows. Page paths are the client router's (apps/web-react/src/main.tsx). */

export const PAGE_LOCALES = Object.freeze(['fa', 'en', 'ar', 'ru', 'zh-CN'])
/* exact page paths outside /:locale: the gateway root, the product shells and
   the legacy single-segment section links (LEGACY_SECTIONS in main.tsx).
   `/accounts` is deliberately absent: it is the authenticated GET /accounts
   API, which already shadows that legacy link on the server. */
export const PAGE_EXACT = Object.freeze([
  '/', '/terminal', '/portfolio', '/journal', '/react', '/react/',
  '/markets', '/how', '/team', '/rules', '/platform', '/model', '/legal', '/about', '/contact', '/support',
])

/* ---- expression tree ---- */
const and = (...of) => ({ t: 'and', of })
const or = (...of) => ({ t: 'or', of })
const not = x => ({ t: 'not', x })
const pathEq = v => ({ t: 'pathEq', v })
const pathPrefix = v => ({ t: 'pathPrefix', v })
const methodIn = v => ({ t: 'methodIn', v })
const hostIn = v => ({ t: 'hostIn', v })
const headerEq = (name, v) => ({ t: 'headerEq', name, v })
const headerAbsent = name => ({ t: 'headerAbsent', name })
const headerContains = (name, v) => ({ t: 'headerContains', name, v })
const country = v => ({ t: 'country', v })
const cookieContains = v => ({ t: 'cookieContains', v })
const queryContains = v => ({ t: 'queryContains', v })

export const documentNavigation = (methods = ['GET', 'HEAD']) => and(
  methodIn(methods),
  or(headerEq('sec-fetch-dest', 'document'), and(headerAbsent('sec-fetch-dest'), headerContains('accept', 'text/html'))),
)
export const pagePath = () => or(
  ...PAGE_EXACT.map(pathEq),
  ...PAGE_LOCALES.flatMap(l => [pathEq(`/${l}`), pathPrefix(`/${l}/`)]),
)

/** browser navigation on an alias host → canonical origin (301) */
export const canonicalCondition = hosts => and(hostIn(hosts), documentNavigation(), pagePath())

/** IR visitors' navigation on openfi.cloud → openfi.live (302, gated) */
export const geoCondition = () => and(
  hostIn(['openfi.cloud']), country('IR'), documentNavigation(['GET']), pagePath(),
  not(cookieContains('of-region=global')), not(cookieContains('openfund_session=')), not(queryContains('region=global')),
)

/* ---- evaluation (the backend) ----
   req: { method, host, path, query, headers (lower-case names), cookie, country } */
export function evaluate(node, req) {
  const header = name => { const v = req.headers?.[name]; return v == null ? null : Array.isArray(v) ? v.join(',') : String(v) }
  switch (node.t) {
    case 'and': return node.of.every(n => evaluate(n, req))
    case 'or': return node.of.some(n => evaluate(n, req))
    case 'not': return !evaluate(node.x, req)
    case 'pathEq': return req.path === node.v
    case 'pathPrefix': return req.path.startsWith(node.v)
    case 'methodIn': return node.v.includes(req.method)
    case 'hostIn': return node.v.includes(String(req.host || '').toLowerCase().replace(/:\d+$/, ''))
    case 'headerEq': return header(node.name) === node.v
    case 'headerAbsent': return header(node.name) === null
    case 'headerContains': return (header(node.name) ?? '').includes(node.v)
    case 'country': return req.country === node.v
    case 'cookieContains': return String(req.cookie ?? req.headers?.cookie ?? '').includes(node.v)
    case 'queryContains': return String(req.query ?? '').includes(node.v)
    default: throw Error(`unknown node ${node.t}`)
  }
}

/* ---- serialization (Cloudflare Rules language, Free-plan functions only) ---- */
const q = s => `"${String(s).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
export function toCloudflare(node) {
  switch (node.t) {
    case 'and': return node.of.map(n => wrap(n)).join(' and ')
    case 'or': return `(${node.of.map(n => wrap(n)).join(' or ')})`
    case 'not': return `not ${wrap(node.x)}`
    case 'pathEq': return `http.request.uri.path eq ${q(node.v)}`
    case 'pathPrefix': return `starts_with(http.request.uri.path, ${q(node.v)})`
    case 'methodIn': return `http.request.method in {${node.v.map(q).join(' ')}}`
    case 'hostIn': return `http.host in {${node.v.map(q).join(' ')}}`
    case 'headerEq': return `any(http.request.headers[${q(node.name)}][*] eq ${q(node.v)})`
    case 'headerAbsent': return `not any(http.request.headers.names[*] eq ${q(node.name)})`
    case 'headerContains': return `any(http.request.headers[${q(node.name)}][*] contains ${q(node.v)})`
    case 'country': return `ip.src.country eq ${q(node.v)}`
    case 'cookieContains': return `http.cookie contains ${q(node.v)}`
    case 'queryContains': return `http.request.uri.query contains ${q(node.v)}`
    default: throw Error(`unknown node ${node.t}`)
  }
}
const wrap = n => (n.t === 'and' ? `(${toCloudflare(n)})` : toCloudflare(n))
