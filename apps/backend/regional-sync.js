/**
 * Regional synchronization (ADR 0033).
 *
 * Delivery: each region's sync worker PUSHES its transactional outbox
 * (region_outbox, written by database triggers in the same transaction as
 * the financial change) to the peer over HTTPS. Every request is signed
 * (HMAC-SHA256 over method, path, timestamp, nonce and body hash) with a key
 * id, so keys can be rotated; timestamps outside ±5 min and reused nonces are
 * refused (replay protection).
 *
 * Effects: at-least-once delivery, exactly-once effects. The receiver stores
 * each event in region_inbox under its globally unique event_id in the same
 * transaction as its projection, applies a stream strictly in stream_seq
 * order (gaps are held, duplicates acknowledged without effect), and never
 * writes the engine's tables: foreign data goes to region_remote_rows /
 * region_remote_entries (read models).
 *
 * Authority: an account-scoped event is accepted only from the account's
 * home region and only at the current (or newer) ownership epoch. An event
 * that claims an account this region owns is an ownership conflict: the local
 * account is quarantined (the write fence then blocks it) and a discrepancy
 * is opened for human review.
 */
import crypto from 'node:crypto'

export const PROTOCOL_VERSION = 1
/* protocol versions this build can talk to (forward/backward window) */
export const COMPATIBLE_PROTOCOLS = Object.freeze([1])

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = v => typeof v === 'string' && uuidRe.test(v)
const isNum = v => v !== null && v !== '' && Number.isFinite(Number(v))
const isStr = v => typeof v === 'string'

/* Versioned event contracts: required fields of payload.row and their types.
   Unknown extra fields are tolerated (additive schema evolution); a missing
   or mistyped required field rejects the event. */
const ROW = {
  'user.v1':             { id: isUuid, wallet_address: isStr, status: isStr },
  'account.v1':          { id: isUuid, user_id: isUuid, account_type: isStr, balance: isNum, used_margin: isNum, realized_pnl: isNum, status: isStr },
  'ownership.v1':        { account_id: isUuid, home_region: isStr, epoch: isNum, state: isStr },
  'challenge.v1':        { id: isUuid, user_id: isUuid, status: isStr },
  'challenge_event.v1':  { id: isNum, challenge_id: isUuid, kind: isStr },
  'challenge_review.v1': { challenge_id: isUuid, decision: isStr, actor: isStr },
  'order.v1':            { id: isUuid, account_id: isUuid, market: isStr, side: isStr, status: isStr },
  'position.v1':         { id: isUuid, account_id: isUuid, market: isStr, side: isStr, status: isStr },
  'ledger.v1':           { id: isNum, account_id: isUuid, event: isStr, amount: isNum, balance_after: isNum },
  'withdrawal.v1':       { id: isUuid, user_id: isUuid, amount_usd: isNum, status: isStr },
}
const CONTROL = {
  'checkpoint.v1': p => isUuid(p.run_id ?? '00000000-0000-0000-0000-000000000000') && Array.isArray(p.accounts) &&
    p.accounts.every(a => isUuid(a.account_id) && isNum(a.balance) && isNum(a.ledger_count)),
  'checkpoint_done.v1': p => isUuid(p.run_id) && Number.isInteger(p.count) && p.count >= 0,
  'handoff_bundle.v1': p => isUuid(p.account_id) && isStr(p.to) && Number.isInteger(p.epoch) && p.bundle && typeof p.bundle === 'object' && p.digest && typeof p.digest === 'object',
}
export const SUPPORTED_TYPES = Object.freeze([...Object.keys(ROW), ...Object.keys(CONTROL)])

/* entity name in the read model for row-snapshot events */
const ENTITY = { 'user.v1': 'user', 'account.v1': 'account', 'ownership.v1': 'ownership', 'challenge.v1': 'challenge',
  'order.v1': 'order', 'position.v1': 'position', 'withdrawal.v1': 'withdrawal' }
/* append-only entries */
const ENTRY = { 'ledger.v1': 'ledger', 'challenge_event.v1': 'challenge_event', 'challenge_review.v1': 'challenge_review' }

export function validateEvent(e) {
  if (!e || typeof e !== 'object') return 'invalid_event'
  if (!isUuid(e.event_id)) return 'invalid_event_id'
  if (!isStr(e.stream) || e.stream.length > 120 || !/^(user|control):[\w-]+$/.test(e.stream)) return 'invalid_stream'
  if (!Number.isInteger(e.stream_seq) || e.stream_seq < 1) return 'invalid_stream_seq'
  if (!SUPPORTED_TYPES.includes(e.type)) return 'unsupported_type'
  if (e.schema_version !== 1) return 'unsupported_schema_version'
  if (e.account_id != null && !isUuid(e.account_id)) return 'invalid_account_id'
  if (e.epoch != null && !(Number.isInteger(e.epoch) && e.epoch >= 1)) return 'invalid_epoch'
  const p = e.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'invalid_payload'
  if (ROW[e.type]) {
    if (!p.row || typeof p.row !== 'object') return 'invalid_payload'
    for (const [k, ok] of Object.entries(ROW[e.type])) if (!ok(p.row[k])) return `invalid_field:${k}`
    if (p.wallet != null && !/^0x[0-9a-f]{40}$/.test(p.wallet)) return 'invalid_wallet'
  } else if (!CONTROL[e.type](p)) return 'invalid_payload'
  if (e.account_id && !isStr(p.home_region)) return 'missing_home_region'
  return null
}

