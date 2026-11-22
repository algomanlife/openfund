/* Direction-aware arrow primitive: one geometry, one mirroring rule, no
   glyphs in copy, and the legacy mechanisms are gone. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { buildSync } from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(root, '..', '..')
const read = path => readFileSync(join(repo, path), 'utf8')

function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [join(repo, path)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
}

test('arrow kinds, SVG markup and direction glyph fallback', async () => {
  const { ARROW_KINDS, ARROW_PATHS, MIRRORED, arrowSvg, arrowGlyph } = await load('apps/web-react/src/ui/arrows.ts')
  assert.deepEqual([...ARROW_KINDS], ['forward', 'back', 'forward-down', 'external', 'down', 'up'])
  assert.deepEqual([...MIRRORED].sort(), ['back', 'external', 'forward', 'forward-down'])
  for (const kind of ARROW_KINDS) {
    const svg = arrowSvg(kind)
    assert.match(svg, /^<svg class="of-arrow" data-arrow="[a-z-]+" viewBox="0 0 16 16"/)
    assert.match(svg, /aria-hidden="true" focusable="false"/)
    assert.ok(svg.includes(`d="${ARROW_PATHS[kind]}"`))
  }
  assert.equal(arrowGlyph('forward', 'ltr'), '→')
  assert.equal(arrowGlyph('forward', 'rtl'), '←')
  assert.equal(arrowGlyph('external', 'rtl'), '↖')
  assert.equal(arrowGlyph('down', 'rtl'), '↓')
})

test('mirroring follows the nearest dir attribute, never the language', () => {
  const css = read('apps/web-react/src/ui/dir-arrow.css')
  const H = String.raw`:is\(\[data-arrow='forward'\], \[data-arrow='back'\], \[data-arrow='forward-down'\], \[data-arrow='external'\]\)`
  assert.match(css, new RegExp(String.raw`\[dir='rtl'\] \.of-arrow${H},\n\[dir='rtl'\] \[dir='ltr'\] \[dir='rtl'\] \.of-arrow${H} \{\n  transform: scaleX\(-1\);`))
  assert.match(css, new RegExp(String.raw`\[dir='rtl'\] \[dir='ltr'\] \.of-arrow${H} \{\n  transform: none;`))
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(rules, /:dir\(|:lang\(|\[lang|data-lang|ofLang/)
  assert.doesNotMatch(rules, /data-arrow='(?:up|down)'/)
})

test('Backstage and Open Trade use the same geometry and stylesheet', async () => {
  const { ARROW_PATHS } = await load('apps/web-react/src/ui/arrows.ts')
  const backstage = await load('apps/backstage/operations/public/dir-arrow.js')
  const openTrade = await load('apps/open-trade/src/arrows.ts')
  assert.deepEqual(backstage.ARROW_PATHS, ARROW_PATHS)
  assert.deepEqual(openTrade.ARROW_PATHS, ARROW_PATHS)
  const css = read('apps/web-react/src/ui/dir-arrow.css')
  assert.equal(read('apps/backstage/operations/public/dir-arrow.css'), css)
  assert.equal(read('apps/open-trade/src/dir-arrow.css'), css)
  const landing = read('apps/web-react/src/pages/landing-body.html')
  for (const [, kind, d] of landing.matchAll(/data-arrow="([a-z-]+)"[^>]*><path d="([^"]+)"/g)) assert.equal(d, ARROW_PATHS[kind], `landing ${kind} arrow geometry`)
})

test('the language-based arrow swaps and ad-hoc mirror rules are gone', () => {
  assert.doesNotMatch(read('apps/web-react/src/pages/Landing.tsx'), /swapArrows|ARROW_MAP/)
  assert.doesNotMatch(read('apps/web-react/src/features/information/InformationShell.tsx'), /'←': '→'/)
  assert.doesNotMatch(read('apps/web-react/src/features/company/company.css'), /co-(?:cta span|help-arrow)\{transform:scaleX\(-1\)\}/)
  assert.doesNotMatch(read('apps/web-react/src/features/navigation/mega-menu.css'), /content:' [←→]'/)
})

test('no arrow glyph in copy, translations or CMS seeds', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts/check-arrow-glyphs.mjs')], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})

test('the glyph check fails on a new arrow in copy', async () => {
  const { findGlyphs } = await import('../scripts/check-arrow-glyphs.mjs')
  assert.deepEqual(findGlyphs(), [])
  const probe = join(root, 'src/ui/__arrow_probe__.ts')
  const { writeFileSync, rmSync } = await import('node:fs')
  writeFileSync(probe, "export const label = 'See markets →'\n// comment → ignored\nexport const key = 'Alt+Shift+→'\n")
  try {
    const hits = findGlyphs()
    assert.equal(hits.length, 1)
    assert.match(hits[0], /__arrow_probe__\.ts:1:/)
  } finally { rmSync(probe) }
})

test('the CMS migration strips only leading and trailing glyphs', () => {
  const script = join(repo, 'apps/backstage/scripts/strip_arrow_glyphs.py')
  assert.ok(existsSync(script))
  const code = `import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('m',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
print(json.dumps([m.strip_edges(v) for v in json.loads(sys.argv[2])],ensure_ascii=False))`
  const cases = ['See markets →', '← Governance', 'Entry → exit', 'Plain', '↗', 'Back to top ↑', null]
  const r = spawnSync('python3', ['-I', '-c', code, script, JSON.stringify(cases)], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.deepEqual(out, ['See markets', 'Governance', 'Entry → exit', 'Plain', '', 'Back to top', null])
  /* idempotent */
  const again = spawnSync('python3', ['-I', '-c', code, script, JSON.stringify(out)], { encoding: 'utf8' })
  assert.deepEqual(JSON.parse(again.stdout), out)
})
