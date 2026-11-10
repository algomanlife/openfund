/**
 * Openfund Whitepaper v1.0: content completeness in both languages, block
 * schema validation, CMS round trip (seed rows → public parser), rejection
 * of unsafe or incomplete CMS editions, chart arithmetic, catalog-derived
 * pricing, status discipline and the activated footer link.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { buildSync } from 'esbuild'
const require = createRequire(import.meta.url)

function load(path, extra = {}) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, logLevel: 'silent', ...extra })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}

const { bundledWhitepaper } = load('../src/cms/seed/whitepaper/index.ts')
const { validateBlocks, pairBlocks, localizeBlock, safeUrl, BLOCK_SCHEMA } = load('../src/cms/whitepaper/schema.ts')
const { parseDocument, parseChapters, parseDatasets, parseReferences, datasetKeys, referenceKeys, REQUIRED_CHAPTERS } = load('../src/cms/whitepaper/client.ts')
const { documentRow, chapterRow, datasetRow, referenceRow } = load('../src/cms/whitepaper/directus.ts')
const { waterfallRows } = load('../src/features/whitepaper/charts.tsx')
const { challengePlans } = load('../src/data/challengePlans.ts')

const paper = bundledWhitepaper
const clone = value => JSON.parse(JSON.stringify(value))

test('the edition has twenty ordered chapters with unique, URL-safe anchors', () => {
  assert.equal(paper.chapters.length, 20)
  const slugs = paper.chapters.map(c => c.slug)
  assert.equal(new Set(slugs).size, slugs.length)
  for (const slug of slugs) assert.match(slug, /^[a-z0-9][a-z0-9-]*$/)
  assert.deepEqual(paper.chapters.map(c => c.sort), [...paper.chapters.map(c => c.sort)].sort((a, b) => a - b))
  for (const required of REQUIRED_CHAPTERS) assert.ok(slugs.includes(required), required)
  for (const required of ['introduction', 'architecture', 'prop-evaluation', 'economics', 'treasury-transparency', 'partner-programs', 'live-market-access', 'roadmap', 'disclosures']) assert.ok(slugs.includes(required), required)
})

test('every chapter and block is complete in Persian and English', () => {
  const doc = paper.document
  for (const key of ['title', 'subtitle', 'abstract', 'seoTitle', 'seoDescription']) {
    assert.ok(doc[key].fa.trim() && doc[key].en.trim(), key)
  }
  for (const chapter of paper.chapters) {
    for (const key of ['kicker', 'title', 'summary']) assert.ok(chapter[key].fa.trim() && chapter[key].en.trim(), `${chapter.slug}.${key}`)
    assert.deepEqual(validateBlocks(chapter.blocks), [], chapter.slug)
    assert.ok(chapter.blocks.length >= 2, chapter.slug)
  }
})

test('Persian copy is Persian and English copy is not', () => {
  const persian = /[؀-ۿ]/
  for (const chapter of paper.chapters) {
    assert.match(chapter.title.fa, persian, chapter.slug)
    assert.doesNotMatch(chapter.title.en, persian, chapter.slug)
  }
})

test('every chart and reference used by the text exists, and every reference is https with an access date', () => {
  for (const key of datasetKeys(paper.chapters)) assert.ok(paper.datasets.some(d => d.key === key), key)
  const refKeys = new Set(paper.references.map(r => r.key))
  for (const key of referenceKeys(paper.chapters, paper.datasets)) assert.ok(refKeys.has(key), key)
  for (const ref of paper.references) {
    assert.equal(new URL(ref.url).protocol, 'https:', ref.key)
    assert.match(ref.accessed, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(ref.note.fa && ref.note.en, ref.key)
  }
  /* the References chapter lists every reference exactly once */
  const bibliography = paper.chapters.find(c => c.slug === 'references').blocks.find(b => b.type === 'refs').keys
  assert.deepEqual([...bibliography].sort(), [...refKeys].sort())
})

