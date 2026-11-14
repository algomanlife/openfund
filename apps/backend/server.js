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
import fs from 'node:fs'
import path from 'node:path'
import { releaseDiagnostics } from './release.js'
import { runtimeConfigScript } from './runtime-config.js'
import { staticCacheControl, NO_STORE } from './static-cache.js'
import { seoRoutes } from './seo.js'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createClient, isHex, http, recoverMessageAddress } from 'viem'
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe'
import { arbitrum } from 'viem/chains'
import pg from 'pg'
import { marketData } from './market-data.js'
import { Engine } from './engine.js'
import { Portfolio } from './portfolio.js'
import { productRoutes } from './products.js'
import { accountDirectory } from './accounts.js'
import { purchaseRoutes, confirmPurchase, defaultPaymentVerifier, recoverPendingPayments, paymentReadinessReport, paymentChains, DEPAY_SIGNED_PATHS } from './purchases.js'
import { adminRoutes } from './admin.js'
import { chartWorkspaceRoutes } from './chart-workspaces.js'
import { supportRoutes, supportAdminRoutes } from './support.js'
import { rewardRoutes, rewardAdminRoutes } from './rewards.js'
import { certificateRoutes, certificateAdminRoutes } from './certificates.js'
import { calendarAdminRoutes } from './conduct.js'
import { createFootprintService } from './footprint/service.js'
import { couponAdminRoutes } from './coupons.js'
import { paymentAdminRoutes } from './payments-admin.js'
import { governanceRoutes } from './governance-routes.js'
import { partnerRoutes, partnerAdminRoutes, attributeAmbassador } from './partners.js'
import { economyRoutes, economyAdminRoutes } from './economy.js'
import { liveRoutes, liveAdminRoutes, liveConfig, processSettlements, settlementAdapter } from './live-funding.js'
import { Treasury, TreasuryNetworks, treasuryNetworksConfig } from './treasury.js'
import { createTradingStreamHub } from './trading-stream.js'

const cfg = {
  port: Number(process.env.PORT || 8080),
  dbUrl: process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms',
  /* allowed SIWE domains (frontend builds the message with window.location.host) */
  domains: (process.env.ALLOWED_DOMAINS || 'localhost:5173,localhost:4173,127.0.0.1:5173,127.0.0.1:4173').split(',').map(v => v.trim()).filter(Boolean),
  sessionTtlH: Number(process.env.SESSION_TTL_HOURS || 24 * 7),
  nonceTtlMs: 10 * 60 * 1000,
  prod: process.env.NODE_ENV === 'production',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173').split(',')
}

const testDatabase = /(?:^|[_-])(test|audit|ci)(?:$|[_-])/.test(new URL(cfg.dbUrl).pathname.slice(1))
const testMode = !cfg.prod && process.env.SIM_TEST_MODE === '1' && testDatabase

const pool = new pg.Pool({ connectionString: cfg.dbUrl })
/* dedicated connections for the engine monitoring loop (SL/TP, liquidation,
   pending orders, risk sweeps): the loop is serial, so 3 covers its deepest
   nesting; it keeps risk processing out of the API pool's queue */
const loopPool = new pg.Pool({ connectionString: cfg.dbUrl, max: 3 })
const engine = new Engine(pool, marketData, { loopPool })
const portfolio = new Portfolio(pool, marketData)
/* checkStreamSessions is a hoisted function declaration (session helpers below) */
const tradingStreams = createTradingStreamHub({ engine, checkSessions: (hashes, userId) => checkStreamSessions(hashes, userId) })
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use((req,res,next) => {
  const origin = req.headers.origin
  if (origin && !['GET','HEAD','OPTIONS'].includes(req.method)) {
    const sameOrigin = origin === `${req.protocol}://${req.get('host')}`
    if (!sameOrigin && !cfg.corsOrigins.includes(origin)) return res.status(403).json({ error:'invalid_origin' })
  }
  next()
})

/* ---------- security headers ----------
   CSP allows same-origin scripts/workers/frames (the shared terminal
   runs in a same-origin iframe; its boot logic is the external
   legacy/react-boot.js and its dynamic data a non-executable JSON
   island), the hashed theme pre-paint script in index.html, inline
   styles (Vite + component styles), CMS-hosted images (Directus) and
   wss for the live market stream. CSP_EXTRA_CONNECT (comma-separated
   origins) widens connect-src for non-HTTPS local CMS deployments.
   Nothing cross-origin may script or frame us.

   APPLICATION DOCUMENTS ONLY (the /react/ HTML shell, which the srcDoc
   terminal inherits) additionally allow:
    - 'unsafe-eval' in script-src: the vendored Vela/Pine engine
      (same-origin trusted bundle) compiles indicator scripts with
      `new Function` — a computation path, not an injection surface;
    - sha256 hashes of the LANDING legacy scripts: the landing injects
      them inline (fetch → textContent) so their execution is
      synchronous with the mount check — a route change can never let
      them boot against a removed DOM (a <script src> element has an
      unavoidable fetch→execute gap). The hashes are computed at server
      startup from the exact files that ship in react/legacy/, so the
      policy allows precisely those scripts and nothing else.
   API responses keep the fully strict policy. */
/* Hash the exact inline pre-paint script in the served build. Locale and
   routing changes alter those bytes; a stale literal hash would silently
   block legacy bookmark recovery and the no-flash direction setup. */
