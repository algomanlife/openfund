/* Regression tests for the README, retired-registry and font gates
   (scripts/docs/check-readme.mjs, check-retired.mjs, check-fonts.mjs).
   Each gate must pass on a clean fixture and fail on a planted regression.
   Node built-ins and git only; no network. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const gate = name => path.join(repo, 'scripts/docs', name)
const run = (script, cwd, ...args) => spawnSync(process.execPath, [gate(script), ...args], { cwd, env: { ...process.env, DOCS_ROOT: cwd }, encoding: 'utf8' })
function gitFixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfund-gate-'))
  for (const [f, content] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), content) }
  execFileSync('git', ['init', '-q'], { cwd: dir }); execFileSync('git', ['add', '-A'], { cwd: dir })
  return dir
}

/* ---------- font gate ---------- */
const DASTKHAT_CSS = "@font-face { font-family: 'Dastkhat'; src: url('Dastkhat-Variable.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }\n"
test('font gate passes when only Ubuntu and the shared Dastkhat file declare faces', () => {
  const dir = gitFixture({
    'apps/web-react/public/assets/fonts/dastkhat/dastkhat.css': DASTKHAT_CSS,
    'apps/site.css': "@import url(fonts/dastkhat.css);@font-face{font-family:'Ubuntu';src:url(u.ttf)}body{font-family:'Dastkhat','Ubuntu',sans-serif}",
    'docs/note.md': 'Dastkhat is based on Vazirmatn; the Irancell files were removed.',
  })
  const r = run('check-fonts.mjs', dir)
  assert.equal(r.status, 0, r.stderr)
})
for (const [name, files, expected] of [
  ['a retired font file', { 'dist/assets/irancell-400.ttf': 'x' }, /retired font file is present/],
  ['a retired face in font-family', { 'a.css': 'body{font-family:Vazirmatn,sans-serif}' }, /retired face in a font context/],
  ['a canvas font naming Irancell', { 'a.js': "ctx.font = '12px Irancell'" }, /retired face in a font context/],
  ['a retired asset URL', { 'a.html': '<link rel="preload" href="assets/openfund-persian-400-v4.woff2">' }, /references retired font asset/],
  ['a foreign @font-face family', { 'a.css': "@font-face{font-family:'Inter';src:url(i.woff2)}" }, /only Ubuntu and Dastkhat/],
  ['a Persian @font-face outside dastkhat.css', { 'a.css': DASTKHAT_CSS }, /outside dastkhat\.css/],
  ['a foreign FontFace', { 'a.ts': "new FontFace('OpenfundCertificateFa', 'url(x)')" }, /FontFace "OpenfundCertificateFa"/],
]) test(`font gate fails on ${name}`, () => {
  const r = run('check-fonts.mjs', gitFixture(files))
  assert.equal(r.status, 1); assert.match(r.stderr, expected)
})

/* ---------- retired gate ---------- */
const registry = status => JSON.stringify({ schemaVersion: 1, updatedAt: '2026-11-21', statuses: { retired: 'Removed.', 'legacy-only pending removal': 'Kept.', dormant: 'Not built.' },
  historical: { paths: ['^CHANGELOG\\.md$'] },
  items: [{ id: 'old-font', item: 'Old font', kind: 'font', status, retiredSince: '2026-11-21', replacement: 'New font', gate: { files: ['(^|/)old\\.ttf$'], text: ['old\\.ttf'], notice: '^Old font', scope: 'active' } }] })
