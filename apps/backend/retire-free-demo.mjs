/**
 * Delete every former free demo account (ADR 0062). Owner-run, per region.
 *
 *   npm run retire-free-demo              # dry run: counts only, changes nothing
 *   npm run retire-free-demo -- --confirm # deletes, in one transaction
 *
 * Signing in no longer creates a trading account; the owner decided that the
 * existing auto-created demo accounts (account_type = 'free_demo') are test
 * data and are deleted completely. Run it once on each region's database
 * (GLOBAL and IRAN), after taking a backup of that database:
 *
 *  - only accounts owned by THIS region and in the `active` ownership state
 *    are deleted (the regional fence rejects writes to any other account);
 *    accounts owned elsewhere are reported and left for that region's run;
 *  - every dependent row goes with the account: journal entries and
 *    preferences, trade notes, close requests, positions, orders, ledger
 *    rows, engine events, risk and equity samples and the ownership row;
 *  - synchronized read-model copies of the peer region's free demo accounts
 *    (region_remote_rows / region_remote_entries) are deleted too;
 *  - the transaction sets openfund.retire_free_demo = 'on' (SET LOCAL), the
 *    only condition under which the trial immutability triggers allow a
 *    delete. Nothing outside this transaction can use it.
 *
 * The deletion cannot be undone except by restoring the backup.
 */
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is required'); process.exit(2) }
const confirm = process.argv.includes('--confirm')
const pool = new pg.Pool({ connectionString: url })

/* children first; each statement is scoped to the selected account ids ($1) */
const DELETE_STEPS = [
  ['journal_entries', `DELETE FROM journal_entries WHERE product='prop' AND account_ref = ANY($1::text[])`],
  ['journal_preferences', `DELETE FROM journal_preferences WHERE product='prop' AND account_ref = ANY($1::text[])`],
  ['trade_notes', `DELETE FROM trade_notes WHERE split_part(trade_key, '|', 1) = ANY($1::text[])`],
  ['position_close_requests', `DELETE FROM position_close_requests WHERE account_id = ANY($1::uuid[])`],
  ['trading_positions', `DELETE FROM trading_positions WHERE account_id = ANY($1::uuid[])`],
  ['trading_orders', `DELETE FROM trading_orders WHERE account_id = ANY($1::uuid[])`],
  ['trading_ledger', `DELETE FROM trading_ledger WHERE account_id = ANY($1::uuid[])`],
  ['trading_events', `DELETE FROM trading_events WHERE account_id = ANY($1::uuid[])`],
  ['account_equity_risk', `DELETE FROM account_equity_risk WHERE account_id = ANY($1::uuid[])`],
  ['account_equity_samples', `DELETE FROM account_equity_samples WHERE account_id = ANY($1::uuid[])`],
  ['demo_accounts', `DELETE FROM demo_accounts WHERE id = ANY($1::uuid[]) AND account_type='free_demo'`],
]

async function exists(client, table) {
  return (await client.query('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${table}`])).rows[0].ok
}

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL openfund.retire_free_demo = 'on'`)
    const region = (await client.query('SELECT openfund_local_region() AS region')).rows[0].region
    const all = (await client.query(
      `SELECT a.id, coalesce(o.home_region = openfund_local_region() AND o.state = 'active', false) AS local
         FROM demo_accounts a LEFT JOIN account_ownership o ON o.account_id = a.id
        WHERE a.account_type = 'free_demo' ORDER BY a.created_at FOR UPDATE OF a`)).rows
    const ids = all.filter(r => r.local).map(r => r.id)
    const skipped = all.length - ids.length
    const counts = {}
    for (const [table, sql] of DELETE_STEPS) {
      if (!(await exists(client, table))) continue
      const countSql = sql.replace(/^DELETE FROM (\w+) WHERE/, (_, name) => `SELECT count(*)::int AS n FROM ${name} WHERE`)
      counts[table] = confirm ? (await client.query(sql, [ids])).rowCount : (await client.query(countSql, [ids])).rows[0].n
    }
    /* read-model copies of the peer region's free demo accounts */
    if (await exists(client, 'region_remote_rows')) {
      const remote = (await client.query(
        `SELECT entity_id FROM region_remote_rows WHERE entity='account' AND data->>'account_type'='free_demo'`)).rows.map(r => r.entity_id)
      const tables = ['region_remote_entries', 'region_remote_rows']
      for (const table of tables) {
        if (!(await exists(client, table))) continue
        const where = `account_id::text = ANY($1::text[]) OR (entity='account' AND entity_id = ANY($1::text[]))`
        const sql = table === 'region_remote_rows' ? `FROM ${table} WHERE ${where}` : `FROM ${table} WHERE account_id::text = ANY($1::text[])`
        counts[table] = confirm ? (await client.query(`DELETE ${sql}`, [remote])).rowCount
          : (await client.query(`SELECT count(*)::int AS n ${sql}`, [remote])).rows[0].n
      }
    }
    if (confirm) {
      await client.query(`INSERT INTO audit_log (action, user_id, details) VALUES ('free_demo_retired', NULL, $1)`,
        [JSON.stringify({ region, accounts: ids.length, skippedOtherRegion: skipped, counts })])
      await client.query('COMMIT')
    } else {
      await client.query('ROLLBACK')
    }
    console.log(JSON.stringify({ mode: confirm ? 'deleted' : 'dry-run', region, accounts: ids.length, skippedOtherRegion: skipped, rows: counts }, null, 2))
    if (!confirm) console.log('Nothing was changed. Take a database backup, then run again with --confirm.')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

try {
  await run()
} catch (error) {
  console.error('retire-free-demo:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
