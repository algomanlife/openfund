/* Dastkhat typography contract (static). The browser half that measures the
   rendered font, the font requests and the CSP lives in e2e/test-typography.mjs.
   No network, browser or database. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(web, '../..')
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
const FONT_DIR = 'apps/web-react/public/assets/fonts/dastkhat'
const source = JSON.parse(read(`${FONT_DIR}/SOURCE.json`))

/* Every stylesheet that sets a UI font family for an Openfund-owned surface.
   Directus Studio vendor code is deliberately absent. */
const OWNED_STYLES = [
  'apps/web-react/src/styles/design-system.css',
  'apps/web-react/public/legacy/style.css',
  'apps/web-react/public/legacy/terminal.css',
  'apps/web-react/src/features/terminal/terminal.css',
  'apps/web-react/src/features/terminal/workspace.css',
  'apps/web-react/src/features/purchase/purchase.css',
  'apps/web-react/src/features/information/information.css',
  'apps/web-react/src/features/ticker/ticker.css',
  'apps/web-react/src/pages/portfolio.css',
  'apps/web-react/src/session/session.css',
  'apps/backstage/operations/public/style.css',
  'apps/open-trade/src/style.css',
]
const OWNED_SCRIPTS = [
  'apps/web-react/public/legacy/share-card.js',
  'apps/web-react/public/legacy/vela-bridge.js',
  'packages/openfund-charts/src/vela-bridge.js',
  'apps/web-react/src/features/certificates/export.ts',
  'apps/backstage/operations/server.js',
  'apps/open-trade/scripts/prepare.mjs',
]
/* Font tokens copied into separate documents (legacy pages, the terminal
   iframe, Backstage) must stay identical to the design-system source. */
const TOKEN_COPIES = [
  'apps/web-react/public/legacy/style.css',
  'apps/web-react/public/legacy/terminal.css',
  'apps/backstage/operations/public/style.css',
]
const TOKENS = ['--ds-font-persian', '--ds-font-arabic', '--ds-font-latin', '--ds-font-cjk', '--ds-font-numeric']
const normalise = value => value.replace(/\s+/g, '').replace(/"/g, "'")
const tokensOf = css => Object.fromEntries(TOKENS.map(name => {
  const match = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  return [name, match && normalise(match[1])]
}))
const facesOf = css => [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => m[1])

test('pinned Dastkhat files are unmodified upstream copies with their licence', () => {
  assert.match(source.commit, /^[0-9a-f]{40}$/)
  assert.equal(source.license, 'OFL-1.1')
  assert.equal(source.upstream, 'https://github.com/dastyar-io/dastkhat-font')
  for (const [name, meta] of Object.entries(source.files)) {
    const bytes = fs.readFileSync(path.join(repo, FONT_DIR, name))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256, name)
    if (name.endsWith('.woff2')) assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', name)
  }
  const ofl = read(`${FONT_DIR}/OFL.txt`)
  assert.match(ofl, /SIL OPEN FONT LICENSE Version 1\.1/)
  assert.match(ofl, /Dastkhat Project Authors/)
  assert.match(read(`${FONT_DIR}/THIRD-PARTY-NOTICES.txt`), /Vazirmatn/)
})

test('third-party notices and licensing docs record the pinned revision', () => {
  for (const doc of ['THIRD_PARTY_NOTICES.md', 'docs/legal/LICENSING.md']) {
    const text = read(doc)
    assert.match(text, /Dastkhat/, doc)
    assert.ok(text.includes(source.commit.slice(0, 12)), `${doc} names commit ${source.commit.slice(0, 12)}`)
  }
})

test('the design system defines the font tokens with Dastkhat for Persian and Arabic', () => {
  const tokens = tokensOf(read('apps/web-react/src/styles/design-system.css'))
  assert.match(tokens['--ds-font-persian'], /^'Dastkhat',/)
  assert.match(tokens['--ds-font-arabic'], /^'Ubuntu','DastkhatArabic','Dastkhat',/)
  assert.match(tokens['--ds-font-latin'], /^'Ubuntu','Dastkhat',/)
  /* Latin, Cyrillic and CJK fallbacks stay in place */
  assert.match(tokens['--ds-font-persian'], /'Ubuntu'.*system-ui.*sans-serif$/)
  assert.match(tokens['--ds-font-cjk'], /'PingFangSC','MicrosoftYaHei','NotoSansSC'/)
  assert.match(tokens['--ds-font-numeric'], /^'Ubuntu',/)
})

