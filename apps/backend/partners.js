/**
 * Openfund Brand Ambassador and Verified Trading Coach programs.
 *
 * Two independent roles share one application workflow
 * (submitted → under_review → approved | rejected; approved ↔ suspended).
 * Each role needs its own approval; approving one never grants the other.
 *
 * Ambassador economics (server-enforced, see docs/economy/AMBASSADOR_POLICY.md):
 *  - a referral code exists ONLY after an administrator approves the
 *    application with verified audience evidence (≥ 50,000 followers on
 *    Instagram OR YouTube, plus an active second platform);
 *  - commission = 10% of the confirmed net purchase amount, on the
 *    referred customer's FIRST paid purchase only;
 *  - recognized inside the same database transaction that confirms the
 *    payment (purchases.js → recognizeCommissionTx), idempotent through
 *    partial UNIQUE indexes — replays/duplicate callbacks insert nothing;
 *  - refunds/chargebacks append proportional reversal entries; history is
 *    append-only (UPDATE/DELETE rejected by trigger);
 *  - recognition (ledger entry) is separate from transfer (payout entry
 *    with the operator's payout reference).
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import { adminAuth, adminActor } from './admin.js'
import { commissionFor, commissionReversal, D, usd } from './economy-math.js'
import { liveEligibility } from './live-funding.js'
import { financialAudit } from './financial-audit.js'

export { financialAudit }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const AMBASSADOR_TERMS_VERSION = 'ambassador-2026-11'
export const COACH_TERMS_VERSION = 'coach-2026-11'
export const AMBASSADOR_MIN_FOLLOWERS = 50_000

const mask = a => { const v = String(a || '').toLowerCase(); return v.length < 12 ? v : `${v.slice(0, 6)}…${v.slice(-4)}` }
const str = (v, max, { required = false } = {}) => {
  if (v == null || v === '') { if (required) throw fail(400, 'missing_field'); return null }
  if (typeof v !== 'string' || v.length > max) throw fail(400, 'invalid_field')
  return v.trim()
}
const url = (v, hosts) => {
  if (v == null || v === '') return null
  let u
  try { u = new URL(String(v)) } catch { throw fail(400, 'invalid_url') }
  if (u.protocol !== 'https:' || u.username || u.password) throw fail(400, 'invalid_url')
  if (hosts && !hosts.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))) throw fail(400, 'invalid_platform_url')
  return u.href.slice(0, 300)
}
const count = v => {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 1e10) throw fail(400, 'invalid_count')
  return n
}
const email = v => {
  const e = str(v, 200, { required: true })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw fail(400, 'invalid_email')
  return e.toLowerCase()
}
const sanitizeCampaign = v => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v.toLowerCase() : null)

/* ---------------- application payload validation ---------------- */
export function validateApplication(role, body = {}) {
  if (body.acceptTerms !== true) throw fail(400, 'terms_not_accepted')
  const contactEmail = email(body.contactEmail)
  if (role === 'ambassador') {
    const payload = {
      displayName: str(body.displayName, 80, { required: true }),
      instagramUrl: url(body.instagramUrl, ['instagram.com']),
      youtubeUrl: url(body.youtubeUrl, ['youtube.com', 'youtu.be']),
      instagramFollowers: count(body.instagramFollowers),
      youtubeSubscribers: count(body.youtubeSubscribers),
      audienceLocation: str(body.audienceLocation, 120, { required: true }),
      contentCategory: str(body.contentCategory, 120, { required: true }),
      marketingExperience: str(body.marketingExperience, 2000, { required: true }),
      promotionStrategy: str(body.promotionStrategy, 3000, { required: true }),
      notes: str(body.notes, 2000),
    }
    if (!payload.instagramUrl && !payload.youtubeUrl) throw fail(400, 'platform_required')
    /* self-declared counts are recorded as CLAIMS only; never shown as verified */
    return { contactEmail, payload, terms: AMBASSADOR_TERMS_VERSION }
  }
  if (role === 'coach') {
    const links = Array.isArray(body.profileLinks) ? body.profileLinks.slice(0, 5).map(l => url(l)) : []
    const docs = Array.isArray(body.supportingDocuments) ? body.supportingDocuments.slice(0, 5).map(l => url(l)) : []
    const payload = {
      displayName: str(body.displayName, 80, { required: true }),
      contact: str(body.contact, 200),
      tradingExperience: str(body.tradingExperience, 3000, { required: true }),
      marketsTraded: str(body.marketsTraded, 300, { required: true }),
      trackRecord: str(body.trackRecord, 3000, { required: true }),
      riskManagement: str(body.riskManagement, 3000, { required: true }),
      mentoringExperience: str(body.mentoringExperience, 3000, { required: true }),
      profileLinks: links.filter(Boolean),
      supportingDocuments: docs.filter(Boolean),
      motivation: str(body.motivation, 3000, { required: true }),
    }
    return { contactEmail, payload, terms: COACH_TERMS_VERSION }
  }
  throw fail(400, 'invalid_role')
}

