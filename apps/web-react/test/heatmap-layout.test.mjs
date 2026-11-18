/* Heatmap layout (features/radar/treemap.ts): proportional areas, no
 * overlap, labels only where they fit, an "others" tile that keeps the
 * total, stable ordering across live updates, and the colour scale. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const out = buildSync({ entryPoints: [fileURLToPath(new URL('../src/features/radar/treemap.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' })
const { squarify, collapseSmall, stableOrder, colourWeight } = await import('data:text/javascript,' + encodeURIComponent(out.outputFiles[0].text))

/* a realistic skew: two giants and a long tail, like Hyperliquid volume */
const markets = [5e9, 2.2e9, 4e8, 3.1e8, 2.6e8, 1.2e8, 9e7, ...Array.from({ length: 170 }, (_, i) => 4e7 / (i + 1))].map((value, i) => ({ key: `M${i}`, value }))
const rect = { x: 0, y: 0, w: 1100, h: 560 }
const area = r => r.w * r.h
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

test('squarify: areas proportional to value, inside the rectangle, without overlap', () => {
  const tiles = squarify(markets, rect)
  const total = markets.reduce((s, m) => s + m.value, 0)
  assert.equal(tiles.length, markets.length)
  for (const { item, rect: r } of tiles) {
    assert.ok(Math.abs(area(r) - (item.value / total) * area(rect)) < 1e-6 * area(rect), item.key)
    assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= rect.w + 1e-6 && r.y + r.h <= rect.h + 1e-6, item.key)
  }
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) assert.ok(overlap(tiles[i].rect, tiles[j].rect) < 1e-6)
})

test('collapseSmall: every kept tile is big enough to label, and the others tile keeps the total', () => {
  const minArea = 56 * 34
  const { kept, others, othersValue } = collapseSmall(markets, rect, minArea)
  assert.ok(kept.length >= 5 && kept.length < 40, `${kept.length} labelled tiles`)
  assert.ok(others.length > 100)
  assert.equal(kept.length + others.length, markets.length)
  assert.ok(Math.abs(kept.reduce((s, m) => s + m.value, 0) + othersValue - markets.reduce((s, m) => s + m.value, 0)) < 1)
  const tiles = squarify([...kept, { key: 'others', value: othersValue }], rect)
  const total = markets.reduce((s, m) => s + m.value, 0)
  for (const { item, rect: r } of tiles) {
    assert.ok(Math.abs(area(r) - (item.value / total) * area(rect)) < 1e-6 * area(rect), 'size stays proportional to the metric')
    if (item.key !== 'others') assert.ok(area(r) >= minArea - 1e-6, `${item.key} is readable`)
  }
  const tiny = collapseSmall([{ value: 3 }, { value: 2 }, { value: 1 }], { x: 0, y: 0, w: 10, h: 10 }, 1e6)
  assert.deepEqual([tiny.kept.length, tiny.others.length], [1, 2], 'all tiny: the largest stays visible, the rest are grouped')
  const single = collapseSmall([{ key: 'a', value: 100 }, { key: 'b', value: 1 }], { x: 0, y: 0, w: 100, h: 100 }, 500)
  assert.deepEqual([single.kept.length, single.others.length], [1, 1], 'even one unreadable market is grouped (it opens at readable size)')
})

test('stableOrder: small fluctuations keep the order; a clear lead or a new market moves', () => {
  const k = m => m.key, v = m => m.value
  const prev = ['A', 'B', 'C']
  const wobble = [{ key: 'A', value: 100 }, { key: 'B', value: 104 }, { key: 'C', value: 50 }]
  assert.deepEqual(stableOrder(wobble, k, v, prev).map(k), ['A', 'B', 'C'], '4 % is noise')
  const lead = [{ key: 'A', value: 100 }, { key: 'B', value: 140 }, { key: 'C', value: 50 }]
  assert.deepEqual(stableOrder(lead, k, v, prev).map(k), ['B', 'A', 'C'], '40 % is a lead')
  const fresh = [...wobble, { key: 'D', value: 80 }]
  assert.deepEqual(stableOrder(fresh, k, v, prev).map(k), ['A', 'B', 'D', 'C'])
  assert.deepEqual(stableOrder(wobble, k, v, null).map(k), ['B', 'A', 'C'], 'no history: value order')
})

test('colour weight is the real value on a symmetric scale, clamped, and null when unknown', () => {
  assert.equal(colourWeight(0.05, 0.1), 0.5)
  assert.equal(colourWeight(-0.3, 0.1), -1)
  assert.equal(colourWeight(null, 0.1), null)
  assert.equal(colourWeight(Number.NaN, 0.1), null)
})
