/** seed challenge plans from the landing's published presets (idempotent)
 *
 * Canonical key is `dailyLossPct` (matches the frontend catalog
 * src/data/challengePlans.ts and the CMS seed path). The legacy backend
 * key `maxDailyLossPct` is still ACCEPTED by evaluation.js
 * normalizeRules() for pre-existing rows, but never written here. */
import pg from 'pg'
import { PLAN_SEEDS as plans } from './plan-catalog.js'

const url = process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms'
const pool = new pg.Pool({ connectionString: url })
for (const p of plans) {
  await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`, [p.slug, p.name, JSON.stringify(p.configuration)])
  console.log('plan:', p.slug)
}
await pool.end()
console.log('plans seeded')
