/* Market Heatmap and Trade Radar against the REAL feed (integration, not required).
 *
 * The required acceptance suite (e2e/test-heatmap-radar.cjs) runs on fixed
 * fixtures. This check keeps the end-to-end path honest: the backend's shared
 * Hyperliquid cache answers /radar/markets with a well-formed market list, the
 * heatmap renders it, and the radar tabs render data or an explicit state.
 * It depends on the network and on live markets, so CI runs it as a
 * non-blocking step and it must never gate a merge. */
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); console.log('PASS - ' + name) }

;(async () => {
  const response = await fetch(BASE + '/radar/markets', { signal: AbortSignal.timeout(40000) })
  ok(`/radar/markets answers (${response.status})`, response.ok)
  const body = await response.json()
  ok('the market list is well formed', Array.isArray(body.markets) && typeof body.updated === 'number'
    && body.markets.every(m => typeof m.coin === 'string' && (m.dayVolume === null || typeof m.dayVolume === 'number')), JSON.stringify(body).slice(0, 200))
  ok(`the live feed has markets (${body.markets.length})`, body.markets.some(m => (m.dayVolume || 0) > 0))

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(BASE + '/en/prop/heatmap', { waitUntil: 'load' })
    await page.locator('.of-hm-tile').first().waitFor({ timeout: 40000 })
    ok('the heatmap renders live tiles', await page.locator('.of-hm-tile[data-coin]').count() > 0)
    await page.goto(BASE + '/en/prop/radar', { waitUntil: 'load' })
    for (const tab of ['Live tape', 'Aggregated positioning', 'Whale positions', 'Leaderboard']) {
      await page.getByRole('tab', { name: tab }).click()
      /* "Loading…" is transient; wait for a table or a settled empty/error message */
      await page.locator('.of-radar-panel').locator('table, .of-radar-empty:not([role="status"])').first().waitFor({ timeout: 40000 })
      ok(`${tab} renders live data or an explicit state`, true)
    }
  } finally { await browser.close() }
  console.log('live heatmap and radar integration passed')
})().catch(e => { console.error(e); process.exit(1) })
