/**
 * Private, encrypted S3-compatible storage for migration evidence (ADR 0051).
 *
 *   MIGRATION_STORAGE_ENDPOINT          https origin, e.g. https://s3.eu-central-1.amazonaws.com
 *                                       or an S3-compatible provider's endpoint
 *   MIGRATION_STORAGE_BUCKET            private bucket (no public access)
 *   MIGRATION_STORAGE_REGION            signing region (default us-east-1)
 *   MIGRATION_STORAGE_ACCESS_KEY_ID     secret (render.yaml sync:false)
 *   MIGRATION_STORAGE_SECRET_ACCESS_KEY secret (render.yaml sync:false)
 *   MIGRATION_STORAGE_PATH_STYLE        '1' for path-style URLs (most S3-compatible providers)
 *
 * Every object is written with server-side encryption (AES256) and is never
 * public: reviewers receive a presigned GET that expires in minutes and
 * forces a download (Content-Disposition: attachment). Until every value is
 * present `configured` is false and the request form says "opening soon".
 * AWS Signature Version 4 is implemented here (no SDK dependency).
 */
import crypto from 'node:crypto'

const fail = (status, error) => Object.assign(new Error(error), { status })
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest()
/* RFC 3986 encoding as SigV4 requires */
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const encPath = key => key.split('/').map(enc).join('/')

export function createMigrationStorage(env = process.env, { fetchImpl = fetch, now = () => new Date() } = {}) {
  const endpoint = String(env.MIGRATION_STORAGE_ENDPOINT || '').trim().replace(/\/+$/, '')
  const bucket = String(env.MIGRATION_STORAGE_BUCKET || '').trim()
  const region = String(env.MIGRATION_STORAGE_REGION || 'us-east-1').trim()
  const accessKey = String(env.MIGRATION_STORAGE_ACCESS_KEY_ID || '').trim()
  const secretKey = String(env.MIGRATION_STORAGE_SECRET_ACCESS_KEY || '').trim()
  const pathStyle = env.MIGRATION_STORAGE_PATH_STYLE === '1'
  let origin = null
  try {
    const u = new URL(endpoint)
    const local = ['localhost', '127.0.0.1'].includes(u.hostname) && env.NODE_ENV !== 'production'
    if ((u.protocol === 'https:' || (local && u.protocol === 'http:')) && !u.username && !u.password && u.pathname === '/' && !u.search) origin = u
  } catch { /* not configured */ }
  const configured = !!(origin && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) && /^[a-z0-9-]{2,30}$/.test(region) && accessKey.length >= 8 && secretKey.length >= 16)

  const target = key => {
    if (!configured) throw fail(503, 'storage_not_configured')
    if (!/^[A-Za-z0-9/_.-]{1,512}$/.test(key) || key.includes('..')) throw fail(400, 'invalid_object_key')
    const host = pathStyle ? origin.host : `${bucket}.${origin.host}`
    const path = pathStyle ? `/${bucket}/${encPath(key)}` : `/${encPath(key)}`
    return { host, path, base: `${origin.protocol}//${host}` }
  }
  const scopeOf = date => `${date.slice(0, 8)}/${region}/s3/aws4_request`
  const signingKey = date => hmac(hmac(hmac(hmac('AWS4' + secretKey, date.slice(0, 8)), region), 's3'), 'aws4_request')
  const stamp = () => now().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  /** Signed request with the payload hash in the headers (PUT, DELETE). */
  async function signed(method, key, { body = Buffer.alloc(0), headers = {} } = {}) {
    const { host, path, base } = target(key)
    const amzDate = stamp()
    const payloadHash = sha256(body)
    const all = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])) }
    const names = Object.keys(all).sort()
    const canonical = [method, path, '', names.map(n => `${n}:${all[n].trim()}\n`).join(''), names.join(';'), payloadHash].join('\n')
    const toSign = ['AWS4-HMAC-SHA256', amzDate, scopeOf(amzDate), sha256(canonical)].join('\n')
    const signature = crypto.createHmac('sha256', signingKey(amzDate)).update(toSign).digest('hex')
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scopeOf(amzDate)}, SignedHeaders=${names.join(';')}, Signature=${signature}`
    const { host: _h, ...sent } = all
    const res = await fetchImpl(base + path, { method, body: method === 'PUT' ? body : undefined, redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { ...sent, Authorization: authorization } })
      .catch(() => { throw fail(502, 'storage_unavailable') })
    await res.body?.cancel?.()
    if (!res.ok && !(method === 'DELETE' && res.status === 404)) throw fail(502, 'storage_rejected')
    return res.status
  }

  return {
    configured,
    /** Store one object, encrypted at rest by the provider. */
    put: (key, body, contentType) => signed('PUT', key, { body, headers: { 'content-type': contentType, 'x-amz-server-side-encryption': 'AES256' } }),
    /** Delete one object (a missing object counts as deleted). */
    remove: key => signed('DELETE', key),
    /** Presigned GET that expires after `seconds` and forces a download. */
    presign(key, { seconds = 300, filename = 'evidence', maxSeconds = 900 } = {}) {
      const { path, base } = target(key)
      const expires = Math.max(30, Math.min(maxSeconds, Math.floor(seconds)))
      const amzDate = stamp()
      const query = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${accessKey}/${scopeOf(amzDate)}`, 'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(expires), 'X-Amz-SignedHeaders': 'host',
        /* filename null only for the published signing test vector */
        ...(filename === null ? {} : { 'response-content-disposition': `attachment; filename="${String(filename).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}"` }),
      }
      const qs = Object.keys(query).sort().map(k => `${enc(k)}=${enc(query[k])}`).join('&')
      const host = new URL(base).host
      const canonical = ['GET', path, qs, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
      const toSign = ['AWS4-HMAC-SHA256', amzDate, scopeOf(amzDate), sha256(canonical)].join('\n')
      const signature = crypto.createHmac('sha256', signingKey(amzDate)).update(toSign).digest('hex')
      return { url: `${base}${path}?${qs}&X-Amz-Signature=${signature}`, expiresInSeconds: expires }
    },
  }
}

