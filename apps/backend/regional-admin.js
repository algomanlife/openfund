/**
 * Regional operations API (ADR 0033), mounted at /admin/regional behind the
 * admin service token. Every state-changing call needs a named actor
 * (X-Admin-Actor), a typed confirmation and a reason, and is recorded.
 *
 *   GET  /admin/regional                          operations dashboard (JSON)
 *   POST /admin/regional/sync/enable              initial state transfer + live capture
 *   POST /admin/regional/reconcile                start a reconciliation run (both directions)
 *   GET  /admin/regional/reconciliation/:id       run result and its discrepancies
 *   GET  /admin/regional/discrepancies            open (or ?status=all) discrepancies
 *   POST /admin/regional/discrepancies/:id/acknowledge
 *   POST /admin/regional/outbox/:eventId/retry    re-queue a dead-lettered event
 *   GET  /admin/regional/accounts/:id             local ownership, history, remote copy, offers
 *   POST /admin/regional/accounts/:id/release     handoff step 1 (owner region)
 *   POST /admin/regional/accounts/:id/cancel-release
 *   POST /admin/regional/accounts/:id/accept      handoff step 2 (target region)
 *   POST /admin/regional/accounts/:id/unquarantine
 */
import { enableSyncWithSnapshot, enqueueCheckpoints, syncMetrics } from './regional-sync.js'
import { releaseAccount, cancelRelease, acceptAccount } from './regional-ownership.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, ...extra })
const reasonOf = body => {
  const r = body?.reason
  if (typeof r !== 'string' || r.trim().length < 10 || r.length > 500) throw fail(400, 'reason_required')
  return r.trim()
}
const confirm = (body, expected) => { if (body?.confirm !== expected) throw fail(400, 'confirmation_mismatch', { reasons: [{ expected }] }) }