/**
 * Reviewer-verified audience evidence required to approve an ambassador.
 * `verification.audience` = [{ platform, count, evidence, verifiedAt }]
 */
export function checkAmbassadorVerification(v = {}) {
  const audience = Array.isArray(v.audience) ? v.audience : []
  const valid = audience.filter(a => ['instagram', 'youtube'].includes(a?.platform) && Number.isInteger(a?.count) && typeof a?.evidence === 'string' && a.evidence.trim().length >= 4)
  if (!valid.some(a => a.count >= AMBASSADOR_MIN_FOLLOWERS)) return 'audience_threshold_not_verified'
  if (v.secondPlatformActive !== true) return 'second_platform_not_verified'
  if (v.marketsContent !== true || v.engagementReviewed !== true) return 'content_review_incomplete'
  return null
}

async function uniqueCode(db, prefix) {
  for (let i = 0; i < 8; i++) {
    const code = prefix + Array.from(crypto.randomBytes(9)).map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
    const { rows } = await db.query(
      `SELECT 1 FROM referral_codes WHERE code=$1 UNION ALL SELECT 1 FROM ambassador_profiles WHERE referral_code=$1
       UNION ALL SELECT 1 FROM coach_profiles WHERE coach_code=$1`, [code])
    if (!rows.length) return code
  }
  throw new Error('code generation failed')
}

const cookieValue = (req, name) => {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}
const cookieCode = req => {
  const v = String(cookieValue(req, 'of_ref') || '').trim().toUpperCase()
  return /^[A-HJ-NP-Z2-9]{6,12}$/.test(v) ? v : null
}

/** Attribution at account creation (called from /auth/verify; never throws). */
export async function attributeAmbassador(pool, req, { newUserId }) {
  try { return await attributeTx(pool, req, newUserId, 'signup') } catch (e) { console.error('ambassador attribution failed:', e?.message); return false }
}

/**
 * Attribution at order creation for an existing account that has never
 * paid and was never attributed (e.g. signed up before visiting the link).
 */
export async function attributeAtFirstOrder(pool, req, userId) {
  try {
    const paid = await pool.query(`SELECT 1 FROM purchase_orders WHERE user_id=$1 AND status='paid' LIMIT 1`, [userId])
    if (paid.rowCount) return false
    return await attributeTx(pool, req, userId, 'first_order')
  } catch (e) { console.error('ambassador attribution failed:', e?.message); return false }
}

async function attributeTx(db, req, userId, source) {
  const code = cookieCode(req)
  if (!code) return false
  const { rows: [p] } = await db.query(`SELECT user_id FROM ambassador_profiles WHERE referral_code=$1 AND status='active'`, [code])
  if (!p || String(p.user_id) === String(userId)) return false
  const r = await db.query(
    `INSERT INTO ambassador_attributions (referred_user_id, ambassador_user_id, referral_code, source, campaign)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (referred_user_id) DO NOTHING`,
    [userId, p.user_id, code, source, sanitizeCampaign(cookieValue(req, 'of_cmp'))])
  return r.rowCount === 1
}

/**
 * Recognize the ambassador commission for a confirmed payment. MUST run
 * inside the payment-confirmation transaction (`client`). Returns the
 * ledger entry id, or null with a reason when not eligible.
 */
