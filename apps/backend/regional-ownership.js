/**
 * Explicit, audited account handoff between regions (ADR 0033).
 *
 * Ownership never moves because of an outage or a health check. A transfer
 * is two operator decisions, one in each region:
 *
 *   1. release (owner region A): the account must be flat (no open position,
 *      no pending order, no open withdrawal request). Ownership becomes
 *      state='fenced' at epoch+1. From that commit on, the database fence
 *      rejects every write to the account in A, including a stale worker's.
 *      A bundle of the account's rows and a digest are sent to B through the
 *      ordered outbox (handoff_bundle.v1).
 *   2. accept (target region B): the operator accepts that exact epoch. B
 *      imports the bundle, verifies the digest, creates its ownership row
 *      (home_region=B, same epoch, active) and emits it. When A applies that
 *      ownership event it marks its copy 'transferred'.
 *
 * Between 1 and 2 nobody can write the account. A takes no action if B
 * never accepts; the operator can then re-activate it in A (cancel).
 */

const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, ...extra })
const D = v => (v == null ? null : String(Number(v)))

/* rows that make up an account, keyed to the account or its challenge */
const BUNDLE = [
  ['demo_accounts', `SELECT * FROM demo_accounts WHERE id=$1`],
  ['openfund_challenges', `SELECT * FROM openfund_challenges WHERE demo_account_id=$1`],
  ['trading_orders', `SELECT * FROM trading_orders WHERE account_id=$1 ORDER BY created_at, id`],
  ['trading_positions', `SELECT * FROM trading_positions WHERE account_id=$1 ORDER BY opened_at, id`],
  ['trading_ledger', `SELECT * FROM trading_ledger WHERE account_id=$1 ORDER BY id`],
  ['account_equity_risk', `SELECT * FROM account_equity_risk WHERE account_id=$1`],
  ['challenge_events', `SELECT e.* FROM challenge_events e JOIN openfund_challenges c ON c.id=e.challenge_id WHERE c.demo_account_id=$1 ORDER BY e.id`],
  ['challenge_equity_days', `SELECT d.* FROM challenge_equity_days d JOIN openfund_challenges c ON c.id=d.challenge_id WHERE c.demo_account_id=$1`],
  ['challenge_trailing', `SELECT t.* FROM challenge_trailing t JOIN openfund_challenges c ON c.id=t.challenge_id WHERE c.demo_account_id=$1`],
  ['challenge_strikes', `SELECT s.* FROM challenge_strikes s JOIN openfund_challenges c ON c.id=s.challenge_id WHERE c.demo_account_id=$1`],
  ['withdrawal_requests', `SELECT w.* FROM withdrawal_requests w JOIN openfund_challenges c ON c.id=w.challenge_id WHERE c.demo_account_id=$1 ORDER BY w.requested_at`],
]
/* bigserial ids are regional; imported rows get new local ids */
const REGIONAL_IDS = new Set(['trading_ledger', 'challenge_events', 'challenge_strikes'])

export function bundleDigest(bundle) {
  const acc = bundle.demo_accounts?.[0]
  return {
    balance: D(acc?.balance), realized_pnl: D(acc?.realized_pnl), status: acc?.status ?? null,
    ledger_count: bundle.trading_ledger?.length ?? 0,
    ledger_sum: D((bundle.trading_ledger ?? []).reduce((s, l) => s + Number(l.amount), 0)),
    last_balance_after: D(bundle.trading_ledger?.at(-1)?.balance_after),
    positions: bundle.trading_positions?.length ?? 0,
  }
}

async function exportBundle(c, accountId) {
  const bundle = {}
  for (const [t, sql] of BUNDLE) {
    if (!(await c.query(`SELECT to_regclass('public.' || $1) IS NOT NULL AS ok`, [t])).rows[0].ok) continue
    bundle[t] = (await c.query(sql, [accountId])).rows
  }
  const user = (await c.query(`SELECT u.wallet_address, u.wallet_chain, u.display_name FROM openfund_users u JOIN demo_accounts a ON a.user_id=u.id WHERE a.id=$1`, [accountId])).rows[0]
  const plans = (await c.query(`SELECT p.id, p.slug FROM challenge_plans p JOIN openfund_challenges c ON c.challenge_plan_id=p.id WHERE c.demo_account_id=$1`, [accountId])).rows
  return { user, plans, ...bundle }
}

