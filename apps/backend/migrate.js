/** apply schema.sql (idempotent) */
import pg from 'pg'
import { readFileSync } from 'node:fs'
const url = process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms'
const pool = new pg.Pool({ connectionString: url })
await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
console.log('schema applied (idempotent)')
await pool.end()