export async function recognizeCommissionTx(client, { orderId, userId, paymentId, payerAddress }) {
  const { rows: [attr] } = await client.query(`SELECT * FROM ambassador_attributions WHERE referred_user_id=$1`, [userId])
  if (!attr) return { recognized: false, reason: 'not_attributed' }
  const { rows: [order] } = await client.query(`SELECT id, price_usd, created_at, status FROM purchase_orders WHERE id=$1`, [orderId])
  const skip = async reason => {
    await financialAudit(client, 'system', 'commission_not_recognized', 'purchase_order', orderId, null, { reason, ambassador: attr.ambassador_user_id })
    return { recognized: false, reason }
  }
  if (!order || order.status !== 'paid') return skip('order_not_paid')
  const { rows: [prof] } = await client.query(
    `SELECT a.status, u.wallet_address FROM ambassador_profiles a JOIN openfund_users u ON u.id=a.user_id WHERE a.user_id=$1 FOR SHARE OF a`, [attr.ambassador_user_id])
  if (!prof || prof.status !== 'active') return skip('ambassador_not_active')
  if (new Date(attr.attributed_at) > new Date(order.created_at)) return skip('attributed_after_order')
  if (payerAddress && String(payerAddress).toLowerCase() === String(prof.wallet_address).toLowerCase()) return skip('self_referral_payer')
  const earlier = await client.query(`SELECT 1 FROM purchase_orders WHERE user_id=$1 AND status='paid' AND id<>$2 LIMIT 1`, [userId, orderId])
  if (earlier.rowCount) return skip('not_first_purchase')
  const c = commissionFor(order.price_usd)
  if (!c) return skip('zero_amount')
  const { rows: [entry] } = await client.query(
    `INSERT INTO referral_commissions (ambassador_user_id, referred_user_id, entry_type, purchase_order_id, payment_id, base_amount_usd, rate, amount_usd, campaign)
     VALUES ($1,$2,'earned',$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id`,
    [attr.ambassador_user_id, userId, orderId, paymentId, c.base, c.rate, c.amount, attr.campaign])
  if (!entry) return { recognized: false, reason: 'already_recognized' }
  await financialAudit(client, 'system', 'commission_earned', 'referral_commission', entry.id, null, { orderId, paymentId, ...c })
  return { recognized: true, id: entry.id, ...c }
}

/** Proportional reversal for a recorded refund/chargeback (inside `client` tx). */
export async function reverseCommissionTx(client, adjustment, actor) {
  const { rows: [earned] } = await client.query(
    `SELECT * FROM referral_commissions WHERE purchase_order_id=$1 AND entry_type='earned'`, [adjustment.purchase_order_id])
  if (!earned) return null
  const { rows: [{ reversed }] } = await client.query(
    `SELECT coalesce(sum(r.amount_usd),0) AS reversed FROM referral_commissions r
       JOIN payment_adjustments a ON a.id=r.adjustment_id
      WHERE r.entry_type='reversal' AND a.purchase_order_id=$1`, [adjustment.purchase_order_id])
  const amount = commissionReversal({ earnedUsd: earned.amount_usd, baseUsd: earned.base_amount_usd, adjustmentUsd: adjustment.amount_usd, alreadyReversedUsd: reversed })
  if (D(amount).lte(0)) return null
  const { rows: [entry] } = await client.query(
    `INSERT INTO referral_commissions (ambassador_user_id, referred_user_id, entry_type, purchase_order_id, payment_id, adjustment_id, base_amount_usd, rate, amount_usd, recorded_by)
     VALUES ($1,$2,'reversal',$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id`,
    [earned.ambassador_user_id, earned.referred_user_id, earned.purchase_order_id, earned.payment_id, adjustment.id, adjustment.amount_usd, earned.rate, `-${amount}`, actor])
  if (entry) await financialAudit(client, actor, 'commission_reversed', 'referral_commission', entry.id, { earned: earned.amount_usd }, { reversal: `-${amount}`, adjustmentId: adjustment.id })
  return entry ? { id: entry.id, amount: `-${amount}` } : null
}

async function ambassadorBalances(db, ambassadorId) {
  const { rows: [b] } = await db.query(
    `SELECT coalesce(sum(amount_usd) FILTER (WHERE entry_type='earned'),0) AS earned,
            coalesce(sum(amount_usd) FILTER (WHERE entry_type='reversal'),0) AS reversed,
            coalesce(-sum(amount_usd) FILTER (WHERE entry_type='payout'),0) AS paid,
            coalesce(sum(amount_usd),0) AS pending,
            count(*) FILTER (WHERE entry_type='earned')::int AS first_purchases,
            coalesce(sum(base_amount_usd) FILTER (WHERE entry_type='earned'),0) AS eligible_revenue
       FROM referral_commissions WHERE ambassador_user_id=$1`, [ambassadorId])
  return b
}