export async function releaseAccount(pool, accountId, { to, actor, reason }) {
  if (!['GLOBAL', 'IRAN'].includes(to)) throw fail(400, 'invalid_target_region')
  if (typeof reason !== 'string' || reason.trim().length < 10) throw fail(400, 'reason_required')
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const local = (await c.query(`SELECT openfund_local_region() AS r`)).rows[0].r
    if (to === local) throw fail(400, 'target_is_local_region')
    if (!(await c.query(`SELECT openfund_sync_enabled() AS e`)).rows[0].e) throw fail(409, 'sync_not_enabled')
    /* FOR UPDATE waits for every in-flight writer (they hold FOR SHARE) */
    const o = (await c.query(`SELECT * FROM account_ownership WHERE account_id=$1 FOR UPDATE`, [accountId])).rows[0]
    if (!o) throw fail(404, 'account_not_found')
    if (o.home_region !== local || o.state !== 'active') throw fail(409, 'account_not_owned_active', { reasons: [{ home_region: o.home_region, state: o.state }] })
    const busy = (await c.query(
      `SELECT (SELECT count(*) FROM trading_positions WHERE account_id=$1 AND status='open')::int AS positions,
              (SELECT count(*) FROM trading_orders WHERE account_id=$1 AND status='pending')::int AS orders,
              (SELECT count(*) FROM withdrawal_requests w JOIN openfund_challenges c ON c.id=w.challenge_id
                 WHERE c.demo_account_id=$1 AND w.status IN ('requested','approved'))::int AS withdrawals`, [accountId])).rows[0]
    if (busy.positions || busy.orders || busy.withdrawals) throw fail(409, 'account_not_flat', { reasons: [busy] })
    const epoch = Number(o.epoch) + 1
    await c.query(`UPDATE account_ownership SET state='fenced', epoch=$2, updated_at=now(), updated_by=$3 WHERE account_id=$1`, [accountId, epoch, actor])
    const bundle = await exportBundle(c, accountId)
    const digest = bundleDigest(bundle)
    await c.query(`INSERT INTO account_ownership_events (account_id, epoch, action, from_region, to_region, actor, reason, detail)
                   VALUES ($1,$2,'released',$3,$4,$5,$6,$7)`, [accountId, epoch, local, to, actor, reason, JSON.stringify(digest)])
    const userId = bundle.demo_accounts[0].user_id
    await c.query(`SELECT openfund_outbox_append($1, 'handoff_bundle.v1', $2, $3)`,
      ['user:' + userId, accountId, JSON.stringify({ account_id: accountId, to, epoch, bundle, digest })])
    await c.query('COMMIT')
    return { accountId, epoch, state: 'fenced', to, digest }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
}

/** Undo a release that the target never accepted (owner region, same epoch). */
export async function cancelRelease(pool, accountId, { actor, reason }) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const local = (await c.query(`SELECT openfund_local_region() AS r`)).rows[0].r
    const o = (await c.query(`SELECT * FROM account_ownership WHERE account_id=$1 FOR UPDATE`, [accountId])).rows[0]
    if (!o || o.home_region !== local || o.state !== 'fenced') throw fail(409, 'not_fenced_here')
    /* a new epoch, so a late acceptance of the released epoch is recognisably stale */
    const epoch = Number(o.epoch) + 1
    await c.query(`UPDATE account_ownership SET state='active', epoch=$2, updated_at=now(), updated_by=$3 WHERE account_id=$1`, [accountId, epoch, actor])
    await c.query(`INSERT INTO account_ownership_events (account_id, epoch, action, from_region, to_region, actor, reason) VALUES ($1,$2,'release_cancelled',$3,$3,$4,$5)`,
      [accountId, epoch, local, actor, reason])
    await c.query('COMMIT')
    return { accountId, epoch, state: 'active' }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
}