const bootScript = fs.readFileSync(new URL('../../react/index.html', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)?.[1]
if (!bootScript) throw Error('Frontend pre-paint script missing from react/index.html')
const CSP_THEME_BOOT_HASH = "'sha256-" + crypto.createHash('sha256').update(bootScript).digest('base64') + "'"
const legacyScriptHashes = () => {
  const dir = fileURLToPath(new URL('../../react/legacy', import.meta.url))
  const names = ['locale.js', 'app.js', 'features.js', 'market.js', 'motion.js']
  const hashes = []
  for (const name of names) {
    try {
      /* hash the EXACT text the landing injects: file code + the
         deterministic relative sourceURL suffix (Landing.tsx must keep
         this suffix byte-identical) */
      const code = fs.readFileSync(path.join(dir, name))
      const injected = Buffer.concat([code, Buffer.from('\n//# sourceURL=legacy/' + name)])
      hashes.push("'sha256-" + crypto.createHash('sha256').update(injected).digest('base64') + "'")
    } catch { /* file absent from this build — the landing degrades to its error path */ }
  }
  return hashes.join(' ')
}
const CSP_LEGACY_HASHES = legacyScriptHashes()
const cspExtraConnect = (process.env.CSP_EXTRA_CONNECT || '').split(',').map(v => v.trim()).filter(Boolean).join(' ')
/* WalletConnect v2 loads its Verify API in an iframe; allowed only when a
   WalletConnect Cloud project id is configured (remote wallets enabled). */
const cspList = name => (process.env[name] || '').split(',').map(v => v.trim()).filter(v => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(v)).join(' ')
/* CSP_EXTRA_SCRIPT_SRC / CSP_EXTRA_FRAME_SRC: https origins (no paths, no
   wildcards) for the approved DePay widget, e.g. https://integrate.depay.com.
   Unset = nothing cross-origin may script or frame the application. */
const cspExtraScript = cspList('CSP_EXTRA_SCRIPT_SRC')
const cspExtraFrame = cspList('CSP_EXTRA_FRAME_SRC')
const cspWalletFrames = process.env.VITE_WALLETCONNECT_PROJECT_ID ? ' https://verify.walletconnect.org https://verify.walletconnect.com' : ''
/* The terminal's News & Information tab embeds the official TradingView
   Economic Calendar web component: an ES module (and its chunks) from
   widgets.tradingview-widget.com that renders its own iframe from
   www.tradingview-widget.com. Allowed on application documents only. */
const CSP_TV_SCRIPT = ' https://widgets.tradingview-widget.com'
const CSP_TV_FRAME = ' https://www.tradingview-widget.com'
const buildCsp = (allowEval) =>
  "default-src 'self'; script-src 'self' " + (cspExtraScript ? cspExtraScript + ' ' : '') + CSP_THEME_BOOT_HASH + (allowEval ? " 'unsafe-eval' " + CSP_LEGACY_HASHES + CSP_TV_SCRIPT : '') + "; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; connect-src 'self' https: wss:" + (cspExtraConnect ? ' ' + cspExtraConnect : '') + "; " +
  "worker-src 'self' blob:; frame-src 'self'" + (cspExtraFrame ? ' ' + cspExtraFrame : '') + cspWalletFrames + (allowEval ? CSP_TV_FRAME : '') + "; frame-ancestors 'self'; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'"
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy', buildCsp(false))
  if (cfg.prod) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})
app.use('/products', express.json({ limit: '2mb' }))
app.use('/auth/profile', express.json({ limit: '512kb' })) /* avatar data URLs */
app.use('/chart/workspaces', express.json({ limit: '256kb' }))
app.use('/admin/calendar', express.json({ limit: '2mb' })) /* operator calendar imports (≤ 5,000 events) */ /* chart workspace entries (200 KB cap per entry) */
/* the DePay callback is signed over its exact bytes: keep the raw body for that one route */
/* DePay signs the exact request bytes: keep the raw body for its routes */
/* every DePay-signed path (canonical + aliases), from purchases.js */
app.use(express.json({ limit: '32kb', verify: (req, res, buf) => { if (DEPAY_SIGNED_PATHS.has(req.path)) req.rawBody = buf } }))

/* ---------- CORS (credentials for session cookies) ---------- */
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && cfg.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, X-Openfund-Chart-User')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

/* ---------- tiny in-memory rate limiter (per ip+route) ----------
   Test mode (SIM_TEST_MODE + test database, never production) widens
   the windows so sequential suite runs don't trip real-user limits. */
const hits = new Map()
setInterval(() => hits.clear(), 60_000).unref()
const limitScale = testMode ? 50 : 1
const limit =
  (max, window = 60_000) =>
  (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const n = (hits.get(key) || 0) + 1;
    hits.set(key, n);
    if (n > max * limitScale) return res.status(429).json({ error: "rate_limited" });
    next();
  };

const audit = (action, userId = null, req = null, details = {}) =>
  pool.query('INSERT INTO audit_log (action, user_id, ip, details) VALUES ($1,$2,$3,$4)',
    [action, userId, req?.ip || null, JSON.stringify(details)]).catch(() => {})

/* ---------- session helpers ---------- */
const COOKIE = 'openfund_session'
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex')
const newSessionId = () => crypto.randomBytes(32).toString('base64url')

