#!/usr/bin/env node
/* Records the two terminal-guide videos (ADR 0056) from Openfund's OWN
 * terminal. Never third-party footage.
 *
 *  1. "Connect your wallet and activate your account for trading"
 *  2. "Find a market and open a position"
 *
 * Requirements (local development only):
 *  - a local build served by the backend with a DISPOSABLE database
 *    (SIM_TEST_MODE=1 for the demo engine), e.g. on http://localhost:18090;
 *  - Playwright's Chromium and its bundled ffmpeg (npx playwright install).
 *
 * The wallet is a generated EIP-1193 test provider injected into the page.
 * It signs the real SIWE message with a throwaway key and never sends a
 * transaction. Every wallet address on screen is masked before it renders.
 * Clicks are highlighted, key controls get a gentle zoom, and fa/en WebVTT
 * subtitles are written from the actual action times.
 *
 * Output (apps/web-react/public/assets/guides/): <name>.webm (VP9),
 * <name>.mp4 (H.264, encoded by Chromium's MediaRecorder), <name>.jpg
 * (poster), <name>.fa.vtt and <name>.en.vtt. Each video is 30 to 60 seconds
 * and under 5 MB; the script fails otherwise.
 *
 * Usage: GUIDE_BASE_URL=http://localhost:18090 node scripts/guides/record-terminal-guide.mjs
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(join(root, 'package.json'))
const { chromium } = require('playwright')
const { generatePrivateKey, privateKeyToAccount } = createRequire(join(root, 'apps/backend/package.json'))('viem/accounts')

const BASE = process.env.GUIDE_BASE_URL || 'http://localhost:18090'
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('Record against a local development build only')
const OUT = join(root, 'apps/web-react/public/assets/guides')
const WORK = join(tmpdir(), `openfund-guide-${Date.now()}`)
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true })
const SIZE = { width: 1280, height: 720 }
const sleep = ms => new Promise(r => setTimeout(r, ms))

function ffmpeg() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(process.env.HOME, process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright')
  const dir = readdirSync(cache).filter(d => d.startsWith('ffmpeg-')).sort().pop()
  if (!dir) throw new Error('Playwright ffmpeg not found: run npx playwright install ffmpeg')
  const bin = readdirSync(join(cache, dir)).find(f => f.startsWith('ffmpeg'))
  return join(cache, dir, bin)
}

/* ---------- overlays: click highlight, zoom, address masking ---------- */
const OVERLAY = () => {
  const MASK = /0x[0-9a-fA-F]{4,40}(?:(?:…|\.\.\.)[0-9a-fA-F]{2,8})?/g
  const mask = node => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (MASK.test(n.nodeValue)) { MASK.lastIndex = 0; n.nodeValue = n.nodeValue.replace(MASK, '0x••••…••••') }
  }
  new MutationObserver(list => { for (const m of list) { if (m.type === 'characterData') mask(m.target.parentNode || m.target); else m.addedNodes.forEach(n => mask(n.nodeType === 3 ? n.parentNode : n)) } })
    .observe(document, { subtree: true, childList: true, characterData: true })
  addEventListener('DOMContentLoaded', () => mask(document.body))
  addEventListener('pointerdown', e => {
    const ring = document.createElement('div')
    Object.assign(ring.style, { position: 'fixed', left: `${e.clientX - 22}px`, top: `${e.clientY - 22}px`, width: '44px', height: '44px', borderRadius: '50%',
      border: '3px solid #82e7bd', background: '#82e7bd33', pointerEvents: 'none', zIndex: 2147483647, transition: 'transform .6s ease-out, opacity .6s ease-out' })
    document.documentElement.append(ring)
    requestAnimationFrame(() => { ring.style.transform = 'scale(1.8)'; ring.style.opacity = '0' })
    setTimeout(() => ring.remove(), 700)
  }, true)
}

