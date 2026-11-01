/**
 * Openfund backend — wallet identity (SIWE), sessions, users & challenges.
 *
 * Security model:
 *  - Directus stays the ADMIN data interface; this service is the ONLY
 *    authentication and ownership boundary for wallet users.
 *  - Cookies: opaque session id, HttpOnly, SameSite=Lax (Secure in prod),
 *    server-side expiry, hashed at rest. No privileged tokens in the frontend.
 *  - SIWE per EIP-4361: fresh single-use nonce (10 min TTL), domain + chain
 *    validated, signature verified with viem (EIP-1271 where applicable).
 *  - One wallet address (normalized lowercase) = exactly one Openfund user.
 */
import crypto from 'node:crypto'
import express from 'express'
import { createClient, isHex, http } from 'viem'
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe'
import { arbitrumSepolia } from 'viem/chains'
import pg from 'pg'
import { marketData } from './market-data.js'
import { Engine } from './engine.js'

const cfg = {
  port: Number(process.env.PORT || 8080),
  dbUrl: process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms',
  /* allowed SIWE domains (frontend builds the message with window.location.host) */
  domains: (process.env.ALLOWED_DOMAINS || 'localhost:5173,localhost:4173,127.0.0.1:5173,127.0.0.1:4173').split(','),
  sessionTtlH: Number(process.env.SESSION_TTL_HOURS || 24 * 7),
  nonceTtlMs: 10 * 60 * 1000,
  prod: process.env.NODE_ENV === 'production',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173').split(',')
}

const pool = new pg.Pool({ connectionString: cfg.dbUrl })
const engine = new Engine(pool, marketData)
const app = express()
app.use(express.json({ limit: '32kb' }))

/* ---------- CORS (credentials for session cookies) ---------- */
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && cfg.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

/* ---------- tiny in-memory rate limiter (per ip+route) ---------- */
const hits = new Map()
setInterval(() => hits.clear(), 60_000).unref()
const limit = (max, window = 60_000) => (req, res, next) => {
  const key = `${req.ip}:${req.path}`
  const n = (hits.get(key) || 0) + 1
  hits.set(key, n)
  if (n > max) return res.status(429).json({ error: 'rate_limited' })
  next()
}

const audit = (action, userId = null, req = null, details = {}) =>
  pool.query('INSERT INTO audit_log (action, user_id, ip, details) VALUES ($1,$2,$3,$4)',
    [action, userId, req?.ip || null, JSON.stringify(details)]).catch(() => {})

/* ---------- session helpers ---------- */
const COOKIE = 'openfund_session'
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex')
const newSessionId = () => crypto.randomBytes(32).toString('base64url')