function setSessionCookie(res, sid) {
  res.cookie ??= null;
  // express's res.cookie is set by cookie-parser? no — use manual header
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${sid}; HttpOnly; Path=/; Max-Age=${cfg.sessionTtlH * 3600}; SameSite=Lax${cfg.prod ? "; Secure" : ""}`,
  );
}
const clearSessionCookie = (res) =>
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${cfg.prod ? "; Secure" : ""}`,
  );

function parseCookie(header) {
  const out = {}
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k) out[k] = v.join('=')
  }
  return out
}

function sanitizeCookieCode(req) {
  const header = String(req.headers.cookie || '')
  const match = header.match(/(?:^|;\s*)of_ref=([^;]+)/)
  return match ? (sanitizeCode(decodeURIComponent(match[1])) || null) : null
}

/* auth_sessions.last_seen is activity bookkeeping only (nothing reads it for
   authorization or expiry), so it is written at most once per minute per
   session instead of on every authenticated request and stream tick. The
   session itself is still read and validated on every request. */
const SESSION_TOUCH_MS = 60_000
const sessionTouched = new Map()   /* id_hash → last last_seen write (ms) */
setInterval(() => {
  const cutoff = Date.now() - SESSION_TOUCH_MS
  for (const [h, t] of sessionTouched) if (t < cutoff) sessionTouched.delete(h)
}, SESSION_TOUCH_MS).unref()
function touchSessions(hashes) {
  const now = Date.now(), due = []
  for (const h of hashes) {
    if (now - (sessionTouched.get(h) ?? 0) < SESSION_TOUCH_MS) continue
    sessionTouched.set(h, now); due.push(h)
  }
  if (!due.length) return Promise.resolve()
  return pool.query('UPDATE auth_sessions SET last_seen = now() WHERE id_hash = ANY($1)', [due]).catch(() => {
    for (const h of due) sessionTouched.delete(h)   /* retry on the next request */
  })
}

async function userFromSession(req) {
  const sid = parseCookie(req.headers.cookie)[COOKIE]
  if (!sid) return null
  const hash = sha(sid)
  const { rows } = await pool.query(
    `SELECT s.user_id, u.wallet_address, u.display_name, u.avatar_url, u.status, u.created_at, u.last_login_at,
            (s.expires_at > now()) AS valid
       FROM auth_sessions s JOIN openfund_users u ON u.id = s.user_id
      WHERE s.id_hash = $1`, [hash])
  const row = rows[0]
  if (!row || !row.valid) return null
  await touchSessions([hash])
  return row
}

/* stream session check: the same validity rule as userFromSession followed
   by the stream's `status === 'active'` gate, for every open stream of one
   trading scope in a single query. Returns the set of still-valid hashes. */
