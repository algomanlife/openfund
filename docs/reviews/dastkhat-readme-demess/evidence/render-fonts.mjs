#!/usr/bin/env node
/* Render evidence for the Dastkhat migration (no backend, no database).
 *
 *   PLAYWRIGHT=/path/to/node_modules/playwright CHROME=/usr/bin/google-chrome \
 *     node docs/reviews/dastkhat-readme-demess/evidence/render-fonts.mjs
 *
 * Serves the real repository files from a local static server and an
 * in-process Backstage, opens each surface in Chrome, and records for every
 * page: the font requests made, whether any retired face was requested, which
 * faces document.fonts actually loaded, and a screenshot. Writes results.json
 * and PNGs next to this script. Exits non-zero on any failure. */
import { createServer } from 'node:http'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../../..')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright')
const RETIRED = /irancell|vazirmatn|openfund-persian|persian\.woff2|openfund-[1-5]\.ttf/i
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain' }
const FA = 'پلتفرم شفاف معاملات اختصاصی؛ حساب ارزیابی ۱۰۰٬۰۰۰ دلاری — Openfund 2026'
const AR = 'منصة تداول شفافة للحسابات الممولة — Openfund 2026'

/* Test pages that load the real stylesheets exactly as each surface does. */
const PAGES = {
  '/__evidence/legacy-site.html': `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/legacy/style.css"></head><body style="padding:40px"><h1 style="font-weight:600">${FA}</h1><p style="font-weight:400">${FA}</p><p lang="ar" style="font-family:var(--ds-font-arabic)">${AR}</p></body></html>`,
  '/__evidence/terminal-iframe.html': `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/legacy/terminal.css"></head><body style="padding:40px;background:#060808;color:#eee"><h2>${FA}</h2><p>${FA}</p></body></html>`,
  '/__evidence/react-shell.html': `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/fonts/dastkhat/dastkhat.css"><link rel="stylesheet" href="/__ds.css"></head><body style="padding:40px;font-family:var(--ds-font-persian)"><h2>${FA}</h2><p class="ds-num">123,456.78</p></body></html>`,
  '/__evidence/certificate-canvas.html': `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#0b1a16"><canvas id="c" width="1000" height="260"></canvas><script>
    const ARABIC_RANGE = 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F, U+066B-066C'
    Promise.all([new FontFace('Dastkhat Certificate', 'url(/assets/fonts/dastkhat/Dastkhat-Variable.woff2)', { weight: '100 900', unicodeRange: ARABIC_RANGE }).load(),
      ...[400, 700].map(w => new FontFace('Ubuntu Certificate', 'url(/assets/ubuntu-' + w + '.ttf)', { weight: String(w) }).load())])
    .then(fonts => { fonts.forEach(f => document.fonts.add(f)); const x = document.getElementById('c').getContext('2d'); x.fillStyle = '#e9fff5'; x.direction = 'rtl'; x.textAlign = 'right'
      x.font = "700 44px 'Dastkhat Certificate', 'Ubuntu Certificate', system-ui, sans-serif"; x.fillText('گواهی تکمیل چالش — 100,000 USD', 960, 110)
      x.font = "500 30px 'Dastkhat Certificate', 'Ubuntu Certificate', system-ui, sans-serif"; x.fillText('شمارهٔ سریال OF-123456-ABCDEF', 960, 190); document.title = 'ready' })
  </script></body></html>`,
}

function staticServer(root, overrides) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    if (overrides[url.pathname]) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(overrides[url.pathname]) }
    if (url.pathname === '/__ds.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); return res.end(await readFile(path.join(repo, 'apps/web-react/src/styles/design-system.css'))) }
    const file = path.join(root, decodeURIComponent(url.pathname))
    try {
      if (!(await stat(file)).isFile()) throw new Error()
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
      res.end(await readFile(file))
    } catch { res.writeHead(404); res.end() }
  })
}
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))