function setSessionCookie(res, sid) {
  res.cookie ??= null
  // express's res.cookie is set by cookie-parser? no — use manual header
  res.setHeader('Set-Cookie',
    `${COOKIE}=${sid}; HttpOnly; Path=/; Max-Age=${cfg.sessionTtlH * 3600}; SameSite=Lax${cfg.prod ? '; Secure' : ''}`)
}
const clearSessionCookie = (res) =>
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${cfg.prod ? '; Secure' : ''}`)

function parseCookie(header) {
  const out = {}
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k) out[k] = v.join('=')
  }
  return out
}

async function userFromSession(req) {
  const sid = parseCookie(req.headers.cookie)[COOKIE]
  if (!sid) return null
  const { rows } = await pool.query(
    `SELECT s.user_id, u.wallet_address, u.display_name, u.status, u.created_at, u.last_login_at,
            (s.expires_at > now()) AS valid
       FROM auth_sessions s JOIN openfund_users u ON u.id = s.user_id
      WHERE s.id_hash = $1`, [sha(sid)])
  const row = rows[0]
  if (!row || !row.valid) return null
  await pool.query('UPDATE auth_sessions SET last_seen = now() WHERE id_hash = $1', [sha(sid)]).catch(() => {})
  return row
}

const requireAuth = async (req, res, next) => {
  try {
    const user = await userFromSession(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    if (user.status === 'suspended') {
      clearSessionCookie(res)
      return res.status(403).json({ error: 'account_suspended' })
    }
    req.user = user
    next()
  } catch (e) {
    res.status(500).json({ error: 'internal' })
  }
}

/* public client for EIP-1271 contract-wallet signature checks */
const client = createClient({ chain: arbitrumSepolia, transport: http() })

/* =================  AUTH  ================= */

/* 1 — nonce */
app.post('/auth/nonce', limit(60), async (req, res) => {
  try {
    const address = String(req.body?.address || '').toLowerCase()
    if (!isHex(address) || address.length !== 42) return res.status(400).json({ error: 'invalid_address' })
    const nonce = crypto.randomBytes(16).toString('hex')  /* alphanumeric per EIP-4361 */
    await pool.query(
      'INSERT INTO auth_nonces (nonce, address, expires_at) VALUES ($1,$2, now() + $3::interval)',
      [nonce, address, `${cfg.nonceTtlMs} milliseconds`])
    res.json({ nonce, expiresInMs: cfg.nonceTtlMs })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'internal' })
  }
})

/* 2 — verify SIWE */
app.post('/auth/verify', limit(60), async (req, res) => {
  try {
    const { message, signature } = req.body || {}
    if (typeof message !== 'string' || !isHex(signature)) return res.status(400).json({ error: 'invalid_payload' })

    const parsed = parseSiweMessage(message)
    if (!parsed.address) return res.status(400).json({ error: 'invalid_message' })
    if (!parsed.nonce) return res.status(400).json({ error: 'missing_nonce' })
    if (!cfg.domains.includes(parsed.domain)) return res.status(400).json({ error: 'invalid_domain' })
    const wantChain = BigInt(parsed.chainId ?? 0)
    if (wantChain !== BigInt(arbitrumSepolia.id)) return res.status(400).json({ error: 'invalid_chain' })

    /* nonce must exist, belong to this address, be fresh and unused */
    const { rows: nonceRows } = await pool.query(
      'SELECT address, used_at, expires_at FROM auth_nonces WHERE nonce = $1', [parsed.nonce])
    const nonceRow = nonceRows[0]
    if (!nonceRow) return res.status(400).json({ error: 'unknown_nonce' })
    if (nonceRow.used_at) return res.status(400).json({ error: 'nonce_reused' })
    if (new Date(nonceRow.expires_at) < new Date()) return res.status(400).json({ error: 'nonce_expired' })
    if (nonceRow.address !== parsed.address.toLowerCase()) return res.status(400).json({ error: 'nonce_address_mismatch' })

    /* cryptographic verification (viem handles EIP-1271 for contract wallets via client) */
    let ok = false
    try {
      /* viem signature: verifySiweMessage(client, params) — covers EOAs (EIP-191)
         and contract wallets (EIP-1271 / ERC-6492) via the public client */
      ok = await verifySiweMessage(client, {
        address: parsed.address, message, signature,
        domain: parsed.domain, nonce: parsed.nonce
      })
    } catch { ok = false }  /* malformed signature → invalid */
    if (!ok) { await audit('auth_failed', null, req, { address: parsed.address }); return res.status(401).json({ error: 'invalid_signature' }) }

    /* burn the nonce */
    await pool.query('UPDATE auth_nonces SET used_at = now() WHERE nonce = $1', [parsed.nonce])

    /* one wallet = one user (normalized lowercase, unique constraint is the final guard) */
    const address = parsed.address.toLowerCase()
    const { rows } = await pool.query(
      `INSERT INTO openfund_users (wallet_address, wallet_chain, last_login_at)
       VALUES ($1, $2, now())
       ON CONFLICT (wallet_address)
       DO UPDATE SET last_login_at = now(), updated_at = now()
       RETURNING id, wallet_address, status, display_name, created_at, last_login_at`,
      [address, arbitrumSepolia.id])
    const user = rows[0]
    if (user.status === 'suspended') {
      await audit('auth_blocked_suspended', user.id, req, {})
      return res.status(403).json({ error: 'account_suspended' })
    }

    /* every new user gets ONE free demo account with exactly 100,000 DAI —
       atomic + idempotent (DB constraint prevents duplicate credits) */
    const demo = await engine.ensureDemoAccount(user.id).catch(e => { console.error(e); null })
    if (!demo) return res.status(500).json({ error: 'internal' })

    const sid = newSessionId()
    await pool.query(
      'INSERT INTO auth_sessions (id_hash, user_id, expires_at, user_agent, ip) VALUES ($1,$2, now() + $3::interval, $4, $5)',
      [sha(sid), user.id, `${cfg.sessionTtlH} hours`, String(req.headers['user-agent'] || '').slice(0, 200), req.ip || null])
    setSessionCookie(res, sid)
    await audit('auth_login', user.id, req, { address })
    res.json({ user: { id: user.id, walletAddress: user.wallet_address, displayName: user.display_name, createdAt: user.created_at } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'internal' })
  }
})

/* 3 — me (+ challenges, ownership enforced by session join) */
app.get('/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.status, c.created_at, c.started_at, c.completed_at,
            p.slug AS plan_slug, p.name AS plan_name, p.configuration AS plan_configuration
       FROM openfund_challenges c JOIN challenge_plans p ON p.id = c.challenge_plan_id
      WHERE c.user_id = $1 ORDER BY c.created_at DESC`, [req.user.user_id])
  res.json({
    user: {
      id: req.user.user_id,
      walletAddress: req.user.wallet_address,
      displayName: req.user.display_name,
      status: req.user.status,
      createdAt: req.user.created_at,
      lastLoginAt: req.user.last_login_at
    },
    challenges: rows
  })
})

