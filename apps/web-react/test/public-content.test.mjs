/* Public website content validation (fa, en, ar, ru, zh-CN).
 *
 * Covers the commercial-launch content contract (docs/website/CONTENT_ARCHITECTURE.md):
 * no hosting/infrastructure provider notes, development or placeholder copy;
 * no public Team section or Instagram promo; exact A-Book / B-Book labels;
 * no unverified office, licensing or payout-speed claims; simulated-account
 * and purchase-availability disclosures kept; complete translations; correct
 * text direction; and SEO routes that match the sitemap.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
const appRoot = fileURLToPath(new URL('..', import.meta.url))
const read = path => readFileSync(join(appRoot, path), 'utf8')
function load(path, extra = {}) {
  const { outputFiles } = buildSync({ entryPoints: [join(appRoot, path)], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    loader: { '.css': 'empty', '.zip': 'dataurl', '.html': 'text', '.json': 'json' }, define: { 'import.meta.env': '{}' }, ...extra })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}

const LOCALES = ['fa', 'en', 'ar', 'ru', 'zh-CN']
const ADDED = ['ar', 'ru', 'zh-CN']
const landing = read('src/pages/landing-body.html')
const faToEn = JSON.parse(read('public/translations.json'))
const source = JSON.parse(read('src/i18n/content/source.json'))
const dictionaries = Object.fromEntries(ADDED.map(l => [l, JSON.parse(read(`src/i18n/content/${l}.json`))]))

/* fa/en editorial seeds that reach public pages (bundled or seeded into Directus) */
const SEEDS = ['src/cms/seed/homeContent.ts', 'src/cms/seed/legalContent.ts', 'src/cms/seed/faqContent.ts', 'src/cms/seed/faqSiteContent.ts',
  'src/cms/seed/marketsContent.ts', 'src/features/rulebook/content.ts', 'src/features/information/content.ts', 'src/data/challengePlans.ts']
const walkFiles = dir => readdirSync(join(appRoot, dir)).flatMap(name => {
  const rel = `${dir}/${name}`
  return statSync(join(appRoot, rel)).isDirectory() ? walkFiles(rel) : /\.ts$/.test(name) ? [rel] : []
})
const WHITEPAPER = walkFiles('src/cms/seed/whitepaper')

/** the public text of each locale */
function localeCorpus() {
  const fa = [landing, ...Object.keys(faToEn), ...SEEDS.map(read), ...WHITEPAPER.map(read)].join('\n')
  const en = [...source, ...Object.values(faToEn)].join('\n')
  const out = { fa, en }
  for (const l of ADDED) out[l] = source.map(s => dictionaries[l][s] ?? '').join('\n')
  return out
}
const corpus = localeCorpus()

test('every locale has a complete translation of the public source inventory', () => {
  /* regenerate the inventory in memory and compare: source.json must be current */
  /* editorial strings live in src/i18n/content/<locale>.json, interface strings in src/i18n/messages/<locale>.ts */
  execFileSync(process.execPath, ['scripts/i18n-sources.mjs', '--check'], { cwd: appRoot, stdio: 'pipe' })
})

const FORBIDDEN = [
  /* hosting / infrastructure-provider notes */
  [/\bRender\b(?!ed|ing|s\b)/, 'hosting provider name'], [/\bon Sites\b|\bin Sites\b|در Sites/, 'hosting platform note'],
  [/میزبانی این نسخه|hosted on|hosting provider|زیرساخت Render|Render infrastructure|دیتاسنتر/, 'hosting statement'],
  /* development / placeholder copy */
  [/\blorem ipsum\b|\bTODO\b|\bFIXME\b|placeholder text|test mode|حالت آزمایشی سامانه/i, 'development copy'],
  [/Illustrative team member|عضو نمونهٔ تیم|Sample plans|پلن‌های نمونه|prices are illustrative|قیمت این حساب نمونه است/, 'sample/illustrative product copy'],
  [/Protocol proposal · coming soon|دریافت پروپوزال پروتکل/, 'placeholder document'],
  /* unverified claims */
  [/Brannan|San Francisco, CA|Suite 300|خاکشانسی|بلوار ارم/, 'unverified office address'],
  [/licensed by|regulated by|under license from|دارای مجوز از/i, 'licensing claim'],
  [/paid within \d+ hours|payouts? in under|instant payouts?|برداشت فوری/i, 'payout speed claim'],
  [/trade real capital|real-money funded|سرمایهٔ واقعی شرکت/i, 'real capital claim'],
  [/Iran’s first open-source business|اولین کسب‌وکار منبع‌باز ایرانی/, 'unverifiable superlative'],
  [/We bet on traders, not against them|ما روی معامله‌گر شرط می‌بندیم/, 'claim that contradicts the B-Book disclosure'],
  /* A-Book / B-Book must use the exact labels */
  [/A-booked|B-booked|ای‌بوک|بی‌بوک|\bA book\b|\bB book\b/i, 'non-standard A-Book/B-Book label'],
]

