/**
 * Migration to Openfund (migration.js, ADR 0051) on real PostgreSQL with a
 * local S3-compatible stand-in: signing (AWS SigV4 test vector), file
 * validation, "opening soon" until storage is configured, the live
 * checklist, one migration per person, the review decision with KYC, the
 * single-use pass, the normal-price Migration order that provisions a
 * funded-stage challenge, and deletion of files after retention.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import express from 'express'
import pg from 'pg'
import { migrationRoutes, migrationAdminRoutes, purgeMigrationFiles, checklist } from '../migration.js'
import { createMigrationStorage, validateEvidenceFile } from '../migration-storage.js'
import { provisionOrderTx } from '../purchases.js'
import { PLAN_SEEDS } from '../plan-catalog.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'migration-test-token-0123456789abcdef'
const objects = new Map()
const s3Log = []
let server, s3, base, storage
const users = []
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(64)])
const pdf = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')

const call = async (method, path, { body, user, admin, raw, type } = {}) => {
  const headers = { 'content-type': type || 'application/json' }
  if (user) headers['x-test-user'] = user
  if (admin) { headers.authorization = `Bearer ${TOKEN}`; headers['x-admin-actor'] = 'migration reviewer' }
  const r = await fetch(base + path, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) })
  const text = await r.text()
  let data = text; try { data = JSON.parse(text) } catch {}
  return { status: r.status, data }
}
/* fresh hashes each run (the same hash cannot back two requests); a trailing 1 = verified by the stub */
const txHash = () => '0x' + crypto.randomBytes(31).toString('hex') + 'a1'
const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  for (const p of PLAN_SEEDS) await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING`, [p.slug, p.name, JSON.stringify(p.configuration)])
  await pool.query(`UPDATE migration_settings SET min_payouts=3, window_months=12, plans='["standard","one-phase"]', retention_days=90, pass_expires_days=30 WHERE id`)
  for (let i = 0; i < 3; i++) users.push((await pool.query('INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id, wallet_address', ['0x' + crypto.randomBytes(20).toString('hex')])).rows[0])
  /* S3-compatible stand-in: requires a SigV4 Authorization and SSE on PUT */
  s3 = http.createServer(async (req, res) => {
    const parts = []; for await (const p of req) parts.push(p)
    s3Log.push({ method: req.method, url: req.url, headers: req.headers })
    const key = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (req.method === 'PUT') {
      if (!/^AWS4-HMAC-SHA256 Credential=/.test(req.headers.authorization || '') || req.headers['x-amz-server-side-encryption'] !== 'AES256') { res.statusCode = 403; return res.end() }
      objects.set(key, Buffer.concat(parts)); res.statusCode = 200; return res.end()
    }
    if (req.method === 'DELETE') { objects.delete(key); res.statusCode = 204; return res.end() }
    if (req.method === 'GET' && new URL(req.url, 'http://x').searchParams.get('X-Amz-Signature')) { res.statusCode = objects.has(key) ? 200 : 404; return res.end(objects.get(key) ?? '') }
    res.statusCode = 403; res.end()
  }).listen(0)
  const env = { NODE_ENV: 'test', MIGRATION_STORAGE_ENDPOINT: `http://127.0.0.1:${s3.address().port}`, MIGRATION_STORAGE_BUCKET: 'evidence-test', MIGRATION_STORAGE_REGION: 'eu-central-1',
    MIGRATION_STORAGE_ACCESS_KEY_ID: 'TESTACCESSKEY', MIGRATION_STORAGE_SECRET_ACCESS_KEY: crypto.randomBytes(24).toString('hex'), MIGRATION_STORAGE_PATH_STYLE: '1' }
  let active = createMigrationStorage({}) /* not configured until the test switches it */
  storage = createMigrationStorage(env)
  const proxy = { get configured() { return active.configured }, put: (...a) => active.put(...a), remove: (...a) => active.remove(...a), presign: (...a) => active.presign(...a) }
  globalThis.__useStorage = () => { active = storage }
  const app = express()
  app.use(express.json())
  const requireAuth = (req, res, next) => (req.headers['x-test-user'] ? ((req.user = { user_id: req.headers['x-test-user'] }), next()) : res.status(401).json({ error: 'unauthenticated' }))
  const limit = () => (_req, _res, next) => next()
  const verifyTx = async ({ txHash }) => ({ verified: txHash.endsWith('1'), reason: txHash.endsWith('1') ? null : 'not_found' })
  app.use(migrationRoutes({ pool, requireAuth, limit, storage: proxy, verifyTx, audit: async () => {}, raw: express.raw }))
  app.use('/admin/migration', migrationAdminRoutes({ pool, storage: proxy, audit: async () => {} }))
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message, details: error.details }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { server?.close(); s3?.close(); await pool.end() })

