import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/* /:locale/airdrop (owner decision 2026-11-28) and the contracts hero motion */
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const page = read('src/features/airdrop/AirdropPage.tsx')

test('five missions pay $1,000 to $5,000; cash or prizes for challenge buyers, never a token', () => {
  const amounts = [...page.matchAll(/usd: (\d+)/g)].map(m => Number(m[1]))
  assert.deepEqual(amounts, [1000, 2000, 3000, 4000, 5000])
  assert.match(page, /never a token/)
  assert.match(page, /separate from the Openfund Premium League/)
  assert.match(page, /Only the connected wallet that bought the challenge can claim/)
  assert.match(page, /to=\{`\/\$\{locale\}\/checkout`\}/)
})

test('both heroes are original SVG with CSS motion that stops under reduced motion', () => {
  for (const [file, css, prefix] of [['src/features/airdrop/BalloonDrop.tsx', 'src/features/airdrop/airdrop.css', 'bd'], ['src/features/contracts/ChainMint.tsx', 'src/features/contracts/contracts.css', 'cm']]) {
    assert.match(read(file), /role="img" aria-label=\{label\}/)
    const style = read(css)
    assert.match(style, new RegExp(`@keyframes ${prefix}-`))
    const reduced = style.slice(style.indexOf('@media (prefers-reduced-motion: reduce)', style.indexOf(`.${prefix}-scene`)))
    assert.match(reduced, /animation: none/, file)
  }
  assert.match(read('src/features/contracts/SmartContractsPage.tsx'), /visual=\{<ChainMint /)
})