async function makeWalletPage(context, account) {
  const page = await context.newPage()
  await page.exposeFunction('guideSign', raw => account.signMessage({ message: { raw } }))
  await page.addInitScript(address => {
    const events = {}
    window.ethereum = {
      isMetaMask: true,
      on: (k, fn) => (events[k] ||= []).push(fn),
      removeListener: (k, fn) => (events[k] = (events[k] || []).filter(x => x !== fn)),
      request: async ({ method, params }) => {
        if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [address]
        if (method === 'eth_chainId') return '0xa4b1'
        if (method === 'net_version') return '42161'
        if (method === 'wallet_switchEthereumChain') return null
        if (method === 'personal_sign') return window.guideSign(params[0])
        if (method === 'eth_getBalance') return '0x0'
        if (method === 'eth_blockNumber') return '0x1'
        if (method === 'wallet_requestPermissions') return [{ parentCapability: 'eth_accounts' }]
        if (method === 'eth_sendTransaction') throw new Error('The guide wallet never sends transactions')
        return null
      },
    }
  }, account.address)
  await page.addInitScript(OVERLAY)
  return page
}

/* a recorded scene: the clock, cues and the camera */
function scene(page) {
  const cues = []
  let t0 = null
  const now = () => (Date.now() - t0) / 1000
  return {
    start() { t0 = Date.now() },
    get t0() { return t0 },
    async say(en, fa, seconds) { const start = now(); cues.push({ start, end: start + seconds, en, fa }); await sleep(seconds * 1000) },
    cue(en, fa, seconds) { const start = now(); cues.push({ start, end: start + seconds, en, fa }) },
    async zoom(locator, scale = 1.35) {
      const box = await locator.boundingBox()
      if (!box) return
      const x = box.x + box.width / 2, y = box.y + box.height / 2
      await page.evaluate(({ x, y, scale }) => { const s = document.documentElement.style; s.transition = 'transform .8s ease-in-out'; s.transformOrigin = `${x}px ${y}px`; s.transform = `scale(${scale})` }, { x, y, scale })
      await sleep(900)
    },
    async unzoom() { await page.evaluate(() => { document.documentElement.style.transform = 'none' }); await sleep(900) },
    async click(locator, { zoom = false } = {}) {
      await locator.waitFor({ state: 'visible', timeout: 30_000 })
      if (zoom) await this.zoom(locator)
      await locator.hover(); await sleep(450)
      await locator.click(); await sleep(700)
      if (zoom) await this.unzoom()
    },
    async type(locator, text) { await locator.click(); await locator.fill(''); await locator.pressSequentially(text, { delay: 140 }); await sleep(500) },
    cues,
  }
}