test('the signer matches the published AWS SigV4 presigned-URL example', () => {
  const s = createMigrationStorage({ MIGRATION_STORAGE_ENDPOINT: 'https://s3.amazonaws.com', MIGRATION_STORAGE_BUCKET: 'examplebucket', MIGRATION_STORAGE_REGION: 'us-east-1',
    MIGRATION_STORAGE_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE', MIGRATION_STORAGE_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' }, { now: () => new Date('2013-05-24T00:00:00Z') })
  const { url } = s.presign('test.txt', { seconds: 86400, maxSeconds: 86400, filename: null })
  assert.ok(url.startsWith('https://examplebucket.s3.amazonaws.com/test.txt?'))
  assert.ok(url.endsWith('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'))
  /* reviewer links are short-lived and download-only */
  const reviewer = storage.presign('migration/x/file.pdf', { seconds: 3600 })
  assert.equal(reviewer.expiresInSeconds, 900)
  assert.match(reviewer.url, /response-content-disposition=attachment/)
  assert.equal(createMigrationStorage({ MIGRATION_STORAGE_ENDPOINT: 'http://s3.example.com', MIGRATION_STORAGE_BUCKET: 'b-1', MIGRATION_STORAGE_ACCESS_KEY_ID: 'AAAAAAAA', MIGRATION_STORAGE_SECRET_ACCESS_KEY: 'x'.repeat(20) }).configured, false, 'plain http only for local tests')
})

test('files are accepted by content, not by name: type, size and active PDF content', () => {
  assert.equal(validateEvidenceFile(png, 'image/png').ext, 'png')
  assert.equal(validateEvidenceFile(pdf, 'application/pdf').ext, 'pdf')
  assert.throws(() => validateEvidenceFile(png, 'application/pdf'), /file_type_mismatch/)
  assert.throws(() => validateEvidenceFile(Buffer.from('MZ' + 'x'.repeat(100)), 'application/x-msdownload'), /file_type_not_accepted/)
  assert.throws(() => validateEvidenceFile(Buffer.from('%PDF-1.7 /OpenAction << /S /JavaScript /JS (app.alert(1)) >>'), 'application/pdf'), /file_active_content/)
  assert.throws(() => validateEvidenceFile(Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024)]), 'image/png'), /file_too_large/)
  /* inherited property names never resolve to a file type (CodeQL js/unvalidated-dynamic-method-call) */
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.throws(() => validateEvidenceFile(png, name), /file_type_not_accepted/, name)
  }
  /* non-buffer bodies (an empty or parsed body) are refused, never measured */
  assert.throws(() => validateEvidenceFile(['x'.repeat(32)], 'image/png'), /file_empty/)
  assert.throws(() => validateEvidenceFile('x'.repeat(32), 'image/png'), /file_empty/)
  assert.ok(Buffer.isBuffer(validateEvidenceFile(png, 'image/png').bytes))
})

test('the form says "opening soon" and stores nothing until storage is configured', async () => {
  const config = await call('GET', '/migration/config')
  assert.equal(config.data.open, false)
  assert.deepEqual(config.data.firms.map(f => f.name).slice(0, 4), ['FTMO', 'FundingPips', 'FundedNext', 'E8 Markets'])
  const ftmo = config.data.firms.find(f => f.name === 'FTMO')
  assert.equal(ftmo.websiteUrl, 'https://ftmo.com')
  assert.ok(ftmo.programTypes.length && ftmo.evidenceTypes.length)
  assert.equal(ftmo.logoUrl, null, 'no logo until the owner uploads one')
  assert.equal((await call('POST', '/migration/requests', { user: users[0].id, body: { firmId: config.data.firms[0].id, claimedMaxSizeUsd: 100000, fullName: 'Sara Example', email: 'sara@example.test' } })).data.error, 'migration_opening_soon')
  globalThis.__useStorage()
  assert.equal((await call('GET', '/migration/config')).data.open, true)
})