async function checkStreamSessions(hashes, userId) {
  const { rows } = await pool.query(
    `SELECT s.id_hash FROM auth_sessions s JOIN openfund_users u ON u.id = s.user_id
      WHERE s.id_hash = ANY($1) AND s.user_id = $2 AND s.expires_at > now() AND u.status = 'active'`,
    [hashes, userId])
  const valid = new Set(rows.map(r => r.id_hash))
  await touchSessions(valid)
  return valid
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

/* Wallet authentication is Arbitrum One only (chain 42161). The map keeps
   the multi-chain shape for future networks, but only chains listed here
   are accepted: a SIWE message for any other chain id is rejected with
   `invalid_chain` before any signature work. The public client is used
   for EIP-1271 / ERC-6492 contract-wallet checks; AUTH_RPC_URL optionally
   points it at a dedicated Arbitrum endpoint. */
const AUTH_CHAINS = [arbitrum]
const clients = new Map(AUTH_CHAINS.map(chain => [chain.id, createClient({ chain, transport: http(process.env.AUTH_RPC_URL || undefined, { timeout: 5000, retryCount: 0 }) })]))

import { referralRoutes, attributeReferral, sanitizeCode } from './referrals.js'

/* =================  AUTH  ================= */

/* 1 — nonce */
app.post("/auth/nonce", limit(60), async (req, res) => {
  try {
    const address = String(req.body?.address || "").toLowerCase();
    if (!isHex(address) || address.length !== 42)
      return res.status(400).json({ error: "invalid_address" });
    const nonce = crypto
      .randomBytes(16)
      .toString("hex"); /* alphanumeric per EIP-4361 */
    await pool.query(
      "INSERT INTO auth_nonces (nonce, address, expires_at) VALUES ($1,$2, now() + $3::interval)",
      [nonce, address, `${cfg.nonceTtlMs} milliseconds`],
    );
    res.json({ nonce, expiresInMs: cfg.nonceTtlMs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "internal" });
  }
});

/* 2 — verify SIWE */
app.post("/auth/verify", limit(60), async (req, res) => {
  try {
    const { message, signature } = req.body || {};
    if (typeof message !== "string" || !isHex(signature))
      return res.status(400).json({ error: "invalid_payload" });

    const parsed = parseSiweMessage(message);
    if (!parsed.address)
      return res.status(400).json({ error: "invalid_message" });
    if (!parsed.nonce) return res.status(400).json({ error: "missing_nonce" });
    if (!cfg.domains.includes(parsed.domain))
      return res.status(400).json({ error: "invalid_domain" });
    const client = clients.get(Number(parsed.chainId));
    if (!client) return res.status(400).json({ error: "invalid_chain" });
    let uri;
    try {
      uri = new URL(parsed.uri);
    } catch {
      return res.status(400).json({ error: "invalid_uri" });
    }
    if (
      uri.host !== parsed.domain ||
      !["http:", "https:"].includes(uri.protocol) ||
      (cfg.prod && uri.protocol !== "https:")
    )
      return res.status(400).json({ error: "invalid_uri" });
    const now = Date.now();
    if (
      parsed.version !== "1" ||
      !parsed.issuedAt ||
      !Number.isFinite(+parsed.issuedAt) ||
      +parsed.issuedAt > now + 60000 ||
      now - +parsed.issuedAt > cfg.nonceTtlMs ||
      (parsed.expirationTime && +parsed.expirationTime <= now) ||
      (parsed.notBefore && +parsed.notBefore > now)
    )
      return res.status(400).json({ error: "invalid_message_time" });

    /* nonce must exist, belong to this address, be fresh and unused */
    const { rows: nonceRows } = await pool.query(
      "SELECT address, used_at, expires_at FROM auth_nonces WHERE nonce = $1",
      [parsed.nonce],
    );
    const nonceRow = nonceRows[0];
    if (!nonceRow) return res.status(400).json({ error: "unknown_nonce" });
    if (nonceRow.used_at)
      return res.status(400).json({ error: "nonce_reused" });
    if (new Date(nonceRow.expires_at) < new Date())
      return res.status(400).json({ error: "nonce_expired" });
    if (nonceRow.address !== parsed.address.toLowerCase())
      return res.status(400).json({ error: "nonce_address_mismatch" });

    /* cryptographic verification (viem handles EIP-1271 for contract wallets via client) */
    let ok = false;
    /* EOA signatures (EIP-191) are verified locally by ECDSA recovery, so an
       RPC outage never blocks ordinary wallet sign-in. Domain, URI, chain,
       times and nonce were validated above. Only when recovery does not match
       (contract wallets: EIP-1271 / ERC-6492) is the Arbitrum RPC consulted. */
    try {
      ok = (await recoverMessageAddress({ message, signature })).toLowerCase() === parsed.address.toLowerCase();
    } catch {
      ok = false;
    }
    if (!ok) try {
      ok = await verifySiweMessage(client, {
        address: parsed.address,
        message,
        signature,
        domain: parsed.domain,
        nonce: parsed.nonce,
      });
    } catch {
      ok = false;
    } /* malformed signature → invalid */
    if (!ok) {
      await audit("auth_failed", null, req, { address: parsed.address });
      return res.status(401).json({ error: "invalid_signature" });
    }

    /* burn the nonce */
    const consumed = await pool.query(
      "UPDATE auth_nonces SET used_at=now() WHERE nonce=$1 AND used_at IS NULL AND expires_at > now() AND address=$2 RETURNING nonce",
      [parsed.nonce, parsed.address.toLowerCase()],
    );
    if (!consumed.rowCount)
      return res.status(400).json({ error: "nonce_reused" });

    /* one wallet = one user (normalized lowercase, unique constraint is the final guard) */
    const address = parsed.address.toLowerCase();
    /* referral attribution only applies to a FIRST-TIME account: check existence
       before the upsert so a later sign-in can never re-attribute */
    const knownUser = await pool.query('SELECT id FROM openfund_users WHERE wallet_address = $1', [address])
    const { rows } = await pool.query(
      `INSERT INTO openfund_users (wallet_address, wallet_chain, last_login_at)
       VALUES ($1, $2, now())
       ON CONFLICT (wallet_address)
       DO UPDATE SET last_login_at = now(), updated_at = now(), wallet_chain = EXCLUDED.wallet_chain
       RETURNING id, wallet_address, status, display_name, created_at, last_login_at`,
      [address, parsed.chainId],
    );
    const user = rows[0];
    if (user.status === "suspended") {
      await audit("auth_blocked_suspended", user.id, req, {});
      return res.status(403).json({ error: "account_suspended" });
    }

    /* every new user gets ONE free demo account with exactly 100,000 DAI —
       atomic + idempotent (DB constraint prevents duplicate credits) */
    const demo = await engine.ensureDemoAccount(user.id).catch((e) => {
      console.error(e);
      null;
    });
    if (!demo) return res.status(500).json({ error: "internal" });

    /* Growth Partner attribution: recorded once, server-side, from the of_ref
       cookie; self-referral and repeat attribution are impossible (see referrals.js) */
    if (knownUser.rowCount === 0) {
      const attributed = await attributeReferral(pool, req, { newUserId: user.id, walletAddress: address });
      if (attributed) await audit('referral_attributed', user.id, req, { code: sanitizeCookieCode(req) });
      /* Brand Ambassador attribution (approved ambassador codes only) */
      if (await attributeAmbassador(pool, req, { newUserId: user.id }))
        await audit('ambassador_attributed', user.id, req, { code: sanitizeCookieCode(req) });
    }

    const sid = newSessionId();
    await pool.query(
      "INSERT INTO auth_sessions (id_hash, user_id, expires_at, user_agent, ip) VALUES ($1,$2, now() + $3::interval, $4, $5)",
      [
        sha(sid),
        user.id,
        `${cfg.sessionTtlH} hours`,
        String(req.headers["user-agent"] || "").slice(0, 200),
        req.ip || null,
      ],
    );
    setSessionCookie(res, sid);
    await audit("auth_login", user.id, req, { address });
    res.json({
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "internal" });
  }
});

/* 3 — me (+ challenges, ownership enforced by session join) */
app.get('/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.status, c.stage, c.account_size_usd, c.demo_account_id, c.purchase_order_id,
            c.created_at, c.started_at, c.completed_at, c.expires_at, c.rules_snapshot,
            p.slug AS plan_slug, p.name AS plan_name, p.configuration AS plan_configuration
       FROM openfund_challenges c JOIN challenge_plans p ON p.id = c.challenge_plan_id
      WHERE c.user_id = $1 ORDER BY c.created_at DESC`, [req.user.user_id])
  res.json({
    user: {
      id: req.user.user_id,
      walletAddress: req.user.wallet_address,
      displayName: req.user.display_name,
      avatarUrl: req.user.avatar_url,
      status: req.user.status,
      createdAt: req.user.created_at,
      lastLoginAt: req.user.last_login_at
    },
    challenges: rows
  })
}))

/* 3b — profile editing (display name + avatar; wallet identity is immutable) */
const AVATAR_MAX_BYTES = 256 * 1024
const isValidAvatar = (v) =>
  typeof v === 'string' &&
  (v.startsWith('https://') && v.length <= 500 ||
   /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && Buffer.byteLength(v, 'utf8') <= AVATAR_MAX_BYTES + 64)
app.patch('/auth/profile', requireAuth, limit(30), asyncRoute(async (req, res) => {
  const { displayName, avatarUrl } = req.body || {}
  const sets = []
  const params = [req.user.user_id]
  if (displayName !== undefined) {
    if (displayName !== null && (typeof displayName !== 'string' || displayName.trim().length === 0 || displayName.trim().length > 60))
      return res.status(400).json({ error: 'invalid_display_name' })
    params.push(displayName === null ? null : displayName.trim())
    sets.push(`display_name=$${params.length}`)
  }
  if (avatarUrl !== undefined) {
    if (avatarUrl !== null && !isValidAvatar(avatarUrl)) return res.status(400).json({ error: 'invalid_avatar' })
    params.push(avatarUrl)
    sets.push(`avatar_url=$${params.length}`)
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing_to_update' })
  await pool.query(`UPDATE openfund_users SET ${sets.join(', ')}, updated_at=now() WHERE id=$1`, params)
  await audit('profile_updated', req.user.user_id, req, { fields: { displayName: displayName !== undefined, avatarUrl: avatarUrl !== undefined } })
  const { rows: [u] } = await pool.query('SELECT display_name, avatar_url FROM openfund_users WHERE id=$1', [req.user.user_id])
  res.json({ displayName: u.display_name, avatarUrl: u.avatar_url })
}))

/* 4 — logout */
app.post('/auth/logout', asyncRoute(async (req, res) => {
  const sid = parseCookie(req.headers.cookie)[COOKIE]
  if (sid) {
    const { rows } = await pool.query('DELETE FROM auth_sessions WHERE id_hash = $1 RETURNING user_id', [sha(sid)])
    sessionTouched.delete(sha(sid))
    tradingStreams.revokeSession(sha(sid))   /* open streams of this session end now */
    if (rows[0]) await audit('auth_logout', rows[0].user_id, req, {})
  }
  clearSessionCookie(res)
  res.json({ ok: true })
}))

/* =================  TRADING (auth-guarded, server-authoritative)  ================ */

const tradingAuth = async (req, res, next) => {
  try {
    const user = await userFromSession(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    if (user.status === 'suspended') return res.status(403).json({ error: 'account_suspended' })
    if(req.path.startsWith('/trading')) {
      const accountRef=req.query.account || req.body?.accountId || req.body?.account_id;
      if(req.body?.product && req.body.product!=='prop')return res.status(403).json({error:'wrong_product_context'});
      if(accountRef && (await engine.getAccount(user.user_id))?.id!==accountRef){
        /* account references resolve in two shapes: the demo trading
           account id, or the openfund_challenges id the UI carries in
           its URL (journal/evaluation scope) — both must be owned */
        const ownedAccount = await pool.query(
          `SELECT 1 FROM demo_accounts a JOIN openfund_challenges c ON c.demo_account_id=a.id
            WHERE a.id=$1 AND c.user_id=$2 AND a.account_type='challenge'`, [accountRef, user.user_id])
        if (ownedAccount.rowCount) { req.accountId = accountRef }
        else {
          const challenge = (await pool.query(
            `SELECT demo_account_id FROM openfund_challenges WHERE id=$1 AND user_id=$2`,
            [accountRef, user.user_id])).rows[0]
          if (challenge?.demo_account_id) req.accountId = challenge.demo_account_id
          else return res.status(404).json({error:'account_not_found'})
        }
      }
    }
    req.user = user
    next()
  } catch { res.status(500).json({ error: 'internal' }) }
}

app.get('/accounts', tradingAuth, asyncRoute(async (req,res) => {
  res.json(await accountDirectory(pool,engine,req.user))
}))

/* ============== CHALLENGES (evaluation lifecycle, session-scoped) ============== */

app.get('/challenges', tradingAuth, asyncRoute(async (req, res) => {
  const list = await engine.challenges.listForUser(req.user.user_id)
  const views = []
  for (const c of list) {
    const state = c.demo_account_id ? await engine.state(req.user.user_id, c.demo_account_id) : null
    views.push(await engine.challenges.view(c, state))
  }
  res.json({ challenges: views })
}))

app.get('/challenges/:id', tradingAuth, asyncRoute(async (req, res) => {
  const c = await engine.challenges.byId(req.params.id, req.user.user_id)
  if (!c) return res.status(404).json({ error: 'challenge_not_found' })
  const state = c.demo_account_id ? await engine.state(req.user.user_id, c.demo_account_id) : null
  res.json(await engine.challenges.view(c, state))
}))

/* created → started: provisions the trading account on first start,
   freezes the rules snapshot, sets the time limit (if any). Idempotent. */
app.post('/challenges/:id/start', tradingAuth, limit(30), asyncRoute(async (req, res) => {
  const started = await engine.challenges.start(req.user.user_id, req.params.id)
  await audit('challenge_started', req.user.user_id, req, { challengeId: req.params.id, stage: started.stage })
  res.json({ ok: true, challenge: {
    id: started.id, status: started.status, stage: started.stage,
    accountId: started.demo_account_id, startedAt: started.started_at, expiresAt: started.expires_at } })
}))

app.post('/trading/preview', tradingAuth, asyncRoute(async (req,res) => {
  res.json(await engine.previewOrder(req.user.user_id, req.body || {}, req.accountId || null))
}))

app.get('/trading/state', tradingAuth, asyncRoute(async (req, res) => {
  const state = await engine.state(req.user.user_id, req.accountId || null)
  res.json(state)
}))

app.post('/trading/order', tradingAuth, limit(30), async (req, res) => {
  try {
    const key = req.headers['idempotency-key'] || null
    const out = await engine.submitOrder(req.user.user_id, req.body || {}, key, req.accountId || null)
    if (!out.ok) return res.status(400).json({ error: out.reason, order: out.order })
    res.json(out)
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'internal' })
  }
})

app.post('/trading/positions/:id/close', tradingAuth, async (req, res) => {
  try {
    const out = await engine.closePosition(req.user.user_id, req.params.id, { fraction:req.body?.fraction ?? 1, idempotencyKey:req.headers['idempotency-key'] || null })
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
app.get("/trading/stream", tradingAuth, async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  /* one state computation per account scope per tick, shared by every tab
     of that scope; session re-checked before each push (trading-stream.js) */
  tradingStreams.attach(req, res, {
    sidHash: sha(parseCookie(req.headers.cookie)[COOKIE]),
    userId: req.user.user_id,
    accountId: req.accountId || null,
  });
});

/* test-only price injection seam — enabled ONLY with SIM_TEST_MODE=1
   (never active in production): lets engine tests drive deterministic marks.
   INTERNAL_API_TOKEN (optional) adds defense-in-depth auth to the seam
   even in test deployments (constant-time compare). */
const internalAuth = (req, res, next) => {
  const token = process.env.INTERNAL_API_TOKEN
  if (token && !crypto.timingSafeEqual(Buffer.from(String(req.headers['x-internal-token'] || '')), Buffer.from(token)))
    return res.status(401).json({ error: 'internal_unauthorized' })
  next()
}
if (testMode) {
  /* test-mode calendar fixture: sales of news-dependent plans need verified
     calendar coverage (conduct.js). SIM_TEST_MODE + test database only;
     an empty, clearly labelled import that never exists in production. */
  pool.query(`INSERT INTO economic_calendar_coverage (source, covers_from, covers_to, event_count, actor)
              SELECT 'sim-test-mode', now() - interval '1 day', now() + interval '60 days', 0, 'sim-test-mode'
               WHERE NOT EXISTS (SELECT 1 FROM economic_calendar_coverage WHERE source='sim-test-mode' AND covers_to > now() + interval '30 days')`)
    .catch(e => console.error('[test-mode] calendar fixture failed', e.message))
  app.post('/internal/inject-price', internalAuth, (req, res) => {
    const { symbol, price, metadata } = req.body || {}
    if (typeof symbol !== 'string' || price == null) return res.status(400).json({ error: 'invalid' })
    if (metadata) marketData.markets.set(symbol, { symbol, base: metadata.base, group: metadata.group, maxLeverage: metadata.maxLeverage, isOpen: true })
    marketData.injectPrice(symbol, String(price))
    res.json({ ok: true })
  })
  /* test-only purchase confirmation seam — SIM_TEST_MODE=1 + test database,
     never active in production: lets browser/E2E tests drive the full
     purchase lifecycle without a real chain (same gate as inject-price) */
  app.post('/internal/confirm-order', internalAuth, asyncRoute(async (req, res) => {
    const { orderId, txHash } = req.body || {}
    if (!orderId || !txHash) return res.status(400).json({ error: 'invalid' })
    const user = await userFromSession(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    const result = await confirmPurchase(pool, {
      orderId, userId: user.user_id,
      evidence: {
        txHash, chainId: Number(process.env.PURCHASE_PAYMENT_CHAIN || 42161),
        blockNumber: 1, fromAddress: user.wallet_address, toAddress: null,
        amount: null, tokenAddress: null, blockTimestamp: new Date().toISOString(),
      },
      source: 'test_seam',
    })
    res.json(result)
  }))
}

/* ============== PORTFOLIO (journal-core analytics, ownership-scoped) ============== */

app.get('/portfolio/overview', tradingAuth, asyncRoute(async (req, res) => {
  const ov = await portfolio.overview(req.user.user_id)
  if (!ov) return res.status(404).json({ error: 'account_not_found' })
  res.json(ov)
}))

app.get('/portfolio/buckets', tradingAuth, asyncRoute(async (req, res) => {
  res.json(await portfolio.buckets(req.user.user_id))
}))

app.get('/portfolio/trades', tradingAuth, asyncRoute(async (req, res) => {
  const q = req.query
  res.json(await portfolio.history(req.user.user_id, {
    limit: Math.min(Number(q.limit) || 25, 100),
    offset: Math.max(Number(q.offset) || 0, 0),
    side: ['long', 'short'].includes(q.side) ? q.side : null,
    market: q.market || null,
    status: ['open', 'closed', 'liquidated'].includes(q.status) ? q.status : null,
    from: q.from || null, to: q.to || null,
    sort: ['closed_desc', 'opened_asc', 'pnl_desc', 'pnl_asc'].includes(q.sort) ? q.sort : 'closed_desc'
  }))
}))

app.get('/portfolio/trades/:id', tradingAuth, asyncRoute(async (req, res) => {
  const d = await portfolio.details(req.user.user_id, req.params.id)
  if (!d) return res.status(404).json({ error: 'not_found' })
  res.json(d)
}))

app.put('/portfolio/notes', tradingAuth, limit(60), asyncRoute(async (req, res) => {
  const { tradeKey, notes, tags } = req.body || {}
  if (typeof tradeKey !== 'string' || !tradeKey.includes('|')) return res.status(400).json({ error: 'invalid_key' })
  res.json(await portfolio.upsertNote(req.user.user_id, tradeKey, notes, tags))
}))

app.use('/products/:product', productRoutes({ pool, portfolio, engine, auth: tradingAuth }))
app.use(referralRoutes({ pool, requireAuth, audit }))
app.use(purchaseRoutes({ pool, requireAuth, audit, limit }))
app.use(rewardRoutes({ pool, requireAuth, audit, limit, md: marketData }))
app.use(certificateRoutes({ pool, requireAuth }))
app.use(chartWorkspaceRoutes({ pool, requireAuth, limit }))
/* Public Contact Us submissions (write-only; operators read via /admin/support or Directus) */
app.use(supportRoutes({ pool, limit, optionalUser: async req => (await userFromSession(req))?.user_id ?? null }))
/* Footprint (Hyperliquid order-flow analytics for the chart only). Read-only,
   isolated from the engine/accounts/payments; inert unless FOOTPRINT_ENABLED=1. */
const footprint = createFootprintService({ mainPool: pool })
app.use(footprint.router)
app.use('/governance', governanceRoutes({ pool, requireAuth, limit }))
/* Economy, Brand Ambassador, Verified Coach and Live Market Access */
const treasury = new Treasury(pool)
const live = liveConfig()
/* treasury wallets per network = the payment settlement receivers (one configuration) */
const treasuryNetworks = new TreasuryNetworks({ networks: treasuryNetworksConfig(paymentChains()) })
const economy = economyRoutes({ pool, treasury, treasuryNetworks, limit })
app.use(economy)
app.use(partnerRoutes({ pool, requireAuth, audit, limit }))
app.use(liveRoutes({ pool, requireAuth, treasury, marketData, limit, config: live }))
app.use('/admin/economy', economyAdminRoutes({ pool, treasury, onChange: () => economy.invalidate() }))
app.use('/admin/partners', partnerAdminRoutes({ pool }))
app.use('/admin/live', liveAdminRoutes({ pool, treasury, config: live }))
app.use('/admin/coupons', couponAdminRoutes({ pool }))
app.use('/admin/payments', paymentAdminRoutes({ pool, verifier: (...a) => defaultPaymentVerifier()(...a) }))
app.use('/admin/support', supportAdminRoutes({ pool }))
app.use('/admin/certificates', certificateAdminRoutes({ pool }))
app.use('/admin/rewards', rewardAdminRoutes({ pool }))
app.use('/admin/calendar', calendarAdminRoutes({ pool }))
app.use('/admin', adminRoutes({ pool, audit }))

/* Public release identity contains build metadata only, never runtime secrets. */
app.get('/version', (req, res) => {
  const release = releaseDiagnostics();
  res.set('Cache-Control','no-store').status(release.status === 'mismatch' ? 503 : 200).json(release);
});

/* Public sitemap and robots policy for the indexable website routes. */
seoRoutes(app)

/* Public non-secret configuration is supplied at runtime, outside the
   immutable release payload. The HTML loads it before the React module.
   Both the clean root path and the legacy /react/ path serve it (cached
   legacy shells still request the old URL). */
const publicRuntimeConfig = runtimeConfigScript(process.env, cfg.prod)
app.get('/react/runtime-config.js', (req, res) => {
  res.set('Cache-Control', 'no-store').type('application/javascript').send(publicRuntimeConfig)
})
app.get('/runtime-config.js', (req, res) => {
  res.set('Cache-Control', 'no-store').type('application/javascript').send(publicRuntimeConfig)
})

/* health */
app.get('/health', asyncRoute(async (req, res) => { try { await pool.query('SELECT 1'); res.json({ ok: true, ts: Date.now() }) } catch { res.status(503).json({ ok: false }) } }))
app.get('/trading/health', tradingAuth, async (req, res) => {
  const st = await engine.state(req.user.user_id)
  res.json({ ok: true, account: st.account != null, markets: marketData.markets.size })
})

/* Same-origin static hosting for Render.
   Clean public URLs: the app shell and its assets are served from the site
   root ('/assets/…', '/legacy/…', '/' → index.html) with a browser-history
   SPA fallback for deep routes. The legacy '/react' document prefix is
   permanently redirected to the clean root — the '#/…' route hash never
   reaches the server, so old bookmarks are recovered client-side by the
   pre-paint normalizer in the app shell. The '/react' static mount stays so
   assets referenced by already-cached legacy shells keep loading.
   HTML documents and the Pine computation worker get the application CSP
   (the engine compiles indicator scripts with `new Function`); every other
   asset and all API responses keep the fully strict policy. */
const reactDir = fileURLToPath(new URL('../../react', import.meta.url))
const reactStaticHeaders = (res, file) => {
  res.set('Cache-Control', staticCacheControl(file))
  if (file.endsWith('.html') || file.endsWith('openfund-pine-worker.min.js')) res.setHeader('Content-Security-Policy', buildCsp(true))
}
app.get(['/react', '/react/', '/react/index.html'], (req, res) => {
  const queryAt = req.url.indexOf('?')
  res.redirect(308, '/' + (queryAt >= 0 ? req.url.slice(queryAt) : ''))
})
app.use('/react', express.static(reactDir, { setHeaders: reactStaticHeaders }))
app.use(express.static(reactDir, { setHeaders: reactStaticHeaders }))
/* SPA fallback for browser-history deep routes: only document navigations
   (GET/HEAD that accept HTML). APIs, websockets and asset requests are all
   matched earlier and never fall through here; non-HTML clients keep the
   strict JSON 404. */
app.use((req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !/text\/html/.test(req.headers.accept || '')) return next()
  res.set('Cache-Control', 'no-cache, must-revalidate')
  res.setHeader('Content-Security-Policy', buildCsp(true))
  res.sendFile(path.join(reactDir, 'index.html'))
})

/* 404 + error safety (no stack leaks) */
/* no-store: a miss (e.g. a new asset hash requested from the old instance
   during deploy cutover) must never be cached by Cloudflare or the browser */
app.use((req, res) => res.set('Cache-Control', NO_STORE).status(404).json({ error: 'not_found' }))
app.use((err, req, res, next) => {
  if (err.code === "23514" && err.message === "account_permanently_disabled")
    err.status = 403;
  if (!err.status) console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.status ? err.message : "internal", ...(err.status && Array.isArray(err.reasons) ? { reasons: err.reasons } : {}) });
});

const server = app.listen(cfg.port, () =>
  console.log(`openfund-backend :${cfg.port}`),
);
/* payment readiness (names and missing fields only, never secret values):
   makes a disabled checkout diagnosable from the service log */
try {
  const r = paymentReadinessReport()
  console.log(`[payments] readiness: paymentsEnabled=${r.paymentsEnabled} depayEndpoints=${r.depayEndpoints} depayConfiguration=${r.depayConfiguration}`)
  for (const c of r.chains) console.log(`[payments] chain ${c.blockchain}: ${c.ready ? 'ready' : 'NOT ready, missing ' + c.missing.join(', ')}${c.warnings.length ? ' — ' + c.warnings.join('; ') : ''}`)
  for (const p of r.problems) console.warn(`[payments] ${p}`)
} catch (e) { console.error('[payments] readiness report failed', e.message) }
/* market data (authoritative server-side marks) + trading engine loop */
marketData.bootstrap().catch(e => console.error('[market-data] bootstrap failed', e.message))
engine.start(1000)
footprint.start().catch(e => console.error('[footprint] start failed', e.message))
/* pending purchase orders past their expiry are swept to 'expired'
   (verified late payments are still accepted inside the grace window —
   see purchases.js confirmPurchase) */
setInterval(() => {
  pool.query(`UPDATE purchase_orders SET status='expired' WHERE status='pending' AND expires_at < now()`)
    .then(r => { if (r.rowCount) console.log(`[purchases] ${r.rowCount} pending order(s) expired`) })
    .catch(() => {})
}, 60_000).unref()
/* payment recovery: a payment that is mined but was never provisioned
   (frontend request lost, RPC down, not yet final) is re-verified on the
   chain until it provisions or becomes a reviewable rejection */
/* interval / minimum age are operator-tunable only to shorten test runs */
const recoveryEvery = Math.max(Number(process.env.PAYMENT_RECOVERY_INTERVAL_MS) || 60_000, 1000)
const recoveryMinAge = Math.max(Number(process.env.PAYMENT_RECOVERY_MIN_AGE_S) || 45, 1)
const paymentRecoveryTimer = setInterval(() => {
  recoverPendingPayments({ pool, minAgeSeconds: recoveryMinAge, log: (order, err) => console.log('[payments] recovery', order, err) })
    .then(r => { if (r.recovered) console.log('[payments] recovered ' + r.recovered + ' order(s)') })
    .catch(e => console.error('[payments] recovery sweep failed', e.message))
}, recoveryEvery)
paymentRecoveryTimer.unref()
/* treasury snapshots (60–120 min schedule) and live settlement retries */
treasury.start()
const settlementTimer = setInterval(() => {
  const adapter = settlementAdapter(live.settlement)
  if (adapter) processSettlements(pool, adapter).catch(e => console.error('[settlements]', e.message))
}, 60_000)
settlementTimer.unref()
let shuttingDown=false
const shutdown = () => { if(shuttingDown)return;shuttingDown=true;const enginePass=engine.stop();tradingStreams.close();marketData.stop();treasury.stop();clearInterval(settlementTimer);clearInterval(paymentRecoveryTimer);Promise.all([enginePass.catch(()=>{}),footprint.stop().catch(()=>{})]).finally(()=>server.close(()=>Promise.all([pool.end(),loopPool.end()]))) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
