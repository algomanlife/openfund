/**
 * Funded-trader agreement (funded-agreement.js, ADR 0052) on real PostgreSQL
 * with a real wallet key: scope (funded stage, cutoff, no trials or
 * tournaments), the server-issued message, signature and template checks,
 * expiry, one append-only record per account, and the engine guard.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { recoverMessageAddress } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { fundedAgreementRoutes, agreementRequired, assertAgreement, agreementMessage, FUNDED_TERMS_VERSION } from '../funded-agreement.js'
import { PLAN_SEEDS } from '../plan-catalog.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const wallet = privateKeyToAccount(generatePrivateKey())
const stranger = privateKeyToAccount(generatePrivateKey())
const today = new Date().toISOString().slice(0, 10)
let server, base, user, funded, stage1, trial
let clock = () => new Date()

const call = async (method, path, { body, as } = {}) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(as ? { 'x-test-user': as } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json().catch(() => null) }
}

before(async () => {
  process.env.FUNDED_AGREEMENT_FROM = today
  for (const p of PLAN_SEEDS) await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING`, [p.slug, p.name, JSON.stringify(p.configuration)])
  const { rows: [plan] } = await pool.query(`SELECT id FROM challenge_plans WHERE slug='standard'`)
  user = (await pool.query('INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id, wallet_address', [wallet.address.toLowerCase()])).rows[0]
  const add = async (stage, rules = {}) => (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot)
    VALUES ($1,$2,'started',10000,$3,$4) RETURNING *`, [user.id, plan.id, stage, JSON.stringify({ funded: stage === 0, ...rules })])).rows[0]
  funded = await add(0); stage1 = await add(1); trial = await add(0, { free: true })
  const app = express()
  app.use(express.json())
  const requireAuth = (req, res, next) => (req.headers['x-test-user'] ? ((req.user = { user_id: req.headers['x-test-user'] }), next()) : res.status(401).json({ error: 'unauthenticated' }))
  const verify = async ({ address, message, signature }) => (await recoverMessageAddress({ message, signature })).toLowerCase() === address.toLowerCase()
  app.use(fundedAgreementRoutes({ pool, requireAuth, limit: () => (_q, _s, n) => n(), audit: async () => {}, verify, now: () => clock() }))
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { delete process.env.FUNDED_AGREEMENT_FROM; server?.close(); await pool.end() })

test('scope: funded stage only, from the cutoff date, never trials or tournaments', () => {
  assert.equal(agreementRequired(funded), true)
  assert.equal(agreementRequired(stage1), false, 'evaluation stages trade freely')
  assert.equal(agreementRequired(trial), false, 'free trials never need it')
  assert.equal(agreementRequired({ ...funded, rules_snapshot: { model: 'tournament' } }), false)
  assert.equal(agreementRequired({ ...funded, created_at: '2020-01-01T00:00:00Z' }), false, 'accounts created before the cutoff are not blocked retroactively')
  assert.equal(agreementRequired(funded, ''), false, 'unset cutoff: not required')
})

test('the engine refuses a funded order until the agreement is signed', async () => {
  await assert.rejects(assertAgreement(pool, funded), /funded_agreement_required/)
  await assertAgreement(pool, stage1)
  const list = await call('GET', '/funded/agreements', { as: user.id })
  const row = list.data.accounts.find(a => a.challengeId === funded.id)
  assert.deepEqual([row.required, row.signed], [true, false])
})

test('signing: the exact server message, this wallet, within fifteen minutes, once', async () => {
  const issued = await call('POST', `/funded/agreements/${funded.id}/message`, { as: user.id })
  assert.equal(issued.status, 200)
  const { message } = issued.data
  assert.match(message, new RegExp(`Account: ${funded.id}`))
  assert.match(message, new RegExp(`Wallet: ${wallet.address.toLowerCase()}`))
  assert.match(message, new RegExp(`Version: ${FUNDED_TERMS_VERSION}`))
  /* a stranger's signature, a tampered message, an expired message */
  assert.equal((await call('POST', `/funded/agreements/${funded.id}`, { as: user.id, body: { message, signature: await stranger.signMessage({ message }) } })).data.error, 'invalid_signature')
  const tampered = message.replace('simulated demo account', 'real account')
  assert.equal((await call('POST', `/funded/agreements/${funded.id}`, { as: user.id, body: { message: tampered, signature: await wallet.signMessage({ message: tampered }) } })).data.error, 'invalid_message')
  const old = agreementMessage({ challengeId: funded.id, wallet: wallet.address, issuedAt: new Date(Date.now() - 20 * 60_000).toISOString() })
  assert.equal((await call('POST', `/funded/agreements/${funded.id}`, { as: user.id, body: { message: old, signature: await wallet.signMessage({ message: old }) } })).data.error, 'message_expired')
  const otherAccount = agreementMessage({ challengeId: stage1.id, wallet: wallet.address, issuedAt: new Date().toISOString() })
  assert.equal((await call('POST', `/funded/agreements/${funded.id}`, { as: user.id, body: { message: otherAccount, signature: await wallet.signMessage({ message: otherAccount }) } })).data.error, 'invalid_message', 'a message for another account is refused')
  /* the real signature */
  const ok = await call('POST', `/funded/agreements/${funded.id}`, { as: user.id, body: { message, signature: await wallet.signMessage({ message }) } })
  assert.equal(ok.status, 201)
  assert.equal((await call('POST', `/funded/agreements/${funded.id}`, { as: user.id, body: { message, signature: await wallet.signMessage({ message }) } })).data.error, 'agreement_already_signed')
  await assertAgreement(pool, funded)
  const row = (await pool.query('SELECT * FROM funded_agreements WHERE challenge_id=$1', [funded.id])).rows[0]
  assert.equal(row.wallet_address, wallet.address.toLowerCase())
  await assert.rejects(pool.query('UPDATE funded_agreements SET terms_version=$1 WHERE challenge_id=$2', ['x', funded.id]), /append_only_table/)
  const event = (await pool.query(`SELECT 1 FROM challenge_events WHERE challenge_id=$1 AND kind='funded_agreement_signed'`, [funded.id])).rowCount
  assert.equal(event, 1)
})

test('only the account owner can sign, and only where it is required', async () => {
  const other = (await pool.query('INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id', ['0x' + crypto.randomBytes(20).toString('hex')])).rows[0]
  assert.equal((await call('POST', `/funded/agreements/${funded.id}/message`, { as: other.id })).status, 404)
  assert.equal((await call('POST', `/funded/agreements/${stage1.id}/message`, { as: user.id })).data.error, 'agreement_not_required')
  assert.equal((await call('POST', `/funded/agreements/${trial.id}/message`, { as: user.id })).data.error, 'agreement_not_required')
})
