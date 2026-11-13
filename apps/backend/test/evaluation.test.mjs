/**
 * Challenge evaluation engine test suite (v0.3.1 soft launch).
 *
 * Covers the rules of record from the published Rulebook:
 *  - lifecycle: provision (created) → start (started) → passed | failed | expired
 *  - challenge-account trading through the same engine (ownership + isolation)
 *  - plan leverage cap on challenge accounts
 *  - one-phase pass (closed-net-profit target + min trading days)
 *  - two-phase stage progression (stage 1 passed → stage 2 provisioned)
 *  - daily loss breach (basis = max(opening balance, opening equity), UTC+3)
 *  - static maximum loss breach
 *  - trailing drawdown breach with breakeven lock (Instant model)
 *  - trial time-limit expiry
 *  - rules snapshot freeze (catalog edits never change a live challenge)
 *  - persistence: a NEW Engine instance re-evaluates from DB state alone
 *  - invalid state transitions rejected
 *
 * Run: node test/evaluation.test.mjs   (backend on :8090, SIM_TEST_MODE=1)
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { ChallengeService } from '../evaluation.js'
import { Engine } from '../engine.js'
import { MarketData } from '../market-data.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const BASE = process.env.TEST_BACKEND_URL || 'http://localhost:8080'
const DOMAIN = 'localhost:5173'
const MKT = 'BTC/USD'
let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('PASS -', name) }
  else { failed++; console.log('FAIL -', name, extra) }
}

const j = async (method, path, body, cookie, headers = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  })
  const setCookie = res.headers.get('set-cookie') || ''
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data, cookie: setCookie.split(';')[0] }
}

async function login(wallet) {
  const n = (await j('POST', '/auth/nonce', { address: wallet.address })).data
  const message = createSiweMessage({ domain: DOMAIN, address: wallet.address, uri: 'http://localhost:5173/', chainId: 42161, nonce: n.nonce, version: '1' })
  const signature = await wallet.signMessage({ message })
  const r = await j('POST', '/auth/verify', { message, signature })
  return r.cookie
}

const inject = (symbol, price) => j('POST', '/internal/inject-price', { symbol, price })

const order = (cookie, account, body) =>
  j('POST', '/trading/order' + (account ? '?account=' + account : ''), body, cookie, { 'Idempotency-Key': randomUUID() })

const state = (cookie, account) => j('GET', '/trading/state?account=' + account, null, cookie)

const challenges = new ChallengeService(pool)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const statusOf = async (id) => (await pool.query('SELECT status, stage, demo_account_id FROM openfund_challenges WHERE id=$1', [id])).rows[0]
const pollStatus = async (id, want, ms = 30000) => {
  const end = Date.now() + ms
  let row
  while (Date.now() < end) {
    row = await statusOf(id)
    if (row.status === want) return row
    await sleep(500)
  }
  return row
}

/* plan factory: sane defaults, overridable per test */
let planSeq = 0
async function makePlan(cfg = {}) {
  const slug = `eval-test-${++planSeq}-${randomUUID().slice(0, 8)}`
  const configuration = {
    accountSizesUsd: [5000], priceUsd: { 5000: 44 },
    phases: 1, phase1TargetPct: 12, phase2TargetPct: null,
    dailyLossPct: 100, maxTotalLossPct: 50, drawdownMode: 'static',
    minTradingDays: 0, referenceLeverageX: 5, ...cfg,
  }
  const { rows: [plan] } = await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) RETURNING id`,
    [slug, 'Eval Test ' + slug, JSON.stringify(configuration)])
  return plan
}

async function makeChallenge(userId, planId) {
  const { rows: [c] } = await pool.query(
    `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd) VALUES ($1,$2,'created',5000) RETURNING *`,
    [userId, planId])
  return c
}

/* provision + start inside one transaction, like confirmPurchase does */
async function provisionAndStart(challenge) {
  const plan_configuration = (await pool.query(
    'SELECT configuration FROM challenge_plans WHERE id=$1', [challenge.challenge_plan_id])).rows[0].configuration
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await new ChallengeService(client).provisionTx(client, { ...challenge, plan_configuration })
    const started = await challenges.startTx(client, challenge)
    await client.query('COMMIT')
    return started
  } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
}

async function cleanupUser(userId) {
  await pool.query(`DELETE FROM position_close_requests WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)`, [userId])
  await pool.query(`DELETE FROM trading_ledger WHERE user_id=$1 AND account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1 AND account_type='challenge')`, [userId])
  await pool.query(`DELETE FROM trading_positions WHERE user_id=$1 AND account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1 AND account_type='challenge')`, [userId])
  await pool.query(`DELETE FROM trading_orders WHERE user_id=$1 AND account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1 AND account_type='challenge')`, [userId])
  await pool.query(`DELETE FROM challenge_equity_days WHERE challenge_id IN (SELECT id FROM openfund_challenges WHERE user_id=$1)`, [userId])
  await pool.query(`DELETE FROM challenge_trailing WHERE challenge_id IN (SELECT id FROM openfund_challenges WHERE user_id=$1)`, [userId])
  await pool.query(`DELETE FROM challenge_events WHERE challenge_id IN (SELECT id FROM openfund_challenges WHERE user_id=$1)`, [userId])
  await pool.query(`DELETE FROM openfund_challenges WHERE user_id=$1`, [userId])
  await pool.query(`DELETE FROM demo_accounts WHERE user_id=$1 AND account_type='challenge'`, [userId])
  await pool.query(`DELETE FROM trading_positions WHERE user_id=$1`, [userId])
  await pool.query(`DELETE FROM trading_orders WHERE user_id=$1`, [userId])
  await pool.query(`DELETE FROM trading_ledger WHERE user_id=$1`, [userId])
  await pool.query(`DELETE FROM demo_accounts WHERE user_id=$1`, [userId])
}

const w1 = privateKeyToAccount(generatePrivateKey())
const w2 = privateKeyToAccount(generatePrivateKey())

/* warm mark so valuations are fresh */
await inject(MKT, 50000)

/* ================= 1. LIFECYCLE: created → started ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  const plan = await makePlan()
  const ch = await makeChallenge(uid, plan.id)

  const before = await j('GET', '/challenges', null, cookie1)
  ok('GET /challenges lists the created challenge',
    before.data.challenges.some(c => c.id === ch.id && c.status === 'created'))
  const view = (await j('GET', '/challenges/' + ch.id, null, cookie1)).data
  ok('challenge view carries frozen rules snapshot',
    view.rules?.dailyLossPct === 100 && view.rules?.phase1TargetPct === 12 && view.rules?.rulesVersion === 2)

  /* trading on a not-yet-started challenge is impossible: no account yet */
  const early = await order(cookie1, randomUUID(), { market: MKT, side: 'long', margin: 100, leverage: 1 })
  ok('order with unknown account → 404', early.status === 404)

  const start = await j('POST', `/challenges/${ch.id}/start`, {}, cookie1)
  ok('start → started + accountId', start.status === 200 && start.data.challenge.status === 'started' && start.data.challenge.accountId)
  const started = await statusOf(ch.id)
  const acc = (await pool.query('SELECT * FROM demo_accounts WHERE id=$1', [started.demo_account_id])).rows[0]
  ok('challenge account funded with the purchased size', acc && acc.account_type === 'challenge' && Number(acc.balance) === 5000)
  const funding = (await pool.query(`SELECT * FROM trading_ledger WHERE account_id=$1 AND event='challenge_funding'`, [acc.id])).rows
  ok('exactly one challenge_funding ledger event', funding.length === 1 && Number(funding[0].balance_after) === 5000)
  const events = (await pool.query('SELECT kind FROM challenge_events WHERE challenge_id=$1 ORDER BY id', [ch.id])).rows.map(r => r.kind)
  ok('event history: account_provisioned → started', events.includes('account_provisioned') && events.includes('started'))

  /* idempotent re-start */
  const again = await j('POST', `/challenges/${ch.id}/start`, {}, cookie1)
  ok('re-start is idempotent (200, still started)', again.status === 200 && again.data.challenge.status === 'started')
  const accounts = (await pool.query(`SELECT count(*)::int n FROM demo_accounts WHERE id=$1`, [started.demo_account_id])).rows[0].n
  ok('no second account created', accounts === 1)

  /* trading works on the challenge account */
  const o = await order(cookie1, started.demo_account_id, { market: MKT, side: 'long', margin: 500, leverage: 5 })
  ok('market order fills on the challenge account', o.status === 200 && o.data.ok && o.data.position?.status === 'open', JSON.stringify(o.data).slice(0, 200))
  const st = await state(cookie1, started.demo_account_id)
  ok('challenge state: balance = 5000 − open fee, used margin reserved',
    Math.abs(Number(st.data.account.balance) - (5000 - 0.875)) < 0.01 && st.data.account.used_margin === '500.00')
  ok('challenge state carries evaluation risk view',
    st.data.account.risk?.basis === 'challenge_equity' && st.data.account.risk?.challenge_status === 'started' && st.data.account.risk?.timezone.startsWith('UTC+3'))
  ok('free demo account untouched by challenge trading',
    Math.abs(Number((await j('GET', '/trading/state', null, cookie1)).data.account.balance) - 100000) < 0.01)

  /* accounts directory */
  const dir = (await j('GET', '/accounts', null, cookie1)).data.accounts
  const cEntry = dir.find(a => a.id === ch.id)
  ok('account directory lists the challenge as tradable', cEntry && cEntry.readOnly === false && cEntry.tradingAccountId === started.demo_account_id && cEntry.source === 'openfund_challenge_simulation')

  /* ownership isolation */
  const cookie2 = await login(w2)
  const foreignOrder = await order(cookie2, started.demo_account_id, { market: MKT, side: 'long', margin: 100, leverage: 1 })
  ok('foreign user cannot trade the challenge account (404)', foreignOrder.status === 404)
  ok('foreign user cannot view the challenge (404)', (await j('GET', '/challenges/' + ch.id, null, cookie2)).status === 404)

  /* plan leverage cap (5×) applies to challenge accounts only */
  const levReject = await order(cookie1, started.demo_account_id, { market: MKT, side: 'long', margin: 100, leverage: 10 })
  ok('challenge account enforces plan leverage 5×', levReject.status === 400 && levReject.data.error === 'leverage_exceeded')
  const freeLev = await order(cookie1, undefined, { market: MKT, side: 'long', margin: 100, leverage: 10 })
  ok('free demo still allows market-metadata leverage', freeLev.status === 200 || freeLev.data.error === 'insufficient_margin')
}

/* ================= 2. ONE-PHASE PASS (closed profit target) ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  /* target 12% of 5000 = 600; daily/max limits high so only the target rule is live */
  const plan = await makePlan({ phases: 1, phase1TargetPct: 12, minTradingDays: 0 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const acc = (await statusOf(ch.id)).demo_account_id

  await inject(MKT, 50000)
  const open = await order(cookie1, acc, { market: MKT, side: 'long', margin: 2000, leverage: 5 })
  ok('position opened for the pass test', open.data.ok)
  await inject(MKT, 53100)
  const pos = (await state(cookie1, acc)).data.positions[0]
  const close = await j('POST', `/trading/positions/${pos.id}/close`, {}, cookie1, { 'Idempotency-Key': randomUUID() })
  ok('close at profit executed', close.status === 200)
  const after = await statusOf(ch.id)
  ok('one-phase target reached → challenge PASSED', after.status === 'passed', `status=${after.status}`)
  const accRow = (await pool.query('SELECT status FROM demo_accounts WHERE id=$1', [acc])).rows[0]
  ok('challenge account closed after pass', accRow.status === 'closed')
  const events = (await pool.query('SELECT kind FROM challenge_events WHERE challenge_id=$1 ORDER BY id', [ch.id])).rows.map(r => r.kind)
  ok("'passed' event recorded", events.includes('passed'))
  const later = await order(cookie1, acc, { market: MKT, side: 'long', margin: 100, leverage: 1 })
  ok('trading rejected after pass', later.status === 409 && later.data.error === 'challenge_passed')
}

/* ================= 3. MIN TRADING DAYS BLOCKS PASS ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  const plan = await makePlan({ phases: 1, phase1TargetPct: 1, minTradingDays: 5 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const acc = (await statusOf(ch.id)).demo_account_id
  await inject(MKT, 50000)
  await order(cookie1, acc, { market: MKT, side: 'long', margin: 2000, leverage: 5 })
  await inject(MKT, 53100)
  const pos = (await state(cookie1, acc)).data.positions[0]
  await j('POST', `/trading/positions/${pos.id}/close`, {}, cookie1, { 'Idempotency-Key': randomUUID() })
  const after = await statusOf(ch.id)
  ok('target reached but minTradingDays unmet → still started', after.status === 'started', `status=${after.status}`)
  const view = (await j('GET', '/challenges/' + ch.id, null, cookie1)).data
  ok('metrics show target reached + trading days below minimum',
    view.metrics?.target?.reached === true && view.metrics?.tradingDays < 5,
    JSON.stringify(view.metrics))
}

/* ================= 4. TWO-PHASE STAGE PROGRESSION ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  const plan = await makePlan({ phases: 2, phase1TargetPct: 12, phase2TargetPct: 8, minTradingDays: 0 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const acc1 = (await statusOf(ch.id)).demo_account_id
  await inject(MKT, 50000)
  await order(cookie1, acc1, { market: MKT, side: 'long', margin: 2000, leverage: 5 })
  await inject(MKT, 53100)
  const pos = (await state(cookie1, acc1)).data.positions[0]
  await j('POST', `/trading/positions/${pos.id}/close`, {}, cookie1, { 'Idempotency-Key': randomUUID() })

  const stage1 = await statusOf(ch.id)
  ok('stage 1 passed → row terminal passed', stage1.status === 'passed')
  const stage2row = (await pool.query('SELECT * FROM openfund_challenges WHERE user_id=$1 AND stage=2 AND status=\'started\' ORDER BY created_at DESC', [uid])).rows[0]
  ok('stage 2 provisioned + started automatically', !!stage2row && !!stage2row.demo_account_id)
  ok('stage 2 inherits the rules snapshot', JSON.stringify(stage2row.rules_snapshot) === JSON.stringify((await statusOf(ch.id)) && stage2row.rules_snapshot) && stage2row.rules_snapshot.phase2TargetPct === 8)
  const acc2Bal = (await pool.query('SELECT balance FROM demo_accounts WHERE id=$1', [stage2row.demo_account_id])).rows[0]
  ok('stage 2 account funded fresh (5000)', Math.abs(Number(acc2Bal.balance) - 5000) < 0.001)
  const events = (await pool.query('SELECT kind FROM challenge_events WHERE challenge_id=$1 ORDER BY id', [ch.id])).rows.map(r => r.kind)
  ok("'stage_passed' event recorded on the stage-1 row", events.includes('stage_passed'))

  /* pass stage 2 (8% = 400) → final pass */
  await inject(MKT, 50000)
  await order(cookie1, stage2row.demo_account_id, { market: MKT, side: 'long', margin: 2000, leverage: 5 })
  await inject(MKT, 53100)
  const pos2 = (await state(cookie1, stage2row.demo_account_id)).data.positions[0]
  await j('POST', `/trading/positions/${pos2.id}/close`, {}, cookie1, { 'Idempotency-Key': randomUUID() })
  const stage2after = await statusOf(stage2row.id)
  ok('stage 2 target reached → challenge PASSED (final)', stage2after.status === 'passed')
  const startRejected = await j('POST', `/challenges/${stage2row.id}/start`, {}, cookie1)
  ok('starting a passed challenge is an invalid transition (409)', startRejected.status === 409)
}

/* ================= 5. DAILY LOSS BREACH ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  /* daily 5% (threshold 4750); max 50% so ONLY the daily rule can fire */
  const plan = await makePlan({ phases: 1, phase1TargetPct: 12, dailyLossPct: 5, maxTotalLossPct: 50 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const acc = (await statusOf(ch.id)).demo_account_id
  await inject(MKT, 50000)
  const o = await order(cookie1, acc, { market: MKT, side: 'short', margin: 2000, leverage: 5 })
  ok('short position opened for the daily-breach test', o.data.ok)
  await inject(MKT, 52600)  /* −520 unrealized → equity ≈ 4476 ≤ 4750 */
  const row = await pollStatus(ch.id, 'failed')
  ok('daily loss breach → challenge FAILED', row.status === 'failed', `status=${row.status}`)
  const ev = (await pool.query(`SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='violation' ORDER BY id DESC LIMIT 1`, [ch.id])).rows[0]
  ok('violation event names the daily rule', ev && JSON.stringify(ev.detail).includes('daily_loss_breach'))
  const accRow = (await pool.query('SELECT status FROM demo_accounts WHERE id=$1', [acc])).rows[0]
  const openPositions = (await pool.query(`SELECT count(*)::int n FROM trading_positions WHERE account_id=$1 AND status='open'`, [acc])).rows[0].n
  ok('breach settlement: account closed, positions settled', accRow.status === 'closed' && openPositions === 0)
  const rejected = await order(cookie1, acc, { market: MKT, side: 'long', margin: 100, leverage: 1 })
  ok('trading rejected after breach', rejected.status === 409 && rejected.data.error === 'challenge_failed', JSON.stringify(rejected.data))
}

/* ================= 6. STATIC MAXIMUM LOSS BREACH ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  /* max 10% (threshold 4500); daily 100% so ONLY the max rule can fire */
  const plan = await makePlan({ phases: 1, dailyLossPct: 100, maxTotalLossPct: 10 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const acc = (await statusOf(ch.id)).demo_account_id
  await inject(MKT, 50000)
  await order(cookie1, acc, { market: MKT, side: 'short', margin: 2000, leverage: 5 })
  await inject(MKT, 52800)  /* −560 → equity ≈ 4436 ≤ 4500 */
  const row = await pollStatus(ch.id, 'failed')
  ok('static maximum loss breach → challenge FAILED', row.status === 'failed', `status=${row.status}`)
  const ev = (await pool.query(`SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='violation' ORDER BY id DESC LIMIT 1`, [ch.id])).rows[0]
  ok('violation event names the maximum rule', ev && JSON.stringify(ev.detail).includes('maximum_loss_breach'))
}

/* ================= 7. TRAILING DRAWDOWN + BREAKEVEN LOCK (Instant) ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  const plan = await makePlan({ phases: 0, dailyLossPct: 100, maxTotalLossPct: 5, drawdownMode: 'trailing', trailingLockAtProfitPct: 5 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const acc = (await statusOf(ch.id)).demo_account_id
  await inject(MKT, 50000)
  await order(cookie1, acc, { market: MKT, side: 'long', margin: 2000, leverage: 5 })
  await inject(MKT, 52500)  /* peak ≈ 5611 → floor ≈ 5361.5 (> starting) */
  await sleep(2500)         /* let the loop record the peak */
  const trail = (await pool.query('SELECT * FROM challenge_trailing WHERE challenge_id=$1', [ch.id])).rows[0]
  ok('trailing peak recorded', trail && Number(trail.peak_equity) > 5490, JSON.stringify(trail))
  await inject(MKT, 51000)  /* equity ≈ 5196 ≤ floor 5361.5 → trailing breach */
  const row = await pollStatus(ch.id, 'failed')
  ok('trailing drawdown breach → challenge FAILED', row.status === 'failed', `status=${row.status}`)
  const ev = (await pool.query(`SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='violation' ORDER BY id DESC LIMIT 1`, [ch.id])).rows[0]
  ok('violation event names the trailing rule', ev && JSON.stringify(ev.detail).includes('trailing_loss_breach'))
}

/* ================= 8. TIME-LIMIT EXPIRY (trial model) ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  const plan = await makePlan({ phases: 1, free: true, timeLimitDays: 14, trialDaysPerPhase: 14, dailyLossPct: 100, maxTotalLossPct: 50 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const startedRow = (await pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [ch.id])).rows[0]
  ok('time-limited challenge gets an expiry (14 days)', startedRow.expires_at && new Date(startedRow.expires_at).getTime() > Date.now())
  await pool.query('UPDATE openfund_challenges SET expires_at = now() - interval \'1 second\' WHERE id=$1', [ch.id])
  const row = await pollStatus(ch.id, 'expired')
  ok('time limit reached → challenge EXPIRED', row.status === 'expired', `status=${row.status}`)
}

/* ================= 9. RULES SNAPSHOT FREEZE ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  const plan = await makePlan({ phases: 1, phase1TargetPct: 12 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const acc = (await statusOf(ch.id)).demo_account_id
  /* catalog edit AFTER purchase must not change the live challenge */
  await pool.query(`UPDATE challenge_plans SET configuration = jsonb_set(configuration, '{phase1TargetPct}', '100') WHERE id=$1`, [plan.id])
  await inject(MKT, 50000)
  await order(cookie1, acc, { market: MKT, side: 'long', margin: 2000, leverage: 5 })
  await inject(MKT, 53100)  /* ≈ +610 realized — passes the SNAPSHOT target (600), not the edited one (5000) */
  const pos = (await state(cookie1, acc)).data.positions[0]
  await j('POST', `/trading/positions/${pos.id}/close`, {}, cookie1, { 'Idempotency-Key': randomUUID() })
  const row = await statusOf(ch.id)
  ok('evaluation uses the frozen snapshot, not the edited catalog', row.status === 'passed', `status=${row.status}`)
}

/* ================= 10. PERSISTENCE: a fresh Engine re-evaluates from DB ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await cleanupUser(uid)
  const cookie1 = await login(w1)
  const plan = await makePlan({ phases: 1, phase1TargetPct: 12 })
  const ch = await provisionAndStart(await makeChallenge(uid, plan.id))
  const acc = (await statusOf(ch.id)).demo_account_id
  /* simulate settled closed profit directly (DB-level prep), then let a
     BRAND-NEW engine instance — as after a process restart — evaluate it */
  await pool.query('UPDATE demo_accounts SET balance = 5610, realized_pnl = 610 WHERE id=$1', [acc])
  const freshEngine = new Engine(pool, new MarketData())
  const transition = await freshEngine.enforceChallengeRisk(acc)
  ok('new engine instance passes the challenge from DB state alone', transition === 'passed', `transition=${transition}`)
  ok('restart-persisted challenge is terminal', (await statusOf(ch.id)).status === 'passed')
  await cleanupUser(uid)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
