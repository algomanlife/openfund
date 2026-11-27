/**
 * Migration to Openfund (ADR 0051).
 *
 * A trader with a funded account at a recognised prop firm and at least
 * `min_payouts` successful payouts in the last `window_months` proves it,
 * a reviewer approves, and a single-use, wallet-bound migration pass is
 * issued. Checkout's Migration path creates a NORMAL-PRICE order that carries
 * the pass; provisioning (purchases.js) then starts the challenge at the
 * funded stage (stage 0) with the plan's normal funded rules, at a size no
 * larger than the largest proven funded size.
 *
 * Evidence files live only in private, encrypted storage
 * (migration-storage.js); reviewers get short-lived signed URLs; files are
 * deleted `retention_days` after the decision. Until storage is configured
 * the request form says "opening soon" and nothing is stored. Each region
 * keeps its own requests and files (regional ownership).
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import { adminAuth, adminActor } from './admin.js'
import { validateEvidenceFile, MAX_EVIDENCE_BYTES } from './migration-storage.js'

const fail = (status, error, details) => Object.assign(new Error(error), { status, ...(details ? { details } : {}) })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE_KINDS = new Set(['identity', 'funded_account', 'statement', 'recording', 'payout_certificate'])
const PAYOUT_KINDS = new Set(['payout_certificate', 'payout_tx', 'statement'])
const day = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) ? v : null)
/* a simple bounded e-mail check (no backtracking regex on input) */
export const emailOf = v => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : ''
  const at = e.indexOf('@')
  if (e.length < 6 || e.length > 254 || at < 1 || at !== e.lastIndexOf('@') || /[\s<>()[\],;:"]/.test(e)) return null
  const domain = e.slice(at + 1)
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.') ? e : null
}
/* the logo's real type is read from its first bytes (no lookup by the
   client's declared type), and the declared type must agree */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
function sniffLogoType(b) {
  if (b.subarray(0, 8).equals(PNG_MAGIC)) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const publicFirm = f => ({ id: f.id, name: f.name, websiteUrl: f.website_url, programTypes: f.program_types, evidenceTypes: f.evidence_types,
  logoUrl: f.has_logo ? `/migration/firms/${f.id}/logo?v=${new Date(f.logo_updated_at).getTime()}` : null })
const FIRM_COLUMNS = 'id, name, status, sort, created_at, website_url, program_types, evidence_types, logo IS NOT NULL AS has_logo, logo_updated_at'
const textList = (v, max = 8) => {
  if (v == null) return null
  const list = Array.isArray(v) ? v : String(v).split(',')
  const out = list.map(x => String(x).trim()).filter(Boolean)
  if (out.length > max || out.some(x => x.length > 80 || /[<>]/.test(x))) throw fail(400, 'invalid_setting')
  return out
}
const money = v => { const n = Number(v); return Number.isFinite(n) && n > 0 && n < 1e9 ? Math.round(n * 100) / 100 : null }

export async function migrationSettings(q) {
  const { rows: [s] } = await q.query('SELECT * FROM migration_settings WHERE id')
  return { minPayouts: s.min_payouts, windowMonths: s.window_months, plans: s.plans, retentionDays: s.retention_days, passExpiresDays: s.pass_expires_days }
}

/** The live checklist the trader sees while uploading. */
export function checklist(evidence, settings, now = Date.now()) {
  const live = evidence.filter(e => !e.deleted_at)
  const since = new Date(now); since.setUTCMonth(since.getUTCMonth() - settings.windowMonths)
  const payouts = live.filter(e => PAYOUT_KINDS.has(e.kind) && e.payout_date && new Date(e.payout_date) >= since && new Date(e.payout_date) <= new Date(now))
  /* one payout per date and amount, however many documents prove it */
  const distinct = new Set(payouts.map(e => `${new Date(e.payout_date).toISOString().slice(0, 10)}:${e.amount_usd ?? ''}`)).size
  const items = {
    identity: live.some(e => e.kind === 'identity'),
    fundedAccount: live.some(e => e.kind === 'funded_account' || e.kind === 'recording'),
    payouts: distinct >= settings.minPayouts,
  }
  return { ...items, payoutCount: distinct, minPayouts: settings.minPayouts, windowMonths: settings.windowMonths, complete: Object.values(items).every(Boolean) }
}

const event = (q, requestId, actor, action, detail = {}) =>
  q.query('INSERT INTO migration_events (request_id, actor, action, detail) VALUES ($1,$2,$3,$4)', [requestId, actor, action, JSON.stringify(detail)])

const publicEvidence = e => ({ id: e.id, kind: e.kind, payoutDate: e.payout_date, amountUsd: e.amount_usd, url: e.url, chainId: e.chain_id, txHash: e.tx_hash,
  file: e.object_key ? { contentType: e.content_type, sizeBytes: e.size_bytes } : null, verification: e.verification, note: e.note, createdAt: e.created_at, deleted: !!e.deleted_at })

async function ownRequest(q, id, userId, lock = false) {
  if (!uuid.test(String(id))) throw fail(404, 'request_not_found')
  const { rows: [r] } = await q.query(`SELECT * FROM migration_requests WHERE id=$1 AND user_id=$2 ${lock ? 'FOR UPDATE' : ''}`, [id, userId])
  if (!r) throw fail(404, 'request_not_found')
  return r
}

/** On-chain payout check: the transaction exists, succeeded, and its block
 *  time is known. Recipient and amount are shown to the reviewer, who
 *  decides; nothing is approved automatically. */
export function createPayoutTxVerifier({ chains = null, rpcUrls = null } = {}) {
  return async ({ chainId, txHash }) => {
    const { createPublicClient, http } = await import('viem')
    const { SUPPORTED_CHAINS } = await import('./payment-verification.js')
    const chain = (chains ?? SUPPORTED_CHAINS).get(Number(chainId))
    let urls = rpcUrls
    if (!urls) { try { urls = JSON.parse(process.env.PURCHASE_RPC_URLS || '{}') } catch { urls = {} } }
    const url = urls[chainId] ?? urls[String(chainId)]
    if (!chain || !url) return { verified: null, reason: 'chain_not_supported' }
    try {
      const client = createPublicClient({ chain, transport: http(Array.isArray(url) ? url[0] : url, { timeout: 8000, retryCount: 1 }) })
      const receipt = await client.getTransactionReceipt({ hash: txHash })
      const block = await client.getBlock({ blockNumber: receipt.blockNumber })
      return { verified: receipt.status === 'success', reason: receipt.status === 'success' ? null : 'reverted', from: receipt.from, to: receipt.to,
        blockTime: new Date(Number(block.timestamp) * 1000).toISOString(), checkedAt: new Date().toISOString() }
    } catch (e) {
      return { verified: false, reason: /not be found|not found/i.test(String(e?.message)) ? 'not_found' : 'rpc_unavailable', checkedAt: new Date().toISOString() }
    }
  }
}

/** Deletes evidence files whose retention has passed (both regions run it). */
export async function purgeMigrationFiles(pool, storage, { limit = 20 } = {}) {
  if (!storage.configured) return 0
  const { rows } = await pool.query(`SELECT id FROM migration_requests WHERE files_purged_at IS NULL AND files_purge_after IS NOT NULL AND files_purge_after <= now() ORDER BY files_purge_after LIMIT $1`, [limit])
  let purged = 0
  for (const { id } of rows) {
    const files = (await pool.query('SELECT id, object_key FROM migration_evidence WHERE request_id=$1 AND object_key IS NOT NULL', [id])).rows
    for (const f of files) {
      await storage.remove(f.object_key)
      await pool.query('UPDATE migration_evidence SET object_key=NULL, deleted_at=coalesce(deleted_at, now()) WHERE id=$1', [f.id])
    }
    await pool.query('UPDATE migration_requests SET files_purged_at=now(), updated_at=now() WHERE id=$1', [id])
    await event(pool, id, 'system:retention', 'files_purged', { files: files.length })
    purged++
  }
  return purged
}

/* ------------------------------------------------------------------ trader */

export function migrationRoutes({ pool, requireAuth, limit, storage, verifyTx = createPayoutTxVerifier(), audit, raw }) {
  const router = Router()

  router.get('/migration/config', limit(120), wrap(async (_req, res) => {
    const settings = await migrationSettings(pool)
    const firms = (await pool.query(`SELECT ${FIRM_COLUMNS} FROM migration_firms WHERE status='active' ORDER BY sort, name`)).rows.map(publicFirm)
    res.set('Cache-Control', 'public, max-age=60').json({ open: storage.configured, firms, rules: settings })
  }))

  /* a logo the owner uploaded in Backstage (none is ever downloaded or recreated) */
  router.get('/migration/firms/:id/logo', limit(240), wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'logo_not_found')
    const { rows: [f] } = await pool.query(`SELECT logo, logo_type FROM migration_firms WHERE id=$1 AND status='active' AND logo IS NOT NULL`, [req.params.id])
    if (!f) throw fail(404, 'logo_not_found')
    res.set({ 'Content-Type': f.logo_type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }).send(f.logo)
  }))

  router.get('/migration/me', requireAuth, wrap(async (req, res) => {
    const settings = await migrationSettings(pool)
    const { rows: [r] } = await pool.query(`SELECT r.*, f.name AS firm_name FROM migration_requests r JOIN migration_firms f ON f.id=r.firm_id
      WHERE r.user_id=$1 ORDER BY (r.status IN ('draft','submitted','approved')) DESC, r.created_at DESC LIMIT 1`, [req.user.user_id])
    if (!r) return res.set('Cache-Control', 'no-store').json({ request: null, open: storage.configured })
    const evidence = (await pool.query('SELECT * FROM migration_evidence WHERE request_id=$1 ORDER BY created_at', [r.id])).rows
    const { rows: [pass] } = await pool.query(`SELECT id, plans, max_size_usd, status, expires_at, purchase_order_id FROM migration_passes WHERE request_id=$1`, [r.id])
    res.set('Cache-Control', 'no-store').json({ open: storage.configured, request: {
      id: r.id, status: r.status, firm: r.firm_name, contactEmail: r.contact_email, claimedMaxSizeUsd: r.claimed_max_size_usd, approvedMaxSizeUsd: r.approved_max_size_usd,
      decisionReason: r.status === 'rejected' ? r.decision_reason : null, submittedAt: r.submitted_at, decidedAt: r.decided_at, createdAt: r.created_at },
      evidence: evidence.filter(e => !e.deleted_at).map(publicEvidence), checklist: checklist(evidence, settings),
      pass: pass ? { id: pass.id, plans: pass.plans, maxSizeUsd: pass.max_size_usd, status: pass.status, expiresAt: pass.expires_at, orderId: pass.purchase_order_id } : null })
  }))

  router.post('/migration/requests', requireAuth, limit(10), wrap(async (req, res) => {
    if (!storage.configured) throw fail(503, 'migration_opening_soon')
    const { firmId, claimedMaxSizeUsd, fullName, email } = req.body || {}
    const contact = emailOf(email)
    if (!contact) throw fail(400, 'invalid_email')
    if (!uuid.test(String(firmId || ''))) throw fail(400, 'invalid_firm')
    const size = money(claimedMaxSizeUsd)
    if (!size) throw fail(400, 'invalid_size')
    const name = typeof fullName === 'string' ? fullName.trim() : ''
    if (name.length < 2 || name.length > 120) throw fail(400, 'invalid_name')
    const { rows: [firm] } = await pool.query(`SELECT id FROM migration_firms WHERE id=$1 AND status='active'`, [firmId])
    if (!firm) throw fail(400, 'invalid_firm')
    const { rows: [done] } = await pool.query(`SELECT 1 FROM migration_requests WHERE user_id=$1 AND status='approved'`, [req.user.user_id])
    if (done) throw fail(409, 'already_migrated')
    let row
    try {
      row = (await pool.query(`INSERT INTO migration_requests (user_id, firm_id, claimed_max_size_usd, full_name, contact_email) VALUES ($1,$2,$3,$4,$5) RETURNING id, status`,
        [req.user.user_id, firm.id, size, name, contact])).rows[0]
    } catch (e) { if (e.code === '23505') throw fail(409, 'request_exists'); throw e }
    await event(pool, row.id, `user:${req.user.user_id}`, 'created', { firmId: firm.id, claimedMaxSizeUsd: size })
    await audit?.('migration_request_created', req.user.user_id, req, { requestId: row.id })
    res.status(201).json({ request: row })
  }))

  /* evidence without a file: payout certificate links and on-chain payouts */
  router.post('/migration/requests/:id/evidence', requireAuth, limit(30), wrap(async (req, res) => {
    const r = await ownRequest(pool, req.params.id, req.user.user_id)
    if (r.status !== 'draft') throw fail(409, 'request_not_editable')
    const b = req.body || {}
    const payoutDate = day(b.payoutDate), amount = b.amountUsd == null ? null : money(b.amountUsd)
    if (b.amountUsd != null && amount == null) throw fail(400, 'invalid_amount')
    let fields
    if (b.kind === 'payout_certificate') {
      let u
      try { u = new URL(String(b.url || '')) } catch { throw fail(400, 'invalid_url') }
      if (u.protocol !== 'https:' || u.username || u.password || String(b.url).length > 500) throw fail(400, 'invalid_url')
      if (!payoutDate) throw fail(400, 'invalid_date')
      fields = { url: u.toString() }
    } else if (b.kind === 'payout_tx') {
      const hash = String(b.txHash || '').toLowerCase()
      if (!/^0x[0-9a-f]{64}$/.test(hash)) throw fail(400, 'invalid_tx_hash')
      if (!Number.isInteger(Number(b.chainId)) || Number(b.chainId) < 1 || Number(b.chainId) > 2_147_483_647) throw fail(400, 'invalid_chain')
      if (!payoutDate) throw fail(400, 'invalid_date')
      const { rows: [dup] } = await pool.query('SELECT 1 FROM migration_evidence e JOIN migration_requests r ON r.id=e.request_id WHERE e.tx_hash=$1 AND r.status <> $2', [hash, 'withdrawn'])
      if (dup) throw fail(409, 'tx_already_used')
      fields = { chain_id: Number(b.chainId), tx_hash: hash, verification: JSON.stringify(await verifyTx({ chainId: Number(b.chainId), txHash: hash })) }
    } else throw fail(400, 'invalid_kind')
    const cols = { request_id: r.id, kind: b.kind, payout_date: payoutDate, amount_usd: amount, note: typeof b.note === 'string' ? b.note.slice(0, 500) : null, ...fields }
    const names = Object.keys(cols)
    const { rows: [e] } = await pool.query(`INSERT INTO migration_evidence (${names.join(',')}) VALUES (${names.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, Object.values(cols))
    await event(pool, r.id, `user:${req.user.user_id}`, 'evidence_added', { evidenceId: e.id, kind: e.kind })
    res.status(201).json({ evidence: publicEvidence(e) })
  }))

  /* evidence files: the raw body is the file (validated before storage) */
  router.post('/migration/requests/:id/evidence/upload', requireAuth, limit(20), raw({ type: () => true, limit: MAX_EVIDENCE_BYTES }), wrap(async (req, res) => {
    if (!storage.configured) throw fail(503, 'migration_opening_soon')
    const r = await ownRequest(pool, req.params.id, req.user.user_id)
    if (r.status !== 'draft') throw fail(409, 'request_not_editable')
    const kind = String(req.query.kind || '')
    if (!FILE_KINDS.has(kind)) throw fail(400, 'invalid_kind')
    const payoutDate = req.query.payoutDate ? day(String(req.query.payoutDate)) : null
    if (req.query.payoutDate && !payoutDate) throw fail(400, 'invalid_date')
    if (PAYOUT_KINDS.has(kind) && !payoutDate) throw fail(400, 'invalid_date')
    const amount = req.query.amountUsd ? money(req.query.amountUsd) : null
    const { rows: [{ n }] } = await pool.query('SELECT count(*)::int n FROM migration_evidence WHERE request_id=$1 AND object_key IS NOT NULL', [r.id])
    if (n >= 30) throw fail(409, 'too_many_files')
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    const file = validateEvidenceFile(req.body, contentType)
    const key = `migration/${r.id}/${crypto.randomUUID()}.${file.ext}`
    await storage.put(key, file.bytes, contentType)
    const { rows: [e] } = await pool.query(`INSERT INTO migration_evidence (request_id, kind, payout_date, amount_usd, object_key, content_type, size_bytes, sha256)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [r.id, kind, payoutDate, amount, key, contentType, file.size, file.sha256])
    await event(pool, r.id, `user:${req.user.user_id}`, 'evidence_uploaded', { evidenceId: e.id, kind, sizeBytes: file.size, sha256: file.sha256 })
    res.status(201).json({ evidence: publicEvidence(e) })
  }))

  router.delete('/migration/requests/:id/evidence/:evidenceId', requireAuth, wrap(async (req, res) => {
    const r = await ownRequest(pool, req.params.id, req.user.user_id)
    if (r.status !== 'draft') throw fail(409, 'request_not_editable')
    if (!uuid.test(req.params.evidenceId)) throw fail(404, 'evidence_not_found')
    const { rows: [e] } = await pool.query('SELECT * FROM migration_evidence WHERE id=$1 AND request_id=$2 AND deleted_at IS NULL', [req.params.evidenceId, r.id])
    if (!e) throw fail(404, 'evidence_not_found')
    if (e.object_key) await storage.remove(e.object_key)
    await pool.query('UPDATE migration_evidence SET deleted_at=now(), object_key=NULL WHERE id=$1', [e.id])
    await event(pool, r.id, `user:${req.user.user_id}`, 'evidence_removed', { evidenceId: e.id })
    res.json({ ok: true })
  }))

  router.post('/migration/requests/:id/submit', requireAuth, limit(10), wrap(async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const r = await ownRequest(client, req.params.id, req.user.user_id, true)
      if (r.status !== 'draft') throw fail(409, 'request_not_editable')
      const list = checklist((await client.query('SELECT * FROM migration_evidence WHERE request_id=$1', [r.id])).rows, await migrationSettings(client))
      if (!list.complete) throw fail(422, 'checklist_incomplete', list)
      await client.query(`UPDATE migration_requests SET status='submitted', submitted_at=now(), updated_at=now() WHERE id=$1`, [r.id])
      await event(client, r.id, `user:${req.user.user_id}`, 'submitted', { payoutCount: list.payoutCount })
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
    await audit?.('migration_request_submitted', req.user.user_id, req, { requestId: req.params.id })
    res.json({ ok: true })
  }))

  router.post('/migration/requests/:id/withdraw', requireAuth, wrap(async (req, res) => {
    const r = await ownRequest(pool, req.params.id, req.user.user_id)
    if (!['draft', 'submitted'].includes(r.status)) throw fail(409, 'request_not_editable')
    const settings = await migrationSettings(pool)
    await pool.query(`UPDATE migration_requests SET status='withdrawn', files_purge_after=now() + ($2::int * interval '1 day'), updated_at=now() WHERE id=$1`, [r.id, settings.retentionDays])
    await event(pool, r.id, `user:${req.user.user_id}`, 'withdrawn')
    res.json({ ok: true })
  }))

  return router
}

