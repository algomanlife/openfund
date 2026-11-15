/* Trade Radar + Heatmap: layout maths, routing, isolation and honest labelling. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { buildSync } from 'esbuild'

const load = entry => {
  const output = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
  const module = { exports: {} }; new Function('module', 'exports', output)(module, module.exports)
  return module.exports
}

test('squarified treemap fills the box with areas proportional to value', () => {
  const { squarify } = load('src/features/radar/treemap.ts')
  const items = [{ value: 6 }, { value: 6 }, { value: 4 }, { value: 3 }, { value: 2 }, { value: 2 }, { value: 1 }, { value: 0 }, { value: -5 }]
  const out = squarify(items, { x: 0, y: 0, w: 600, h: 400 })
  assert.equal(out.length, 7, 'non-positive values are dropped')
  const total = 24, area = 600 * 400
  for (const { item, rect } of out) {
    assert.ok(Math.abs(rect.w * rect.h - (item.value / total) * area) < 1e-6)
    assert.ok(rect.x >= -1e-9 && rect.y >= -1e-9 && rect.x + rect.w <= 600 + 1e-9 && rect.y + rect.h <= 400 + 1e-9)
  }
  assert.deepEqual(squarify([{ value: 1 }], { x: 0, y: 0, w: 0, h: 10 }), [])
})

test('Radar and Heatmap are lazy routes beside the chart in both products', () => {
  const main = readFileSync('src/main.tsx', 'utf8')
  assert.match(main, /const RadarPage = lazy\(\(\) => import\('\.\/features\/radar\/RadarPage'\)\)/)
  assert.match(main, /const HeatmapPage = lazy\(\(\) => import\('\.\/features\/radar\/HeatmapPage'\)\)/)
  assert.match(main, /\{ path: 'chart', element: <SharedTradingTerminal \/> \},\n.*\n\s+\{ path: 'radar'/)
  const model = readFileSync('src/features/terminal/model.ts', 'utf8')
  assert.equal((model.match(/\["chart", "چارت", "Chart"\],\n\s+\["radar", "رادار معاملات", "Trade Radar"\],\n\s+\["heatmap", "نقشه حرارتی بازار", "Heatmap"\]/g) || []).length, 2)
  assert.match(readFileSync('src/features/terminal/TerminalShell.tsx', 'utf8'), /TOP_LEVEL = \["dashboard", "trade", "chart", "radar", "heatmap", "portfolio"\]/)
})

test('modules stay read-only and isolated from trading, wallet and engine code', () => {
  for (const file of ['src/features/radar/RadarPage.tsx', 'src/features/radar/HeatmapPage.tsx', 'src/features/radar/radarData.ts']) {
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /method:\s*['"](POST|PUT|PATCH|DELETE)/i, `${file} must not write`)
    assert.doesNotMatch(src, /from ['"].*(trading|wallet|purchase|session\/useOpenfundSession['"].*useSession)/, `${file} must not import trading or wallet state`)
    assert.doesNotMatch(src, /api\.hyperliquid\.xyz/, `${file} must read through the shared backend cache`)
  }
})

test('the heatmap names its metric and never presents volume as market cap', () => {
  const src = readFileSync('src/features/radar/HeatmapPage.tsx', 'utf8')
  assert.match(src, /24h notional volume/); assert.match(src, /Open interest \(USD\)/)
  assert.doesNotMatch(src, /'Market cap'|marketCap/)
  assert.match(src, /does not show market capitalisation or liquidations/)
})

test('third-party notices are preserved and shipped', () => {
  for (const name of ['whales', 'charts']) {
    assert.ok(existsSync(`../../third_party/drkxbt-${name}/LICENSE`))
    assert.ok(existsSync(`../../third_party/drkxbt-${name}/NOTICE`))
    const shipped = readFileSync(`public/assets/notices/drkxbt-${name}-MIT.txt`, 'utf8')
    assert.match(shipped, /Copyright \(c\) 2026 drk/); assert.match(shipped, /Permission is hereby granted/)
  }
})