/* only the columns the row carries: omitted ones (regional bigserial ids) take their defaults */
async function insertRow(c, table, row) {
  const cols = Object.keys(row).map(k => {
    if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw fail(400, 'invalid_bundle_column')
    return `"${k}"`
  }).join(', ')
  await c.query(`INSERT INTO ${table} (${cols}) SELECT ${cols} FROM jsonb_populate_record(NULL::${table}, $1)`, [JSON.stringify(row)])
}

export async function acceptAccount(pool, accountId, { epoch, actor, reason }) {
  if (typeof reason !== 'string' || reason.trim().length < 10) throw fail(400, 'reason_required')
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const local = (await c.query(`SELECT openfund_local_region() AS r`)).rows[0].r
    const offer = (await c.query(`SELECT * FROM region_handoff_offers WHERE account_id=$1 AND epoch=$2 FOR UPDATE`, [accountId, epoch])).rows[0]
    if (!offer) throw fail(404, 'offer_not_found')
    if (offer.status !== 'pending') throw fail(409, `offer_${offer.status}`)
    /* the release must be the newest the source announced */
    const newest = (await c.query(`SELECT max(epoch)::int AS e FROM region_handoff_offers WHERE account_id=$1`, [accountId])).rows[0].e
    if (newest !== Number(epoch)) throw fail(409, 'stale_offer')
    const remoteOwn = (await c.query(`SELECT data FROM region_remote_rows WHERE source_region=$1 AND entity='ownership' AND entity_id=$2`, [offer.source_region, accountId])).rows[0]
    if (!remoteOwn || remoteOwn.data.state !== 'fenced' || Number(remoteOwn.data.epoch) !== Number(epoch))
      throw fail(409, 'source_not_fenced_at_epoch', { reasons: [{ seen: remoteOwn?.data ?? null }] })
    if ((await c.query(`SELECT 1 FROM account_ownership WHERE account_id=$1`, [accountId])).rowCount) throw fail(409, 'account_already_present')
    const b = offer.bundle
    const DIGEST_FIELDS = ['balance', 'realized_pnl', 'status', 'ledger_count', 'ledger_sum', 'last_balance_after', 'positions']
    const offered = bundleDigest(b)
    /* field by field: jsonb storage does not keep key order */
    if (DIGEST_FIELDS.some(k => String(offered[k]) !== String(offer.digest[k]))) throw fail(409, 'digest_mismatch')
    /* import: the fence and outbox recognise this exact account only */
    await c.query(`SELECT set_config('openfund.ownership_import', $1, true)`, [accountId])
    let user = (await c.query(`SELECT id FROM openfund_users WHERE wallet_address=$1`, [b.user.wallet_address])).rows[0]
    if (!user) user = (await c.query(`INSERT INTO openfund_users (wallet_address, wallet_chain, display_name) VALUES ($1,$2,$3) RETURNING id`,
      [b.user.wallet_address, b.user.wallet_chain, b.user.display_name])).rows[0]
    const planBySlug = new Map((await c.query(`SELECT id, slug FROM challenge_plans`)).rows.map(p => [p.slug, p.id]))
    const planMap = new Map()
    for (const p of b.plans) {
      if (!planBySlug.has(p.slug)) throw fail(409, 'plan_missing_in_region', { reasons: [{ slug: p.slug }] })
      planMap.set(p.id, planBySlug.get(p.slug))
    }
    const fix = row => ('user_id' in row ? { ...row, user_id: user.id } : row)
    await insertRow(c, 'demo_accounts', fix(b.demo_accounts[0]))
    for (const ch of b.openfund_challenges ?? []) {
      const exists = async id => id && (await c.query(`SELECT 1 FROM openfund_challenges WHERE id=$1`, [id])).rowCount > 0
      await insertRow(c, 'openfund_challenges', fix({
        ...ch, challenge_plan_id: planMap.get(ch.challenge_plan_id),
        /* purchases stay in the region that took the payment */
        purchase_order_id: null,
        parent_challenge_id: (await exists(ch.parent_challenge_id)) ? ch.parent_challenge_id : null,
        funded_from_challenge_id: (await exists(ch.funded_from_challenge_id)) ? ch.funded_from_challenge_id : null,
      }))
    }
    for (const [t] of BUNDLE.slice(2)) for (const row of b[t] ?? []) {
      const r = fix(row)
      if (REGIONAL_IDS.has(t)) delete r.id
      await insertRow(c, t, r)
    }
    /* verify what was imported against the digest before taking ownership */
    const imported = await exportBundle(c, accountId)
    const got = bundleDigest(imported), want = offer.digest
    for (const k of DIGEST_FIELDS)
      if (String(got[k]) !== String(want[k])) throw fail(409, 'import_digest_mismatch', { reasons: [{ field: k, got: got[k], want: want[k] }] })
    await c.query(`SELECT set_config('openfund.ownership_import', '', true)`)
    await c.query(`INSERT INTO account_ownership (account_id, home_region, epoch, state, updated_by) VALUES ($1,$2,$3,'active',$4)`, [accountId, local, epoch, actor])
    await c.query(`INSERT INTO account_ownership_events (account_id, epoch, action, from_region, to_region, actor, reason, detail) VALUES ($1,$2,'granted',$3,$4,$5,$6,$7)`,
      [accountId, epoch, offer.source_region, local, actor, reason, JSON.stringify(got)])
    await c.query(`UPDATE region_handoff_offers SET status='accepted', decided_at=now(), decided_by=$3 WHERE account_id=$1 AND epoch=$2`, [accountId, epoch, actor])
    /* the previous owner's read model is rebuilt from this region's rows */
    await emitAccountSnapshot(c, accountId, user.id, b.user.wallet_address)
    await c.query('COMMIT')
    return { accountId, epoch: Number(epoch), home_region: local, state: 'active', digest: got }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
}