test('waterfall subtotals equal the running sum of their dataset', () => {
  for (const dataset of paper.datasets.filter(d => d.kind === 'waterfall')) {
    const rows = waterfallRows(dataset.points)
    dataset.points.forEach((point, i) => {
      if (point.role === 'subtotal') assert.equal(rows[i].value, point.value, `${dataset.key}.${point.key}`)
    })
  }
  const scenario = paper.datasets.find(d => d.key === 'scenario-1m')
  const byKey = Object.fromEntries(scenario.points.map(p => [p.key, p.value]))
  assert.equal(byKey.gross, 1_000_000)
  assert.equal(-byKey['trader-rewards'] / byKey.gross, 0.56)
  assert.equal(byKey['after-rewards'], 440_000)
  assert.equal(paper.datasets.find(d => d.key === 'capital-position').points.at(-1).value, 500_000)
})

test('interactive overrides recompute every downstream subtotal', () => {
  const scenario = paper.datasets.find(d => d.key === 'scenario-1m')
  const rows = waterfallRows(scenario.points, { 'trader-rewards': 700_000 })
  assert.equal(rows.find(r => r.key === 'after-rewards').value, 300_000)
  assert.equal(rows.at(-1).value, 300_000 - 20_000 - 30_000 - 110_000 - 140_000)
})

test('profit-share tiers keep the coach at exactly 10% and sum to 100%', () => {
  const tiers = paper.datasets.find(d => d.key === 'live-split-tiers')
  assert.deepEqual(tiers.segments.map(s => s.key), ['trader', 'coach', 'openfund'])
  for (const point of tiers.points) {
    assert.equal(point.values[1], 10)
    assert.equal(point.values.reduce((a, b) => a + b, 0), 100)
  }
  assert.deepEqual(tiers.points.map(p => p.values[0]), [70, 80, 85])
})

test('prices are never typed into the text: the pricing block reads the catalog', () => {
  const blocks = paper.chapters.flatMap(c => c.blocks)
  assert.equal(blocks.filter(b => b.type === 'pricing').length, 1)
  const prices = challengePlans.flatMap(p => Object.values(p.priceUsd)).filter(v => v > 0)
  const text = JSON.stringify(paper.chapters)
  for (const price of prices) assert.doesNotMatch(text, new RegExp(`\\$${price}(?![\\d,])`), `hardcoded price $${price}`)
})

test('policy statements match the approved economy decisions', () => {
  const text = JSON.stringify(paper.chapters.map(c => c.blocks)).toLowerCase()
  for (const phrase of ['50,000 followers', '10% of the confirmed net amount', 'first eligible purchase', 'at least 10 verified', 'exactly twice', 'at least 5 verified', '$500,000', '10% of distributable realized live profit']) {
    assert.ok(text.includes(phrase.toLowerCase()), phrase)
  }
  /* no fabricated claims */
  for (const banned of ['guaranteed profit', 'audited by', 'licensed by', 'regulated by', 'token sale', 'airdrop']) {
    assert.ok(!text.includes(banned), banned)
  }
})

test('live execution and the protocol are never labelled live', () => {
  const statusOf = title => paper.chapters.flatMap(c => c.blocks).flatMap(b => b.type === 'features' ? b.items : b.type === 'flow' ? b.steps : b.type === 'architecture' ? b.layers.flatMap(l => l.nodes) : [])
    .filter(item => item.title.en.toLowerCase().includes(title)).map(item => item.status)
  for (const title of ['live market access execution', 'openfund protocol', 'live order routing']) {
    const statuses = statusOf(title)
    assert.ok(statuses.length, title)
    assert.ok(statuses.every(s => s === 'planned'), `${title}: ${statuses}`)
  }
})

test('seeded Directus rows parse back to the same edition (CMS round trip)', () => {
  const doc = parseDocument(documentRow(paper.document))
  assert.deepEqual(doc, paper.document)
  const chapters = parseChapters(paper.chapters.map(c => chapterRow(c, 1)))
  assert.deepEqual(chapters, paper.chapters)
  const datasets = parseDatasets(paper.datasets.map((d, i) => datasetRow(d, i)))
  assert.deepEqual(clone(datasets), clone(paper.datasets.map(d => ({ ...d, sources: d.sources || [] }))))
  const references = parseReferences(paper.references.map(r => referenceRow(r)))
  assert.deepEqual(clone(references), clone(paper.references))
})

