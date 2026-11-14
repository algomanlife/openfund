/** seed challenge plans from the published catalog (idempotent, versioned)
 *
 * Canonical key is `dailyLossPct` (matches the frontend catalog
 * src/data/challengePlans.ts and the CMS seed path). The legacy backend
 * key `maxDailyLossPct` is still ACCEPTED by evaluation.js
 * normalizeRules() for pre-existing rows, but never written here.
 *
 * A stored configuration is replaced only when the catalog carries a higher
 * `catalogVersion` than the stored row (a hand edit at the same version is
 * left alone). Purchased challenges are never affected: each one keeps the
 * rules snapshot frozen at provisioning. */
import pg from 'pg'
import { PLAN_SEEDS as plans } from './plan-catalog.js'

const url = process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms'
const pool = new pg.Pool({ connectionString: url })
for (const p of plans) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name,
       configuration = CASE WHEN coalesce((challenge_plans.configuration->>'catalogVersion')::int, 1) < coalesce((EXCLUDED.configuration->>'catalogVersion')::int, 1)
                            THEN EXCLUDED.configuration ELSE challenge_plans.configuration END
     RETURNING (configuration->>'catalogVersion') AS version, (xmax = 0) AS inserted`,
    [p.slug, p.name, JSON.stringify(p.configuration)])
  console.log(`plan: ${p.slug} (catalog v${row.version ?? 1}${row.inserted ? ', inserted' : ''})`)
}
await pool.end()
console.log('plans seeded')
