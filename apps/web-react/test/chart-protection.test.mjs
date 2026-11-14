import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../public/legacy/terminal.js', import.meta.url), 'utf8')
const submit = source.slice(source.indexOf('function submitPositionRisk('), source.indexOf('/* save drawings whenever'))
function rig(result = { ok: true }) {
  const requests = [], messages = [], timers = [], updates = []
  const p = { id: 'p', market: 'BTC/USD', sl: 95, tp: 110 }
  let resolve
  const gate = new Promise(r => { resolve = r })
  const provider = { canTrade: true, state: { positions: [p] }, async modifyRisk(...args) {
    requests.push(args); await gate
    if (result instanceof Error) throw result
    if (result.ok) Object.assign(p, { sl: args[1], tp: args[2] })
    return result
  } }
  const ctx = { window: { __ofServerTP: provider }, S: { marketId: p.market }, positionEdits: new Map(), positionRiskQueues: new Map(), posDrawings: new Map([['p', 'drawing']]), vc: { chart: { drawings: { update: (...args) => updates.push(args) } } }, syncingPositionDrawings: false,
    setTimeout: fn => { timers.push(fn); return 1 }, Promise, positionOverlayColors: () => ({ entry: '#aaa' }), renderPositionInfo: () => {}, toast: (...args) => messages.push(args), CL: (_, en) => en, velaPositionsSync: () => updates.push('sync') }
  vm.createContext(ctx); vm.runInContext(submit, ctx)
  return { ctx, p, provider, requests, timers, messages, updates, resolve }
}

test('removal waits for server acknowledgement and disables duplicate edits', async () => {
  const r = rig()
  r.ctx.submitPositionRisk('p', { sl: null, tp: 110 })
  assert.equal(r.p.sl, 95); assert.equal(r.ctx.positionEdits.get('p').sl, null)
  r.ctx.submitPositionRisk('p', { sl: 90, tp: null })
  assert.equal(r.timers.length, 1)
  r.timers.shift()(); await new Promise(r => setImmediate(r))
  assert.deepEqual(r.requests, [['p', null, 110]])
  assert.equal(r.p.sl, 95)
  r.resolve(); await r.ctx.positionRiskQueues.get('p')
  assert.equal(r.p.sl, null); assert.equal(r.p.tp, 110)
  assert.equal(r.ctx.positionEdits.size, 0)
  assert.equal(r.messages[0][1], 'pos')
})

for (const result of [{ ok: false, errors: ['rejected'] }, new Error('offline')]) test(`failed protection update reconciles confirmed state (${result instanceof Error ? 'network' : 'server'})`, async () => {
  const r = rig(result)
  r.ctx.submitPositionRisk('p', { sl: 90, tp: null }); r.timers.shift()()
  await new Promise(r => setImmediate(r)); r.resolve(); await r.ctx.positionRiskQueues.get('p')
  assert.deepEqual(r.p, { id: 'p', market: 'BTC/USD', sl: 95, tp: 110 })
  assert.equal(r.ctx.positionEdits.size, 0); assert.equal(r.messages[0][1], 'neg')
  assert.equal(r.updates.at(-1), 'sync')
})

test('switching account or market before submission abandons the edit', async () => {
  for (const change of [r => { r.ctx.window.__ofServerTP = {} }, r => { r.ctx.S.marketId = 'ETH/USD' }]) {
    const r = rig(); r.ctx.submitPositionRisk('p', { sl: null, tp: 110 }); change(r); r.timers.shift()()
    await r.ctx.positionRiskQueues.get('p')
    assert.equal(r.requests.length, 0); assert.equal(r.ctx.positionEdits.size, 0)
  }
})

test('native Vela handles keep side, actual quantity and valid increments in preview', async () => {
  const { build } = await import('esbuild')
  const built = await build({ entryPoints: [new URL('../../../packages/openfund-charts/src/openfund-drawings.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false })
  const { OpenfundPositionTool } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))
  for (const side of ['long', 'short']) {
    const drawing = new OpenfundPositionTool({ paneId: 'price', anchors: [{ time: 1, price: 100 }, { time: 2, price: 100 }, { time: 2, price: 100 }], props: { ofSide: side, ofEditable: ['stop', 'target'], ofMissing: ['stop', 'target'], ofQuantity: 3, ofCurrency: 'DAI', ofPrecision: 2, ofTick: 0.05 } })
    drawing.dragHandle(1, { time: 999, price: side === 'long' ? 95.127 : 105.127 })
    assert.equal(drawing.anchors[0].price, 100)
    assert.equal(drawing.anchors[1].time, 2)
    assert.equal(drawing.anchors[1].price, side === 'long' ? 95.15 : 105.15)
    assert.equal(drawing.anchors[2].price, 100)
    assert.equal(drawing.directionLabel(), side === 'long' ? 'LONG' : 'SHORT')
    assert.match(drawing.stopLabel(), /DAI gross est\./)
    assert.match(drawing.stopLabel(), side === 'long' ? /-14\.55/ : /-15\.45/)
  }
})
