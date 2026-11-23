/* Backstage bug bounty editor (bounty.js, ADR 0057): reward amounts are
 * whole USD within bounds with min ≤ max, only the amount fields are
 * written, and no name is published without the reporter's consent. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTiers, normalizeHallEntry, createBountyApi, MAX_REWARD_USD } from '../bounty.js'

const tiers = () => ({ tiers: [
  { severity: 'critical', reward_min_usd: 2000, reward_max_usd: 2000 }, { severity: 'high', reward_min_usd: 1000, reward_max_usd: 1500 },
  { severity: 'medium', reward_min_usd: 500, reward_max_usd: 800 }, { severity: 'low', reward_min_usd: 300, reward_max_usd: 300 }] })

test('reward table: four severities, whole USD, min ≤ max, bounded', () => {
  assert.equal(normalizeTiers(tiers()).length, 4)
  const bad = (mutate) => { const b = tiers(); mutate(b.tiers); return () => normalizeTiers(b) }
  assert.throws(bad(t => { t[1].reward_min_usd = 2000 }), /invalid_tiers/, 'min above max')
  assert.throws(bad(t => { t[0].reward_max_usd = MAX_REWARD_USD + 1 }), /invalid_tiers/)
  assert.throws(bad(t => { t[3].reward_min_usd = 12.5 }), /invalid_tiers/)
  assert.throws(bad(t => { t[2].reward_min_usd = -1 }), /invalid_tiers/)
  assert.throws(bad(t => { t.pop() }), /invalid_tiers/)
  assert.throws(bad(t => { t[0].severity = 'severe' }), /invalid_tiers/)
})

test('hall of fame: consent is required to publish; plain names and https links only', () => {
  const now = new Date('2026-11-23T00:00:00Z')
  const ok = normalizeHallEntry({ display_name: 'Researcher', profile_url: 'https://example.org/r', year: 2026, severity: 'high', status: 'published', consent: true }, now)
  assert.equal(ok.status, 'published')
  assert.throws(() => normalizeHallEntry({ display_name: 'Researcher', year: 2026, status: 'published', consent: false }, now), /consent_required/)
  assert.equal(normalizeHallEntry({ display_name: 'Researcher', year: 2026 }, now).status, 'draft', 'drafts need no consent yet')
  assert.throws(() => normalizeHallEntry({ display_name: '<img src=x>', year: 2026 }, now), /invalid_name/)
  assert.throws(() => normalizeHallEntry({ display_name: 'R', profile_url: 'javascript:alert(1)', year: 2026 }, now), /invalid_profile_url/)
  assert.throws(() => normalizeHallEntry({ display_name: 'R', profile_url: 'http://x.test', year: 2026 }, now), /invalid_profile_url/)
  assert.throws(() => normalizeHallEntry({ display_name: 'R', year: 2030 }, now), /invalid_year/)
  assert.throws(() => normalizeHallEntry({ display_name: 'R', year: 2026, advisory_reference: 'CVE-1' }, now), /invalid_advisory/)
})

test('writes touch only the amount fields of the existing tier rows', async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); calls.push({ method: init.method ?? 'GET', path: u.pathname, body: init.body ? JSON.parse(init.body) : null })
    const data = init.method === 'PATCH' ? { id: 1 } : ['critical', 'high', 'medium', 'low'].map((severity, i) => ({ id: i + 1, severity }))
    return { ok: true, status: 200, json: async () => ({ data }) }
  }
  const api = createBountyApi({ cms: 'https://cms.example.test', token: 'directus-token-for-tests', fetchImpl })
  await (await api.prepareTiers(tiers())).apply()
  const patches = calls.filter(c => c.method === 'PATCH')
  assert.equal(patches.length, 4)
  for (const p of patches) assert.deepEqual(Object.keys(p.body).sort(), ['reward_max_usd', 'reward_min_usd'])
  assert.equal(patches[1].path, '/items/bug_bounty_tiers/2')
})
