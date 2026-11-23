// Bug bounty data (features/bounty, ADR 0057): published amounts or the whole
// default table, never a mix; the hall of fame shows only consenting
// reporters with safe links.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
const result = buildSync({ entryPoints: [fileURLToPath(new URL('../src/features/bounty/bountyData.ts', import.meta.url))], bundle: true, write: false,
  platform: 'node', format: 'cjs', packages: 'external', define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"' } })
const mod = { exports: {} }
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports)
const { normalizeTiers, normalizeHall, DEFAULT_TIERS, loadBounty } = mod.exports

test('tiers: the published table when complete, otherwise the whole default table', () => {
  const rows = [['critical', 2500, 3000], ['high', 1000, 1500], ['medium', 500, 800], ['low', 300, 300]].map(([severity, a, b]) => ({ severity, reward_min_usd: a, reward_max_usd: b, status: 'published' }))
  assert.deepEqual(normalizeTiers(rows)[0], { severity: 'critical', minUsd: 2500, maxUsd: 3000 })
  assert.deepEqual(normalizeTiers(null), DEFAULT_TIERS, 'CMS down')
  assert.deepEqual(normalizeTiers(rows.slice(1)), DEFAULT_TIERS, 'incomplete table: no mixing')
  assert.deepEqual(normalizeTiers(rows.map(r => r.severity === 'high' ? { ...r, reward_min_usd: 2000 } : r)), DEFAULT_TIERS, 'min above max')
  assert.deepEqual(normalizeTiers(rows.map(r => r.severity === 'low' ? { ...r, status: 'draft' } : r)), DEFAULT_TIERS, 'drafts are not published')
  assert.deepEqual(DEFAULT_TIERS.map(t => [t.minUsd, t.maxUsd]), [[2000, 2000], [1000, 1500], [500, 800], [300, 300]], 'the owner defaults')
})

test('hall of fame: consent only, https links only, no invented entries', async () => {
  const hall = normalizeHall([
    { id: 1, display_name: 'Ada', profile_url: 'https://example.org/ada', year: 2026, severity: 'high', consent: true },
    { id: 2, display_name: 'NoConsent', year: 2026, consent: false },
    { id: 3, display_name: 'Link', profile_url: 'javascript:alert(1)', year: 2026, consent: true },
  ])
  assert.deepEqual(hall.map(h => [h.name, h.profileUrl]), [['Ada', 'https://example.org/ada'], ['Link', null]])
  const offline = await loadBounty(async () => null)
  assert.deepEqual(offline.hall, [], 'CMS down: an empty hall, never invented names')
  assert.equal(offline.fromCms, false)
})
