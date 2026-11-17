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

/** sets req.trustedCountry and removes the raw header before any route runs */
export function trustedCountryMiddleware() {
  return (req, res, next) => {
    const country = trustedCountry(req.headers, req.socket?.remoteAddress)
    delete req.headers[COUNTRY_HEADER]
    Object.defineProperty(req, 'trustedCountry', { value: country, enumerable: true })
    next()
  }
}
