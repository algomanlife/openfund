/**
 * Post-run data-integrity audit against the test database.
 * Complements the in-flight k6 checks (lost confirmed workspace writes,
 * multi-tab double commits, retry duplicates, cross-wallet reads).
 * Writes $RUN/integrity.json; exits 1 (and touches INTEGRITY_FAIL) on any violation.
 */
import fs from 'node:fs'
import pg from 'pg'

const RUN = process.argv[2] || '.'
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const checks = {
  /* chart workspaces */
  workspace_owner_mismatch: `SELECT count(*)::int n FROM chart_workspaces w WHERE w.data ? 'owner' AND w.data->>'owner' <> w.user_id::text`,
  workspace_malformed: `SELECT count(*)::int n FROM chart_workspaces WHERE jsonb_typeof(data) <> 'object' OR revision < 1 OR schema_version < 1
                          OR (scope <> '*' AND NOT (data ? 'drawings' AND jsonb_typeof(data->'drawings') = 'array'))
                          OR (scope = '*' AND data ? 'config' AND jsonb_typeof(data->'config') <> 'object')`,
  workspace_symbol_mismatch: `SELECT count(*)::int n FROM chart_workspaces WHERE scope <> '*' AND data ? 'symbol' AND data->>'symbol' <> scope`,
  workspace_over_entry_limit: `SELECT count(*)::int n FROM (SELECT user_id, workspace FROM chart_workspaces GROUP BY 1,2 HAVING count(*) > 120) x`,
  /* orders */
  duplicate_idempotency_keys: `SELECT count(*)::int n FROM (SELECT user_id, idempotency_key FROM trading_orders WHERE idempotency_key IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) x`,
  filled_orders_without_position: `SELECT count(*)::int n FROM trading_orders o WHERE o.status='filled' AND o.position_id IS NULL`,
  positions_sharing_order: `SELECT count(*)::int n FROM (SELECT order_id FROM trading_positions WHERE parent_position_id IS NULL AND order_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1) x`,
  /* positions */
  position_invalid_numbers: `SELECT count(*)::int n FROM trading_positions WHERE quantity <= 0 OR margin <= 0 OR entry_price <= 0 OR leverage < 1`,
  position_open_with_close_fields: `SELECT count(*)::int n FROM trading_positions WHERE status='open' AND (closed_at IS NOT NULL OR exit_price IS NOT NULL)`,
  position_closed_without_exit: `SELECT count(*)::int n FROM trading_positions WHERE status IN ('closed','liquidated') AND (closed_at IS NULL OR exit_price IS NULL)`,
  position_cross_user: `SELECT count(*)::int n FROM trading_positions p JOIN demo_accounts a ON a.id=p.account_id WHERE a.user_id <> p.user_id`,
  /* SL/TP */
  sltp_inverted: `SELECT count(*)::int n FROM trading_positions WHERE status='open' AND sl_price IS NOT NULL AND tp_price IS NOT NULL
                    AND ((side='long' AND sl_price >= tp_price) OR (side='short' AND sl_price <= tp_price))`,
  sltp_last_update_not_applied: `SELECT count(*)::int n FROM trading_positions p
      JOIN LATERAL (SELECT detail FROM trading_events e WHERE e.kind='protection_updated' AND e.detail->>'position' = p.id::text ORDER BY e.id DESC LIMIT 1) l ON true
     WHERE p.status='open' AND ((l.detail->>'sl') IS NOT NULL AND abs(p.sl_price - (l.detail->>'sl')::numeric) > 1e-6
                             OR (l.detail->>'tp') IS NOT NULL AND abs(p.tp_price - (l.detail->>'tp')::numeric) > 1e-6)`,
  /* accounts / ledger */
  account_negative_balance: `SELECT count(*)::int n FROM demo_accounts WHERE balance < 0 OR used_margin < 0`,
  account_used_margin_drift: `SELECT count(*)::int n FROM demo_accounts a WHERE abs(a.used_margin - COALESCE((SELECT sum(margin) FROM trading_positions p WHERE p.account_id=a.id AND p.status='open'),0)) > 0.01`,
  duplicate_demo_funding: `SELECT count(*)::int n FROM (SELECT account_id FROM trading_ledger WHERE event='demo_funding' GROUP BY 1 HAVING count(*) > 1) x`,
}
const res = {}
let bad = 0
for (const [k, q] of Object.entries(checks)) {
  try { const n = (await db.query(q)).rows[0].n; res[k] = n; if (n) bad++ }
  catch (e) { res[k] = `ERROR: ${e.message}` }
}
const counts = (await db.query(`SELECT (SELECT count(*) FROM openfund_users)::int users, (SELECT count(*) FROM chart_workspaces)::int workspace_entries,
  (SELECT count(*) FROM trading_orders)::int orders, (SELECT count(*) FROM trading_positions)::int positions,
  (SELECT count(*) FROM trading_positions WHERE status='open')::int open_positions,
  (SELECT count(*) FROM trading_events WHERE kind='protection_updated')::int sltp_updates`)).rows[0]
await db.end()
const out = { t: Date.now(), violations: bad, checks: res, counts }
fs.writeFileSync(`${RUN}/integrity.json`, JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1))
if (bad) { fs.writeFileSync(`${RUN}/INTEGRITY_FAIL`, ''); process.exit(1) }