/* ------------------------------------------------ upload validation */

/** Accepted evidence files: type by magic bytes (the declared type must
 *  agree), size cap per type, and content checks. There is no antivirus
 *  engine: only inert formats are accepted, active PDF content is refused,
 *  and files are only ever delivered as downloads through signed URLs. */
export const EVIDENCE_TYPES = {
  'application/pdf': { ext: 'pdf', max: 10 * 1024 * 1024, magic: b => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/png': { ext: 'png', max: 10 * 1024 * 1024, magic: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: 'jpg', max: 10 * 1024 * 1024, magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: 'webp', max: 10 * 1024 * 1024, magic: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  'video/mp4': { ext: 'mp4', max: 40 * 1024 * 1024, magic: b => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  'video/webm': { ext: 'webm', max: 40 * 1024 * 1024, magic: b => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
}
export const MAX_EVIDENCE_BYTES = 40 * 1024 * 1024

export function validateEvidenceFile(buffer, declaredType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw fail(400, 'file_empty')
  const spec = EVIDENCE_TYPES[String(declaredType || '').split(';')[0].trim().toLowerCase()]
  if (!spec) throw fail(415, 'file_type_not_accepted')
  if (buffer.length > spec.max) throw fail(413, 'file_too_large')
  if (!spec.magic(buffer)) throw fail(415, 'file_type_mismatch')
  if (spec.ext === 'pdf') {
    /* active content: scripts, launch actions, embedded files, form
       submission (a plain /OpenAction view setting is common and inert) */
    const text = buffer.toString('latin1')
    if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|SubmitForm|ImportData)\b/.test(text)) throw fail(422, 'file_active_content')
  }
  return { ext: spec.ext, size: buffer.length, sha256: sha256(buffer) }
}