let request, firms
test('the live checklist: identity, a funded account, three distinct payouts in twelve months', async () => {
  firms = (await call('GET', '/migration/config')).data.firms
  assert.equal((await call('POST', '/migration/requests', { user: users[0].id, body: { firmId: firms[0].id, claimedMaxSizeUsd: 100000, fullName: 'Sara Example', email: 'not-an-email' } })).data.error, 'invalid_email')
  const created = await call('POST', '/migration/requests', { user: users[0].id, body: { firmId: firms[0].id, claimedMaxSizeUsd: 100000, fullName: 'Sara Example', email: 'sara@example.test' } })
  assert.equal(created.status, 201)
  request = created.data.request
  assert.equal((await call('POST', '/migration/requests', { user: users[0].id, body: { firmId: firms[1].id, claimedMaxSizeUsd: 50000, fullName: 'Sara Example', email: 'sara@example.test' } })).data.error, 'request_exists', 'one open request per person')
  const up = (kind, body, type, q = '') => call('POST', `/migration/requests/${request.id}/evidence/upload?kind=${kind}${q}`, { user: users[0].id, raw: body, type })
  assert.equal((await up('identity', png, 'image/png')).status, 201)
  assert.equal((await up('identity', png, 'application/pdf')).data.error, 'file_type_mismatch')
  assert.equal((await up('statement', pdf, 'application/pdf')).data.error, 'invalid_date', 'a payout document needs its payout date')
  assert.equal((await up('funded_account', png, 'image/png')).status, 201)
  assert.equal((await up('statement', pdf, 'application/pdf', `&payoutDate=${daysAgo(40)}&amountUsd=1800`)).status, 201)
  const cert = await call('POST', `/migration/requests/${request.id}/evidence`, { user: users[0].id, body: { kind: 'payout_certificate', url: 'https://firm.example/certificate/abc', payoutDate: daysAgo(80), amountUsd: 2100 } })
  assert.equal(cert.status, 201)
  /* an on-chain payout is checked automatically; the reviewer still decides */
  const tx = await call('POST', `/migration/requests/${request.id}/evidence`, { user: users[0].id, body: { kind: 'payout_tx', chainId: 42161, txHash: txHash(), payoutDate: daysAgo(400), amountUsd: 900 } })
  assert.equal(tx.data.evidence.verification.verified, true)
  let me = await call('GET', '/migration/me', { user: users[0].id })
  assert.deepEqual([me.data.checklist.identity, me.data.checklist.fundedAccount, me.data.checklist.payouts, me.data.checklist.payoutCount], [true, true, false, 2], 'a payout older than the window does not count')
  assert.equal((await call('POST', `/migration/requests/${request.id}/submit`, { user: users[0].id })).data.error, 'checklist_incomplete')
  await call('POST', `/migration/requests/${request.id}/evidence`, { user: users[0].id, body: { kind: 'payout_tx', chainId: 42161, txHash: txHash(), payoutDate: daysAgo(10), amountUsd: 2500 } })
  me = await call('GET', '/migration/me', { user: users[0].id })
  assert.equal(me.data.checklist.complete, true)
  assert.ok(me.data.evidence.every(e => !('object_key' in e)), 'storage keys never reach the trader')
  assert.equal(objects.size, 3)
  assert.equal((await call('POST', `/migration/requests/${request.id}/submit`, { user: users[0].id })).status, 200)
  assert.equal((await call('POST', `/migration/requests/${request.id}/evidence`, { user: users[0].id, body: { kind: 'payout_certificate', url: 'https://x.example/c', payoutDate: daysAgo(5) } })).data.error, 'request_not_editable')
})

