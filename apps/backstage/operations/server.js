import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { validVerifier, verifyPassword } from './password.js'

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const payoutHash = /^0x[a-f0-9]{64}$/i
const supportRef = /^OF-[0-9]{6}-[A-Z2-9]{6}$/
const supportStatuses = ['in_progress', 'waiting_customer', 'resolved', 'closed']
const wallet = /^0x[a-f0-9]{40}$/i
const token = () => randomBytes(32).toString('base64url')
const fail = (status, code) => Object.assign(new Error(code), { status })
const PAGE_SIZE = 25
const staticFiles = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['public/app.js', 'application/javascript; charset=utf-8'],
  '/strings.js': ['public/strings.js', 'application/javascript; charset=utf-8'],
  '/style.css': ['public/style.css', 'text/css; charset=utf-8'],
  '/mark.svg': ['../../../brand/logos/mark-mint.svg', 'image/svg+xml'],
  '/persian.woff2': ['../../web-react/public/assets/openfund-persian-500-v4.woff2', 'font/woff2'],
}

const routes = {
  users: ['/admin/users', 'users', ['search', 'status', 'offset']],
  challenges: ['/admin/challenges', 'challenges', ['status', 'user_id', 'offset']],
  reviews: ['/admin/rewards/reviews', 'reviews', []],
  payouts: ['/admin/withdrawals?kind=reward', 'withdrawals', ['status', 'offset', 'scope']],
  payments: ['/admin/payments/attempts', 'attempts', ['status', 'review']],
  coupons: ['/admin/coupons', 'coupons', []],
  controlled: ['/admin/coupons/controlled', 'controlledTests', []],
  support: ['/admin/support/messages', 'messages', ['status', 'offset']],
  partners: ['/admin/partners/applications', 'applications', ['role', 'status']],
  finance: ['/admin/economy/position'],
  system: ['/admin/runtime'],
}

function origin(value, name) {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.href !== url.origin + '/' || url.username || url.password ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('Invalid ' + name)
  return url.origin
}

export function loadConfig(env = process.env) {
  const config = {
    origin: origin(env.BACKSTAGE_ORIGIN, 'BACKSTAGE_ORIGIN'),
    backend: origin(env.BACKSTAGE_BACKEND_ORIGIN, 'BACKSTAGE_BACKEND_ORIGIN'),
    cms: origin(env.BACKSTAGE_DIRECTUS_ORIGIN, 'BACKSTAGE_DIRECTUS_ORIGIN'),
    realSettlement: env.BACKSTAGE_REAL_SETTLEMENT === 'true',
    owner: env.BACKSTAGE_OWNER,
    verifier: env.BACKSTAGE_PASSWORD_VERIFIER,
    credential: env.BACKSTAGE_BACKEND_TOKEN,
  }
  if (!/^[A-Za-z0-9._@-]{2,50}$/.test(config.owner || '') ||
      !validVerifier(config.verifier) ||
      !/^[!-~]{24,256}$/.test(config.credential || '')) throw new Error('Backstage owner provisioning is incomplete')
  if (env.NODE_ENV === 'production' && [config.origin, config.backend, config.cms].some(url => !url.startsWith('https:')))
    throw new Error('Backstage production origins must use HTTPS')
  return config
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

async function json(req) {
  if (req.headers['content-type'] !== 'application/json') throw fail(415, 'invalid_request')
  const chunks = []
  let bytes = 0
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length
    if (bytes > 8192) throw fail(413, 'invalid_request')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks))
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
  } catch {}
  throw fail(400, 'invalid_request')
}

