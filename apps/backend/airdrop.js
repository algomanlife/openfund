/**
 * Openfund airdrop (owner decision 2026-11-28). Cash or other prizes, never
 * a token, separate from the Premium League, for wallets that bought a
 * challenge. Progress is computed only from valid Openfund certificates
 * issued to the account (never from anything the trader types), and a claim
 * carries the public post links that share them. Openfund reviews every
 * claim; a payment is recorded with its on-chain transaction to the same
 * wallet. No KYC: the wallet that holds the account is the only recipient.
 */
import { Router } from 'express'
import { adminAuth, adminActor } from './admin.js'

const fail = (status, error, details) => Object.assign(new Error(error), { status, ...(details ? { details } : {}) })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TX = /^0x[0-9a-fA-F]{64}$/

/** missions, in display order; `needs` are valid-certificate counts by kind */
export const AIRDROP_MISSIONS = Object.freeze([
  { id: 'buy-share', rewardUsd: 1000, needs: { purchase: 1 } },
  { id: 'pass-share', rewardUsd: 2000, needs: { purchase: 1, completion: 1 } },
  { id: 'payout-share', rewardUsd: 3000, needs: { purchase: 1, completion: 1, payout: 1 } },
  { id: 'three-buys-pass', rewardUsd: 4000, needs: { purchase: 3, completion: 1 } },
  { id: 'ten-payouts', rewardUsd: 5000, needs: { payout: 10 } },
])
const MISSION = new Map(AIRDROP_MISSIONS.map(m => [m.id, m]))
const KINDS = ['purchase', 'completion', 'payout']

/** progress for certificate counts {purchase, completion, payout} */
export function airdropProgress(counts) {
  const eligible = (counts.purchase || 0) >= 1
  return {
    eligible,
    counts: Object.fromEntries(KINDS.map(k => [k, counts[k] || 0])),
    missions: AIRDROP_MISSIONS.map(m => {
      const steps = Object.entries(m.needs).map(([kind, need]) => ({ kind, need, have: Math.min(counts[kind] || 0, need) }))
      return { id: m.id, rewardUsd: m.rewardUsd, steps, complete: eligible && steps.every(s => s.have >= s.need) }
    }),
  }
}

/** 1 to 5 public https post links, de-duplicated */
export function postLinks(value) {
  if (!Array.isArray(value)) throw fail(400, 'links_required')
  const out = []
  for (const raw of value) {
    if (typeof raw !== 'string' || raw.length > 500) throw fail(400, 'invalid_link')
    let u
    try { u = new URL(raw.trim()) } catch { throw fail(400, 'invalid_link') }
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password) throw fail(400, 'invalid_link')
    const s = u.toString()
    if (!out.includes(s)) out.push(s)
  }
  if (!out.length || out.length > 5) throw fail(400, 'links_required')
  return out
}

async function counts(q, userId) {
  const { rows } = await q.query(`SELECT kind, count(*)::int AS n FROM certificates WHERE user_id=$1 AND status='valid' AND kind = ANY($2) GROUP BY kind`, [userId, KINDS])
  return Object.fromEntries(rows.map(r => [r.kind, r.n]))
}

const publicClaim = c => ({ id: c.id, mission: c.mission, rewardUsd: c.reward_usd, links: c.links, status: c.status, reason: c.decision_reason,
  submittedAt: c.submitted_at, decidedAt: c.decided_at, paidTxHash: c.paid_tx_hash })