/* snapshot events for one account (after an import), in the trigger's payload shape */
const ACCOUNT_SNAPSHOT = [
  ['account.v1', 'demo_accounts', `SELECT to_jsonb(a) FROM demo_accounts a WHERE a.id=$1`],
  ['challenge.v1', 'openfund_challenges', `SELECT to_jsonb(c) FROM openfund_challenges c WHERE c.demo_account_id=$1 ORDER BY c.created_at`],
  ['order.v1', 'trading_orders', `SELECT to_jsonb(o) FROM trading_orders o WHERE o.account_id=$1 ORDER BY o.created_at, o.id`],
  ['position.v1', 'trading_positions', `SELECT to_jsonb(p) FROM trading_positions p WHERE p.account_id=$1 ORDER BY p.opened_at, p.id`],
  ['ledger.v1', 'trading_ledger', `SELECT to_jsonb(l) FROM trading_ledger l WHERE l.account_id=$1 ORDER BY l.id`],
  ['challenge_event.v1', 'challenge_events', `SELECT to_jsonb(e) FROM challenge_events e JOIN openfund_challenges c ON c.id=e.challenge_id WHERE c.demo_account_id=$1 ORDER BY e.id`],
  ['withdrawal.v1', 'withdrawal_requests', `SELECT to_jsonb(w) FROM withdrawal_requests w JOIN openfund_challenges c ON c.id=w.challenge_id WHERE c.demo_account_id=$1 ORDER BY w.requested_at`],
]
async function emitAccountSnapshot(c, accountId, userId, wallet) {
  for (const [type, table, sql] of ACCOUNT_SNAPSHOT)
    for (const { to_jsonb: row } of (await c.query(sql, [accountId])).rows)
      await c.query(`SELECT openfund_outbox_append($1, $2, $3, $4)`,
        ['user:' + userId, type, accountId, JSON.stringify({ row, wallet, op: 'snapshot', table })])
}
