/**
 * Wallet showcase helpers: the copy count that keeps the seamless loop
 * covering any viewport, and the deterministic "data" rendition shown on the
 * far side of the scanner beam.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL('../src/features/home/WalletShowcase.tsx', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', loader: { '.css': 'empty' }, jsx: 'automatic' })
const mod = { exports: {} }; new Function('module', 'exports', 'require', outputFiles[0].text)(mod, mod.exports, require)
const { copiesFor, dataLines, WALLETS, demoWallets } = mod.exports

test('one copy is always wider than the viewport plus one card, for every width', () => {
  for (const [card, gap] of [[248, 16], [222, 12]]) {
    const shift = WALLETS.length * (card + gap)
    for (let viewport = 320; viewport <= 7680; viewport += 37) {
      const copies = copiesFor(viewport, shift, card)
      assert.ok(copies >= 2)
      /* the track spans copies × shift; at the far end of the loop it is shifted by one copy */
      assert.ok(copies * shift - shift >= viewport + card, `${viewport}px: ${copies} copies`)
    }
  }
  assert.equal(copiesFor(1440, 0, 248), 2, 'unmeasured layout falls back to two copies')
})

test('the data rendition is deterministic, glyph-only and fits the card', () => {
  const again = demoWallets()
  for (const [i, wallet] of WALLETS.entries()) {
    const lines = dataLines(wallet)
    assert.deepEqual(lines, dataLines(again[i]))
    assert.ok(lines[0].startsWith('0x') && lines.join('').includes(wallet.address.slice(2, 16)))
    assert.ok(lines.every(line => line.length <= 24), lines.join(' | '))
    assert.ok(lines.every(line => !/[A-Za-z]{3,}/.test(line.replace(/[0-9a-fA-F]/g, '0'))), 'no words, only figures')
  }
  assert.notDeepEqual(dataLines(WALLETS[0]), dataLines(WALLETS[1]))
})
