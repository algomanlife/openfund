#!/usr/bin/env node
/* Post-deploy parity check for v0.9.0 (run by the owner after approving the
 * production deployment; read-only, no credentials).
 *
 *   node docs/reviews/dastkhat-readme-demess/evidence/verify-live.mjs [--version 0.9.0] [--site https://openfi.cloud] [--backstage https://backstage.openfi.cloud]
 *   PLAYWRIGHT=… node … --browser     # also record the font requests of /fa/home in Chrome
 *
 * Checks: /version reports the official release and the tag's commit;
 * Backstage /health reports the same commit; the shared dastkhat.css and the
 * Dastkhat WOFF2 are served; the legacy stylesheet imports dastkhat.css and
 * names no retired face; retired font URLs no longer return a font; with
 * --browser, the Persian home page loads Dastkhat and requests no retired font. */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback }
const version = arg('--version', '0.9.0'), site = arg('--site', 'https://openfi.cloud'), backstage = arg('--backstage', 'https://backstage.openfi.cloud')
const RETIRED = /irancell|vazirmatn|openfund-persian|persian\.woff2/i
let tagCommit = null
try { tagCommit = execFileSync('git', ['rev-list', '-n', '1', `v${version}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch {}
const results = []
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`) }
const get = async (url, init) => { const r = await fetch(url, { redirect: 'follow', ...init }); return { status: r.status, type: r.headers.get('content-type') || '', text: () => r.text(), url: r.url } }

const v = await get(`${site}/version`).then(async r => JSON.parse(await r.text())).catch(e => ({ error: e.message }))
check('/version reports the release', v.version === version, JSON.stringify(v))
check('/version is official and matched', v.official === true, `official=${v.official}`)
if (tagCommit) check('/version commit equals the tag', v.commit === tagCommit, `${v.commit} vs v${version} ${tagCommit}`)
const h = await get(`${backstage}/health`).then(async r => JSON.parse(await r.text())).catch(e => ({ error: e.message }))
check('Backstage /health commit matches the site', Boolean(h.commit) && h.commit === v.commit, JSON.stringify(h))

const css = await get(`${site}/assets/fonts/dastkhat/dastkhat.css`)
const cssText = await css.text()
check('dastkhat.css is served', css.status === 200 && /text\/css/.test(css.type) && /font-family: 'Dastkhat'/.test(cssText), `${css.status} ${css.type}`)
const woff = await get(`${site}/assets/fonts/dastkhat/Dastkhat-Variable.woff2`)
check('Dastkhat-Variable.woff2 is served', woff.status === 200 && /font\/woff2|octet-stream/.test(woff.type), `${woff.status} ${woff.type}`)
const legacy = await get(`${site}/legacy/style.css`)
const legacyText = await legacy.text()
check('legacy stylesheet imports dastkhat.css and names no retired face', /^@import url\(\.\.\/assets\/fonts\/dastkhat\/dastkhat\.css\)/.test(legacyText) && !RETIRED.test(legacyText), `${legacy.status}`)
for (const path of ['/assets/irancell-400.ttf', '/assets/openfund-persian-400-v4.woff2', '/assets/Vazirmatn.ttf']) {
  const r = await get(site + path)
  check(`retired ${path} no longer returns a font`, r.status === 404 || !/font|octet-stream/.test(r.type), `${r.status} ${r.type}`)
}

if (process.argv.includes('--browser')) {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright')
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined })
  const page = await browser.newPage()
  const fonts = []
  page.on('request', r => { if (/\.(woff2?|ttf|otf)(\?|$)|dastkhat\.css/.test(r.url())) fonts.push(new URL(r.url()).pathname) })
  await page.goto(`${site}/fa/home`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')))
  await page.screenshot({ path: 'live-fa-home.png' })
  await browser.close()
  check('live /fa/home loads Dastkhat', loaded.includes('Dastkhat'), loaded.join(', '))
  check('live /fa/home requests no retired font', !fonts.some(f => RETIRED.test(f)), [...new Set(fonts)].join(', '))
}
const failed = results.filter(r => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