export function createBackstage(config, { now = Date.now, audit = event => console.log(JSON.stringify(event)) } = {}) {
  const secure = config.origin.startsWith('https:')
  const cookieName = secure ? '__Host-openfund-backstage' : 'openfund-backstage-local'
  const duration = 8 * 60 * 60_000
  const idleDuration = 30 * 60_000
  const windowSize = 5 * 60_000
  let session, attempts = { until: 0, count: 0 }, hashing = 0
  const cookie = (id, maxAge) => `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`

  async function authenticate(password, usernameMatches = true) {
    if (attempts.until <= now()) attempts = { until: now() + windowSize, count: 0 }
    if (attempts.count >= 10 || hashing >= 2) throw fail(429, 'try_later')
    attempts.count++
    hashing++
    try {
      if (!(await verifyPassword(password, config.verifier)) || !usernameMatches) throw fail(401, 'invalid_credentials')
      attempts.count = 0
    } finally { hashing-- }
  }

  async function backend(path, method = 'GET', body, correlationId) {
    const target = new URL(config.backend)
    const queryStart = path.indexOf('?')
    // Assign URL components independently so operation data cannot change the origin.
    target.pathname = queryStart === -1 ? path : path.slice(0, queryStart)
    if (queryStart !== -1) target.search = path.slice(queryStart)
    try {
      const res = await fetch(target, {
        method, redirect: 'error', signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${config.credential}`, 'X-Admin-Actor': config.owner,
          'X-Request-Id': correlationId, ...(body && { 'Content-Type': 'application/json' }) },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        await res.body?.cancel()
        throw fail([400, 404, 409, 429].includes(res.status) ? res.status : 502, 'backend_rejected')
      }
      return await res.json()
    } catch (error) {
      if (error.status) throw error
      throw fail(502, 'backend_unavailable')
    }
  }

  async function confirmOwner(current, password, correlationId) {
    await authenticate(password)
    const runtime = await backend('/runtime/status', 'GET', undefined, correlationId)
    if (runtime.region !== 'GLOBAL' || runtime.mode !== 'GLOBAL_CONNECTED') throw fail(409, 'wrong_region')
    if (current !== session || now() >= Math.min(current.expires, current.idle)) throw fail(401, 'sign_in_required')
  }

  const server = createServer(async (req, res) => {
    const correlationId = randomUUID()
    const log = (action, outcome, target) => audit({ event: 'backstage', timestamp: new Date(now()).toISOString(),
      actor: config.owner, action, outcome, target, correlationId })
    res.setHeader('X-Request-Id', correlationId)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000')
    try {
      const url = new URL(req.url, config.origin)
      const path = url.pathname
      if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true })
      if (req.headers.host !== new URL(config.origin).host || url.origin !== config.origin) throw fail(404, 'not_found')
      if (req.method === 'GET' && Object.hasOwn(staticFiles, path)) {
        const [file, contentType] = staticFiles[path]
        const data = await readFile(new URL(file, import.meta.url))
        res.writeHead(200, { 'Content-Type': contentType })
        return res.end(data)
      }
      if (!path.startsWith('/api/')) throw fail(404, 'not_found')
      if (!['GET', 'POST'].includes(req.method)) throw fail(405, 'not_found')
      if (req.method === 'POST' && req.headers.origin !== config.origin) throw fail(403, 'invalid_origin')

      if (path === '/api/login' && req.method === 'POST') {
        try {
          const { username, password } = await json(req)
          await authenticate(password, username === config.owner)
          session = { id: token(), csrf: token(), expires: now() + duration, idle: now() + idleDuration }
          res.setHeader('Set-Cookie', cookie(session.id, duration / 1000))
          log('sign_in', 'success')
          return send(res, 200, { owner: config.owner, csrf: session.csrf, cms: config.cms })
        } catch (error) {
          log('sign_in', 'denied')
          throw error
        }
      }

      const id = (req.headers.cookie || '').split(/;\s*/).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
      const current = session
      if (!current || id !== current.id || now() >= Math.min(current.expires, current.idle))
        throw fail(401, 'sign_in_required')
      if (req.method === 'POST' && req.headers['x-csrf-token'] !== current.csrf) throw fail(403, 'invalid_origin')
      current.idle = now() + idleDuration
      if (path === '/api/session' && req.method === 'GET')
        return send(res, 200, { owner: config.owner, csrf: current.csrf, cms: config.cms })
      if (path === '/api/logout' && req.method === 'POST') {
        session = undefined
        res.setHeader('Set-Cookie', cookie('', 0))
        log('sign_out', 'success')
        return send(res, 200, { ok: true })
      }

      const [, , section, record, extra] = path.split('/')
      if (extra !== undefined || !Object.hasOwn(routes, section)) throw fail(404, 'not_found')
      const [endpoint, list, filters] = routes[section]
      if (req.method === 'GET') {
        if (section === 'support' && supportRef.test(record || ''))
          return send(res, 200, await backend(endpoint + '/' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'payments' && uuid.test(record || ''))
          return send(res, 200, await backend('/admin/payments/lookup?orderId=' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (record !== undefined && !uuid.test(record)) throw fail(404, 'not_found')
        if (section === 'challenges' && record) return send(res, 200, await backend('/admin/backstage/challenges/' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'users' && record) return send(res, 200, await backend(endpoint + '/' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'payouts' && record) {
          const root = '/admin/withdrawals/' + encodeURIComponent(record)
          const [detail, trail, thread] = await Promise.all([
            backend(root + '/reward', 'GET', undefined, correlationId),
            backend(root + '/audit', 'GET', undefined, correlationId),
            backend(root + '/thread', 'GET', undefined, correlationId),
          ])
          return send(res, 200, { ...detail, ...trail, thread, realSettlement: config.realSettlement === true })
        }
        if (record !== undefined) throw fail(404, 'not_found')
        if (section === 'system') {
          const [runtime, readiness, version] = await Promise.allSettled([
            backend(endpoint, 'GET', undefined, correlationId),
            backend('/ready', 'GET', undefined, correlationId),
            backend('/version', 'GET', undefined, correlationId),
          ])
          const r = runtime.value
          return send(res, 200, { region: r?.region, mode: r?.mode, epoch: r?.epoch,
            backendReady: readiness.value?.ok === true, version: version.value?.version, commit: version.value?.commit })
        }
        const target = new URL(endpoint, config.backend)
        for (const name of filters || []) {
          const value = url.searchParams.get(name)
          if (value !== null && value.length <= 80) target.searchParams.set(name, value)
        }
        if (filters?.includes('offset')) target.searchParams.set('limit', String(PAGE_SIZE))
        const data = await backend(target.pathname + target.search, 'GET', undefined, correlationId)
        if (section === 'payouts' && target.searchParams.get('scope') === 'test' &&
            data.withdrawals?.some(row => row.test_mode !== true))
          return send(res, 200, { rows: [], total: 0 })
        return send(res, 200, list ? { rows: data[list], total: data.total ?? null } : data)
      }
      if (section === 'controlled' && ['instant', 'standard'].includes(record)) {
        const { action, walletAddress, password } = await json(req)
        if (!['issue', 'revoke'].includes(action) || (action === 'issue' && (typeof walletAddress !== 'string' || !wallet.test(walletAddress))))
          throw fail(400, 'invalid_request')
        try {
          await confirmOwner(current, password, correlationId)
          const revoke = action === 'revoke'
          const data = await backend(endpoint + (revoke ? '/' + record + '/revoke' : ''), 'POST',
            revoke ? {} : { profile: record, walletAddress }, correlationId)
          log('controlled.' + action, 'success', data.id)
          return send(res, 200, data)
        } catch (error) {
          log('controlled.' + action, 'denied', record)
          throw error
        }
      }
      const permitted = {
        reviews: ['approve', 'reject'],
        payouts: ['approve', 'reject', 'simulate', 'settle', 'reply', 'resolve_appeal'],
        support: supportStatuses,
        payments: ['reverify'],
      }
      const identifier = section === 'support' ? supportRef : uuid
      if (!Object.hasOwn(permitted, section) || !identifier.test(record || '')) throw fail(404, 'not_found')
      const { action, reason, password, payoutRef } = await json(req)
      if (!permitted[section].includes(action) || (action !== 'reverify' && (typeof reason !== 'string' || reason.length > 500 || !reason.trim())))
        throw fail(400, 'invalid_request')
      const settlement = action === 'settle'
      if (settlement && config.realSettlement !== true) throw fail(409, 'settlement_disabled')
      if (settlement && (typeof payoutRef !== 'string' || !payoutHash.test(payoutRef.trim())))
        throw fail(400, 'invalid_payout_hash')
      const note = action === 'reverify' ? undefined : reason.trim()
      const payout = section === 'payouts'
      const correspondence = ['reply', 'resolve_appeal'].includes(action)
      const destination = payout ? `/admin/withdrawals/${encodeURIComponent(record)}/${settlement ? 'settle-reward' : correspondence ? 'thread' : 'review'}` :
        section === 'payments' ? endpoint + '/' + encodeURIComponent(record) + '/reverify' : endpoint + '/' + encodeURIComponent(record)
      const payload = correspondence ? { action, message: note } :
        settlement ? { action: 'paid', note, payoutRef: payoutRef.trim().toLowerCase() } :
        payout ? { action, note } :
        section === 'support' ? { status: action, internalNote: note } :
        section === 'payments' ? {} : { decision: action, note }
      try {
        await confirmOwner(current, password, correlationId)
        await backend(destination, 'POST', payload, correlationId)
        log(section + '.' + action, 'success', record)
        return send(res, 200, { ok: true })
      } catch (error) {
        log(section + '.' + action, 'denied', record)
        throw error
      }
    } catch (error) {
      if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : 'unexpected_error' })
    }
  })
  server.requestTimeout = 20_000
  server.headersTimeout = 10_000
  return server
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    createBackstage(loadConfig()).listen(Number(process.env.PORT || 8400), '0.0.0.0', () => console.log('Backstage is listening'))
  } catch {
    console.error('Backstage configuration is incomplete or invalid')
    process.exitCode = 1
  }
}
