/** seed challenge plans from the landing's published presets (idempotent) */
import pg from 'pg'
const url = process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms'
const pool = new pg.Pool({ connectionString: url })
const plans = [
  { slug: 'starter', name: 'شروع — Starter', configuration: { accountSizesUsd: [5000, 10000, 20000], profitSplit: 60, maxTotalLossPct: 3, maxDailyLossPct: 3, phases: 2, payoutCapPct: 10 } },
  { slug: 'standard', name: 'استاندارد — Standard', configuration: { accountSizesUsd: [10000, 50000, 100000], profitSplit: 80, maxTotalLossPct: 6, maxDailyLossPct: 3, phases: 2, payoutCapPct: 0 } },
  { slug: 'single-phase', name: 'تک‌مرحله‌ای — Single Phase', configuration: { accountSizesUsd: [10000, 50000, 100000], profitSplit: 80, maxTotalLossPct: 3, maxDailyLossPct: 3, phases: 1, payoutCapPct: 0 } }
]
for (const p of plans) {
  await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`, [p.slug, p.name, JSON.stringify(p.configuration)])
  console.log('plan:', p.slug)
}
await pool.end()
console.log('plans seeded')