/* ---------------------------------------------------------------------
 * Configuration and request signing
 * ------------------------------------------------------------------- */

export function syncConfig(env = process.env, region) {
  const peerUrl = (env.REGION_SYNC_PEER_URL || '').trim().replace(/\/+$/, '') || null
  const peerRegion = region === 'IRAN' ? 'GLOBAL' : 'IRAN'
  let keys = {}
  if (env.REGION_SYNC_KEYS) {
    try { keys = JSON.parse(env.REGION_SYNC_KEYS) } catch { throw new Error('REGION_SYNC_KEYS must be JSON {"<kid>":"<secret>"}') }
    for (const [kid, secret] of Object.entries(keys))
      if (!/^[\w.-]{1,40}$/.test(kid) || typeof secret !== 'string' || secret.length < 32) throw new Error('REGION_SYNC_KEYS: each key id must be [A-Za-z0-9_.-]{1,40} and each secret at least 32 characters')
  }
  const activeKid = env.REGION_SYNC_ACTIVE_KID || Object.keys(keys)[0] || null
  if (peerUrl) {
    if (!activeKid || !keys[activeKid]) throw new Error('REGION_SYNC_PEER_URL is set but REGION_SYNC_KEYS / REGION_SYNC_ACTIVE_KID do not name a key')
    const u = new URL(peerUrl)
    if (env.NODE_ENV === 'production' && u.protocol !== 'https:') throw new Error('REGION_SYNC_PEER_URL must use https in production')
  }
  return Object.freeze({
    region, peerRegion, peerUrl, keys, activeKid,
    batchSize: Math.min(Math.max(Number(env.REGION_SYNC_BATCH) || 200, 1), 1000),
    intervalMs: Math.max(Number(env.REGION_SYNC_INTERVAL_MS) || 2000, 200),
    maxBackoffMs: Math.max(Number(env.REGION_SYNC_MAX_BACKOFF_MS) || 300_000, 1000),
    skewMs: 5 * 60_000,
    receiving: Object.keys(keys).length > 0,
  })
}

const sha256hex = buf => crypto.createHash('sha256').update(buf).digest('hex')
export function signature(secret, { method, path, ts, nonce, body }) {
  return crypto.createHmac('sha256', secret).update(`${method}\n${path}\n${ts}\n${nonce}\n${sha256hex(body)}`).digest('hex')
}

export function signedHeaders(config, method, path, body, { now = Date.now(), release = null } = {}) {
  const ts = String(now), nonce = crypto.randomBytes(16).toString('hex')
  return {
    'content-type': 'application/json',
    'x-openfund-region': config.region,
    'x-openfund-sync-protocol': String(PROTOCOL_VERSION),
    'x-openfund-sync-kid': config.activeKid,
    'x-openfund-sync-ts': ts,
    'x-openfund-sync-nonce': nonce,
    'x-openfund-sync-signature': signature(config.keys[config.activeKid], { method, path, ts, nonce, body }),
    ...(release ? { 'x-openfund-release': release } : {}),
  }
}

const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, ...extra })

/** Verifies a signed peer request. Throws {status, message} on refusal. */
export async function verifyPeerRequest({ pool, config, method, path, headers, body, now = Date.now() }) {
  if (!config.receiving) throw fail(404, 'not_found')
  const h = k => headers[k]
  if (h('x-openfund-region') !== config.peerRegion) throw fail(403, 'unexpected_source_region')
  const proto = Number(h('x-openfund-sync-protocol'))
  if (!COMPATIBLE_PROTOCOLS.includes(proto)) throw fail(409, 'incompatible_protocol', { reasons: [{ supported: COMPATIBLE_PROTOCOLS, received: proto }] })
  const secret = config.keys[h('x-openfund-sync-kid')]
  if (!secret) throw fail(401, 'unknown_key')
  const ts = Number(h('x-openfund-sync-ts')), nonce = String(h('x-openfund-sync-nonce') || '')
  if (!Number.isFinite(ts) || Math.abs(now - ts) > config.skewMs) throw fail(401, 'stale_request')
  if (!/^[0-9a-f]{32}$/.test(nonce)) throw fail(401, 'invalid_nonce')
  const expected = Buffer.from(signature(secret, { method, path, ts: String(ts), nonce, body }), 'hex')
  const given = Buffer.from(String(h('x-openfund-sync-signature') || ''), 'hex')
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw fail(401, 'invalid_signature')
  const ins = await pool.query(`INSERT INTO region_sync_nonces (nonce) VALUES ($1) ON CONFLICT DO NOTHING`, [nonce])
  if (!ins.rowCount) throw fail(401, 'replayed_request')
}

