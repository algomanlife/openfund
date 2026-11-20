/* Read-only Perpetual (Gains) presentation rules: retained data after a failed
 * refresh is "outdated", stale/inconsistent upstream data is never "live",
 * and transaction links are only built from well-formed hashes. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL('../src/features/terminal/gainsView.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false })
const module = { exports: {} }
new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
const { gainsFeedState, feedSeverity, arbiscanTx, snapshotTime, ORDER_TYPES } = module.exports
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const snap = status => ({ freshness: { status, fetchedAt: '2026-11-20T12:00:00.000Z' }, positions: [] })

test('feed state covers every connection and freshness transition', () => {
  const r = (data, error = null, loading = false) => ({ data, error, loading })
  assert.equal(gainsFeedState(false, r(snap('fresh'))), 'signedout')
  assert.equal(gainsFeedState(true, r(null, null, true)), 'loading')
  assert.equal(gainsFeedState(true, r(snap('fresh'))), 'live')
  assert.equal(gainsFeedState(true, r(snap('stale'))), 'stale')
  assert.equal(gainsFeedState(true, r(snap('inconsistent'))), 'inconsistent')
  assert.equal(gainsFeedState(true, r({ positions: [] })), 'stale', 'no freshness metadata is never live')
  assert.equal(gainsFeedState(true, r(snap('fresh'), 'gains_timeout')), 'outdated')
  assert.equal(gainsFeedState(true, r(null, 'gains_unavailable')), 'unavailable')
  assert.equal(feedSeverity('live'), 'ok')
  assert.equal(feedSeverity('outdated'), 'warn')
  assert.equal(feedSeverity('unavailable'), 'error')
  assert.equal(snapshotTime(snap('fresh')), '2026-11-20T12:00:00.000Z')
  assert.equal(snapshotTime(null), null)
})

test('order types follow the Gains SDK TradeType enum', () => {
  assert.deepEqual([...ORDER_TYPES], ['market', 'limit', 'stop'])
})

test('transaction links require a 32-byte hash', () => {
  assert.equal(arbiscanTx('0x' + 'a'.repeat(64)), 'https://arbiscan.io/tx/0x' + 'a'.repeat(64))
  for (const bad of [null, '', 'javascript:alert(1)', '0x1234', '0x' + 'g'.repeat(64)]) assert.equal(arbiscanTx(bad), null)
})

test('Perpetual surfaces stay read-only and clearly separated from Prop', () => {
  const portfolio = read('../src/features/terminal/GainsPortfolio.tsx')
  const shell = read('../src/features/terminal/TerminalShell.tsx')
  const trading = read('../src/features/terminal/TradingPages.tsx')
  assert.match(portfolio, /<GainsSourceBar resource=\{data\} \/>/)
  assert.match(portfolio, /aria-controls="gains-records"/)
  assert.doesNotMatch(portfolio, /href=\{`https:\/\/arbiscan\.io\/tx\/\$\{r\.tx\}`\}/, 'unvalidated tx link removed')
  assert.match(shell, /Openfund Prop — Simulated evaluation/)
  assert.match(shell, /Openfund Perpetual — Gains account view/)
  assert.match(trading, /readOnly: true,\s*canTrade: false,/)
  assert.match(trading, /Execution disabled \(read-only\)/)
  /* Perpetual never calls Prop engine order endpoints */
  assert.doesNotMatch(portfolio, /\/trading\/(order|close|cancel)/)
})
