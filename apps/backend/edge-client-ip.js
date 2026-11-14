/* Trusted edge client IP (ADR 0031).

   The Iran edge (infra/liara-iran) reaches this service through Render's
   proxy, so with `trust proxy` = 1 every edge visitor would appear as the
   edge's single egress IP: one shared bucket for every per-IP rate limit, and
   that one address in audit_log, auth_sessions and referral visitor hashes.

   When EDGE_CLIENT_IP_KEY is set (>= 32 characters, shared only with the edge),
   a request that carries the exact key in `X-Openfund-Edge-Key` has its
   `req.ip` replaced by the validated `X-Openfund-Edge-Client-Ip`. Any other
   request is unchanged. Both headers are always removed before routing, so
   they never reach handlers, logs or upstream calls.

   Without the key (the default), behaviour is identical to before. */
import crypto from 'node:crypto'
import net from 'node:net'

export const EDGE_KEY_HEADER = 'x-openfund-edge-key'
export const EDGE_IP_HEADER = 'x-openfund-edge-client-ip'
const MIN_KEY_LENGTH = 32

const digest = value => crypto.createHash('sha256').update(String(value)).digest()

/** null when the key is unset; throws on a configured but unusable key */
export function edgeKeyDigest(env = process.env) {
  const key = env.EDGE_CLIENT_IP_KEY || ''
  if (!key) return null
  if (key.length < MIN_KEY_LENGTH || !/^[A-Za-z0-9_-]+$/.test(key))
    throw Error(`EDGE_CLIENT_IP_KEY must be at least ${MIN_KEY_LENGTH} characters of [A-Za-z0-9_-]`)
  return digest(key)
}

/** the client IP an edge request vouches for, or null */
export function trustedEdgeClientIp(headers, keyDigest) {
  if (!keyDigest) return null
  const supplied = headers[EDGE_KEY_HEADER]
  const ip = headers[EDGE_IP_HEADER]
  if (typeof supplied !== 'string' || typeof ip !== 'string') return null
  if (!crypto.timingSafeEqual(digest(supplied), keyDigest)) return null
  const candidate = ip.trim()
  return net.isIP(candidate) ? candidate : null
}

export function edgeClientIpMiddleware(env = process.env) {
  const keyDigest = edgeKeyDigest(env)
  return (req, res, next) => {
    const ip = trustedEdgeClientIp(req.headers, keyDigest)
    delete req.headers[EDGE_KEY_HEADER]
    delete req.headers[EDGE_IP_HEADER]
    if (ip) Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true, writable: false })
    next()
  }
}
