/** apply schema.sql (idempotent) */
import pg from 'pg'
import { readFileSync } from 'node:fs'
/* MIGRATION_DATABASE_URL (OF-2026-11-12): the owner/migration role, so the API
   itself can run on a DML-only DATABASE_URL. Unset = DATABASE_URL (unchanged). */
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms'
const pool = new pg.Pool({ connectionString: url })
const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
/* Ownership guard: every backend table must belong to the migration role. A
   table pre-created under a backend name by another role (for example the
   Directus role, which may create its own collections) would otherwise be
   adopted silently by CREATE TABLE IF NOT EXISTS. */
async function assertBackendOwnership(p, sql) {
  const names = [...new Set([...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)].map(m => m[1].toLowerCase()))]
  const { rows } = await p.query(`SELECT c.relname, pg_get_userbyid(c.relowner) AS owner FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname = ANY($1) AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname = current_user)`, [names])
  if (rows.length) {
    console.error(`refusing to migrate: backend tables owned by another role: ${rows.map(r => `${r.relname} (${r.owner})`).join(', ')}`)
    await p.end(); process.exit(1)
  }
}
await assertBackendOwnership(pool, schemaSql)
await pool.query(schemaSql)
console.log('schema applied (idempotent)')
/* region claim (ADR 0032): first migrate claims the database for
   OPENFUND_REGION (default GLOBAL); a later mismatch exits non-zero */
const { regionConfig, claimDatabaseRegion } = await import('./region.js')
try { console.log(`database region: ${await claimDatabaseRegion(pool, regionConfig(process.env).region)}`) }
catch (e) { console.error(e.message); await pool.end(); process.exit(1) }
await pool.end()
/* Footprint market-data tables (self-contained, no FKs): applied to the
   dedicated FOOTPRINT_DATABASE_URL when set, otherwise to the main database. */
const footprintPool = new pg.Pool({ connectionString: process.env.FOOTPRINT_DATABASE_URL || url })
const footprintSql = readFileSync(new URL('./footprint/schema.sql', import.meta.url), 'utf8')
await assertBackendOwnership(footprintPool, footprintSql)
await footprintPool.query(readFileSync(new URL('./footprint/schema.sql', import.meta.url), 'utf8'))
console.log('footprint schema applied (idempotent)')
await footprintPool.end()
