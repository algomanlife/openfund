#!/usr/bin/env node
/**
 * Optional, read-only live check of the Gains account endpoints behind
 * /products/perpetual/gains (open trades, trading variables, personal history
 * and stats on Arbitrum One). NOT part of CI gating: it depends on third-party
 * availability. Run manually or from the scheduled Upstream watch workflow:
 *   npm run check:gains-account-live
 *
 * It reads the zero address only (no user data) through the production
 * adapter, so a schema change surfaces exactly as users would see it.
 * Exit 0 = shapes decode and freshness is reported. Exit 1 = drift
 * (gains_schema_changed: open a review, do not auto-adapt). Exit 3 = unreachable.
 */
import { gainsPortfolio } from '../../apps/backend/gains-portfolio.js'

const ZERO = '0x0000000000000000000000000000000000000000'
try {
  const s = await gainsPortfolio(ZERO)
  const ok = s.network?.chainId === 42161 && s.capabilities?.readOnly === true && s.capabilities?.canTrade === false &&
    Array.isArray(s.collaterals) && s.collaterals.length > 0 && ['fresh', 'stale', 'inconsistent'].includes(s.freshness?.status)
  console.log(JSON.stringify({ ok, freshness: s.freshness?.status, warnings: s.freshness?.warnings, collaterals: s.collaterals.map(c => c.symbol) }))
  process.exit(ok ? 0 : 1)
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e.message, status: e.status ?? null }))
  process.exit(e.message === 'gains_schema_changed' ? 1 : 3)
}