const vttTime = s => { const ms = Math.max(0, Math.round(s * 1000)); const h = String(Math.floor(ms / 3.6e6)).padStart(2, '0'); const m = String(Math.floor(ms / 6e4) % 60).padStart(2, '0'); const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0'); return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, '0')}` }
/* a cue ends when the next one starts: subtitles never overlap */
const vtt = (cues, lang) => 'WEBVTT\n\n' + cues.map((c, i) => ({ ...c, end: Math.min(c.end, cues[i + 1] ? cues[i + 1].start - 0.05 : c.end) })).map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${c[lang]}\n`).join('\n')

async function encode(name, raw, trimSeconds, duration, cues, browser) {
  const bin = ffmpeg()
  const webm = join(OUT, `${name}.webm`), png = join(WORK, `${name}.png`)
  execFileSync(bin, ['-y', '-loglevel', 'error', '-ss', String(trimSeconds), '-i', raw, '-t', String(duration), '-an', '-c:v', 'libvpx-vp9', '-b:v', '320k', '-maxrate', '420k', '-bufsize', '840k', '-deadline', 'good', '-row-mt', '1', webm])
  execFileSync(bin, ['-y', '-loglevel', 'error', '-ss', String(Math.min(duration - 1, cues[cues.length - 1].start + 1)), '-i', webm, '-frames:v', '1', png])
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', png, '--out', join(OUT, `${name}.jpg`)], { stdio: 'ignore' })
  /* H.264 MP4 through Chromium's MediaRecorder, in real time */
  const page = await browser.newPage()
  await page.route('http://guide.local/**', route => route.fulfill({ status: 200, contentType: route.request().url().endsWith('.webm') ? 'video/webm' : 'text/html',
    body: route.request().url().endsWith('.webm') ? readFileSync(webm) : '<!doctype html><video id=v muted playsinline></video>' }))
  await page.goto('http://guide.local/index.html')
  const base64 = await page.evaluate(async () => {
    const v = document.getElementById('v'); v.src = '/clip.webm'; await v.play()
    const rec = new MediaRecorder(v.captureStream(), { mimeType: 'video/mp4;codecs=avc1.42E01F', videoBitsPerSecond: 650_000 })
    const chunks = []; rec.ondataavailable = e => chunks.push(e.data); rec.start(1000)
    await new Promise(r => { v.onended = r }); rec.stop(); await new Promise(r => { rec.onstop = r })
    const buf = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s)
  })
  await page.close()
  writeFileSync(join(OUT, `${name}.mp4`), Buffer.from(base64, 'base64'))
  writeFileSync(join(OUT, `${name}.en.vtt`), vtt(cues, 'en'))
  writeFileSync(join(OUT, `${name}.fa.vtt`), vtt(cues, 'fa'))
  for (const ext of ['webm', 'mp4']) {
    const size = statSync(join(OUT, `${name}.${ext}`)).size
    if (size >= 5 * 1024 * 1024) throw new Error(`${name}.${ext} is ${size} bytes; the limit is 5 MB`)
    console.log(`${name}.${ext}: ${(size / 1048576).toFixed(2)} MB, ${duration.toFixed(1)} s`)
  }
}

async function record(browser, name, account, setup, play) {
  const dir = join(WORK, name)
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE }, reducedMotion: 'no-preference' })
  const prep = setup ? await makeWalletPage(context, account) : null
  const state = setup ? await setup(prep) : {}
  const page = await makeWalletPage(context, account)
  const s = scene(page)
  const opened = Date.now()
  /* play() starts the clock once the terminal has loaded */
  await play(page, s, state)
  const duration = (Date.now() - s.t0) / 1000
  const video = page.video()
  await prep?.close(); await page.close(); await context.close()
  const raw = await video.path()
  if (duration < 30 || duration > 60) throw new Error(`${name}: ${duration.toFixed(1)} s is outside 30 to 60 seconds`)
  await encode(name, raw, (s.t0 - opened) / 1000 + 0.2, duration, s.cues, browser)
}

const frame = page => page.frameLocator('iframe')
/* signed in: the header's active-account selector is enabled */
const signedIn = page => page.locator('.of-header-account select:not([disabled])').waitFor({ timeout: 30_000 })
const signIn = async page => {
  await page.goto(`${BASE}/en/prop/trade`)
  await page.getByRole('button', { name: 'Connect Wallet', exact: true }).first().click()
  await page.locator('[data-wallet-picker] [data-wallet-id]').first().click()
  await frame(page).getByRole('button', { name: 'Sign in', exact: true }).first().click()
  await signedIn(page)
}
const trialOf = async page => page.evaluate(async () => (await (await fetch('/accounts', { credentials: 'include' })).json()).accounts.find(a => a.type === 'free_trial'))

const browser = await chromium.launch()
try {
  /* 1. connect, sign in (SIWE), choose the demo account */
  await record(browser, 'connect-wallet', privateKeyToAccount(generatePrivateKey()), null, async (page, s) => {
    await page.goto(`${BASE}/en/prop/trade`)
    await frame(page).locator('#market-select-btn').waitFor({ timeout: 30_000 })
    await sleep(2500)
    s.start()
    await s.say('This is the Openfund trading terminal.', 'این ترمینال معاملاتی اوپن‌فاند است.', 5)
    s.cue('Start by connecting your wallet.', 'ابتدا کیف پول خود را وصل کنید.', 5)
    await s.click(page.getByRole('button', { name: 'Connect Wallet', exact: true }).first(), { zoom: true })
    s.cue('Choose your wallet from the list.', 'کیف پول خود را از فهرست انتخاب کنید.', 4)
    await sleep(1800)
    await s.click(page.locator('[data-wallet-picker] [data-wallet-id]').first())
    s.cue('Sign in with a signature. It is not a transaction and costs no fee.', 'با یک امضا وارد شوید. این کار تراکنش نیست و کارمزدی ندارد.', 6)
    await sleep(1500)
    await s.click(frame(page).getByRole('button', { name: 'Sign in', exact: true }).first(), { zoom: true })
    await signedIn(page)
    await s.say('You are signed in. Your wallet is your account.', 'وارد شدید. کیف پول شما همان حساب شماست.', 4)
    const trial = await trialOf(page)
    if (!trial) throw new Error('No demo account was activated for the new wallet')
    s.cue('Open Accounts to see your Prop and Perpetual accounts.', 'برای دیدن حساب‌های پراپ و پرپچوال، بخش حساب‌ها را باز کنید.', 6)
    await s.click(page.getByRole('link', { name: 'Accounts', exact: true }).first())
    await page.locator('.of-account-card').first().waitFor({ timeout: 30_000 })
    await sleep(2500)
    s.cue('Choose your demo account to activate it for trading.', 'حساب دموی خود را انتخاب کنید تا برای معامله فعال شود.', 6)
    await s.click(page.locator(`[data-account-id="${trial.id}"]`), { zoom: true })
    await sleep(2500)
    await page.goto(`${BASE}/en/prop/trade?account=${encodeURIComponent(trial.id)}`)
    await frame(page).locator('#submit-order').waitFor({ timeout: 30_000 })
    await sleep(1500)
    await s.say('Your account is active. You are ready to trade.', 'حساب شما فعال است و آمادهٔ معامله هستید.', 6)
  })

  /* 2. find a market, set size and leverage, open a position (demo) */
  await record(browser, 'open-position', privateKeyToAccount(generatePrivateKey()), async prep => {
    await signIn(prep)
    return { trial: await trialOf(prep) }
  }, async (page, s, { trial }) => {
    await page.goto(`${BASE}/en/prop/trade?account=${encodeURIComponent(trial.id)}`)
    const f = frame(page)
    await f.locator('#submit-order').waitFor({ timeout: 30_000 })
    await sleep(2500)
    s.start()
    await s.say('Your demo account is selected in the terminal.', 'حساب دموی شما در ترمینال انتخاب شده است.', 5)
    s.cue('Open the market list and search for a market.', 'فهرست بازارها را باز کنید و بازار را جست‌وجو کنید.', 6)
    await s.click(f.locator('#market-select-btn'), { zoom: true })
    await s.type(f.locator('#market-search'), 'ETH')
    s.cue('Select the pair you want to trade.', 'جفت‌ارزی را که می‌خواهید معامله کنید انتخاب کنید.', 4)
    await sleep(1000)
    await s.click(f.locator('#market-dd-list li[data-id="ETH/USD"]'))
    await sleep(2000)
    s.cue('Set the size: here, 500 dollars of collateral.', 'حجم را تنظیم کنید: در این نمونه ۵۰۰ دلار وثیقه.', 5)
    await s.zoom(f.locator('#of-collateral'))
    await s.type(f.locator('#of-collateral'), '500')
    await s.unzoom()
    s.cue('Choose the leverage within your plan limit.', 'اهرم را در محدودهٔ مجاز پلن خود انتخاب کنید.', 5)
    await s.click(f.getByRole('button', { name: '10×', exact: true }).first(), { zoom: true })
    await sleep(1200)
    s.cue('Review the order: the estimate comes from the server.', 'سفارش را بازبینی کنید: برآورد از سرور می‌آید.', 6)
    await s.click(f.locator('#submit-order'))
    await f.locator('#review-dialog[open]').waitFor({ timeout: 15_000 })
    await s.zoom(f.locator('#review-dialog'), 1.2)
    await sleep(2500)
    await s.unzoom()
    s.cue('Confirm to open the position on your demo account.', 'تأیید کنید تا موقعیت روی حساب دموی شما باز شود.', 5)
    await s.click(f.locator('#review-confirm'))
    await page.waitForFunction(() => window.__ofServerTP?.state.positions.length === 1, null, { timeout: 20_000 }).catch(() => {})
    await sleep(1500)
    await s.say('Your position appears under Positions.', 'موقعیت شما در بخش موقعیت‌ها نمایش داده می‌شود.', 6)
  })
} finally {
  await browser.close()
  if (existsSync(WORK)) rmSync(WORK, { recursive: true, force: true })
}
