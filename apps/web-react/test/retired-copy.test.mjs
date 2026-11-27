/* ADR 0059 attribution update: Directus rows still holding a retired default
   are shown as the current default, and no source still ships a retired one. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const load = path => {
  const { outputFiles } = buildSync({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, platform: 'node', format: 'cjs', write: false })
  const module = { exports: {} }; new Function('module', 'exports', outputFiles[0].text)(module, module.exports); return module.exports
}
const { RETIRED_COPY, supersedeRetired } = load('../src/cms/retiredCopy.ts')
const files = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|html|json)$/.test(name) && !p.endsWith('retiredCopy.ts') && !p.includes('i18n/content') ? [p] : [] })
const sources = files(new URL('../src', import.meta.url).pathname).map(p => readFileSync(p, 'utf8')).join('\n')

test('exact retired defaults are replaced anywhere in a CMS response; edited text is untouched', () => {
  const [old, current] = [...RETIRED_COPY][0]
  assert.deepEqual(supersedeRetired({ data: [{ translations: [{ description: old }, { description: old + ' edited' }] }], n: 1, x: null }),
    { data: [{ translations: [{ description: current }, { description: old + ' edited' }] }], n: 1, x: null })
})

test('no source ships a retired default and every replacement is a current default', () => {
  const stale = [...RETIRED_COPY.keys()].filter(old => sources.includes(old))
  assert.deepEqual(stale, [])
  const flat = sources.replace(/\\'/g, "'")
  const missing = [...RETIRED_COPY.values()].filter(current => !flat.includes(current))
  assert.deepEqual(missing, [])
})
