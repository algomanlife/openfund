import { Router } from 'express'
import crypto from 'node:crypto'

/**
 * Growth Partner referral attribution (server-authoritative).
 *
 * What exists here and nothing more: a per-wallet invite code, an attribution
 * record written once when an account is created through a code, and a summary
 * endpoint scoped to the authenticated session. There are NO commission,
 * reward, tier or payout fields anywhere in this module — the business terms
 * are unpublished and must never be implied by the API shape.
 *
 * Integrity rules (enforced here AND by the database):
 *  - one code per user, one user per code (UNIQUE both ways)
 *  - an account can be attributed exactly once (UNIQUE referred_user_id)
 *  - a wallet can never be attributed to its own code (CHECK + lookup)
 *  - attribution happens only at account creation, never on later sign-ins
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' /* no 0/O/1/I/L */
const REF_COOKIE = 'of_ref'
const REF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export const REFERRAL_COOKIE = { name: REF_COOKIE, maxAge: REF_COOKIE_MAX_AGE_SECONDS }

const maskAddress = (address) => {
  const value = String(address || '').toLowerCase()
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

/** valid referral cookie value: uppercase code from the code alphabet */
export function sanitizeCode(raw) {
  const value = String(raw || '').trim().toUpperCase()
  return /^[A-HJ-NP-Z2-9]{6,12}$/.test(value) ? value : null
}

async function ensureCode(pool, userId) {
  const existing = await pool.query('SELECT code, created_at FROM referral_codes WHERE user_id = $1', [userId])
  if (existing.rows[0]) return existing.rows[0]
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(crypto.randomBytes(8))
      .map(byte => CODE_ALPHABET[byte % CODE_ALPHABET.length])
      .join('')
    try {
      const inserted = await pool.query(
        'INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) RETURNING code, created_at',
        [userId, code])
      return inserted.rows[0]
    } catch (e) {
      if (e && e.code === '23505') continue /* collision on the code — retry */
      throw e
    }
  }
  throw new Error('referral code generation failed')
}

/**
 * Record attribution for a BRAND-NEW account from the of_ref cookie.
 * Called from /auth/verify right after a user row is created for the first
 * time. Failures are swallowed on purpose: sign-in must never break because
 * of the referral layer.
 */
export async function attributeReferral(pool, req, { newUserId, walletAddress }) {
  try {
    const cookieHeader = String(req.headers.cookie || '')
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REF_COOKIE}=([^;]+)`))
    const code = sanitizeCode(match ? decodeURIComponent(match[1]) : null)
    if (!code) return false

    const owner = await pool.query('SELECT user_id FROM referral_codes WHERE code = $1', [code])
    const referrer = owner.rows[0]?.user_id
    if (!referrer || String(referrer) === String(newUserId)) return false

    /* one account, one attribution — the UNIQUE constraint is the guard */
    const inserted = await pool.query(
      `INSERT INTO referral_attributions (referred_user_id, referrer_user_id, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (referred_user_id) DO NOTHING
       RETURNING id`,
      [newUserId, referrer, code])
    void walletAddress
    return inserted.rowCount === 1
  } catch (e) {
    console.error('referral attribution failed:', e?.message || e)
    return false
  }
}

export function referralRoutes({ pool, requireAuth, audit }) {
  const router = Router()

  /* session-scoped summary: the code, the link the client composes, the
     attribution list. Nothing else exists to show — reward data is not
     invented here. Auth is applied per route — a router-level guard would
     also swallow requests for unrelated routes mounted after this router. */
  router.get('/referral/summary', requireAuth, async (req, res) => {
    try {
      const code = await ensureCode(pool, req.user.user_id)
      const referrals = await pool.query(
        `SELECT a.attributed_at, u.wallet_address, u.status, u.created_at
           FROM referral_attributions a
           JOIN openfund_users u ON u.id = a.referred_user_id
          WHERE a.referrer_user_id = $1
          ORDER BY a.attributed_at DESC
          LIMIT 200`,
        [req.user.user_id])
      const mine = await pool.query(
        `SELECT a.code, a.attributed_at, u.wallet_address AS referrer
           FROM referral_attributions a
           JOIN openfund_users u ON u.id = a.referrer_user_id
          WHERE a.referred_user_id = $1`,
        [req.user.user_id])
      res.json({
        code: code.code,
        codeCreatedAt: code.created_at,
        programState: 'prelaunch',
        attributed: {
          count: referrals.rowCount,
          referrals: referrals.rows.map(row => ({
            joinedAt: row.attributed_at,
            wallet: maskAddress(row.wallet_address),
            status: row.status,
          })),
        },
        attributedTo: mine.rows[0]
          ? { code: mine.rows[0].code, at: mine.rows[0].attributed_at, referrer: maskAddress(mine.rows[0].referrer) }
          : null,
      })
      void audit
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'internal' })
    }
  })

  return router
}