/* ---------------------------------------------------------------------
 * Receiver: ordered, idempotent application
 * ------------------------------------------------------------------- */

async function openDiscrepancy(c, { runId = null, source, accountId = null, kind, detail = {} }) {
  /* one open discrepancy per (account, kind, run): repeated deliveries do not multiply it */
  await c.query(
    `INSERT INTO region_discrepancies (run_id, source_region, account_id, kind, detail)
     SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (
       SELECT 1 FROM region_discrepancies WHERE status='open' AND kind=$4
         AND account_id IS NOT DISTINCT FROM $3 AND run_id IS NOT DISTINCT FROM $1 AND source_region IS NOT DISTINCT FROM $2)`,
    [runId, source, accountId, kind, JSON.stringify(detail)])
}

/* authority checks for an account-scoped event; returns null or a verdict */
async function authorize(c, source, local, e) {
  if (!e.account_id) return null
  if (e.payload.home_region !== source) {
    await openDiscrepancy(c, { source, accountId: e.account_id, kind: 'unauthorized_source', detail: { event_id: e.event_id, claimed: e.payload.home_region } })
    return { status: 'rejected', error: 'unauthorized_source' }
  }
  const mine = (await c.query(`SELECT home_region, state, epoch::int AS epoch FROM account_ownership WHERE account_id=$1 FOR UPDATE`, [e.account_id])).rows[0]
  if (mine && mine.home_region === local && mine.state === 'active') {
    /* history from before this region took ownership: no effect */
    if (e.epoch != null && e.epoch < mine.epoch) return { status: 'superseded' }
    await c.query(`UPDATE account_ownership SET state='quarantined', reconciliation='discrepancy', updated_at=now(), updated_by='system:sync' WHERE account_id=$1`, [e.account_id])
    await c.query(`INSERT INTO account_ownership_events (account_id, epoch, action, from_region, to_region, actor, reason, detail)
                   VALUES ($1,$2,'quarantined',$3,$3,'system:sync','ownership_conflict',$4)`,
      [e.account_id, mine.epoch, local, JSON.stringify({ event_id: e.event_id, peer: source, peer_epoch: e.epoch })])
    await openDiscrepancy(c, { source, accountId: e.account_id, kind: 'ownership_conflict', detail: { event_id: e.event_id, local_epoch: mine.epoch, peer_epoch: e.epoch } })
    return { status: 'rejected', error: 'ownership_conflict' }
  }
  const known = (await c.query(`SELECT (data->>'epoch')::int AS epoch FROM region_remote_rows WHERE source_region=$1 AND entity='ownership' AND entity_id=$2`, [source, e.account_id])).rows[0]
  if (known && e.epoch != null && e.epoch < known.epoch) {
    await openDiscrepancy(c, { source, accountId: e.account_id, kind: 'stale_epoch', detail: { event_id: e.event_id, event_epoch: e.epoch, known_epoch: known.epoch } })
    return { status: 'rejected', error: 'stale_epoch' }
  }
  return null
}