/* ------------------------------------------------------------------- admin */

export function migrationAdminRoutes({ pool, storage, audit }) {
  const router = Router()
  router.use(adminAuth)
  const reasonOf = v => { if (typeof v !== 'string' || v.trim().length < 3 || v.length > 1000) throw fail(400, 'reason_required'); return v.trim() }

  router.get('/requests', wrap(async (req, res) => {
    const status = ['draft', 'submitted', 'approved', 'rejected', 'withdrawn'].includes(req.query.status) ? req.query.status : 'submitted'
    const { rows } = await pool.query(`SELECT r.id, r.status, r.claimed_max_size_usd, r.approved_max_size_usd, r.submitted_at, r.decided_at, r.created_at,
        f.name AS firm, u.wallet_address, (SELECT count(*)::int FROM migration_evidence e WHERE e.request_id=r.id AND e.deleted_at IS NULL) AS evidence
      FROM migration_requests r JOIN migration_firms f ON f.id=r.firm_id JOIN openfund_users u ON u.id=r.user_id
      WHERE r.status=$1 ORDER BY coalesce(r.submitted_at, r.created_at) LIMIT 200`, [status])
    res.set('Cache-Control', 'no-store').json({ requests: rows })
  }))

  router.get('/requests/:id', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'request_not_found')
    const { rows: [r] } = await pool.query(`SELECT r.*, f.name AS firm, u.wallet_address FROM migration_requests r JOIN migration_firms f ON f.id=r.firm_id
      JOIN openfund_users u ON u.id=r.user_id WHERE r.id=$1`, [req.params.id])
    if (!r) throw fail(404, 'request_not_found')
    const evidence = (await pool.query('SELECT * FROM migration_evidence WHERE request_id=$1 ORDER BY created_at', [r.id])).rows
    const events = (await pool.query('SELECT actor, action, detail, created_at FROM migration_events WHERE request_id=$1 ORDER BY id', [r.id])).rows
    const { rows: [pass] } = await pool.query('SELECT * FROM migration_passes WHERE request_id=$1', [r.id])
    const settings = await migrationSettings(pool)
    res.set('Cache-Control', 'no-store').json({ request: r, checklist: checklist(evidence, settings), events, pass: pass ?? null,
      evidence: evidence.filter(e => !e.deleted_at).map(e => ({ ...publicEvidence(e),
        /* short-lived, download-only access for the reviewer */
        download: e.object_key && storage.configured ? storage.presign(e.object_key, { seconds: 300, filename: `${e.kind}-${e.id.slice(0, 8)}` }) : null })) })
  }))

  router.post('/requests/:id/decide', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    const decision = req.body?.decision
    if (!['approve', 'reject'].includes(decision)) throw fail(400, 'invalid_decision')
    if (!uuid.test(req.params.id)) throw fail(404, 'request_not_found')
    const client = await pool.connect()
    let pass = null
    try {
      await client.query('BEGIN')
      const { rows: [r] } = await client.query('SELECT * FROM migration_requests WHERE id=$1 FOR UPDATE', [req.params.id])
      if (!r) throw fail(404, 'request_not_found')
      if (r.status !== 'submitted') throw fail(409, 'request_not_in_review')
      const settings = await migrationSettings(client)
      if (decision === 'approve') {
        const list = checklist((await client.query('SELECT * FROM migration_evidence WHERE request_id=$1', [r.id])).rows, settings)
        if (!list.complete) throw fail(422, 'checklist_incomplete', list)
        if (req.body.kycVerified !== true || req.body.nameMatched !== true) throw fail(422, 'kyc_required')
        const size = money(req.body.approvedMaxSizeUsd)
        if (!size) throw fail(400, 'invalid_size')
        const { rows: [done] } = await client.query(`SELECT 1 FROM migration_requests WHERE user_id=$1 AND status='approved' AND id<>$2`, [r.user_id, r.id])
        if (done) throw fail(409, 'already_migrated')
        await client.query(`UPDATE migration_requests SET status='approved', approved_max_size_usd=$2, kyc_verified=true, name_matched=true, decision_reason=$3,
          decided_by=$4, decided_at=now(), files_purge_after=now() + ($5::int * interval '1 day'), updated_at=now() WHERE id=$1`, [r.id, size, reason, actor, settings.retentionDays])
        pass = (await client.query(`INSERT INTO migration_passes (request_id, user_id, plans, max_size_usd, expires_at)
          VALUES ($1,$2,$3,$4, now() + ($5::int * interval '1 day')) RETURNING *`, [r.id, r.user_id, JSON.stringify(settings.plans), size, settings.passExpiresDays])).rows[0]
      } else {
        await client.query(`UPDATE migration_requests SET status='rejected', decision_reason=$2, decided_by=$3, decided_at=now(),
          files_purge_after=now() + ($4::int * interval '1 day'), updated_at=now() WHERE id=$1`, [r.id, reason, actor, settings.retentionDays])
      }
      await event(client, r.id, actor, decision === 'approve' ? 'approved' : 'rejected', { reason, passId: pass?.id ?? null, approvedMaxSizeUsd: pass?.max_size_usd ?? null })
      await client.query('COMMIT')
      await audit?.(`migration_${decision}d`, r.user_id, req, { actor, reason, requestId: r.id, passId: pass?.id ?? null })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
    res.json({ ok: true, pass })
  }))

  router.post('/passes/:id/revoke', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    if (!uuid.test(req.params.id)) throw fail(404, 'pass_not_found')
    const { rows: [p] } = await pool.query(`UPDATE migration_passes SET status='revoked' WHERE id=$1 AND status='issued' RETURNING request_id, user_id`, [req.params.id])
    if (!p) throw fail(409, 'pass_not_revocable')
    await event(pool, p.request_id, actor, 'pass_revoked', { reason, passId: req.params.id })
    await audit?.('migration_pass_revoked', p.user_id, req, { actor, reason, passId: req.params.id })
    res.json({ ok: true })
  }))

  router.get('/firms', wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ firms: (await pool.query(`SELECT ${FIRM_COLUMNS} FROM migration_firms ORDER BY sort, name`)).rows, settings: await migrationSettings(pool) })
  }))

  router.post('/firms', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (name.length < 2 || name.length > 60 || /[<>]/.test(name)) throw fail(400, 'invalid_name')
    const status = req.body?.status === 'inactive' ? 'inactive' : 'active'
    let site = null
    if (req.body?.websiteUrl) {
      try { const u = new URL(String(req.body.websiteUrl)); if (u.protocol !== 'https:' || u.username || u.password || u.href.length > 200) throw 0; site = u.origin + (u.pathname === '/' ? '' : u.pathname) } catch { throw fail(400, 'invalid_url') }
    }
    const programs = textList(req.body?.programTypes), evidence = textList(req.body?.evidenceTypes)
    const { rows: [f] } = await pool.query(`INSERT INTO migration_firms (name, status, sort, website_url, program_types, evidence_types)
      VALUES ($1,$2,(SELECT coalesce(max(sort),0)+1 FROM migration_firms),$3,coalesce($4::jsonb,'[]'),coalesce($5::jsonb,'[]'))
      ON CONFLICT (name) DO UPDATE SET status=EXCLUDED.status, website_url=coalesce($3, migration_firms.website_url),
        program_types=coalesce($4::jsonb, migration_firms.program_types), evidence_types=coalesce($5::jsonb, migration_firms.evidence_types)
      RETURNING ${FIRM_COLUMNS}`, [name, status, site, programs && JSON.stringify(programs), evidence && JSON.stringify(evidence)])
    await audit?.('migration_firm_saved', null, req, { actor, reason, name, status, websiteUrl: f.website_url, programTypes: f.program_types, evidenceTypes: f.evidence_types })
    res.json({ ok: true, firm: f })
  }))

  /* the owner uploads a firm's logo (PNG, JPEG or WebP, up to 200 KB), or removes it */
  router.post('/firms/:id/logo', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    if (!uuid.test(req.params.id)) throw fail(404, 'firm_not_found')
    let bytes = null, type = null
    if (req.body?.remove !== true) {
      type = typeof req.body?.contentType === 'string' ? req.body.contentType : ''
      if (!LOGO_TYPES.has(type)) throw fail(415, 'file_type_not_accepted')
      if (typeof req.body?.dataBase64 !== 'string' || req.body.dataBase64.length > 280_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(req.body.dataBase64)) throw fail(400, 'invalid_file')
      bytes = Buffer.from(req.body.dataBase64, 'base64')
      if (bytes.length < 16 || bytes.length > 204_800) throw fail(413, 'file_too_large')
      if (sniffLogoType(bytes) !== type) throw fail(415, 'file_type_mismatch')
    }
    const { rows: [f] } = await pool.query(`UPDATE migration_firms SET logo=$2, logo_type=$3, logo_updated_at=CASE WHEN $2::bytea IS NULL THEN NULL ELSE now() END WHERE id=$1 RETURNING name`, [req.params.id, bytes, type])
    if (!f) throw fail(404, 'firm_not_found')
    await audit?.('migration_firm_logo', null, req, { actor, reason, firm: f.name, removed: !bytes, sizeBytes: bytes?.length ?? 0 })
    res.json({ ok: true })
  }))

  router.post('/settings', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    const b = req.body || {}
    const int = (v, lo, hi) => { if (v == null) return null; const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw fail(400, 'invalid_setting'); return n }
    let plans = null
    if (b.plans != null) {
      if (!Array.isArray(b.plans) || !b.plans.length || b.plans.some(p => !/^[a-z0-9][a-z0-9-]{1,39}$/.test(p))) throw fail(400, 'invalid_setting')
      const known = (await pool.query(`SELECT slug FROM challenge_plans WHERE slug = ANY($1) AND status='active'`, [b.plans])).rows.map(r => r.slug)
      if (known.length !== new Set(b.plans).size) throw fail(400, 'invalid_setting')
      plans = JSON.stringify([...new Set(b.plans)])
    }
    const before = await migrationSettings(pool)
    await pool.query(`UPDATE migration_settings SET min_payouts=coalesce($1,min_payouts), window_months=coalesce($2,window_months), plans=coalesce($3::jsonb,plans),
      retention_days=coalesce($4,retention_days), pass_expires_days=coalesce($5,pass_expires_days), updated_by=$6, updated_at=now() WHERE id`,
      [int(b.minPayouts, 1, 20), int(b.windowMonths, 1, 36), plans, int(b.retentionDays, 7, 365), int(b.passExpiresDays, 1, 180), actor])
    const after = await migrationSettings(pool)
    await audit?.('migration_settings_changed', null, req, { actor, reason, before, after })
    res.json({ ok: true, settings: after })
  }))
  return router
}

/* --------------------------------------------------------------- checkout */

/** Validate a migration pass for a new order (inside the order transaction). */
export async function passForOrderTx(client, { passId, userId, planSlug, accountSize }) {
  if (!uuid.test(String(passId || ''))) throw fail(400, 'invalid_migration_pass')
  const { rows: [p] } = await client.query('SELECT * FROM migration_passes WHERE id=$1 FOR UPDATE', [passId])
  if (!p || p.user_id !== userId) throw fail(404, 'migration_pass_not_found')
  if (p.status !== 'issued') throw fail(409, 'migration_pass_used')
  if (new Date(p.expires_at) <= new Date()) throw fail(409, 'migration_pass_expired')
  if (!p.plans.includes(planSlug)) throw fail(409, 'migration_plan_not_eligible')
  if (Number(accountSize) > Number(p.max_size_usd)) throw fail(409, 'migration_size_above_cap')
  return p
}
