/**
 * Funded-trader agreement (ADR 0054).
 *
 * Before the first trade on a funded account, the trader accepts the
 * funded-trader terms by signing a fixed message with the wallet that owns
 * the account (EIP-191; contract wallets through EIP-1271 via the injected
 * verifier). The signed message names the terms version, the account and the
 * wallet, so a signature cannot be reused for another account or wallet.
 * The record (message, signature, version, time) is append-only and audited.
 *
 * Scope: a challenge at the funded stage (stage 0), except free trials and
 * tournament accounts, created on or after FUNDED_AGREEMENT_FROM (UTC
 * YYYY-MM-DD). Unset = not required, so accounts already trading are never
 * blocked retroactively; the owner sets the date when the terms are
 * published. Openfund does not run KYC: the wallet signature is the identity
 * proof, and rewards go only to that wallet.
 */
import { Router } from 'express'

export const FUNDED_TERMS_VERSION = '2026-11'
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISSUED = /\nIssued: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\n/

/** The exact text the wallet signs. */
export function agreementMessage({ challengeId, wallet, version = FUNDED_TERMS_VERSION, issuedAt }) {
  return [
    'Openfund funded-trader agreement',
    '',
    `I accept the Openfund funded-trader terms, version ${version}, for this funded account.`,
    'I understand that the account is a simulated demo account, that rewards are paid only to this wallet,',
    'and that the trading rules frozen on the account apply.',
    '',
    `Version: ${version}`,
    `Account: ${challengeId}`,
    `Wallet: ${String(wallet).toLowerCase()}`,
    `Issued: ${issuedAt}`,
    '',
  ].join('\n')
}

/** Whether a challenge needs a signed agreement before trading. */
export function agreementRequired(challenge, from = process.env.FUNDED_AGREEMENT_FROM) {
  if (!challenge || Number(challenge.stage) !== 0) return false
  const rules = challenge.rules_snapshot || {}
  if (rules.free || rules.model === 'tournament') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '')) return false
  const cutoff = Date.parse(`${from}T00:00:00Z`)
  return Number.isFinite(cutoff) && Date.parse(challenge.created_at) >= cutoff
}

export async function hasAgreement(q, challengeId) {
  return (await q.query('SELECT 1 FROM funded_agreements WHERE challenge_id=$1', [challengeId])).rowCount > 0
}

/** Engine guard: refuse a funded order until the agreement is signed. */
export async function assertAgreement(q, challenge) {
  if (agreementRequired(challenge) && !(await hasAgreement(q, challenge.id))) throw fail(409, 'funded_agreement_required')
}

export function fundedAgreementRoutes({ pool, requireAuth, limit, audit, verify, now = () => new Date() }) {
  const router = Router()
  const own = async (id, userId) => {
    if (!uuid.test(String(id))) throw fail(404, 'challenge_not_found')
    const { rows: [c] } = await pool.query(`SELECT c.id, c.stage, c.status, c.created_at, c.rules_snapshot, u.wallet_address
      FROM openfund_challenges c JOIN openfund_users u ON u.id=c.user_id WHERE c.id=$1 AND c.user_id=$2`, [id, userId])
    if (!c) throw fail(404, 'challenge_not_found')
    return c
  }

  /* the trader's agreements and the funded accounts still waiting for one */
  router.get('/funded/agreements', requireAuth, limit(60), wrap(async (req, res) => {
    const { rows } = await pool.query(`SELECT c.id, c.stage, c.status, c.created_at, c.rules_snapshot, a.terms_version, a.signed_at, a.wallet_address AS signed_wallet
      FROM openfund_challenges c LEFT JOIN funded_agreements a ON a.challenge_id=c.id
      WHERE c.user_id=$1 AND c.stage=0 AND c.status IN ('created','started') ORDER BY c.created_at DESC LIMIT 50`, [req.user.user_id])
    res.set('Cache-Control', 'no-store').json({ version: FUNDED_TERMS_VERSION, accounts: rows.map(r => ({
      challengeId: r.id, status: r.status, required: agreementRequired(r), signed: !!r.signed_at, termsVersion: r.terms_version, signedAt: r.signed_at, wallet: r.signed_wallet })) })
  }))

  /* step 1: the server issues the exact message (fresh time, this account, this wallet) */
  router.post('/funded/agreements/:id/message', requireAuth, limit(20), wrap(async (req, res) => {
    const c = await own(req.params.id, req.user.user_id)
    if (!agreementRequired(c)) throw fail(409, 'agreement_not_required')
    if (await hasAgreement(pool, c.id)) throw fail(409, 'agreement_already_signed')
    res.set('Cache-Control', 'no-store').json({ version: FUNDED_TERMS_VERSION, message: agreementMessage({ challengeId: c.id, wallet: c.wallet_address, issuedAt: now().toISOString() }) })
  }))

  /* step 2: the signed message is checked against the template and the wallet */
  router.post('/funded/agreements/:id', requireAuth, limit(20), wrap(async (req, res) => {
    const c = await own(req.params.id, req.user.user_id)
    if (!agreementRequired(c)) throw fail(409, 'agreement_not_required')
    const { message, signature } = req.body || {}
    if (typeof message !== 'string' || message.length > 2000 || typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130,4000}$/.test(signature)) throw fail(400, 'invalid_signature')
    const issued = ISSUED.exec(message)?.[1]
    if (!issued) throw fail(400, 'invalid_message')
    const age = now().getTime() - Date.parse(issued)
    if (!(age >= -60_000 && age <= 15 * 60_000)) throw fail(400, 'message_expired')
    if (message !== agreementMessage({ challengeId: c.id, wallet: c.wallet_address, issuedAt: issued })) throw fail(400, 'invalid_message')
    let ok = false
    try { ok = await verify({ address: c.wallet_address, message, signature }) } catch { ok = false }
    if (!ok) throw fail(401, 'invalid_signature')
    const { rowCount } = await pool.query(`INSERT INTO funded_agreements (challenge_id, user_id, wallet_address, terms_version, message, signature)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (challenge_id) DO NOTHING`, [c.id, req.user.user_id, String(c.wallet_address).toLowerCase(), FUNDED_TERMS_VERSION, message, signature])
    if (!rowCount) throw fail(409, 'agreement_already_signed')
    await pool.query(`INSERT INTO challenge_events (challenge_id, kind, detail) VALUES ($1,'funded_agreement_signed',$2)`, [c.id, JSON.stringify({ termsVersion: FUNDED_TERMS_VERSION })])
    await audit?.('funded_agreement_signed', req.user.user_id, req, { challengeId: c.id, termsVersion: FUNDED_TERMS_VERSION })
    res.status(201).json({ ok: true, termsVersion: FUNDED_TERMS_VERSION })
  }))
  return router
}
