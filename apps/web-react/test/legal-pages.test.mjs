import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSync } from 'esbuild'

/* Terms of Use and Privacy Policy (ADR 0065): built-in copy in both source
   locales, routes registered everywhere a public page must be, no KYC. */
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const load = path => {
  const { outputFiles } = buildSync({ entryPoints: [new URL(`../${path}`, import.meta.url).pathname], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(() => ({}), module, module.exports)
  return module.exports
}
const { terms, privacy } = load('src/features/legal/content.ts')

test('both documents carry Persian and English for every heading and paragraph, with unique anchors', () => {
  for (const doc of [terms, privacy]) {
    const ids = doc.sections.map(s => s.id)
    assert.equal(new Set(ids).size, ids.length, doc.docType)
    for (const v of [doc.title, doc.intro, ...doc.sections.flatMap(s => [s.heading, ...s.paragraphs])]) {
      assert.ok(v.en.trim() && v.fa.trim(), JSON.stringify(v).slice(0, 80))
      assert.match(v.fa, /[؀-ۿ]/)
    }
    assert.match(doc.version, /^\d{4}-\d{2}-\d{2}$/)
  }
})

test('no KYC: the wallet owner is the account owner, no identity documents are asked for', () => {
  const kyc = terms.sections.find(s => s.id === 'no-kyc').paragraphs.map(p => p.en).join(' ')
  assert.match(kyc, /does not run KYC/)
  assert.match(terms.sections.find(s => s.id === 'wallet').paragraphs[0].en, /owner of the wallet is the owner of the account/)
  assert.match(privacy.sections[0].paragraphs[0].en, /never asks for your name, an identity document/)
  assert.match(terms.sections.find(s => s.id === 'ip').paragraphs[0].en, /owned by Openfund and published as open source/)
})

test('routes are registered in the router, the editorial registry, the SEO head, the sitemap and the footer', () => {
  for (const route of ['terms', 'privacy']) {
    assert.ok(read('src/main.tsx').includes(`path: '/:locale/${route}'`), route)
    assert.ok(read('src/cms/editorialRoutes.ts').includes(`'/:locale/${route}'`), route)
    assert.ok(read('../backend/seo.js').includes(`'${route}'`), route)
  }
  assert.match(read('src/features/loading/seoHead.ts'), /\|terms\|privacy/)
  assert.match(read('src/features/information/navigation.ts'), /'terms' as const, 'privacy' as const/)
})