async function applicationState(pool, userId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (role) id, role, status, submitted_at, updated_at, decided_at, decision_note
       FROM partner_applications WHERE user_id=$1 ORDER BY role, submitted_at DESC`, [userId])
  const out = { ambassador: null, coach: null }
  for (const r of rows) out[r.role] = { id: r.id, status: r.status, submittedAt: r.submitted_at, updatedAt: r.updated_at, decidedAt: r.decided_at, note: r.status === 'rejected' ? r.decision_note : null }
  return out
}

/* ================================================================== */
export function partnerRoutes({ pool, requireAuth, audit, limit }) {
  const router = Router()

  router.get('/partners/me', requireAuth, wrap(async (req, res) => {
    const applications = await applicationState(pool, req.user.user_id)
    const amb = (await pool.query(`SELECT referral_code, status, approved_at FROM ambassador_profiles WHERE user_id=$1`, [req.user.user_id])).rows[0]
    const coach = (await pool.query(`SELECT coach_code, status, approved_at FROM coach_profiles WHERE user_id=$1`, [req.user.user_id])).rows[0]
    res.json({
      applications,
      ambassador: amb ? { code: amb.referral_code, status: amb.status, approvedAt: amb.approved_at } : null,
      coach: coach ? { code: coach.coach_code, status: coach.status, approvedAt: coach.approved_at } : null,
      terms: { ambassador: AMBASSADOR_TERMS_VERSION, coach: COACH_TERMS_VERSION },
    })
  }))

  router.post('/partners/applications', requireAuth, limit(10), wrap(async (req, res) => {
    const role = req.body?.role
    const { contactEmail, payload, terms } = validateApplication(role, req.body || {})
    /* the connected wallet IS the payout identity; it is taken from the session, never the form */
    payload.walletAddress = req.user.wallet_address
    try {
      const { rows: [a] } = await pool.query(
        `INSERT INTO partner_applications (user_id, role, contact_email, payload, terms_version) VALUES ($1,$2,$3,$4,$5) RETURNING id, status, submitted_at`,
        [req.user.user_id, role, contactEmail, JSON.stringify(payload), terms])
      await pool.query(`INSERT INTO partner_application_events (application_id, to_status, actor) VALUES ($1,'submitted',$2)`, [a.id, `user:${req.user.user_id}`])
      await audit('partner_application_submitted', req.user.user_id, req, { role, applicationId: a.id })
      res.status(201).json({ id: a.id, status: a.status, submittedAt: a.submitted_at })
    } catch (e) {
      if (e.code === '23505') throw fail(409, 'application_already_open')
      throw e
    }
  }))

  /* public, rate-limited traffic beacon from /:locale/ref/:code */
  router.post('/ambassador/visit', limit(30), wrap(async (req, res) => {
    const code = String(req.body?.code || '').toUpperCase()
    if (!/^[A-HJ-NP-Z2-9]{6,12}$/.test(code)) return res.status(204).end()
    const { rows: [p] } = await pool.query(`SELECT 1 FROM ambassador_profiles WHERE referral_code=$1 AND status='active'`, [code])
    if (!p) return res.status(204).end()
    const day = new Date().toISOString().slice(0, 10)
    const visitor = crypto.createHash('sha256').update(`${day}|${req.ip}|${req.headers['user-agent'] || ''}|${code}`).digest('hex').slice(0, 32)
    await pool.query(`INSERT INTO referral_visits (referral_code, visitor_hash, campaign, day) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [code, visitor, sanitizeCampaign(req.body?.campaign), day])
    res.status(204).end()
  }))

  router.get('/ambassador/dashboard', requireAuth, wrap(async (req, res) => {
    const { rows: [p] } = await pool.query(`SELECT * FROM ambassador_profiles WHERE user_id=$1`, [req.user.user_id])
    if (!p) throw fail(403, 'ambassador_not_approved')
    const traffic = (await pool.query(
      `SELECT count(*)::int AS visits, count(*) FILTER (WHERE day > current_date - 30)::int AS visits30 FROM referral_visits WHERE referral_code=$1`, [p.referral_code])).rows[0]
    const series = (await pool.query(
      `SELECT day, count(*)::int AS visits FROM referral_visits WHERE referral_code=$1 AND day > current_date - 30 GROUP BY day ORDER BY day`, [p.referral_code])).rows
    const signups = (await pool.query(`SELECT count(*)::int AS n FROM ambassador_attributions WHERE ambassador_user_id=$1`, [req.user.user_id])).rows[0].n
    const b = await ambassadorBalances(pool, req.user.user_id)
    const history = (await pool.query(
      `SELECT id, entry_type, base_amount_usd, amount_usd, payout_reference, campaign, created_at
         FROM referral_commissions WHERE ambassador_user_id=$1 ORDER BY created_at DESC LIMIT 200`, [req.user.user_id])).rows
    const campaigns = (await pool.query(
      `SELECT coalesce(v.k, c.k) AS campaign, coalesce(v.visits,0)::int AS visits, coalesce(c.purchases,0)::int AS purchases, coalesce(c.earned,0) AS earned
         FROM (SELECT coalesce(campaign,'(none)') k, count(*) visits FROM referral_visits WHERE referral_code=$1 GROUP BY 1) v
         FULL JOIN (SELECT coalesce(campaign,'(none)') k, count(*) purchases, sum(amount_usd) earned FROM referral_commissions WHERE ambassador_user_id=$2 AND entry_type='earned' GROUP BY 1) c
           ON c.k = v.k
        ORDER BY 2 DESC`, [p.referral_code, req.user.user_id])).rows
    res.json({
      status: p.status, code: p.referral_code, linkPath: `/ref/${p.referral_code}`, commissionRate: p.commission_rate,
      traffic: { uniqueVisitorDays: traffic.visits, last30Days: traffic.visits30, series },
      referredSignups: signups,
      confirmedFirstPurchases: b.first_purchases,
      eligibleRevenueUsd: usd(b.eligible_revenue),
      earnedUsd: usd(b.earned), reversedUsd: usd(b.reversed), paidUsd: usd(b.paid), pendingSettlementUsd: usd(b.pending),
      history: history.map(h => ({ id: h.id, type: h.entry_type, baseUsd: h.base_amount_usd, amountUsd: h.amount_usd, payoutReference: h.payout_reference, campaign: h.campaign, at: h.created_at })),
      campaigns: campaigns.map(c => ({ campaign: c.campaign, visits: c.visits ?? 0, purchases: c.purchases, earnedUsd: usd(c.earned) })),
    })
  }))

  /* ---------------- coach: trader-side link ---------------- */
  router.get('/coach/link', requireAuth, wrap(async (req, res) => {
    const { rows: [l] } = await pool.query(
      `SELECT l.id, l.status, l.qualification, l.requested_at, l.responded_at, l.verified_at, c.coach_code,
              (SELECT payload->>'displayName' FROM partner_applications WHERE id=c.application_id) AS coach_name
         FROM trader_coach_links l JOIN coach_profiles c ON c.user_id=l.coach_user_id
        WHERE l.trader_user_id=$1 ORDER BY l.requested_at DESC LIMIT 1`, [req.user.user_id])
    res.json({ link: l ? { id: l.id, status: l.status, qualification: l.qualification, coachCode: l.coach_code, coachName: l.coach_name, requestedAt: l.requested_at, verifiedAt: l.verified_at } : null })
  }))

  router.post('/coach/link', requireAuth, limit(10), wrap(async (req, res) => {
    const code = String(req.body?.coachCode || '').toUpperCase()
    const { rows: [c] } = await pool.query(`SELECT user_id FROM coach_profiles WHERE coach_code=$1 AND status='active'`, [code])
    if (!c) throw fail(404, 'coach_not_found')
    if (String(c.user_id) === String(req.user.user_id)) throw fail(400, 'self_coaching_not_allowed')
    try {
      const { rows: [l] } = await pool.query(
        `INSERT INTO trader_coach_links (trader_user_id, coach_user_id) VALUES ($1,$2) RETURNING id, status`, [req.user.user_id, c.user_id])
      await financialAudit(pool, `user:${req.user.user_id}`, 'coach_link_requested', 'trader_coach_link', l.id, null, { coach: c.user_id })
      res.status(201).json(l)
    } catch (e) { if (e.code === '23505') throw fail(409, 'coach_link_already_open'); throw e }
  }))

  router.post('/coach/link/:id/end', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'link_not_found')
    const { rows: [l] } = await pool.query(
      `UPDATE trader_coach_links SET status='ended', ended_at=now()
        WHERE id=$1 AND (trader_user_id=$2 OR coach_user_id=$2) AND status IN ('requested','active') RETURNING id`, [req.params.id, req.user.user_id])
    if (!l) throw fail(409, 'link_not_open')
    await financialAudit(pool, `user:${req.user.user_id}`, 'coach_link_ended', 'trader_coach_link', l.id, null, null)
    res.json({ ok: true })
  }))

  /* ---------------- coach: coach-side dashboard ---------------- */
  const coachProfile = async userId => {
    const { rows: [c] } = await pool.query(`SELECT * FROM coach_profiles WHERE user_id=$1`, [userId])
    if (!c) throw fail(403, 'coach_not_approved')
    return c
  }

  router.get('/coach/dashboard', requireAuth, wrap(async (req, res) => {
    const c = await coachProfile(req.user.user_id)
    const links = (await pool.query(
      `SELECT l.id, l.trader_user_id, l.status, l.qualification, l.qualification_note, l.requested_at, l.verified_at, u.wallet_address, u.display_name
         FROM trader_coach_links l JOIN openfund_users u ON u.id=l.trader_user_id
        WHERE l.coach_user_id=$1 AND l.status IN ('requested','active') ORDER BY l.requested_at DESC`, [req.user.user_id])).rows
    const traders = []
    for (const l of links) {
      /* coaches see eligibility PROGRESS of their own linked traders only */
      const e = l.status === 'active' ? await liveEligibility(pool, l.trader_user_id) : null
      traders.push({
        linkId: l.id, status: l.status, qualification: l.qualification, note: l.qualification_note,
        trader: { wallet: mask(l.wallet_address), displayName: l.display_name || null },
        requestedAt: l.requested_at, verifiedAt: l.verified_at,
        eligibility: e ? e.checks.filter(x => !x.key.startsWith('coach_')) : null,
      })
    }
    const trades = (await pool.query(
      `SELECT p.live_trade_id, p.realized_pnl_usd, p.eligible_costs_usd, p.distributable_usd, p.coach_amount_usd, p.created_at, s.status AS settlement_status, s.tx_hash, s.settlement_reference
         FROM profit_share_allocations p LEFT JOIN settlement_records s ON s.profit_share_id=p.id AND s.beneficiary_role='coach'
        WHERE p.coach_user_id=$1 ORDER BY p.created_at DESC LIMIT 200`, [req.user.user_id])).rows
    const sum = (rows, f, pred = () => true) => rows.filter(pred).reduce((s, r) => s.plus(r[f] || 0), D(0)).toFixed(2)
    res.json({
      status: c.status, code: c.coach_code, revenueSharePct: 10,
      linkedTraders: traders.filter(t => t.status === 'active').length,
      pendingRequests: traders.filter(t => t.status === 'requested').length,
      traders,
      liveTrades: trades.map(t => ({ tradeId: t.live_trade_id, realizedPnlUsd: t.realized_pnl_usd, costsUsd: t.eligible_costs_usd, distributableUsd: t.distributable_usd, coachShareUsd: t.coach_amount_usd, settlement: t.settlement_status, txHash: t.tx_hash, reference: t.settlement_reference, at: t.created_at })),
      realizedNetProfitUsd: sum(trades, 'distributable_usd'),
      coachShareUsd: sum(trades, 'coach_amount_usd'),
      settledUsd: sum(trades, 'coach_amount_usd', t => t.settlement_status === 'completed'),
      pendingUsd: sum(trades, 'coach_amount_usd', t => t.settlement_status !== 'completed'),
    })
  }))

  router.post('/coach/links/:id/respond', requireAuth, wrap(async (req, res) => {
    await coachProfile(req.user.user_id)
    if (!uuid.test(req.params.id)) throw fail(404, 'link_not_found')
    const accept = req.body?.accept === true
    const { rows: [l] } = await pool.query(
      `UPDATE trader_coach_links SET status=$3, responded_at=now() WHERE id=$1 AND coach_user_id=$2 AND status='requested' RETURNING id, status`,
      [req.params.id, req.user.user_id, accept ? 'active' : 'declined'])
    if (!l) throw fail(409, 'link_not_pending')
    await financialAudit(pool, `user:${req.user.user_id}`, `coach_link_${l.status}`, 'trader_coach_link', l.id, null, null)
    res.json(l)
  }))

  router.post('/coach/links/:id/qualification', requireAuth, wrap(async (req, res) => {
    const c = await coachProfile(req.user.user_id)
    if (c.status !== 'active') throw fail(403, 'coach_suspended')
    if (!uuid.test(req.params.id)) throw fail(404, 'link_not_found')
    const decision = req.body?.decision
    if (!['verified', 'rejected'].includes(decision)) throw fail(400, 'invalid_decision')
    const note = str(req.body?.note, 1000, { required: true })
    const { rows: [l] } = await pool.query(
      `UPDATE trader_coach_links SET qualification=$3, qualification_note=$4, verified_at=now()
        WHERE id=$1 AND coach_user_id=$2 AND status='active' RETURNING id, qualification`, [req.params.id, req.user.user_id, decision, note])
    if (!l) throw fail(409, 'link_not_active')
    await financialAudit(pool, `user:${req.user.user_id}`, 'coach_qualification', 'trader_coach_link', l.id, null, { decision, note })
    res.json(l)
  }))

  return router
}

