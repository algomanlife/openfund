/**
 * Record which same-origin requests each public page really makes (cold
 * cache) so the k6 visitor model replays the shipped bundle's actual asset
 * graph and public API calls instead of a guessed list.
 * Output: k6/route-assets.json  { route: [{path, type, bytes, cache}] }
 */
import fs from 'node:fs'
import { chromium } from 'playwright'
import { isolate } from './isolate.mjs'

const TARGET = process.env.TARGET || 'http://127.0.0.1:18080'
const ROUTES = ['/fa/home', '/en/home', '/fa/challenges', '/en/challenges', '/fa/markets', '/en/markets', '/fa/rulebook', '/fa/transparency',
  '/fa/faq', '/en/learn', '/fa/governance', '/en/whitepaper', '/fa/tools']
const browser = await chromium.launch()
const out = {}, blocked = []
for (const route of ROUTES) {
  const ctx = await browser.newContext()
  await isolate(ctx, TARGET, blocked)
  const page = await ctx.newPage()
  const reqs = []
  page.on('response', async r => {
    const u = new URL(r.url())
    if (u.origin !== TARGET) return
    let bytes = 0
    try { bytes = (await r.body()).length } catch {}
    reqs.push({ path: u.pathname + u.search, type: r.request().resourceType(), status: r.status(), bytes, cache: r.headers()['cache-control'] || '' })
  })
  await page.goto(TARGET + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error(route, e.message))
  await page.waitForTimeout(1500)
  out[route] = reqs
  console.log(`${route}: ${reqs.length} same-origin requests, ${(reqs.reduce((a, r) => a + r.bytes, 0) / 1024).toFixed(0)} KB, api: ${reqs.filter(r => ['fetch', 'xhr', 'eventsource'].includes(r.type)).map(r => r.path).join(' ')}`)
  await ctx.close()
}
await browser.close()
fs.writeFileSync(new URL('../k6/route-assets.json', import.meta.url), JSON.stringify(out, null, 1))
console.log('blocked third-party origins:', [...new Set(blocked)].join(' ') || 'none')