for (const locale of LOCALES) {
  test(`${locale}: public copy has no hosting, development, placeholder or unverified claims`, () => {
    for (const [pattern, why] of FORBIDDEN) {
      const match = corpus[locale].match(pattern)
      const context = match ? corpus[locale].slice(Math.max(0, match.index - 60), match.index + 60).replace(/\s+/g, ' ') : ''
      assert.ok(!match, `${locale}: ${why}: "${match?.[0]}" in …${context}…`)
    }
  })
}

test('A-Book and B-Book keep their exact labels in all five locales', () => {
  const doc = new (require('jsdom').JSDOM)(landing).window.document
  assert.deepEqual([...doc.querySelectorAll('.model-pill')].map(p => p.textContent), ['A-Book', 'B-Book'])
  assert.ok([...doc.querySelectorAll('.model-pill')].every(p => p.getAttribute('dir') === 'ltr'))
  for (const l of ADDED) {
    assert.equal(dictionaries[l]['A-Book'], 'A-Book')
    assert.equal(dictionaries[l]['B-Book'], 'B-Book')
    for (const s of source.filter(s => /A-Book|B-Book/.test(s))) {
      for (const label of ['A-Book', 'B-Book']) if (s.includes(label)) assert.ok(dictionaries[l][s].includes(label), `${l} renames ${label}: ${s}`)
    }
  }
  const pairs = Object.entries(faToEn).filter(([fa]) => /A-Book|B-Book/.test(fa))
  assert.ok(pairs.length >= 1)
  for (const [fa, en] of pairs) for (const label of ['A-Book', 'B-Book']) if (fa.includes(label)) assert.ok(en.includes(label), en)
})

test('the public Team section is removed from navigation, footer, routes and the Challenges page', () => {
  const doc = new (require('jsdom').JSDOM)(landing).window.document
  assert.equal(doc.querySelectorAll('#team, .team-section, #team-dialog, [data-team]').length, 0)
  assert.doesNotMatch(read('src/features/information/navigation.ts'), /'team'\] as const|team: text\(/)
  assert.doesNotMatch(read('src/cms/seed/marketsContent.ts'), /team-section/)
  assert.doesNotMatch(read('src/cms/client.ts'), /'team-section', 'faq-section'/)
  assert.doesNotMatch(read('src/pages/Landing.tsx'), /'team'/)
  assert.doesNotMatch(read('src/main.tsx'), /scroll: 'team'/)
  for (const [key, value] of Object.entries(faToEn)) assert.doesNotMatch(value, /^(?:Team|Our team|Openfund team)$/, key)
})

test('the Instagram promo button is gone and the other community channels stay', () => {
  const community = read('src/features/community/TelegramCommunity.tsx')
  assert.doesNotMatch(community, /id: 'instagram'/)
  assert.doesNotMatch(community, /News, Education & Entertainment|اخبار، آموزش و سرگرمی/)
  assert.match(community, /id: 'telegram'/)
  assert.match(community, /id: 'discord'/)
})

test('no unreleased app downloads or placeholder documents are published', () => {
  const doc = new (require('jsdom').JSDOM)(landing).window.document
  assert.equal(doc.querySelectorAll('#desktop, .desktop-btns, .document-links button[disabled]').length, 0)
  assert.doesNotMatch(landing, /به‌زودی|coming soon/i)
  assert.equal(doc.querySelectorAll('.credits-row a[href*="render.com"]').length, 0)
})