export function regionalAdminRoutes({ Router, pool, runtime, adminAuth, adminActor, syncWorker = null, health = async () => ({}), audit = async () => {} }) {
  const router = Router()
  router.use(adminAuth)
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
  const id = req => { if (!uuid.test(req.params.id)) throw fail(404, 'not_found'); return req.params.id }

  router.get('/', wrap(async (req, res) => {
    const state = await runtime.current()
    const sync = await syncMetrics(pool)
    const withdrawals = (await pool.query(`SELECT count(*)::int AS n FROM withdrawal_requests WHERE status IN ('requested','approved')`)).rows[0].n
    const offers = (await pool.query(`SELECT count(*)::int AS n FROM region_handoff_offers WHERE status='pending'`)).rows[0].n
    res.set('Cache-Control', 'no-store').json({
      region: state.region, mode: state.mode, epoch: state.epoch, roles: runtime.config.roles,
      ...(await health()),
      sync: { ...sync, peerUrlConfigured: !!syncWorker?.config.peerUrl, workerRunning: !!syncWorker?.running },
      withdrawalsAwaitingReview: withdrawals, pendingHandoffOffers: offers,
    })
  }))

  router.post('/sync/enable', wrap(async (req, res) => {
    const actor = adminActor(req); const reason = reasonOf(req.body); confirm(req.body, 'ENABLE-REGIONAL-SYNC')
    const r = await enableSyncWithSnapshot(pool, { actor })
    await audit('regional_sync_enabled', null, req, { actor, reason, snapshot: r.snapshot })
    res.json(r)
  }))

  router.post('/reconcile', wrap(async (req, res) => {
    const actor = adminActor(req); const reason = reasonOf(req.body)
    const state = await runtime.current()
    const run = (await pool.query(`INSERT INTO region_reconciliation_runs (started_by, mode_epoch, detail) VALUES ($1,$2,$3) RETURNING *`,
      [actor, state.epoch, JSON.stringify({ reason, mode: state.mode })])).rows[0]
    /* our authoritative figures go to the peer (it compares on its side) … */
    const local = await enqueueCheckpoints(pool, run.id)
    /* … and the peer appends its figures to its streams for us to compare */
    let peer
    if (syncWorker?.config.peerUrl) {
      try { peer = await syncWorker.request('POST', '/sync/v1/checkpoint-request', { run_id: run.id }) }
      catch (e) { peer = { error: e.message } }
    } else peer = { error: 'sync_peer_not_configured' }
    if (peer.error) await pool.query(`UPDATE region_reconciliation_runs SET status='failed', completed_at=now(), detail=detail || $2 WHERE id=$1`,
      [run.id, JSON.stringify({ peer_error: peer.error })])
    await audit('regional_reconciliation_started', null, req, { actor, run: run.id, peer })
    res.json({ run: run.id, localCheckpoints: local.checkpoints, peer })
  }))

  router.get('/reconciliation/:id', wrap(async (req, res) => {
    const run = (await pool.query(`SELECT * FROM region_reconciliation_runs WHERE id=$1`, [id(req)])).rows[0]
    if (!run) throw fail(404, 'not_found')
    const discrepancies = (await pool.query(`SELECT * FROM region_discrepancies WHERE run_id=$1 ORDER BY id`, [run.id])).rows
    res.set('Cache-Control', 'no-store').json({ run, discrepancies })
  }))

  router.get('/discrepancies', wrap(async (req, res) => {
    const all = req.query.status === 'all'
    const rows = (await pool.query(`SELECT * FROM region_discrepancies ${all ? '' : `WHERE status='open'`} ORDER BY id DESC LIMIT 500`)).rows
    res.set('Cache-Control', 'no-store').json({ discrepancies: rows })
  }))

  router.post('/discrepancies/:did/acknowledge', wrap(async (req, res) => {
    if (!/^\d+$/.test(req.params.did)) throw fail(404, 'not_found')
    const actor = adminActor(req); const reason = reasonOf(req.body); confirm(req.body, `ACKNOWLEDGE-${req.params.did}`)
    const r = await pool.query(`UPDATE region_discrepancies SET status='acknowledged', resolved_by=$2, resolved_at=now(), resolution=$3 WHERE id=$1 AND status='open' RETURNING *`,
      [req.params.did, actor, reason])
    if (!r.rowCount) throw fail(409, 'not_open')
    await audit('regional_discrepancy_acknowledged', null, req, { actor, id: req.params.did, reason })
    res.json(r.rows[0])
  }))

  router.post('/outbox/:eventId/retry', wrap(async (req, res) => {
    if (!uuid.test(req.params.eventId)) throw fail(404, 'not_found')
    const actor = adminActor(req); const reason = reasonOf(req.body)
    const r = await pool.query(`UPDATE region_outbox SET dead_at=NULL, attempts=0 WHERE event_id=$1 AND dead_at IS NOT NULL AND acked_at IS NULL RETURNING event_id`, [req.params.eventId])
    if (!r.rowCount) throw fail(409, 'not_dead_lettered')
    await audit('regional_outbox_retry', null, req, { actor, eventId: req.params.eventId, reason })
    res.json({ requeued: req.params.eventId })
  }))

  router.get('/accounts/:id', wrap(async (req, res) => {
    const a = id(req)
    const ownership = (await pool.query(`SELECT * FROM account_ownership WHERE account_id=$1`, [a])).rows[0] ?? null
    const history = (await pool.query(`SELECT * FROM account_ownership_events WHERE account_id=$1 ORDER BY id`, [a])).rows
    const remote = (await pool.query(`SELECT source_region, entity, entity_id, stream_seq, data, updated_at FROM region_remote_rows WHERE account_id=$1 OR (entity='account' AND entity_id=$2) ORDER BY entity`, [a, a])).rows
    const offers = (await pool.query(`SELECT account_id, source_region, epoch, digest, status, received_at, decided_at, decided_by FROM region_handoff_offers WHERE account_id=$1 ORDER BY epoch`, [a])).rows
    res.set('Cache-Control', 'no-store').json({ ownership, history, remote, offers })
  }))

  const short = a => a.slice(0, 8)
  router.post('/accounts/:id/release', wrap(async (req, res) => {
    const a = id(req); const actor = adminActor(req); const reason = reasonOf(req.body)
    confirm(req.body, `RELEASE-${short(a)}-TO-${req.body?.to}`)
    const r = await releaseAccount(pool, a, { to: req.body.to, actor, reason })
    await audit('regional_account_released', null, req, { actor, ...r })
    res.json(r)
  }))
  router.post('/accounts/:id/cancel-release', wrap(async (req, res) => {
    const a = id(req); const actor = adminActor(req); const reason = reasonOf(req.body)
    confirm(req.body, `CANCEL-RELEASE-${short(a)}`)
    const r = await cancelRelease(pool, a, { actor, reason })
    await audit('regional_release_cancelled', null, req, { actor, ...r })
    res.json(r)
  }))
  router.post('/accounts/:id/accept', wrap(async (req, res) => {
    const a = id(req); const actor = adminActor(req); const reason = reasonOf(req.body)
    const epoch = Number(req.body?.epoch)
    if (!Number.isInteger(epoch) || epoch < 1) throw fail(400, 'epoch_required')
    confirm(req.body, `ACCEPT-${short(a)}-EPOCH-${epoch}`)
    const r = await acceptAccount(pool, a, { epoch, actor, reason })
    await audit('regional_account_accepted', null, req, { actor, ...r })
    res.json(r)
  }))
  router.post('/accounts/:id/unquarantine', wrap(async (req, res) => {
    const a = id(req); const actor = adminActor(req); const reason = reasonOf(req.body)
    confirm(req.body, `UNQUARANTINE-${short(a)}`)
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      const o = (await c.query(`SELECT * FROM account_ownership WHERE account_id=$1 FOR UPDATE`, [a])).rows[0]
      if (!o || o.state !== 'quarantined') throw fail(409, 'not_quarantined')
      const open = (await c.query(`SELECT count(*)::int AS n FROM region_discrepancies WHERE account_id=$1 AND status='open'`, [a])).rows[0].n
      if (open) throw fail(409, 'open_discrepancies_for_account', { reasons: [{ open }] })
      /* a new epoch: anything the peer sent under the conflicting epoch is stale */
      const epoch = Number(o.epoch) + 1
      await c.query(`UPDATE account_ownership SET state='active', reconciliation='clean', epoch=$2, updated_at=now(), updated_by=$3 WHERE account_id=$1`, [a, epoch, actor])
      await c.query(`INSERT INTO account_ownership_events (account_id, epoch, action, from_region, to_region, actor, reason) VALUES ($1,$2,'released_quarantine',$3,$3,$4,$5)`,
        [a, epoch, o.home_region, actor, reason])
      await c.query('COMMIT')
      await audit('regional_account_unquarantined', null, req, { actor, account: a, epoch })
      res.json({ accountId: a, state: 'active', epoch })
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
  }))
  return router
}

/** Signed-in user's copies of their accounts held by the other region (read model). */
export function remoteAccountRoutes({ Router, pool, requireAuth }) {
  const router = Router()
  router.get('/accounts/remote', requireAuth, async (req, res, next) => {
    try {
      const wallet = (await pool.query(`SELECT wallet_address FROM openfund_users WHERE id=$1`, [req.user.user_id])).rows[0]?.wallet_address
      const rows = wallet ? (await pool.query(
        `SELECT r.source_region, r.entity, r.entity_id, r.data, r.updated_at FROM region_remote_rows r
          WHERE r.entity IN ('account','challenge','ownership') AND (r.wallet=$1 OR r.account_id IN (SELECT account_id FROM region_remote_rows WHERE wallet=$1 AND entity='account'))
          ORDER BY r.entity, r.updated_at DESC LIMIT 200`, [wallet])).rows : []
      res.set('Cache-Control', 'no-store').json({ readOnly: true, rows })
    } catch (e) { next(e) }
  })
  return router
}