let pass
test('review: signed short-lived links, KYC and name match required, a single-use pass on approval', async () => {
  const queue = await call('GET', '/admin/migration/requests?status=submitted', { admin: true })
  assert.ok(queue.data.requests.some(r => r.id === request.id))
  const detail = await call('GET', `/admin/migration/requests/${request.id}`, { admin: true })
  const file = detail.data.evidence.find(e => e.kind === 'identity')
  assert.match(file.download.url, /X-Amz-Signature=/)
  assert.equal((await fetch(file.download.url)).status, 200)
  const decide = body => call('POST', `/admin/migration/requests/${request.id}/decide`, { admin: true, body })
  assert.equal((await decide({ decision: 'approve', reason: 'payouts verified', approvedMaxSizeUsd: 100000 })).data.error, 'kyc_required')
  assert.equal((await decide({ decision: 'approve', reason: 'x', approvedMaxSizeUsd: 100000, kycVerified: true, nameMatched: true })).data.error, 'reason_required')
  const ok = await decide({ decision: 'approve', reason: 'three payouts verified; KYC name matches the firm documents', approvedMaxSizeUsd: 50000, kycVerified: true, nameMatched: true })
  assert.equal(ok.status, 200)
  pass = ok.data.pass
  assert.equal(Number(pass.max_size_usd), 50000)
  assert.deepEqual(pass.plans, ['standard', 'one-phase'])
  assert.equal((await decide({ decision: 'reject', reason: 'second decision' })).data.error, 'request_not_in_review')
  const events = (await pool.query('SELECT action FROM migration_events WHERE request_id=$1 ORDER BY id', [request.id])).rows.map(r => r.action)
  assert.deepEqual([events[0], events.at(-2), events.at(-1)], ['created', 'submitted', 'approved'])
  await assert.rejects(pool.query('UPDATE migration_events SET action=$1 WHERE request_id=$2', ['edited', request.id]), /append_only_table/)
  /* one migration per person: an approved trader cannot apply again */
  assert.equal((await call('POST', '/migration/requests', { user: users[0].id, body: { firmId: firms[2].id, claimedMaxSizeUsd: 25000, fullName: 'Sara Example', email: 'sara@example.test' } })).data.error, 'already_migrated')
})

test('checkout: a normal-price order with the pass starts at the funded stage, once', async () => {
  const { rows: [standard] } = await pool.query(`SELECT id, configuration FROM challenge_plans WHERE slug='standard'`)
  const sizes = standard.configuration.accountSizesUsd.map(Number)
  const size = Math.max(...sizes.filter(s => s <= 50000))
  const over = sizes.find(s => s > 50000)
  const { passForOrderTx } = await import('../migration.js')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (over) await assert.rejects(passForOrderTx(client, { passId: pass.id, userId: users[0].id, planSlug: 'standard', accountSize: over }), /migration_size_above_cap/)
    await assert.rejects(passForOrderTx(client, { passId: pass.id, userId: users[1].id, planSlug: 'standard', accountSize: size }), /migration_pass_not_found/)
    await assert.rejects(passForOrderTx(client, { passId: pass.id, userId: users[0].id, planSlug: 'instant', accountSize: size }), /migration_plan_not_eligible/)
    await passForOrderTx(client, { passId: pass.id, userId: users[0].id, planSlug: 'standard', accountSize: size })
    const price = Number(standard.configuration.priceUsd[size])
    const { rows: [order] } = await client.query(
      `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, list_price_usd, discount_usd, price_usd, status, payment_required, payment_method, migration_pass_id)
       VALUES ($1,$2,$3,$4,0,$4,'pending',true,'crypto',$5) RETURNING *`, [users[0].id, standard.id, size, price, pass.id])
    assert.equal(Number(order.price_usd), price, 'the normal plan price')
    await provisionOrderTx(client, { order, source: 'test' })
    const challenge = (await client.query('SELECT stage, rules_snapshot FROM openfund_challenges WHERE purchase_order_id=$1', [order.id])).rows[0]
    assert.equal(challenge.stage, 0)
    assert.equal(challenge.rules_snapshot.funded, true)
    const p = (await client.query('SELECT status, purchase_order_id FROM migration_passes WHERE id=$1', [pass.id])).rows[0]
    assert.deepEqual([p.status, p.purchase_order_id], ['redeemed', order.id])
    await assert.rejects(passForOrderTx(client, { passId: pass.id, userId: users[0].id, planSlug: 'standard', accountSize: size }), /migration_pass_used/)
  } finally { await client.query('ROLLBACK').catch(() => {}); client.release() }
})