const retiredFixture = (extra = {}, status = 'retired') => gitFixture({
  'docs/development/RETIRED.json': registry(status),
  'THIRD_PARTY_NOTICES.md': '| Component | License | Text |\n| --- | --- | --- |\n| New font | OFL | x |\n',
  'README.md': '# T\n\n## Retired and no longer used\n\n<!-- retired:summary -->\n<!-- /retired:summary -->\n',
  'CHANGELOG.md': 'Removed old.ttf.\n', ...extra,
})
test('retired gate renders its outputs and passes with zero active references', () => {
  const dir = retiredFixture()
  assert.equal(run('check-retired.mjs', dir, '--write').status, 0)
  const r = run('check-retired.mjs', dir)
  assert.equal(r.status, 0, r.stderr)
  assert.match(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), /\| Old font \| retired \| New font \|/)
  assert.match(fs.readFileSync(path.join(dir, 'docs/development/RETIRED.md'), 'utf8'), /\| Old font \| font \| retired \| 2026-11-21 \| New font \| 0 \|/)
})
test('retired gate fails while a retired item is referenced or its file exists', () => {
  const dir = retiredFixture({ 'src/a.css': "src:url(old.ttf)", 'assets/old.ttf': 'x' })
  run('check-retired.mjs', dir, '--write')
  const r = run('check-retired.mjs', dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /src\/a\.css:1/); assert.match(r.stderr, /assets\/old\.ttf: file present/)
})
test('retired gate fails when the active license table still lists a retired component', () => {
  const dir = retiredFixture({ 'THIRD_PARTY_NOTICES.md': '| Component | License | Text |\n| --- | --- | --- |\n| Old font files | OFL | x |\n' })
  run('check-retired.mjs', dir, '--write')
  assert.match(run('check-retired.mjs', dir).stderr, /active license table lists retired "old-font"/)
})
test('legacy-only items are counted, not gated', () => {
  const dir = retiredFixture({ 'src/a.css': 'old.ttf' }, 'legacy-only pending removal')
  run('check-retired.mjs', dir, '--write')
  assert.equal(run('check-retired.mjs', dir).status, 0)
})
test('retired gate fails on a stale generated page', () => {
  const dir = retiredFixture()
  assert.match(run('check-retired.mjs', dir).stderr, /out of date/)
})