/* ================================================================== */
const APPLICATION_ACTIONS = {
  review: { from: ['submitted'], to: 'under_review' },
  approve: { from: ['submitted', 'under_review'], to: 'approved' },
  reject: { from: ['submitted', 'under_review'], to: 'rejected' },
  suspend: { from: ['approved'], to: 'suspended' },
  reinstate: { from: ['suspended'], to: 'approved' },
}

export function partnerAdminRoutes({ pool }) {
  const router = Router()
  router.use(adminAuth)

  router.get('/applications', wrap(async (req, res) => {
    const params = [], where = []
    if (['ambassador', 'coach'].includes(req.query.role)) { params.push(req.query.role); where.push(`a.role=$${params.length}`) }
    if (Object.values(APPLICATION_ACTIONS).some(s => s.to === req.query.status) || req.query.status === 'submitted') { params.push(req.query.status); where.push(`a.status=$${params.length}`) }
    const { rows } = await pool.query(
      `SELECT a.id, a.role, a.status, a.contact_email, a.payload, a.verification, a.submitted_at, a.decided_at, a.decided_by, a.decision_note, u.wallet_address
         FROM partner_applications a JOIN openfund_users u ON u.id=a.user_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.submitted_at DESC LIMIT 200`, params)
    res.json({ applications: rows })
  }))

  router.get('/applications/:id', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'application_not_found')
    const { rows: [a] } = await pool.query(`SELECT a.*, u.wallet_address FROM partner_applications a JOIN openfund_users u ON u.id=a.user_id WHERE a.id=$1`, [req.params.id])
    if (!a) throw fail(404, 'application_not_found')
    const events = (await pool.query(`SELECT from_status, to_status, actor, note, ts FROM partner_application_events WHERE application_id=$1 ORDER BY id`, [a.id])).rows
    res.json({ application: a, events })
  }))

  router.post('/applications/:id/decision', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'application_not_found')
    const spec = APPLICATION_ACTIONS[req.body?.action]
    if (!spec) throw fail(400, 'invalid_action')
    const note = str(req.body?.note, 2000, { required: ['reject', 'suspend', 'approve'].includes(req.body.action) })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [a] } = await client.query(`SELECT * FROM partner_applications WHERE id=$1 FOR UPDATE`, [req.params.id])
      if (!a) throw fail(404, 'application_not_found')
      if (a.status === spec.to) { await client.query('COMMIT'); return res.json({ ok: true, duplicate: true, status: a.status }) }
      if (!spec.from.includes(a.status)) throw fail(409, `application_${a.status}_cannot_${req.body.action}`)
      let verification = a.verification
      let code = null
      if (req.body.action === 'approve') {
        verification = req.body.verification || {}
        if (a.role === 'ambassador') {
          const err = checkAmbassadorVerification(verification)
          if (err) throw fail(400, err)
          code = await uniqueCode(client, 'A')
          await client.query(
            `INSERT INTO ambassador_profiles (user_id, application_id, referral_code, approved_by) VALUES ($1,$2,$3,$4)
             ON CONFLICT (user_id) DO UPDATE SET application_id=EXCLUDED.application_id, status='active', updated_at=now()`,
            [a.user_id, a.id, code, actor])
          code = (await client.query(`SELECT referral_code FROM ambassador_profiles WHERE user_id=$1`, [a.user_id])).rows[0].referral_code
        } else {
          if (typeof verification.trackRecordReviewed !== 'boolean' || !verification.trackRecordReviewed || typeof verification.evidence !== 'string' || verification.evidence.trim().length < 4)
            throw fail(400, 'track_record_not_verified')
          code = await uniqueCode(client, 'C')
          await client.query(
            `INSERT INTO coach_profiles (user_id, application_id, coach_code, approved_by) VALUES ($1,$2,$3,$4)
             ON CONFLICT (user_id) DO UPDATE SET application_id=EXCLUDED.application_id, status='active', updated_at=now()`,
            [a.user_id, a.id, code, actor])
          code = (await client.query(`SELECT coach_code FROM coach_profiles WHERE user_id=$1`, [a.user_id])).rows[0].coach_code
        }
      }
      const table = a.role === 'ambassador' ? 'ambassador_profiles' : 'coach_profiles'
      if (req.body.action === 'suspend') await client.query(`UPDATE ${table} SET status='suspended', updated_at=now() WHERE user_id=$1`, [a.user_id])
      if (req.body.action === 'reinstate') await client.query(`UPDATE ${table} SET status='active', updated_at=now() WHERE user_id=$1`, [a.user_id])
      await client.query(
        `UPDATE partner_applications SET status=$2, updated_at=now(), verification=$3,
                decided_at=CASE WHEN $2 IN ('approved','rejected','suspended') THEN now() ELSE decided_at END,
                decided_by=CASE WHEN $2 IN ('approved','rejected','suspended') THEN $4 ELSE decided_by END,
                decision_note=coalesce($5, decision_note)
          WHERE id=$1`, [a.id, spec.to, JSON.stringify(verification), actor, note])
      await client.query(`INSERT INTO partner_application_events (application_id, from_status, to_status, actor, note) VALUES ($1,$2,$3,$4,$5)`,
        [a.id, a.status, spec.to, actor, note])
      await financialAudit(client, actor, `partner_${req.body.action}`, 'partner_application', a.id, { status: a.status }, { status: spec.to, role: a.role, code })
      await client.query('COMMIT')
      res.json({ ok: true, status: spec.to, code })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.get('/commissions', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT a.user_id, a.referral_code, a.status, u.wallet_address,
              coalesce(sum(c.amount_usd) FILTER (WHERE c.entry_type='earned'),0) AS earned,
              coalesce(sum(c.amount_usd) FILTER (WHERE c.entry_type='reversal'),0) AS reversed,
              coalesce(-sum(c.amount_usd) FILTER (WHERE c.entry_type='payout'),0) AS paid,
              coalesce(sum(c.amount_usd),0) AS pending
         FROM ambassador_profiles a JOIN openfund_users u ON u.id=a.user_id
         LEFT JOIN referral_commissions c ON c.ambassador_user_id=a.user_id
        GROUP BY a.user_id, a.referral_code, a.status, u.wallet_address ORDER BY pending DESC`)
    res.json({ ambassadors: rows })
  }))

  /* record a completed commission transfer (funds are moved by the operator) */
  router.post('/commissions/payout', wrap(async (req, res) => {
    const actor = adminActor(req)
    const { ambassadorUserId, amountUsd, payoutReference } = req.body || {}
    if (!uuid.test(ambassadorUserId || '')) throw fail(400, 'invalid_ambassador')
    const ref = str(payoutReference, 200, { required: true })
    const amount = D(amountUsd)
    if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 2) throw fail(400, 'invalid_amount')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`commission:${ambassadorUserId}`])
      const dup = await client.query(`SELECT id FROM referral_commissions WHERE ambassador_user_id=$1 AND entry_type='payout' AND payout_reference=$2`, [ambassadorUserId, ref])
      if (dup.rowCount) { await client.query('COMMIT'); return res.json({ ok: true, duplicate: true, id: dup.rows[0].id }) }
      const b = await ambassadorBalances(client, ambassadorUserId)
      if (amount.gt(b.pending)) throw fail(409, 'payout_exceeds_pending_balance')
      const { rows: [e] } = await client.query(
        `INSERT INTO referral_commissions (ambassador_user_id, entry_type, amount_usd, payout_reference, recorded_by) VALUES ($1,'payout',$2,$3,$4) RETURNING id`,
        [ambassadorUserId, `-${usd(amount)}`, ref, actor])
      await financialAudit(client, actor, 'commission_paid', 'referral_commission', e.id, { pending: b.pending }, { paid: usd(amount), reference: ref })
      await client.query('COMMIT')
      res.json({ ok: true, id: e.id })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  return router
}
