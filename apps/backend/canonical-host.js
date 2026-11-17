/* Canonical website domain per region (ADR 0043, owner decision 1).

   GLOBAL https://openfi.cloud · IRAN https://openfi.live. Aliases of a
   region's website answer browser navigation with 301 to the same path and
   query on the canonical origin. Cloudflare does this for the GLOBAL aliases
   it proxies; this middleware does it where Cloudflare is not in the path
   (the IRAN aliases, served by Liara directly).

     PUBLIC_ORIGIN           canonical origin, e.g. https://openfi.live
     CANONICAL_ALIAS_HOSTS   comma-separated hosts that redirect to it

   Never redirected, so machine traffic and payloads are never bounced:
   - any method other than GET and HEAD (orders, sign-in, payment callbacks,
     webhooks and signed sync are POSTs and keep working on an alias);
   - signed regional sync, health/readiness/version/status probes, ACME and
     well-known files, the CMS snapshot API, the admin API and the JSON API
     prefixes (auth, products, purchases, payments …);
   - WebSocket upgrades and event streams (Accept: text/event-stream).
   The canonical host itself is never redirected, so no loop is possible. */

const MACHINE_PATHS = [/^\/sync\//, /^\/health$/, /^\/ready$/, /^\/version$/, /^\/runtime\//, /^\/runtime-config\.js$/,
  /^\/\.well-known\//, /^\/cms\//, /^\/admin(\/|$)/,
  /* API reads from a page still open on an alias keep working there */
  /^\/(auth|products|purchases|invoices|api|notifications|support|rewards|referrals?|chart|governance|live|economy|certificates)\//]

export function canonicalConfig(env = process.env) {
  const raw = env.PUBLIC_ORIGIN || ''
  const aliases = (env.CANONICAL_ALIAS_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  if (!raw) {
    if (aliases.length) throw Error('CANONICAL_ALIAS_HOSTS needs PUBLIC_ORIGIN')
    return null
  }
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || url.port)
    throw Error('PUBLIC_ORIGIN must be a bare https origin, e.g. https://openfi.live')
  for (const h of aliases) if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)) throw Error(`CANONICAL_ALIAS_HOSTS: invalid host ${h}`)
  if (aliases.includes(url.hostname)) throw Error('CANONICAL_ALIAS_HOSTS must not contain the canonical host')
  return { origin: url.origin, host: url.hostname, aliases: new Set(aliases) }
}

/** the redirect target for a request, or null when it must be served as is */
export function canonicalRedirect(cfg, { method, host, path, url, headers = {} }) {
  if (!cfg) return null
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '')
  if (!cfg.aliases.has(h)) return null
  if (method !== 'GET' && method !== 'HEAD') return null
  if (MACHINE_PATHS.some(re => re.test(path))) return null
  if (String(headers.upgrade || '').toLowerCase() === 'websocket') return null
  if (String(headers.accept || '').includes('text/event-stream')) return null
  return cfg.origin + (url.startsWith('/') ? url : `/${url}`)
}

export function canonicalHostMiddleware(env = process.env) {
  const cfg = canonicalConfig(env)
  return (req, res, next) => {
    const target = canonicalRedirect(cfg, { method: req.method, host: req.headers.host, path: req.path, url: req.originalUrl, headers: req.headers })
    if (!target) return next()
    res.set('Cache-Control', 'public, max-age=3600')
    res.redirect(301, target)
  }
}

/* An explicit region choice (`?region=global` or `?region=iran`, e.g. a
   "stay on the international site" link) is remembered in the non-secret
   `of-region` cookie. Cloudflare's geographic redirect skips a browser that
   carries `of-region=global` (or a session), so an Iranian visitor who chose
   GLOBAL is never bounced back (ADR 0043). */
export const REGION_COOKIE = 'of-region'
export function regionChoiceMiddleware({ secure = true } = {}) {
  return (req, res, next) => {
    const choice = (req.method === 'GET' || req.method === 'HEAD') ? String(req.query?.region ?? '').toLowerCase() : ''
    if (choice === 'global' || choice === 'iran')
      res.append('Set-Cookie', `${REGION_COOKIE}=${choice}; Path=/; Max-Age=2592000; SameSite=Lax${secure ? '; Secure' : ''}`)
    next()
  }
}
