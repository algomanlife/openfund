/**
 * Brand wordmark: one source of truth (src/brand/wordmark.ts) for the text
 * beside the logo mark. Legacy templates carry the token and never a
 * hard-coded wordmark; React components render BrandWordmark; the share card
 * reads the injected value; no stylesheet transforms the wordmark's case.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL('../src/brand/wordmark.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false })
const mod = { exports: {} }; new Function('module', 'exports', 'require', outputFiles[0].text)(mod, mod.exports, require)
const { BRAND_WORDMARK, BRAND_WORDMARK_TOKEN, withBrandWordmark } = mod.exports

test('the wordmark constant is OpenFi and replaces every template token', () => {
  assert.equal(BRAND_WORDMARK, 'OpenFi')
  assert.equal(withBrandWordmark(`<b>${BRAND_WORDMARK_TOKEN}</b><i aria-label="${BRAND_WORDMARK_TOKEN}"></i>`), '<b>OpenFi</b><i aria-label="OpenFi"></i>')
})

test('legacy templates use the token, never a hard-coded wordmark', () => {
  const expected = { 'landing-body.html': 5, 'portfolio-body.html': 1, 'terminal-body.html': 1 }
  for (const [file, count] of Object.entries(expected)) {
    const html = read(`../src/pages/${file}`)
    assert.doesNotMatch(html, />openfund</i, file)
    assert.doesNotMatch(html, /brand-word(?:mark)?[^>]*>openfund/i, file)
    assert.equal(html.split(BRAND_WORDMARK_TOKEN).length - 1, count, file)
    /* the visible caption is aria-hidden, so the link's name is the wordmark itself;
       an aria-label would not match the visible text (axe label-content-name-mismatch) */
    assert.doesNotMatch(html, /class="brand"[^>]*aria-label/, file)
  }
})

test('React wordmarks render BrandWordmark and every template consumer injects the value', () => {
  for (const file of ['features/terminal/TerminalShell.tsx', 'features/terminal/TerminalMenu.tsx', 'features/navigation/SiteNavDrawer.tsx']) {
    const source = read(`../src/${file}`)
    assert.match(source, /<BrandWordmark\b/, file)
    assert.doesNotMatch(source, />openfund</i, file)
  }
  for (const file of ['pages/Landing.tsx', 'pages/Terminal.tsx', 'pages/Portfolio.tsx', 'features/information/InformationShell.tsx', 'features/terminal/TradingPages.tsx'])
    assert.match(read(`../src/${file}`), /withBrandWordmark\(/, file)
  assert.match(read('../src/features/terminal/TradingPages.tsx'), /data-brand-wordmark="\$\{BRAND_WORDMARK\}"/)
  const card = read('../public/legacy/share-card.js')
  assert.match(card, /getAttribute\('data-brand-wordmark'\)/)
  assert.doesNotMatch(card, /'openfund'\s*,\s*wf|measure\('openfund'/)
})

test('no stylesheet lowercases or uppercases the wordmark', () => {
  for (const file of ['../public/legacy/style.css', '../public/legacy/terminal.css', '../src/brand/wordmark.css']) {
    const css = read(file)
    for (const rule of css.match(/[^{}]*(?:brand-wordmark|brand-word|\.brand>span|of-brand b)[^{}]*\{[^}]*\}/g) || [])
      assert.doesNotMatch(rule, /text-transform:\s*(?:lowercase|uppercase|capitalize)/, `${file}: ${rule}`)
  }
})