const site = await listen(staticServer(path.join(repo, 'apps/web-react/public'), PAGES))
const dist = await listen(staticServer(path.join(repo, 'dist'), {}))
const { createBackstage } = await import(pathToFileURL(path.join(repo, 'apps/backstage/operations/server.js')))
const bsServer = createBackstage({ origin: 'http://127.0.0.1:1', backend: 'http://127.0.0.1:9', cms: 'http://127.0.0.1:9', owner: 'evidence', verifier: 'x', credential: 'x'.repeat(32), contentToken: null, iranBackend: null, releaseCommit: null, realSettlement: false }, { audit: () => {} })
const bs = await listen(bsServer)
/* Backstage refuses foreign Host headers; give it its real origin */
bsServer.removeAllListeners('request')
const bsReal = createBackstage({ origin: `http://127.0.0.1:${bs}`, backend: 'http://127.0.0.1:9', cms: 'http://127.0.0.1:9', owner: 'evidence', verifier: 'x', credential: 'x'.repeat(32), contentToken: null, iranBackend: null, releaseCommit: null, realSettlement: false }, { audit: () => {} })
bsServer.on('request', (req, res) => bsReal.emit('request', req, res))

const targets = [
  { id: 'legacy-site-fa', url: `http://127.0.0.1:${site}/__evidence/legacy-site.html`, expect: ['Dastkhat', 'Dastkhat Arabic'] },
  { id: 'terminal-iframe-fa', url: `http://127.0.0.1:${site}/__evidence/terminal-iframe.html`, expect: ['Dastkhat'] },
  { id: 'react-shell-fa', url: `http://127.0.0.1:${site}/__evidence/react-shell.html`, expect: ['Dastkhat'] },
  { id: 'certificate-canvas-fa', url: `http://127.0.0.1:${site}/__evidence/certificate-canvas.html`, expect: ['Dastkhat Certificate'], waitTitle: 'ready' },
  { id: 'dist-landing-fa', url: `http://127.0.0.1:${dist}/index.html`, expect: ['Dastkhat'] },
  { id: 'dist-terminal-fa', url: `http://127.0.0.1:${dist}/terminal.html`, expect: ['Dastkhat'] },
  { id: 'backstage-fa', url: `http://127.0.0.1:${bs}/`, expect: ['Dastkhat'], lang: 'fa' },
]

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] })
const results = []
let failed = 0
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const fontRequests = [], failedRequests = [], cspViolations = []
  page.on('request', r => { if (/\.(woff2?|ttf|otf)(\?|$)|dastkhat\.css/.test(r.url())) fontRequests.push(new URL(r.url()).pathname) })
  page.on('requestfailed', r => failedRequests.push(new URL(r.url()).pathname))
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text()) })
  /* keep pages offline-safe: block anything not served locally */
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort())
  await page.goto(t.url, { waitUntil: 'load' }).catch(e => failedRequests.push('navigation: ' + e.message))
  if (t.lang) await page.evaluate(lang => { document.documentElement.lang = lang; document.documentElement.dir = 'rtl'; const p = document.createElement('p'); p.textContent = 'ورود به میز کار مالک — اوپن‌فاند'; p.style.cssText = 'font-size:32px;padding:24px'; document.body.prepend(p) }, t.lang)
  if (t.waitTitle) await page.waitForFunction(title => document.title === title, t.waitTitle, { timeout: 10_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')))
  const shot = `${t.id}.png`
  await page.screenshot({ path: path.join(here, shot) })
  const retired = fontRequests.filter(u => RETIRED.test(u))
  const missing = t.expect.filter(f => !loaded.includes(f))
  const fontFailures = failedRequests.filter(u => /\.(woff2?|ttf|otf)|dastkhat\.css/.test(u))
  const ok = !retired.length && !missing.length && !fontFailures.length && !cspViolations.length
  if (!ok) failed++
  results.push({ id: t.id, ok, loadedFaces: [...new Set(loaded)], fontRequests: [...new Set(fontRequests)], retiredRequests: retired, missingFaces: missing, fontFailures, cspViolations, screenshot: shot })
  await page.close()
}
await browser.close()
for (const s of [bsServer]) s.close()
await writeFile(path.join(here, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id}: loaded [${r.loadedFaces.join(', ')}] retired requests ${r.retiredRequests.length}`)
process.exit(failed ? 1 : 0)
