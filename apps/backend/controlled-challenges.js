import { randomBytes } from 'node:crypto'
import { adminActor } from './admin.js'

const fail = (status, message) => Object.assign(new Error(message), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

export function controlledRules(rules, entitlement) {
  if (!entitlement) return rules
  const instant = entitlement.profile === 'instant'
  if (!rules.evaluationCapable || rules.free || rules.model !== entitlement.profile || rules.phases !== (instant ? 0 : 2))
    throw fail(409, 'controlled_challenge_configuration_invalid')

  return {
    ...rules,
    controlledTest: { couponId: entitlement.coupon_id, profile: entitlement.profile },
    timeLimitDays: null,
    trialDaysPerPhase: null,
    minTradingDays: 0,
    refundPolicy: 'none',
    ...(instant ? {
      profitableDaysPer30: null,
      conduct: { ...rules.conduct, profitableDayRule: null },
      rewardCycles: rules.rewardCycles.map(cycle => ({ ...cycle, profitableDays: null })),
    } : { phase1TargetPct: 1, phase2TargetPct: 1 }),
  }
}

export function mountControlledChallenges(router, pool) {
  router.post('/controlled', wrap(async (req, res) => {
    const actor = adminActor(req)
    const { profile, walletAddress } = req.body || {}
    if (!['instant', 'standard'].includes(profile)) throw fail(400, 'invalid_controlled_profile')
    if (typeof walletAddress !== 'string' || !/^0x[0-9a-f]{40}$/i.test(walletAddress)) throw fail(400, 'invalid_wallet')
    const wallet = walletAddress.toLowerCase()
    const code = randomBytes(16).toString('hex').toUpperCase()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [owner] } = await client.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [wallet])
      if (!owner) throw fail(404, 'wallet_not_registered')
      const { rows: [plan] } = await client.query('SELECT id FROM challenge_plans WHERE slug=$1', [profile])
      if (!plan) throw fail(409, 'controlled_challenge_plan_missing')
      await client.query("SELECT set_config('openfund.actor',$1,true)", [actor])
      const { rows: [coupon] } = await client.query(
        `INSERT INTO coupons (code,name,kind,value,status,max_redemptions,internal,created_by,expires_at)
         VALUES ($1,$2,'percent',100,'active',1,true,$3,now()+interval '7 days') RETURNING id, expires_at`,
        [code, `Controlled test: ${profile}`, actor])
      await client.query(`INSERT INTO controlled_challenge_coupons (coupon_id,profile,user_id,wallet_address,challenge_plan_id,issued_by)
        VALUES ($1,$2,$3,$4,$5,$6)`, [coupon.id, profile, owner.id, wallet, plan.id, actor])
      await client.query('INSERT INTO coupon_challenge_plans (coupon_id,challenge_plan_id) VALUES ($1,$2)', [coupon.id, plan.id])
      await client.query('INSERT INTO coupon_allowed_users (coupon_id,user_id) VALUES ($1,$2)', [coupon.id, owner.id])
      await client.query('COMMIT')
      res.set('Cache-Control', 'no-store').status(201).json({ ...coupon, profile, code })
    } catch (error) {
      await client.query('ROLLBACK')
      if (error.constraint === 'controlled_challenge_coupons_profile_key') throw fail(409, 'controlled_profile_already_issued')
      throw error
    } finally { client.release() }
  }))

  router.post('/controlled/:profile/revoke', wrap(async (req, res) => {
    const actor = adminActor(req)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT set_config('openfund.actor',$1,true)", [actor])
      const { rows: [coupon] } = await client.query(`UPDATE coupons c SET status='revoked'
        FROM controlled_challenge_coupons t WHERE t.profile=$1 AND t.coupon_id=c.id
        RETURNING c.id, c.status, c.uses_consumed`, [req.params.profile])
      if (!coupon) throw fail(404, 'controlled_profile_not_found')
      await client.query('COMMIT')
      res.set('Cache-Control', 'no-store').json(coupon)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }))

  router.get('/controlled', wrap(async (_req, res) => {
    const { rows } = await pool.query(`SELECT c.id, c.status, c.expires_at, c.uses_consumed, t.profile,
        t.wallet_address, t.issued_at, t.issued_by,
        (SELECT jsonb_agg(jsonb_build_object('id', x.id, 'stage', x.stage, 'status', x.status, 'accountId', x.demo_account_id)
           ORDER BY x.stage, x.created_at)
         FROM openfund_challenges x WHERE x.rules_snapshot->'controlledTest'->>'couponId'=c.id::text) AS challenges,
        (SELECT jsonb_agg(jsonb_build_object('id', w.id, 'status', w.status, 'amountUsd', w.amount_usd)
           ORDER BY w.requested_at)
         FROM withdrawal_requests w JOIN openfund_challenges x ON x.id=w.challenge_id
         WHERE w.test_mode AND x.rules_snapshot->'controlledTest'->>'couponId'=c.id::text) AS simulated_payouts
       FROM controlled_challenge_coupons t JOIN coupons c ON c.id=t.coupon_id ORDER BY t.profile`)
    res.set('Cache-Control', 'no-store').json({ controlledTests: rows })
  }))
}
