/** seed challenge plans from the landing's published presets (idempotent) */
import pg from 'pg'
const url = process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms'
const pool = new pg.Pool({ connectionString: url })
/* mirrors the single source of truth: apps/web-react/src/data/challengePlans.ts
   (docs/research/FUNDINGPIPS_PROGRAMS.md holds the provenance) */
const plans = [
  { slug: 'standard', name: 'استاندارد — Standard', configuration: { accountSizesUsd: [5000, 10000, 25000, 50000, 100000], priceUsd: { 5000: 44, 10000: 80, 25000: 216, 50000: 349, 100000: 652 }, phases: 2, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyLossPct: 5, maxDailyLossPctAlt: 3, maxTotalLossPct: 10, drawdownMode: 'static', minTradingDays: 3, profitSplitPct: 80, profitSplitMonthlyPct: 100, payoutCapPct: 0, firstPayoutDays: 14, minPayoutPct: 1, refundPolicy: 'fourth-reward' } },
  { slug: 'one-phase', name: 'تک‌مرحله‌ای — One-phase', configuration: { accountSizesUsd: [5000, 10000, 25000, 50000, 100000], priceUsd: { 5000: 74, 10000: 111, 25000: 255, 50000: 353, 100000: 666 }, phases: 1, phase1TargetPct: 12, maxDailyLossPct: 3, maxDailyLossPctAlt: 2, maxTotalLossPct: 12, drawdownMode: 'static', minTradingDays: 0, profitSplitPct: 80, profitSplitMonthlyPct: 100, payoutCapPct: 0, firstPayoutDays: 14, minPayoutPct: 1, refundPolicy: 'none' } },
  { slug: 'instant', name: 'آنی — Instant', configuration: { accountSizesUsd: [5000, 10000, 25000, 50000, 100000, 200000], priceUsd: { 5000: 60, 10000: 88, 25000: 188, 50000: 244, 100000: 444, 200000: 888 }, phases: 0, maxDailyLossPct: 3, maxTotalLossPct: 5, drawdownMode: 'trailing', trailingLockAtProfitPct: 5, minTradingDays: 0, profitableDaysPer30: 7, consistencyPct: 15, profitSplitPct: 95, payoutCapPct: 0, firstPayoutDays: 14, minPayoutPct: 1, refundPolicy: 'none' } },
  { slug: 'free-trial', name: 'تست رایگان — Free Trial', configuration: { accountSizesUsd: [5000, 10000, 25000, 50000, 100000], priceUsd: { 5000: 0, 10000: 0, 25000: 0, 50000: 0, 100000: 0 }, phases: 2, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyLossPct: 5, maxTotalLossPct: 10, drawdownMode: 'static', minTradingDays: 3, trialDaysPerPhase: 14, profitSplitPct: 0, payoutCapPct: 0, refundPolicy: 'none', free: true } }
]
for (const p of plans) {
  await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`, [p.slug, p.name, JSON.stringify(p.configuration)])
  console.log('plan:', p.slug)
}
await pool.end()
console.log('plans seeded')