export function airdropRoutes({ pool, requireAuth, limit = () => (req, res, next) => next(), audit = async () => {} }) {
  const router = Router()

  router.get('/airdrop/missions', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json({ token: false, missions: AIRDROP_MISSIONS.map(({ id, rewardUsd, needs }) => ({ id, rewardUsd, needs })) })
  })

  router.get('/airdrop/me', requireAuth, wrap(async (req, res) => {
    const progress = airdropProgress(await counts(pool, req.user.user_id))
    const { rows } = await pool.query('SELECT * FROM airdrop_claims WHERE user_id=$1', [req.user.user_id])
    const claims = new Map(rows.map(c => [c.mission, publicClaim(c)]))
    res.set('Cache-Control', 'no-store').json({ ...progress, missions: progress.missions.map(m => ({ ...m, claim: claims.get(m.id) || null })) })
  }))

  router.post('/airdrop/claims', requireAuth, limit(10), wrap(async (req, res) => {
    const mission = MISSION.get(req.body?.mission)
    if (!mission) throw fail(400, 'invalid_mission')
    const links = postLinks(req.body?.links)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      /* one decision at a time per wallet and mission */
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`airdrop:${req.user.user_id}:${mission.id}`])
      const progress = airdropProgress(await counts(client, req.user.user_id))
      if (!progress.eligible) throw fail(403, 'purchase_required')
      if (!progress.missions.find(m => m.id === mission.id).complete) throw fail(409, 'mission_incomplete')
      const { rows: [existing] } = await client.query('SELECT * FROM airdrop_claims WHERE user_id=$1 AND mission=$2 FOR UPDATE', [req.user.user_id, mission.id])
      if (existing && existing.status !== 'rejected') throw fail(409, 'claim_exists', { status: existing.status })
      const { rows: [claim] } = existing
        ? await client.query(`UPDATE airdrop_claims SET links=$2, status='submitted', decision_reason=NULL, decided_by=NULL, decided_at=NULL, submitted_at=now(), updated_at=now()
            WHERE id=$1 RETURNING *`, [existing.id, JSON.stringify(links)])
        : await client.query(`INSERT INTO airdrop_claims (user_id, mission, reward_usd, links) VALUES ($1,$2,$3,$4) RETURNING *`,
            [req.user.user_id, mission.id, mission.rewardUsd, JSON.stringify(links)])
      await client.query('COMMIT')
      await audit('airdrop_claim_submitted', req.user.user_id, req, { claimId: claim.id, mission: mission.id })
      res.status(201).json({ claim: publicClaim(claim) })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e }
    finally { client.release() }
  }))

  return router
}

export function airdropAdminRoutes({ pool, audit = async () => {} }) {
  const router = Router()
  router.use(adminAuth)
  const reasonOf = v => { if (typeof v !== 'string' || v.trim().length < 3 || v.length > 1000) throw fail(400, 'reason_required'); return v.trim() }

  router.get('/claims', wrap(async (req, res) => {
    const status = ['submitted', 'approved', 'rejected', 'paid'].includes(req.query.status) ? req.query.status : 'submitted'
    const { rows } = await pool.query(`SELECT c.*, u.wallet_address FROM airdrop_claims c JOIN openfund_users u ON u.id=c.user_id
      WHERE c.status=$1 ORDER BY c.submitted_at LIMIT 200`, [status])
    res.set('Cache-Control', 'no-store').json({ claims: rows.map(c => ({ ...publicClaim(c), wallet: c.wallet_address })) })
  }))

  /* approve | reject (reason) | paid (reason + the on-chain transaction to the claim's wallet) */
  router.post('/claims/:id/decide', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'claim_not_found')
    const actor = adminActor(req), reason = reasonOf(req.body?.reason), decision = req.body?.decision
    const from = { approve: ['submitted'], reject: ['submitted', 'approved'], paid: ['approved'] }[decision]
    if (!from) throw fail(400, 'invalid_decision')
    const tx = decision === 'paid' ? String(req.body?.txHash || '') : null
    if (decision === 'paid' && !TX.test(tx)) throw fail(400, 'invalid_tx_hash')
    const status = { approve: 'approved', reject: 'rejected', paid: 'paid' }[decision]
    const { rows: [c] } = await pool.query(`UPDATE airdrop_claims SET status=$2, decision_reason=$3, decided_by=$4, decided_at=now(), updated_at=now(),
        paid_tx_hash = coalesce($5, paid_tx_hash) WHERE id=$1 AND status = ANY($6) RETURNING *`, [req.params.id, status, reason, actor, tx && tx.toLowerCase(), from])
    if (!c) throw fail(409, 'claim_not_in_state')
    await audit(`airdrop_claim_${status}`, c.user_id, req, { actor, claimId: c.id, mission: c.mission, reason, txHash: c.paid_tx_hash })
    res.json({ claim: publicClaim(c) })
  }))
  return router
}