/* ---------- README gate (against the real README in a linked copy) ---------- */
function readmeFixture(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfund-readme-'))
  for (const entry of fs.readdirSync(repo)) if (!['README.md', '.git', 'node_modules'].includes(entry)) fs.symlinkSync(path.join(repo, entry), path.join(dir, entry))
  fs.writeFileSync(path.join(dir, 'README.md'), mutate(fs.readFileSync(path.join(repo, 'README.md'), 'utf8')))
  return dir
}
test('the committed README satisfies its contract', () => {
  const r = run('check-readme.mjs', readmeFixture(s => s))
  assert.equal(r.status, 0, r.stderr)
})
for (const [name, mutate, expected] of [
  ['sections out of order', s => s.replace('/> Security\n', '/> Securityx\n').replace('/> License\n', '/> Security\n').replace('/> Securityx\n', '/> License\n'), /sections must be exactly/],
  ['an orphan heading before the first section', s => s.replace('<a name="overview"></a>', '### Payments\n\nx\n\n<a name="overview"></a>'), /orphan heading/],
  ['a stale version', s => s.replace('Openfund is early-stage.', 'Since v0.6.5 Openfund is early-stage.'), /v0\.6\.5 is not the latest official release|platform version numbers/],
  ['a dated gallery heading', s => s.replace('<a name="business"></a>', '### Captures — 2026-11-20\n\nx\n\n<a name="business"></a>'), /dated heading/],
  ['a section heading without its icon', s => s.replace(/^## <img[^\n]*\/> Security$/m, '## Security'), /must use its icon heading/],
  ['a section without its anchor', s => s.replace('<a name="roadmap"></a>', ''), /must be preceded by <a name="roadmap">/],
  ['a gutted section', s => s.replace(/(## <img[^\n]*\/> Roadmap\n)[\s\S]*?(<a name="security">)/, '$1\n$2'), /nearly empty/],
  ['a README stripped of graphics', s => s.replace(/<img [^>]*>/g, ''), /must stay graphical|out of date/],
  ['a missing banner', s => s.replace('docs/assets/graphics/hero.svg', 'docs/assets/graphics/ecosystem.svg'), /title block must show/],
  ['font names outside Technology stack', s => s.replace('Openfund sells one-time', 'Persian uses Dastkhat. Openfund sells one-time'), /typography policy/],
  ['a dropped single-source link', s => s.replace('[business model in detail](docs/economy/BUSINESS_DETAIL.md)', 'business model in detail'), /must link docs\/economy\/BUSINESS_DETAIL\.md/],
  ['a broken link', s => s.replace('(docs/README.md)', '(docs/MISSING.md)'), /broken link/],
  ['a hand-edited generated block', s => s.replace('<!-- /license:summary -->', '| Extra | MIT |\n<!-- /license:summary -->'), /out of date/],
  ['a hand-edited product card block', s => s.replace('<!-- /products -->', 'extra\n<!-- /products -->'), /out of date/],
]) test(`README gate fails on ${name}`, () => {
  const r = run('check-readme.mjs', readmeFixture(mutate))
  assert.equal(r.status, 1, 'expected failure'); assert.match(r.stderr, expected)
})

/* ---------- docs-impact gate (merge rule) ---------- */
import { check as impact } from '../check-docs-impact.mjs'
test('docs-impact passes when product code ships with its record', () => {
  assert.equal(impact(['apps/web-react/src/features/x.tsx', 'CHANGELOG.md']).ok, true)
  assert.equal(impact(['apps/backend/src/a.test.mjs', 'apps/web-react/package-lock.json']).ok, true)
  assert.equal(impact(['docs/readme/products.json', 'README.md']).ok, true)
})
for (const [name, files, expected] of [
  ['product code without a record', ['apps/backend/src/payments.mjs'], /product code changed/],
  ['a screenshot without provenance', ['docs/assets/screenshots/x.png', 'CHANGELOG.md'], /screenshots changed/],
  ['infrastructure without deployment docs', ['render.yaml'], /deployment and infrastructure/],
  ['README data without a regenerated README', ['docs/readme/features.json'], /README data changed/],
]) test(`docs-impact fails on ${name}`, () => {
  const r = impact(files)
  assert.equal(r.ok, false); assert.match(r.problems.join('\n'), expected)
})
test('docs-impact honours a declared exemption and bot authors', () => {
  assert.equal(impact(['apps/backend/src/x.mjs'], { body: '## Documentation\nDocs-impact: none — internal refactor, no behavior change' }).ok, true)
  assert.equal(impact(['apps/backend/src/x.mjs'], { body: 'Docs-impact: none' }).ok, false)
  assert.equal(impact(['apps/backend/src/x.mjs'], { author: 'dependabot[bot]' }).ok, true)
})

/* ---------- developer-docs merge rule ---------- */
test('developer-docs rule: developer-facing changes need docs/developer-portal/', () => {
  for (const f of ['apps/web-react/src/main.tsx', 'apps/backend/purchases.js', 'apps/backend/schema.sql', 'render.yaml', '.env.example', 'apps/backend/package.json', '.github/workflows/ci.yml', 'scripts/release/build.mjs', 'apps/open-trade/src/main.tsx']) {
    const r = impact([f, 'CHANGELOG.md'])
    assert.equal(r.ok, false, f)
    assert.match(r.problems.join(' '), /developer-portal/, f)
    assert.equal(impact([f, 'CHANGELOG.md', 'docs/developer-portal/sections.json']).ok, true, f)
  }
})
test('developer-docs rule ignores tests, lockfiles and unrelated product code', () => {
  assert.equal(impact(['apps/backend/test/purchases.test.mjs', 'apps/backend/package-lock.json', 'apps/web-react/src/features/x.tsx', 'CHANGELOG.md']).ok, true)
  assert.equal(impact(['apps/open-trade/README.md', 'CHANGELOG.md']).ok, true)
})
test('developer-docs rule: only its own declaration exempts it', () => {
  assert.equal(impact(['apps/backend/purchases.js', 'CHANGELOG.md'], { body: 'Developer-docs: none — internal helper, no API or behavior change' }).ok, true)
  assert.equal(impact(['apps/backend/purchases.js'], { body: 'Docs-impact: none — internal refactor, no behavior change' }).ok, false)
  assert.equal(impact(['apps/backend/purchases.js'], { body: 'Docs-impact: none — internal refactor, no behavior change\nDeveloper-docs: none — internal refactor, no behavior change' }).ok, true)
  assert.equal(impact(['apps/backend/purchases.js', 'CHANGELOG.md'], { body: 'Developer-docs: none' }).ok, false)
  assert.equal(impact(['apps/backend/purchases.js'], { author: 'dependabot[bot]' }).ok, true)
})