async function project(c, source, local, e) {
  const p = e.payload
  if (ENTITY[e.type]) {
    const row = p.row, entity = ENTITY[e.type]
    const id = entity === 'ownership' ? row.account_id : row.id
    const account = e.account_id ?? (entity === 'account' ? row.id : null)
    await c.query(
      `INSERT INTO region_remote_rows (source_region, entity, entity_id, account_id, wallet, stream_seq, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (source_region, entity, entity_id) DO UPDATE
         SET data=EXCLUDED.data, stream_seq=EXCLUDED.stream_seq, account_id=coalesce(EXCLUDED.account_id, region_remote_rows.account_id),
             wallet=coalesce(EXCLUDED.wallet, region_remote_rows.wallet), updated_at=now()
         WHERE region_remote_rows.stream_seq < EXCLUDED.stream_seq`,
      [source, entity, String(id), account, p.wallet ?? null, e.stream_seq, JSON.stringify(row)])
    if (entity === 'ownership') await applyOwnershipFromPeer(c, source, local, row)
    return
  }
  if (ENTRY[e.type]) {
    const row = p.row, entity = ENTRY[e.type]
    const id = entity === 'challenge_review' ? row.challenge_id : String(row.id)
    await c.query(
      `INSERT INTO region_remote_entries (source_region, entity, entity_id, account_id, stream_seq, data)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [source, entity, id, e.account_id, e.stream_seq, JSON.stringify(row)])
    return
  }
  if (e.type === 'checkpoint.v1') return compareCheckpoint(c, source, p)
  if (e.type === 'checkpoint_done.v1') {
    await c.query(`UPDATE region_reconciliation_runs SET expected=$2 WHERE id=$1`, [p.run_id, p.count])
    return completeRunIfDone(c, p.run_id)
  }
  if (e.type === 'handoff_bundle.v1') {
    if (p.to !== local) return
    await c.query(
      `INSERT INTO region_handoff_offers (account_id, source_region, epoch, bundle, digest) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (account_id, epoch) DO NOTHING`,
      [p.account_id, source, p.epoch, JSON.stringify(p.bundle), JSON.stringify(p.digest)])
  }
}

/* The new owner's ownership row reached the old owner: finish the handoff. */
async function applyOwnershipFromPeer(c, source, local, row) {
  if (row.home_region !== source || row.state !== 'active') return
  const mine = (await c.query(`SELECT home_region, state, epoch::int AS epoch FROM account_ownership WHERE account_id=$1 FOR UPDATE`, [row.account_id])).rows[0]
  if (!mine || mine.home_region !== local || mine.state !== 'fenced' || Number(row.epoch) !== mine.epoch) return
  await c.query(`UPDATE account_ownership SET home_region=$2, state='transferred', updated_at=now(), updated_by='system:sync' WHERE account_id=$1`, [row.account_id, source])
  await c.query(`INSERT INTO account_ownership_events (account_id, epoch, action, from_region, to_region, actor)
                 VALUES ($1,$2,'transferred',$3,$4,'system:sync')`, [row.account_id, mine.epoch, local, source])
}

async function compareCheckpoint(c, source, p) {
  let mismatched = 0
  for (const a of p.accounts) {
    const acc = (await c.query(`SELECT data FROM region_remote_rows WHERE source_region=$1 AND entity='account' AND entity_id=$2`, [source, a.account_id])).rows[0]
    const ledger = (await c.query(`SELECT count(*)::int AS n FROM region_remote_entries WHERE source_region=$1 AND entity='ledger' AND account_id=$2`, [source, a.account_id])).rows[0].n
    const problems = []
    if (!acc) problems.push({ kind: 'account_missing' })
    else if (String(Number(acc.data.balance)) !== String(Number(a.balance))) problems.push({ kind: 'balance_mismatch', projected: acc.data.balance, authoritative: a.balance })
    if (ledger !== Number(a.ledger_count)) problems.push({ kind: 'ledger_count_mismatch', projected: ledger, authoritative: a.ledger_count })
    for (const pr of problems) await openDiscrepancy(c, { runId: p.run_id ?? null, source, accountId: a.account_id, kind: pr.kind, detail: pr })
    if (problems.length) mismatched++
  }
  if (p.run_id) {
    await c.query(`UPDATE region_reconciliation_runs SET compared=compared+$2, mismatched=mismatched+$3 WHERE id=$1`, [p.run_id, 1, mismatched ? 1 : 0])
    await completeRunIfDone(c, p.run_id)
  }
}

async function completeRunIfDone(c, runId) {
  await c.query(`UPDATE region_reconciliation_runs SET status='complete', completed_at=now()
                  WHERE id=$1 AND status='waiting' AND expected IS NOT NULL AND compared >= expected`, [runId])
}

/** Apply a batch received from `source`. Returns one result per event. */
export async function applyBatch(pool, { source, local, events }) {
  if (!Array.isArray(events) || events.length > 1000) throw fail(400, 'invalid_batch')
  const results = []
  /* within a stream, lower sequence first */
  const ordered = [...events].sort((a, b) => String(a?.stream).localeCompare(String(b?.stream)) || (a?.stream_seq ?? 0) - (b?.stream_seq ?? 0))
  for (const e of ordered) results.push(await applyOne(pool, source, local, e))
  return results
}

async function applyOne(pool, source, local, e) {
  const invalid = validateEvent(e)
  if (invalid) {
    if (invalid.startsWith('unsupported')) await openDiscrepancy(pool, { source, kind: 'schema_unsupported', detail: { type: e?.type, schema_version: e?.schema_version } })
    return { event_id: e?.event_id ?? null, status: 'rejected', error: invalid, retryable: invalid.startsWith('unsupported') }
  }
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    await c.query(`SELECT set_config('openfund.sync_apply', '1', true)`)
    const seen = (await c.query(`SELECT status FROM region_inbox WHERE event_id=$1`, [e.event_id])).rows[0]
    if (seen) { await c.query('ROLLBACK'); return { event_id: e.event_id, status: seen.status === 'applied' ? 'duplicate' : seen.status } }
    /* serialize per stream: the checkpoint row is the stream's lock */
    await c.query(`INSERT INTO region_stream_checkpoints (source_region, stream, applied_seq) VALUES ($1,$2,0) ON CONFLICT DO NOTHING`, [source, e.stream])
    const applied = Number((await c.query(`SELECT applied_seq FROM region_stream_checkpoints WHERE source_region=$1 AND stream=$2 FOR UPDATE`, [source, e.stream])).rows[0].applied_seq)
    const clash = (await c.query(`SELECT event_id FROM region_inbox WHERE source_region=$1 AND stream=$2 AND stream_seq=$3`, [source, e.stream, e.stream_seq])).rows[0]
    if (e.stream_seq <= applied || clash) {
      /* a different event at an already used position: never silently accepted */
      await openDiscrepancy(c, { source, accountId: e.account_id, kind: 'sequence_conflict', detail: { event_id: e.event_id, stream: e.stream, stream_seq: e.stream_seq, existing: clash?.event_id ?? null } })
      await c.query('COMMIT')
      return { event_id: e.event_id, status: 'rejected', error: 'sequence_conflict' }
    }
    if (e.stream_seq > applied + 1) {
      await insertInbox(c, source, e, 'held')
      await c.query('COMMIT')
      return { event_id: e.event_id, status: 'held' }
    }
    const verdict = await applyInOrder(c, source, local, e)
    /* drain successors that were waiting for this one */
    let next = e.stream_seq + 1
    for (;;) {
      const held = (await c.query(`SELECT * FROM region_inbox WHERE source_region=$1 AND stream=$2 AND stream_seq=$3 AND status='held'`, [source, e.stream, next])).rows[0]
      if (!held) break
      await c.query(`DELETE FROM region_inbox WHERE event_id=$1`, [held.event_id])
      await applyInOrder(c, source, local, { ...held, stream_seq: Number(held.stream_seq), epoch: held.epoch == null ? null : Number(held.epoch) })
      next++
    }
    await c.query('COMMIT')
    return { event_id: e.event_id, ...verdict }
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {})
    return { event_id: e.event_id, status: 'rejected', error: 'apply_failed', retryable: true, detail: String(err.message).slice(0, 200) }
  } finally { c.release() }
}

async function insertInbox(c, source, e, status, error = null) {
  await c.query(
    `INSERT INTO region_inbox (event_id, source_region, stream, stream_seq, type, schema_version, account_id, epoch, payload, status, error, applied_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $10 = 'applied' THEN now() END)`,
    [e.event_id, source, e.stream, e.stream_seq, e.type, e.schema_version, e.account_id ?? null, e.epoch ?? null, JSON.stringify(e.payload), status, error])
}

/* applies event `e` whose stream_seq is exactly checkpoint+1, then advances the checkpoint */
async function applyInOrder(c, source, local, e) {
  const verdict = await authorize(c, source, local, e)
  /* a rejected event still occupies its position (recorded, never applied),
     so later events of the stream are not blocked behind it; the open
     discrepancy blocks reopening until a human reviews it */
  if (!verdict || verdict.status === 'superseded') {
    if (!verdict) await project(c, source, local, e)
    await insertInbox(c, source, e, 'applied', verdict ? 'superseded' : null)
  } else {
    await insertInbox(c, source, e, 'rejected', verdict.error)
  }
  await c.query(`UPDATE region_stream_checkpoints SET applied_seq=$3, updated_at=now() WHERE source_region=$1 AND stream=$2`, [source, e.stream, e.stream_seq])
  return verdict ?? { status: 'applied' }
}

/* ---------------------------------------------------------------------
 * Sender: outbox → peer
 * ------------------------------------------------------------------- */

export class SyncWorker {
  constructor({ pool, config, fetchImpl = (...a) => fetch(...a), release = null, log = console }) {
    this.pool = pool; this.config = config; this.fetchImpl = fetchImpl; this.release = release; this.log = log
    this.timer = null; this.running = false; this.backoff = 0; this.busy = null
  }

  start() {
    if (this.running || !this.config.peerUrl) return
    this.running = true
    const loop = async () => {
      if (!this.running) return
      let delay = this.config.intervalMs
      try { const r = await (this.busy = this.tick()); delay = r.sent >= this.config.batchSize ? 50 : this.config.intervalMs; this.backoff = 0 }
      catch (e) {
        this.backoff = Math.min(this.backoff ? this.backoff * 2 : this.config.intervalMs, this.config.maxBackoffMs); delay = this.backoff
        this.log.warn?.(`[sync] delivery to ${this.config.peerRegion} failed: ${e.message} (retry in ${Math.round(delay / 1000)}s)`)
      } finally { this.busy = null }
      if (this.running) { this.timer = setTimeout(loop, delay); this.timer.unref?.() }
    }
    this.timer = setTimeout(loop, 10); this.timer.unref?.()
  }

  async stop() { this.running = false; clearTimeout(this.timer); await this.busy?.catch(() => {}) }

  async request(method, path, payload) {
    const body = Buffer.from(JSON.stringify(payload ?? {}))
    const r = await this.fetchImpl(this.config.peerUrl + path, {
      method, body: method === 'GET' ? undefined : body,
      headers: signedHeaders(this.config, method, path, method === 'GET' ? Buffer.alloc(0) : body, { release: this.release }),
      signal: AbortSignal.timeout(20_000),
    })
    const text = await r.text()
    let json = null; try { json = JSON.parse(text) } catch {}
    if (!r.ok) throw Object.assign(new Error(json?.error || `http_${r.status}`), { status: r.status })
    return json
  }

  async recordPeer(fields) {
    await this.pool.query(
      `INSERT INTO region_peer_status (peer_region, last_attempt_at, last_success_at, last_error, peer_release, peer_protocol, compatible, detail)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7)
       ON CONFLICT (peer_region) DO UPDATE SET last_attempt_at=now(),
         last_success_at=coalesce(EXCLUDED.last_success_at, region_peer_status.last_success_at),
         last_error=EXCLUDED.last_error,
         peer_release=coalesce(EXCLUDED.peer_release, region_peer_status.peer_release),
         peer_protocol=coalesce(EXCLUDED.peer_protocol, region_peer_status.peer_protocol),
         compatible=coalesce(EXCLUDED.compatible, region_peer_status.compatible),
         detail=CASE WHEN EXCLUDED.detail = '{}'::jsonb THEN region_peer_status.detail ELSE EXCLUDED.detail END`,
      [this.config.peerRegion, fields.ok ? new Date() : null, fields.error ?? null, fields.release ?? null, fields.protocol ?? null, fields.compatible ?? null, JSON.stringify(fields.detail ?? {})])
  }

  /** Signed handshake: peer identity, protocol, release and its sync health. */
  async hello() {
    try {
      const h = await this.request('GET', '/sync/v1/hello')
      const compatible = COMPATIBLE_PROTOCOLS.includes(h.protocol) && h.region === this.config.peerRegion
      await this.recordPeer({ ok: true, release: h.release, protocol: h.protocol, compatible, detail: h })
      return { ok: true, compatible, ...h }
    } catch (e) {
      await this.recordPeer({ ok: false, error: e.message })
      return { ok: false, error: e.message }
    }
  }

  /** One delivery pass. Unacknowledged events stay in the outbox until the peer acknowledges them. */
  async tick() {
    const hello = await this.hello()
    if (!hello.ok) throw new Error(hello.error)
    if (!hello.compatible) throw new Error('peer_protocol_incompatible: synchronization suspended')
    const { rows } = await this.pool.query(
      `SELECT id, event_id, stream, stream_seq::int, type, schema_version, account_id, epoch::int, payload
         FROM region_outbox WHERE acked_at IS NULL AND dead_at IS NULL ORDER BY id LIMIT $1`, [this.config.batchSize])
    if (!rows.length) return { sent: 0 }
    const events = rows.map(({ id, ...e }) => e)
    const res = await this.request('POST', '/sync/v1/events', { events })
    const byId = new Map((res.results || []).map(r => [r.event_id, r]))
    let acked = 0, rejected = 0
    for (const row of rows) {
      const r = byId.get(row.event_id)
      if (r && ['applied', 'duplicate', 'held', 'superseded'].includes(r.status)) {
        await this.pool.query(`UPDATE region_outbox SET acked_at=now(), last_error=NULL WHERE id=$1`, [row.id]); acked++
      } else {
        rejected++
        /* a definitive refusal is dead-lettered for review; retryable ones stay */
        const dead = r && r.status === 'rejected' && !r.retryable
        await this.pool.query(`UPDATE region_outbox SET attempts=attempts+1, last_error=$2, dead_at=CASE WHEN $3 THEN now() END WHERE id=$1`,
          [row.id, r ? r.error : 'no_result', dead])
      }
    }
    await this.recordPeer({ ok: true })
    return { sent: rows.length, acked, rejected }
  }
}

/* ---------------------------------------------------------------------
 * Initial state transfer, checkpoints, metrics
 * ------------------------------------------------------------------- */

/* the payload shape the outbox trigger writes, for rows that existed before sync */
const SNAPSHOT_SOURCES = [
  ['user.v1', null, `SELECT 'user:'||u.id AS stream, NULL::uuid AS acc, to_jsonb(u) - 'avatar_url' AS row, u.wallet_address AS wallet, 'openfund_users' AS tbl
                       FROM openfund_users u WHERE EXISTS (SELECT 1 FROM demo_accounts a WHERE a.user_id=u.id AND openfund_account_writable(a.id)) ORDER BY u.created_at, u.id`],
  ['account.v1', 'a', `SELECT 'user:'||a.user_id, a.id, to_jsonb(a), u.wallet_address, 'demo_accounts' FROM demo_accounts a JOIN openfund_users u ON u.id=a.user_id
                       WHERE openfund_account_writable(a.id) ORDER BY a.created_at, a.id`],
  ['ownership.v1', 'a', `SELECT 'user:'||a.user_id, o.account_id, to_jsonb(o), u.wallet_address, 'account_ownership' FROM account_ownership o
                       JOIN demo_accounts a ON a.id=o.account_id JOIN openfund_users u ON u.id=a.user_id WHERE openfund_account_writable(a.id) ORDER BY o.account_id`],
  ['challenge.v1', 'a', `SELECT 'user:'||c.user_id, c.demo_account_id, to_jsonb(c), u.wallet_address, 'openfund_challenges' FROM openfund_challenges c JOIN openfund_users u ON u.id=c.user_id
                       WHERE c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id) ORDER BY c.created_at, c.id`],
  ['challenge_event.v1', 'a', `SELECT 'user:'||c.user_id, c.demo_account_id, to_jsonb(e), u.wallet_address, 'challenge_events' FROM challenge_events e
                       JOIN openfund_challenges c ON c.id=e.challenge_id JOIN openfund_users u ON u.id=c.user_id
                       WHERE c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id) ORDER BY e.id`],
  ['challenge_review.v1', 'a', `SELECT 'user:'||c.user_id, c.demo_account_id, to_jsonb(r), u.wallet_address, 'challenge_reviews' FROM challenge_reviews r
                       JOIN openfund_challenges c ON c.id=r.challenge_id JOIN openfund_users u ON u.id=c.user_id
                       WHERE c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id) ORDER BY r.decided_at`],
  ['order.v1', 'a', `SELECT 'user:'||o.user_id, o.account_id, to_jsonb(o), u.wallet_address, 'trading_orders' FROM trading_orders o JOIN openfund_users u ON u.id=o.user_id
                       WHERE openfund_account_writable(o.account_id) ORDER BY o.created_at, o.id`],
  ['position.v1', 'a', `SELECT 'user:'||p.user_id, p.account_id, to_jsonb(p), u.wallet_address, 'trading_positions' FROM trading_positions p JOIN openfund_users u ON u.id=p.user_id
                       WHERE openfund_account_writable(p.account_id) ORDER BY p.opened_at, p.id`],
  ['ledger.v1', 'a', `SELECT 'user:'||l.user_id, l.account_id, to_jsonb(l), u.wallet_address, 'trading_ledger' FROM trading_ledger l JOIN openfund_users u ON u.id=l.user_id
                       WHERE openfund_account_writable(l.account_id) ORDER BY l.id`],
  ['withdrawal.v1', 'a', `SELECT 'user:'||w.user_id, c.demo_account_id, to_jsonb(w), u.wallet_address, 'withdrawal_requests' FROM withdrawal_requests w
                       JOIN openfund_users u ON u.id=w.user_id LEFT JOIN openfund_challenges c ON c.id=w.challenge_id
                       WHERE c.demo_account_id IS NULL OR openfund_account_writable(c.demo_account_id) ORDER BY w.requested_at, w.id`],
]

/**
 * Initial state transfer: append every locally owned row to the outbox as
 * snapshot events (same contracts as live events), then enable live capture.
 * Both happen in ONE transaction under an exclusive lock on the stream heads,
 * so no change can fall between the snapshot and the first live event.
 */
export async function enableSyncWithSnapshot(pool, { actor }) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    await c.query('LOCK TABLE region_stream_heads IN EXCLUSIVE MODE')
    const enabled = (await c.query(`SELECT openfund_sync_enabled() AS e`)).rows[0].e
    if (enabled) throw fail(409, 'sync_already_enabled')
    /* block concurrent financial writers for the snapshot's duration */
    for (const t of ['demo_accounts', 'openfund_challenges', 'trading_orders', 'trading_positions', 'trading_ledger', 'withdrawal_requests', 'challenge_events', 'challenge_reviews', 'account_ownership', 'openfund_users'])
      await c.query(`LOCK TABLE ${t} IN SHARE MODE`)
    const counts = {}
    for (const [type, , sql] of SNAPSHOT_SOURCES) {
      const r = await c.query(
        `SELECT count(openfund_outbox_append(s.stream, $1, s.acc, jsonb_build_object('row', s.row, 'wallet', s.wallet, 'op', 'snapshot', 'table', s.tbl)))::int AS n
           FROM (${sql}) AS s(stream, acc, row, wallet, tbl)`, [type])
      counts[type] = r.rows[0].n
    }
    await c.query(`INSERT INTO region_sync_settings (singleton, enabled, changed_by) VALUES (true, true, $1)
                   ON CONFLICT (singleton) DO UPDATE SET enabled=true, changed_at=now(), changed_by=$1`, [actor])
    await c.query('COMMIT')
    return { enabled: true, snapshot: counts }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
}

/** Authoritative per-account figures, appended to each user's stream (ordered after all its earlier events). */
export async function enqueueCheckpoints(pool, runId) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const users = (await c.query(`SELECT DISTINCT a.user_id FROM demo_accounts a WHERE openfund_account_writable(a.id) ORDER BY a.user_id`)).rows
    const rows = []
    for (const { user_id } of users) {
      /* take the user's stream head FIRST, then read: a writer that commits
         after this read appends after this checkpoint, so the receiver
         compares against exactly the events that precede it */
      await c.query(`INSERT INTO region_stream_heads (stream, seq) VALUES ($1, 0) ON CONFLICT (stream) DO UPDATE SET seq = region_stream_heads.seq`, ['user:' + user_id])
      const accounts = (await c.query(
        `SELECT jsonb_agg(jsonb_build_object('account_id', a.id, 'balance', a.balance, 'realized_pnl', a.realized_pnl, 'epoch', o.epoch,
                  'ledger_count', (SELECT count(*) FROM trading_ledger l WHERE l.account_id=a.id)) ORDER BY a.id) AS accounts
           FROM demo_accounts a JOIN account_ownership o ON o.account_id=a.id
          WHERE a.user_id=$1 AND openfund_account_writable(a.id)`, [user_id])).rows[0].accounts
      await c.query(`SELECT openfund_outbox_append($1, 'checkpoint.v1', NULL, $2)`, ['user:' + user_id, JSON.stringify({ run_id: runId, accounts })])
      rows.push(user_id)
    }
    await c.query(`SELECT openfund_outbox_append($1, 'checkpoint_done.v1', NULL, $2)`, ['control:' + (await localRegion(c)).toLowerCase(), JSON.stringify({ run_id: runId, count: rows.length })])
    await c.query('COMMIT')
    return { checkpoints: rows.length }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
}

const localRegion = async c => (await c.query(`SELECT openfund_local_region() AS r`)).rows[0].r

/** Sync health for the operations view and the reopening gates. */
export async function syncMetrics(pool) {
  const one = async (sql, p = []) => (await pool.query(sql, p)).rows[0]
  const outbox = await one(`SELECT count(*) FILTER (WHERE acked_at IS NULL AND dead_at IS NULL)::int AS pending,
                                   count(*) FILTER (WHERE dead_at IS NOT NULL AND acked_at IS NULL)::int AS dead,
                                   extract(epoch FROM now() - min(created_at) FILTER (WHERE acked_at IS NULL))::int AS oldest_pending_s,
                                   max(acked_at) AS last_acked_at
                              FROM region_outbox`)
  const inbox = await one(`SELECT count(*) FILTER (WHERE status='held')::int AS held, count(*) FILTER (WHERE status='rejected')::int AS rejected,
                                  max(applied_at) AS last_applied_at FROM region_inbox`)
  const disc = await one(`SELECT count(*) FILTER (WHERE status='open')::int AS open FROM region_discrepancies`)
  const own = (await pool.query(`SELECT home_region, state, count(*)::int AS n FROM account_ownership GROUP BY 1,2 ORDER BY 1,2`)).rows
  const peer = (await pool.query(`SELECT * FROM region_peer_status`)).rows[0] ?? null
  const enabled = (await one(`SELECT openfund_sync_enabled() AS e`)).e
  const run = (await pool.query(`SELECT * FROM region_reconciliation_runs ORDER BY started_at DESC LIMIT 1`)).rows[0] ?? null
  return { enabled, outbox, inbox, discrepancies: disc, ownership: own, peer, lastReconciliation: run }
}

/* ---------------------------------------------------------------------
 * HTTP: peer endpoints (signed) — mounted at /sync/v1 with a raw body
 * ------------------------------------------------------------------- */

export function syncPeerRoutes({ Router, raw, pool, config, release = () => null, mode = async () => null, onCheckpointRequest = null }) {
  const router = Router()
  router.use(raw({ type: () => true, limit: '8mb' }))
  const verify = async req => verifyPeerRequest({ pool, config, method: req.method, path: req.baseUrl + req.path, headers: req.headers, body: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0) })
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
  router.get('/hello', wrap(async (req, res) => {
    await verify(req)
    const m = await syncMetrics(pool)
    const toPeer = (await pool.query(`SELECT count(*)::int AS n FROM region_outbox WHERE acked_at IS NULL`)).rows[0].n
    res.set('Cache-Control', 'no-store').json({
      region: config.region, protocol: PROTOCOL_VERSION, compatible: COMPATIBLE_PROTOCOLS, types: SUPPORTED_TYPES,
      release: release(), mode: await mode(), outboxPending: toPeer, outboxDead: m.outbox.dead,
      inboxHeld: m.inbox.held, inboxRejected: m.inbox.rejected, openDiscrepancies: m.discrepancies.open,
      quarantined: m.ownership.filter(o => o.state === 'quarantined').reduce((s, o) => s + o.n, 0),
    })
  }))
  router.post('/events', wrap(async (req, res) => {
    await verify(req)
    let body; try { body = JSON.parse(req.body.toString('utf8')) } catch { throw fail(400, 'invalid_json') }
    const results = await applyBatch(pool, { source: config.peerRegion, local: config.region, events: body.events })
    res.json({ results })
  }))
  router.post('/checkpoint-request', wrap(async (req, res) => {
    await verify(req)
    let body; try { body = JSON.parse(req.body.toString('utf8')) } catch { throw fail(400, 'invalid_json') }
    if (!isUuid(body.run_id)) throw fail(400, 'invalid_run_id')
    const r = await enqueueCheckpoints(pool, body.run_id)
    onCheckpointRequest?.(body.run_id)
    res.json(r)
  }))
  return router
}