test('separate documents carry identical copies of the font tokens', () => {
  const expected = tokensOf(read('apps/web-react/src/styles/design-system.css'))
  for (const file of TOKEN_COPIES) {
    const copy = tokensOf(read(file))
    for (const name of file.includes('backstage') ? ['--ds-font-persian'] : TOKENS)
      assert.equal(copy[name], expected[name], `${file} ${name}`)
  }
})

test('every Dastkhat @font-face is a same-origin variable WOFF2 at the pinned path', () => {
  const files = new Set(Object.keys(source.files).filter(name => name.endsWith('.woff2')))
  let count = 0
  for (const file of OWNED_STYLES) {
    for (const face of facesOf(read(file)).filter(face => /Dastkhat/.test(face))) {
      count += 1
      const url = face.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/)[1]
      assert.doesNotMatch(url, /^(https?:)?\/\//, `${file}: fonts are self-hosted`)
      assert.match(url, /(^|\/|\.\.\/)assets\/fonts\/dastkhat\/[A-Za-z-]+\.woff2$/, `${file}: ${url}`)
      assert.ok(files.has(path.basename(url)), `${file}: ${url} is a pinned file`)
      assert.match(face, /format\(['"]woff2['"]\)/, file)
      assert.match(face, /font-weight:\s*100 900/, `${file}: variable weight range`)
      assert.match(face, /font-display:\s*swap/, file)
    }
  }
  assert.ok(count >= 6, `expected Dastkhat faces in the owned stylesheets, found ${count}`)
})

test('the replaced Persian faces are no longer UI defaults', () => {
  for (const file of [...OWNED_STYLES, ...OWNED_SCRIPTS]) {
    const text = read(file)
    assert.doesNotMatch(text, /Irancell|irancell-\d00|openfund-persian-\d00|Openfund Persian|persian\.woff2/, file)
    assert.doesNotMatch(text, /font-family:\s*['"]?Vazirmatn|Vazirmatn\.ttf/, file)
  }
  for (const file of OWNED_STYLES)
    assert.doesNotMatch(read(file), /font-family\s*:\s*['"]?Tahoma/, `${file}: Tahoma is never the first choice`)
})

test('canvas surfaces name Dastkhat for Persian glyphs', () => {
  assert.match(read('apps/web-react/public/legacy/share-card.js'), /var FONT = "Ubuntu, Dastkhat,/)
  assert.match(read('packages/openfund-charts/src/vela-bridge.js'), /fontFamily: "Ubuntu, 'Dastkhat', system-ui, sans-serif"/)
  assert.equal(read('apps/web-react/public/legacy/vela-bridge.js'), read('packages/openfund-charts/src/vela-bridge.js'))
  assert.match(read('apps/web-react/src/features/certificates/export.ts'), /assets\/fonts\/dastkhat\/Dastkhat-Variable\.woff2/)
})

test('Backstage and Open Trade reach the same files from their own origin', () => {
  const backstage = read('apps/backstage/operations/server.js')
  assert.match(backstage, /'\/assets\/fonts\/dastkhat\/Dastkhat-Variable\.woff2': \['\.\.\/\.\.\/web-react\/public\/assets\/fonts\/dastkhat\/Dastkhat-Variable\.woff2', 'font\/woff2'\]/)
  assert.match(backstage, /font-src 'self'/)
  assert.match(read('apps/backstage/operations/public/style.css'), /:root\[lang=fa\]\{font-family:var\(--ds-font-persian\)\}/)
  const prepare = read('apps/open-trade/scripts/prepare.mjs')
  assert.match(prepare, /cp\(web \+ "assets\/fonts\/dastkhat", "public\/assets\/fonts\/dastkhat"/)
  assert.match(read('apps/open-trade/electron/main.ts'), /font-src 'self'/)
})

test('technical numbers stay isolated LTR with tabular digits', () => {
  const ds = read('apps/web-react/src/styles/design-system.css')
  assert.match(ds, /\.ds-num \{ font-family: var\(--ds-font-numeric\); font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; \}/)
  const legacy = read('apps/web-react/public/legacy/style.css')
  assert.match(legacy, /\.numeric\{[^}]*direction:ltr;unicode-bidi:isolate\}/)
  assert.match(legacy, /\.numeric\{font-variant-numeric:tabular-nums\}/)
})