test('retired legal documents never render even if a stale CMS row is published', () => {
  const client = read('src/cms/client.ts')
  assert.match(client, /RETIRED_LEGAL_DOCS = new Set\(\['offices'\]\)/)
  assert.match(client, /if \(RETIRED_LEGAL_DOCS\.has\(row\.doc_type\)\) continue/)
  const { legalSeed } = load('src/cms/seed/legalContent.ts')
  assert.ok(!legalSeed.some(d => d.docType === 'offices'))
})

test('simulated-account and purchase-availability disclosures are kept', () => {
  const { legalSeed } = load('src/cms/seed/legalContent.ts')
  const simulated = legalSeed.find(d => d.docType === 'simulated-environment')
  assert.ok(simulated && /simulated trading environment/.test(simulated.paragraphs[0].en) && /شبیه‌سازی‌شده/.test(simulated.paragraphs[0].fa))
  /* the notice stays the default; CheckoutHost relabels it only when the backend reports payments enabled */
  const note = 'فعال‌سازی خرید در این نسخه فراهم نیست.'
  assert.ok(landing.includes(note))
  assert.match(faToEn[Object.keys(faToEn).find(k => k.startsWith(note))], /^Purchase activation is not available in this release\./)
  for (const l of ADDED) assert.match(dictionaries[l][faToEn[Object.keys(faToEn).find(k => k.startsWith(note))]], /\S/)
  const host = read('src/features/purchase/CheckoutHost.tsx')
  assert.match(host, /if \(!paymentsEnabled\) return\n    const relabel/)
})

test('text direction is RTL for fa/ar and LTR for en/ru/zh-CN, before and after hydration', () => {
  const { dirOf } = load('src/i18n/locales.ts')
  assert.deepEqual(LOCALES.map(dirOf), ['rtl', 'ltr', 'rtl', 'ltr', 'ltr'])
  const html = read('index.html')
  assert.match(html, /document\.documentElement\.dir=lang==='fa'\|\|lang==='ar'\?'rtl':'ltr'/)
  /* LTR technical labels inside RTL copy stay isolated */
  const doc = new (require('jsdom').JSDOM)(landing).window.document
  assert.ok([...doc.querySelectorAll('.brand > span')].every(s => s.getAttribute('dir') === 'ltr'))
})

test('SEO: indexable routes, sitemap and hreflang agree for every locale', async () => {
  const { PUBLIC_SITE_ROUTES, SITE_LOCALES, localesFor, sitemapXml, robotsTxt, siteOrigin } = await import('../../backend/seo.js')
  assert.deepEqual(SITE_LOCALES, LOCALES)
  const seo = read('src/features/loading/seoHead.ts')
  const pattern = new RegExp(seo.match(/const PUBLIC_ROUTES = \/(.*)\/\n/)[1])
  const routes = read('src/main.tsx')
  for (const route of PUBLIC_SITE_ROUTES) {
    for (const locale of LOCALES) assert.ok(pattern.test(`/${locale}/${route}`), `${route} is not indexable in seoHead.ts`)
    assert.ok(routes.includes(`path: '/:locale/${route}'`), `${route} has no React route`)
  }
  for (const route of ['prop/dashboard', 'perpetual/trade', 'governance/workspace']) assert.ok(!PUBLIC_SITE_ROUTES.includes(route))
  const xml = sitemapXml('https://example.test')
  const expected = PUBLIC_SITE_ROUTES.reduce((n, r) => n + localesFor(r).length, 0)
  assert.equal((xml.match(/<url>/g) || []).length, expected)
  for (const locale of LOCALES) assert.ok(xml.includes(`hreflang="${locale}" href="https://example.test/${locale}/home"`))
  assert.ok(xml.includes('hreflang="x-default" href="https://example.test/fa/home"'))
  assert.ok(!/\/prop\/|\/perpetual\//.test(xml))
  assert.match(robotsTxt('https://example.test'), /Sitemap: https:\/\/example\.test\/sitemap\.xml/)
  assert.equal(siteOrigin('evil.test\r\nx'), null)
  assert.equal(siteOrigin('openfi.cloud'), 'https://openfi.cloud')
})
