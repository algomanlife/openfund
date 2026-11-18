/**
 * Campaign counters and coupon promotability (campaigns.js), DB-backed.
 *  - events increment one anonymous daily row; nothing identifying is stored;
 *  - malformed events are refused;
 *  - only a public, active, in-window, not-exhausted coupon is promotable;
 *  - stats need the admin token and compute CTR.
 * Run: DATABASE_URL=<isolated test db> node --test test/campaigns.test.mjs
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { campaignRoutes } from '../campaigns.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
process.env.ADMIN_API_TOKEN ||= 'campaign-test-admin-token-0123456789'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const tag = randomUUID().slice(0, 6).toUpperCase()
let server, base
const call = (method, path, { body, admin } = {}) => fetch(base + path, {
  method, headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}`, 'X-Admin-Actor': 'campaign-test' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) }))

before(async () => {
  const app = express()
  app.use(express.json())
  app.use(campaignRoutes({ pool, limit: () => (req, res, next) => next() }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal' }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server?.close()
  await pool.query(`DELETE FROM campaign_daily_stats WHERE campaign_id IN ('901','902')`)
  await pool.end()
})

test('events increment one anonymous daily row per campaign, placement and event', async () => {
  for (const event of ['impression', 'impression', 'click', 'close']) assert.equal((await call('POST', '/campaigns/events', { body: { campaignId: 901, placement: 'modal', event } })).status, 204)
  await call('POST', '/campaigns/events', { body: { campaignId: '902', placement: 'announcement_bar', event: 'impression' } })
  const { rows } = await pool.query(`SELECT * FROM campaign_daily_stats WHERE campaign_id='901'`)
  assert.equal(rows.length, 1)
  assert.deepEqual([rows[0].impressions, rows[0].clicks, rows[0].closes], [2, 1, 1])
  const columns = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='campaign_daily_stats'`)).rows.map(r => r.column_name).sort()
  assert.deepEqual(columns, ['campaign_id', 'clicks', 'closes', 'day', 'impressions', 'placement', 'updated_at'], 'no identifying columns')
})

test('malformed events are refused', async () => {
  for (const body of [{ campaignId: 'x;drop', placement: 'modal', event: 'click' }, { campaignId: 1, placement: 'popup', event: 'click' },
    { campaignId: 1, placement: 'modal', event: 'purchase' }, {}]) assert.equal((await call('POST', '/campaigns/events', { body })).status, 400)
})

test('only a public, active, in-window, not-exhausted coupon is promotable', async () => {
  const make = async (suffix, extra = '') => (await pool.query(
    `INSERT INTO coupons (code, kind, value, status, max_redemptions, per_user_limit, created_by${extra ? ', ' + extra.split('=')[0] : ''})
     VALUES ($1, 'percent', 20, 'active', 10, 1, 'test'${extra ? ', ' + extra.split('=')[1] : ''}) RETURNING id`, [`CMP${suffix}-${tag}`])).rows[0].id
  await make('OK')
  const inactive = await make('OFF'); await pool.query(`UPDATE coupons SET status='inactive' WHERE id=$1`, [inactive])
  const expired = await make('OLD'); await pool.query(`UPDATE coupons SET expires_at=now() - interval '1 minute' WHERE id=$1`, [expired])
  const future = await make('NEW'); await pool.query(`UPDATE coupons SET starts_at=now() + interval '1 day' WHERE id=$1`, [future])
  const used = await make('FULL'); await pool.query(`UPDATE coupons SET max_redemptions=1, uses_consumed=1 WHERE id=$1`, [used])
  const restricted = await make('VIP')
  const user = (await pool.query(`INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id`, ['0xcmp' + randomUUID().replace(/-/g, '').slice(0, 36)])).rows[0].id
  await pool.query(`INSERT INTO coupon_allowed_users (coupon_id, user_id) VALUES ($1, $2)`, [restricted, user])
  const ok = await call('GET', `/campaigns/coupons/cmpok-${tag.toLowerCase()}`)
  assert.deepEqual(ok.data, { promotable: true, code: `CMPOK-${tag}`, kind: 'percent', value: '20.00' })
  for (const s of ['OFF', 'OLD', 'NEW', 'FULL', 'VIP', 'NONE']) assert.deepEqual((await call('GET', `/campaigns/coupons/CMP${s}-${tag}`)).data, { promotable: false }, s)
  assert.deepEqual((await call('GET', '/campaigns/coupons/bad%20code!')).data, { promotable: false })
})

test('stats need the admin token and report CTR', async () => {
  assert.equal((await call('GET', '/admin/campaigns/stats')).status, 403)
  const { status, data } = await call('GET', '/admin/campaigns/stats', { admin: true })
  assert.equal(status, 200)
  const row = data.stats.find(s => s.campaign_id === '901' && s.placement === 'modal')
  assert.deepEqual([row.impressions, row.clicks, row.closes, row.ctr], [2, 1, 1, 0.5])
})
