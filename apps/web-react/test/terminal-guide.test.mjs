// Terminal guide (features/guide, ADR 0056): selection by region and page,
// the published-only offline fallback, fa/en copy with the English fallback,
// the "Don't show again" cookie (version only, no identifiers, SameSite=Lax,
// Secure on https) and the terminal rule that guides are the only popup there.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
const src = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
function load(path) {
  const result = buildSync({
    entryPoints: [fileURLToPath(new URL(`../src/${path}`, import.meta.url))], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, jsx: 'automatic',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"' },
  })
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports)
  return mod.exports
}
async function withRegion(region, fn) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { value: { __OPENFUND_RUNTIME_CONFIG__: { region, cmsPublicUrl: 'https://cms.example.test' } }, configurable: true, writable: true })
  try { return await fn(load('features/guide/guide.ts')) } finally { if (saved) Object.defineProperty(globalThis, 'window', saved); else delete globalThis.window }
}
const STEP = { id: 1, sort: 2, status: 'published', media_kind: 'video', video_mp4: 'a', video_webm: 'b', poster: 'c', subtitles_fa: 'd', subtitles_en: 'e',
  title_fa: 'باز کردن موقعیت', title_en: 'Open a position', body_fa: 'متن', body_en: 'Body' }
const GUIDE = { id: 4, version: 3, cookie_days: 30, pages: ['terminal'], regions: ['GLOBAL'],
  steps: [STEP, { ...STEP, id: 2, sort: 1, title_en: 'Connect your wallet', title_fa: 'اتصال کیف پول' }, { ...STEP, id: 3, sort: 3, status: 'archived' }] }

test('selection: region and page must match; steps come in order; archived steps are hidden', async () => {
  await withRegion('GLOBAL', async g => {
    const guide = await g.selectGuide('en', async () => [GUIDE])
    assert.deepEqual(guide.steps.map(s => s.title), ['Connect your wallet', 'Open a position'])
    assert.equal(guide.version, 3); assert.equal(guide.cookieDays, 30)
    assert.match(guide.steps[0].mp4, /^https?:\/\/[^/]+\/assets\/a$/, 'CMS media through the Directus assets path')
    assert.equal(await g.selectGuide('en', async () => [{ ...GUIDE, pages: ['home'] }]), null)
    assert.equal(await g.selectGuide('en', async () => []), null, 'an empty published list means no guide, not the fallback')
  })
  await withRegion('IRAN', async g => assert.equal(await g.selectGuide('fa', async () => [GUIDE]), null))
})

test('copy: fa and en, other locales read en', async () => {
  await withRegion('GLOBAL', async g => {
    assert.equal((await g.selectGuide('fa', async () => [GUIDE])).steps[0].title, 'اتصال کیف پول')
    for (const locale of ['ar', 'ru', 'zh-CN']) assert.equal((await g.selectGuide(locale, async () => [GUIDE])).steps[0].title, 'Connect your wallet', locale)
  })
})

test('offline fallback: only when no content source answers; bundled media, no counters', async () => {
  await withRegion('IRAN', async g => {
    const guide = await g.selectGuide('fa', async () => null)
    assert.equal(guide.id, '0')
    assert.equal(guide.steps.length, 2)
    assert.equal(guide.steps[0].mp4, '/assets/guides/connect-wallet.mp4')
  })
  const seed = JSON.parse(readFileSync(new URL('../public/assets/guides/guide.json', import.meta.url), 'utf8'))
  await withRegion('GLOBAL', async g => {
    assert.deepEqual(g.OFFLINE_GUIDE.steps.map(s => s.title_en), seed.steps.map(s => s.title_en), 'the fallback mirrors the published seed')
    assert.deepEqual(g.OFFLINE_GUIDE.steps.map(s => s.title_fa), seed.steps.map(s => s.title_fa))
  })
})

test('"Don\'t show again": a cookie per guide version, no identifiers, Lax, Secure on https', async () => {
  await withRegion('GLOBAL', async g => {
    const guide = await g.selectGuide('en', async () => [GUIDE])
    const set = g.cookieString(guide, true, true)
    assert.equal(set, 'of_guide_4=3; Path=/; SameSite=Lax; Secure; Max-Age=2592000')
    assert.equal(g.cookieString(guide, false, false), 'of_guide_4=; Path=/; SameSite=Lax; Max-Age=0')
    assert.equal(g.optedOut(guide, 'theme=dark; of_guide_4=3'), true)
    assert.equal(g.optedOut(guide, 'of_guide_4=2'), false, 'a new version shows again')
    assert.equal(g.optedOut(guide, ''), false)
    assert.equal(g.cookieName('4; Domain=evil'), 'of_guide_4Domainevil', 'the name cannot inject attributes')
  })
})

test('terminal rules: the guide is the only popup there; it is mounted once in the shell and reachable from the menu', () => {
  const shell = src('features/terminal/TerminalShell.tsx'), menu = src('features/terminal/TerminalMenu.tsx'), modal = src('features/guide/GuideModal.tsx')
  assert.match(shell, /<GuideModal locale=\{locale\} \/>\s*<\/TerminalContext.Provider>/)
  assert.doesNotMatch(shell, /PromoModal/, 'no promotional popup on the terminal')
  assert.match(menu, /openGuide\(\)/)
  assert.match(modal, /aria-modal="true"/)
  assert.match(modal, /e\.key === 'Escape'/)
  assert.match(modal, /prefers-reduced-motion: reduce/)
  assert.match(src('features/guide/guide.css'), /prefers-reduced-motion: reduce/)
  assert.match(src('features/campaigns/campaigns.ts'), /if \(placement !== 'announcement_bar'\) return null/, 'campaign popups stay banned on trading pages')
})