test('rejection, withdrawal and deletion of every file after retention', async () => {
  const created = await call('POST', '/migration/requests', { user: users[1].id, body: { firmId: firms[1].id, claimedMaxSizeUsd: 25000, fullName: 'Reza Example', email: 'reza@example.test' } })
  const id = created.data.request.id
  await call('POST', `/migration/requests/${id}/evidence/upload?kind=identity`, { user: users[1].id, raw: png, type: 'image/png' })
  assert.equal((await call('POST', `/migration/requests/${id}/withdraw`, { user: users[1].id })).status, 200)
  assert.equal((await call('POST', '/migration/requests', { user: users[1].id, body: { firmId: firms[1].id, claimedMaxSizeUsd: 25000, fullName: 'Reza Example', email: 'reza@example.test' } })).status, 201, 'a withdrawn trader may apply again')
  /* make the approved request's and the withdrawn request's retention due */
  await pool.query(`UPDATE migration_requests SET files_purge_after=now() - interval '1 minute' WHERE id = ANY($1)`, [[request.id, id]])
  const before = objects.size
  assert.ok(before >= 4)
  assert.equal(await purgeMigrationFiles(pool, storage), 2)
  assert.equal(objects.size, before - 4)
  const left = (await pool.query('SELECT count(*)::int n FROM migration_evidence WHERE request_id = ANY($1) AND object_key IS NOT NULL', [[request.id, id]])).rows[0].n
  assert.equal(left, 0)
  assert.equal(await purgeMigrationFiles(pool, storage), 0, 'idempotent')
  assert.ok(s3Log.filter(l => l.method === 'DELETE').length >= 4)
})

test('the checklist counts one payout per date and amount', () => {
  const s = { minPayouts: 3, windowMonths: 12 }
  const e = (kind, d, a) => ({ kind, payout_date: d == null ? null : daysAgo(d), amount_usd: a ?? null, deleted_at: null })
  const list = checklist([e('identity'), e('recording'), e('statement', 5, 100), e('payout_certificate', 5, 100), e('payout_tx', 6, 100), e('statement', 7, 200)], s)
  assert.deepEqual([list.payoutCount, list.complete], [3, true])
})

test('firms: the owner edits details and uploads a logo; the site serves it safely', async () => {
  const save = await call('POST', '/admin/migration/firms', { admin: true, body: { name: 'Example Prop', websiteUrl: 'https://example-prop.test/', programTypes: 'Two-step evaluation, Instant funding', evidenceTypes: ['Payout certificate'], reason: 'owner request' } })
  assert.equal(save.status, 200)
  assert.deepEqual(save.data.firm.program_types, ['Two-step evaluation', 'Instant funding'])
  assert.equal((await call('POST', '/admin/migration/firms', { admin: true, body: { name: 'Bad Site', websiteUrl: 'http://insecure.test', reason: 'x1x' } })).data.error, 'invalid_url')
  const id = save.data.firm.id
  const logo = (bytes, contentType) => call('POST', `/admin/migration/firms/${id}/logo`, { admin: true, body: { contentType, dataBase64: bytes.toString('base64'), reason: 'logo provided by the firm' } })
  assert.equal((await logo(pdf, 'image/png')).data.error, 'file_type_mismatch')
  assert.equal((await logo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml')).data.error, 'file_type_not_accepted', 'no SVG (script-capable)')
  for (const contentType of ['constructor', '__proto__', 'toString']) {
    assert.equal((await logo(png, contentType)).data.error, 'file_type_not_accepted', contentType)
  }
  assert.equal((await logo(png, 'image/png')).status, 200)
  const firm = (await call('GET', '/migration/config')).data.firms.find(f => f.id === id)
  assert.match(firm.logoUrl, new RegExp(`^/migration/firms/${id}/logo\\?v=\\d+$`))
  const r = await fetch(base + firm.logoUrl)
  assert.equal(r.headers.get('content-type'), 'image/png')
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
  assert.ok(Buffer.from(await r.arrayBuffer()).equals(png))
  assert.equal((await call('POST', `/admin/migration/firms/${id}/logo`, { admin: true, body: { remove: true, reason: 'logo withdrawn' } })).status, 200)
  assert.equal((await fetch(base + firm.logoUrl)).status, 404)
  await pool.query('DELETE FROM migration_firms WHERE id=$1', [id])
})
