/* Trusted visitor country (ADR 0043).

   Cloudflare adds `CF-IPCountry` to proxied requests (zone setting "IP
   Geolocation"), but the Render origin is also reachable directly at its
   onrender.com host, where a client can send any header. The country is
   therefore trusted only when the hop that reached this service's proxy is a
   Cloudflare address (Cloudflare replaces the header on every request it
   proxies). Otherwise the country is unknown and the regional fallback
   applies. The header is removed before routing either way.

   The hop is the last X-Forwarded-For entry: Render's (and Liara's) front
   proxy appends the address that connected to it. Without that header (local
   runs) the socket peer is used.

   The country only chooses a default language. Nothing financial, no access
   decision and no geographic routing depends on it: routing happens at
   Cloudflare's edge, which sees the real connection. */
import net from 'node:net'
import { lookupIp } from './geo-ipdb.js'

/* Cloudflare's published ranges, https://www.cloudflare.com/ips-v4 and
   https://www.cloudflare.com/ips-v6 (2026-11-17). A stale list only makes a
   visitor fall back to the default language; it never grants anything. */
export const CLOUDFLARE_IPV4 = Object.freeze([
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
])
export const CLOUDFLARE_IPV6 = Object.freeze([
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
])

const cloudflare = new net.BlockList()
for (const r of CLOUDFLARE_IPV4) { const [a, p] = r.split('/'); cloudflare.addSubnet(a, Number(p), 'ipv4') }
for (const r of CLOUDFLARE_IPV6) { const [a, p] = r.split('/'); cloudflare.addSubnet(a, Number(p), 'ipv6') }

export const COUNTRY_HEADER = 'cf-ipcountry'

export function isCloudflareAddress(ip) {
  let a = String(ip || '').trim()
  if (a.startsWith('::ffff:') && net.isIPv4(a.slice(7))) a = a.slice(7)
  const family = net.isIP(a)
  return family === 4 ? cloudflare.check(a, 'ipv4') : family === 6 ? cloudflare.check(a, 'ipv6') : false
}

/** the address that connected to the platform's front proxy */
export function proxyPeer(headers, socketAddress) {
  const xff = headers['x-forwarded-for']
  const list = (Array.isArray(xff) ? xff.join(',') : String(xff || '')).split(',').map(s => s.trim()).filter(Boolean)
  return list.length ? list[list.length - 1] : socketAddress
}

/** ISO country (upper case) when it provably came from Cloudflare, else null */
export function trustedCountry(headers, socketAddress) {
  const value = headers[COUNTRY_HEADER]
  if (typeof value !== 'string' || !/^[A-Za-z0-9]{2}$/.test(value.trim())) return null
  return isCloudflareAddress(proxyPeer(headers, socketAddress)) ? value.trim().toUpperCase() : null
}

/** the X-Forwarded-For entry `hop` positions from the right (1 = the last,
 *  appended by the platform proxy); entries further left are client-written */
export function forwardedAddress(headers, socketAddress, hop = 1) {
  const xff = headers['x-forwarded-for']
  const list = (Array.isArray(xff) ? xff.join(',') : String(xff || '')).split(',').map(s => s.trim()).filter(Boolean)
  if (!list.length) return hop === 1 ? socketAddress : null
  return list.length >= hop ? list[list.length - hop] : null
}

/* OF-2026-11-08/-19: the visitor address behind Cloudflare. With
   `trust proxy 1`, req.ip is the address that connected to Render's proxy,
   which is a Cloudflare edge for every request through the GLOBAL domains. All
   visitors on one edge then shared one rate-limit bucket and one audit IP.
   CF-Connecting-IP is used only when that connecting address is inside
   Cloudflare's published ranges (the same proof trustedCountry uses); on a
   direct request to the Render host it is a client-written header and is
   ignored. */
export const CLIENT_IP_HEADER = 'cf-connecting-ip'
export function cloudflareClientIp(headers, socketAddress) {
  const value = headers[CLIENT_IP_HEADER]
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (!net.isIP(candidate)) return null
  return isCloudflareAddress(proxyPeer(headers, socketAddress)) ? candidate : null
}
export function cloudflareClientIpMiddleware() {
  return (req, res, next) => {
    const ip = cloudflareClientIp(req.headers, req.socket?.remoteAddress)
    delete req.headers[CLIENT_IP_HEADER]
    if (ip) Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true, writable: false })
    next()
  }
}

/* Country source per region (ADR 0043):
     GEO_COUNTRY_SOURCE=cloudflare (default)  CF-IPCountry from a Cloudflare hop (GLOBAL on Render)
     GEO_COUNTRY_SOURCE=ip-database           IPv4/IPv6 lookup of the platform-provided visitor
       address (IRAN on Liara). Needs GEOIP_DB_PATH and GEO_CLIENT_HOP: the
       X-Forwarded-For position, from the right, where the platform writes
       the visitor's address. It must be measured on the real ingress
       (GET /runtime/ingress) before it is set; there is no default. In this
       mode CF-IPCountry is never read. */
export function countryResolver(env = process.env, { loadDb } = {}) {
  const source = env.GEO_COUNTRY_SOURCE || 'cloudflare'
  if (source === 'cloudflare') return { source, resolve: (headers, socket) => trustedCountry(headers, socket), address: (headers, socket) => proxyPeer(headers, socket) }
  if (source !== 'ip-database') throw Error('GEO_COUNTRY_SOURCE must be cloudflare or ip-database')
  const hop = Number(env.GEO_CLIENT_HOP)
  if (!Number.isInteger(hop) || hop < 1 || hop > 4) throw Error('GEO_CLIENT_HOP (1-4, measured with /runtime/ingress) is required with GEO_COUNTRY_SOURCE=ip-database')
  if (!env.GEOIP_DB_PATH) throw Error('GEOIP_DB_PATH is required with GEO_COUNTRY_SOURCE=ip-database')
  const db = (loadDb ?? (async () => null))(env.GEOIP_DB_PATH)
  let table = null
  const ready = Promise.resolve(db).then(t => { table = t })
  return { source, hop, ready,
    resolve: (headers, socket) => table ? lookupIp(table, forwardedAddress(headers, socket, hop)) : null,
    address: (headers, socket) => forwardedAddress(headers, socket, hop) }
}

/** sets req.trustedCountry and removes the raw header before any route runs */
export function trustedCountryMiddleware(resolver = countryResolver({})) {
  return (req, res, next) => {
    const country = resolver.resolve(req.headers, req.socket?.remoteAddress)
    delete req.headers[COUNTRY_HEADER]
    Object.defineProperty(req, 'trustedCountry', { value: country, enumerable: true })
    next()
  }
}

/** what this runtime sees of the caller (GET /runtime/ingress): the caller's
 *  own address as the platform reports it, the hop count and whether the
 *  last hop is Cloudflare. Used once per platform to measure GEO_CLIENT_HOP. */
export function ingressReport(req, resolver) {
  const xff = String(req.headers['x-forwarded-for'] ?? '')
  const hops = xff ? xff.split(',').map(s => s.trim()).filter(Boolean) : []
  return {
    forwardedHops: hops.length,
    hopsFromRight: hops.slice().reverse().slice(0, 4),
    lastHopCloudflare: isCloudflareAddress(proxyPeer(req.headers, req.socket?.remoteAddress)),
    countrySource: resolver.source,
    country: req.trustedCountry ?? null,
  }
}