test('an incomplete or unsafe CMS edition is rejected, never partially rendered', () => {
  const rows = paper.chapters.map(c => chapterRow(c, 1))
  /* a missing English translation */
  const missing = clone(rows); missing[0].translations = missing[0].translations.filter(t => t.language_code === 'fa')
  assert.equal(parseChapters(missing), null)
  /* the disclosures chapter removed */
  assert.equal(parseChapters(rows.filter(r => r.slug !== 'disclosures')), null)
  /* an unknown block type */
  const unknown = clone(rows); unknown[1].translations.forEach(t => t.blocks.push({ type: 'html', text: '<script>alert(1)</script>' }))
  assert.equal(parseChapters(unknown), null)
  /* locales disagreeing on a status (non-localized value) */
  const status = clone(rows); const fa = status[4].translations.find(t => t.language_code === 'fa')
  fa.blocks.find(b => b.type === 'features').items[0].status = 'live'
  fa.blocks.find(b => b.type === 'features').items[0].status = 'bogus'
  assert.equal(parseChapters(status), null)
  /* a non-https reference */
  const refs = paper.references.map(r => referenceRow(r)); refs[0].url = 'javascript:alert(1)'
  assert.equal(parseReferences(refs), null)
  /* a non-numeric chart value */
  const ds = paper.datasets.map((d, i) => datasetRow(d, i)); ds[0].data.points[0].value = 'a lot'
  assert.equal(parseDatasets(ds), null)
})

test('image URLs are allow-listed', () => {
  for (const ok of ['/fa/whitepaper', 'assets/mark-mint.svg', 'https://example.org/a.png']) assert.equal(safeUrl(ok), true, ok)
  for (const bad of ['javascript:alert(1)', '//evil.example/x.png', 'data:image/svg+xml,<svg/>', 'http://example.org/a.png']) assert.equal(safeUrl(bad), false, bad)
  const image = { type: 'image', src: 'javascript:alert(1)', alt: { fa: 'x', en: 'x' } }
  assert.equal(pairBlocks([localizeBlock(image, 'fa')], [localizeBlock(image, 'en')]), null)
})

test('every block type the renderer supports has a schema', () => {
  const source = readFileSync(new URL('../src/features/whitepaper/blocks.tsx', import.meta.url), 'utf8')
  for (const type of Object.keys(BLOCK_SCHEMA)) assert.ok(source.includes(`case '${type}'`), type)
})

test('the footer Whitepaper link is active, locale-aware and has no /react prefix', () => {
  const html = readFileSync(new URL('../src/pages/landing-body.html', import.meta.url), 'utf8')
  assert.ok(!html.includes('دریافت وایت‌پیپر · به‌زودی'), 'the disabled placeholder is gone')
  assert.equal((html.match(/data-doc-link="whitepaper"/g) || []).length, 1, 'exactly one whitepaper link')
  const { JSDOM } = require('jsdom')
  const { renderNavigation } = load('../src/features/information/navigation.ts', { loader: { '.zip': 'dataurl' } })
  for (const [locale, label] of [['fa', 'مطالعهٔ وایت‌پیپر'], ['en', 'Read the whitepaper'], ['ar', 'اقرأ الورقة البيضاء']]) {
    const dom = new JSDOM(`<footer>${html.match(/<div class="document-links">[\s\S]*?<\/div>/)[0]}</footer>`)
    globalThis.document = dom.window.document
    renderNavigation(dom.window.document, locale, `/${locale}/whitepaper`, null, null)
    const link = dom.window.document.querySelector('a[data-doc-link="whitepaper"]')
    assert.equal(link.getAttribute('href'), `/${locale}/whitepaper`)
    assert.equal(link.textContent, label)
    assert.equal(link.getAttribute('aria-current'), 'page')
    /* no disabled "coming soon" placeholder documents are published */
    assert.equal(dom.window.document.querySelectorAll('.document-links button[disabled]').length, 0)
    dom.window.close()
  }
})

test('the whitepaper route is registered, indexable and public', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
  assert.match(main, /path: '\/:locale\/whitepaper', element: <Suspense fallback=\{null\}><Whitepaper \/><\/Suspense>/)
  const seo = readFileSync(new URL('../src/features/loading/seoHead.ts', import.meta.url), 'utf8')
  assert.match(seo, /\|whitepaper\)/)
})