/* 4 — logout */
app.post('/auth/logout', async (req, res) => {
  const sid = parseCookie(req.headers.cookie)[COOKIE]
  if (sid) {
    const { rows } = await pool.query('DELETE FROM auth_sessions WHERE id_hash = $1 RETURNING user_id', [sha(sid)])
    if (rows[0]) await audit('auth_logout', rows[0].user_id, req, {})
  }
  clearSessionCookie(res)
  res.json({ ok: true })
})

/* =================  TRADING (auth-guarded, server-authoritative)  ================ */

const tradingAuth = async (req, res, next) => {
  try {
    const user = await userFromSession(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    if (user.status === 'suspended') return res.status(403).json({ error: 'account_suspended' })
    req.user = user
    next()
  } catch { res.status(500).json({ error: 'internal' }) }
}

app.get('/trading/state', tradingAuth, async (req, res) => {
  const state = await engine.state(req.user.user_id)
  res.json(state)
})

app.post('/trading/order', tradingAuth, limit(30), async (req, res) => {
  try {
    const key = req.headers['idempotency-key'] || null
    const out = await engine.submitOrder(req.user.user_id, req.body || {}, key)
    if (!out.ok && !out.duplicate) return res.status(400).json({ error: out.reason, order: out.order })
    res.json(out)
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'internal' })
  }
})

app.post('/trading/positions/:id/close', tradingAuth, async (req, res) => {
  try {
    const out = await engine.closePosition(req.user.user_id, req.params.id)
    res.json(out)
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message })
    res.status(500).json({ error: 'internal' })
  }
})

app.post('/trading/positions/:id/protection', tradingAuth, async (req, res) => {
  try {
    const { sl, tp } = req.body || {}
    res.json(await engine.updateProtection(req.user.user_id, req.params.id, { sl, tp }))
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message })
    res.status(500).json({ error: 'internal' })
  }
})

app.post('/trading/orders/:id/cancel', tradingAuth, async (req, res) => {
  try {
    res.json(await engine.cancelOrder(req.user.user_id, req.params.id))
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message })
    res.status(500).json({ error: 'internal' })
  }
})

/* SSE live stream: account + positions + orders pushed on change (1 s heartbeat) */
app.get('/trading/stream', tradingAuth, async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.write('retry: 3000\n\n')
  let last = ''
  const push = async () => {
    try {
      const state = await engine.state(req.user.user_id)
      const snapshot = JSON.stringify(state)
      if (snapshot !== last) {           /* only push actual changes */
        last = snapshot
        res.write(`data: ${snapshot}\n\n`)
      } else {
        res.write(': hb\n\n')
      }
    } catch { /* user deleted mid-stream */ }
  }
  const onState = () => push()
  engine.onState(onState)
  const hb = setInterval(push, 1000)
  req.on('close', () => { clearInterval(hb); engine.listeners.delete(onState) })
  await push()
})

/* test-only price injection seam — enabled ONLY with SIM_TEST_MODE=1
   (never active in production): lets engine tests drive deterministic marks */
if (process.env.SIM_TEST_MODE === '1') {
  app.post('/internal/inject-price', (req, res) => {
    const { symbol, price } = req.body || {}
    if (typeof symbol !== 'string' || price == null) return res.status(400).json({ error: 'invalid' })
    marketData.injectPrice(symbol, String(price))
    res.json({ ok: true })
  })
}

/* health */
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }))
app.get('/trading/health', tradingAuth, async (req, res) => {
  const st = await engine.state(req.user.user_id)
  res.json({ ok: true, account: st.account != null, markets: marketData.markets.size })
})

/* 404 + error safety (no stack leaks) */
app.use((req, res) => res.status(404).json({ error: 'not_found' }))
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'internal' }) })

const server = app.listen(cfg.port, () => console.log(`openfund-backend :${cfg.port}`))
/* market data (authoritative server-side marks) + trading engine loop */
marketData.bootstrap().catch(e => console.error('[market-data] bootstrap failed', e.message))
engine.start(1000)
const shutdown = () => { engine.stop(); marketData.stop(); server.close(); pool.end() }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
