/** apply schema.sql (idempotent) */
import pg from 'pg'
import { readFileSync } from 'node:fs'
const url = process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms'
const pool = new pg.Pool({ connectionString: url })
await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
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
await footprintPool.query(readFileSync(new URL('./footprint/schema.sql', import.meta.url), 'utf8'))
console.log('footprint schema applied (idempotent)')
await footprintPool.end()
