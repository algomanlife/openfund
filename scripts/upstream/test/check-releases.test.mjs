import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classify, breakingSignals, fetchUpstream, checkAll, refreshRegistry, toMarkdown, semver } from '../check-releases.mjs'

const note = (n) => readFileSync(new URL(`./fixtures/releases/${n}.md`, import.meta.url), 'utf8')

test('Directus: a minor that declares breaking changes and a Node.js requirement is high risk', () => {
  const c = classify({ scheme: 'directus', installed: '12.5.1', latest: '12.6.0', notes: [note('directus-12.6.0')] })
  assert.equal(c.risk, 'high'); assert.equal(c.action, 'manual-review')
  assert.ok(c.reasons.some((r) => /Node\.js/.test(r)), c.reasons.join('|'))
})

test('Directus: a clean patch is low risk and only a proposal', () => {
  const c = classify({ scheme: 'directus', installed: '12.6.0', latest: '12.6.1', notes: [note('directus-12.6.1')] })
  assert.equal(c.risk, 'low'); assert.equal(c.action, 'proposal')
})

test('Directus: a major is blocked pending an owner decision and mentions licensing', () => {
  const c = classify({ scheme: 'directus', installed: '11.9.1', latest: '12.0.0', notes: [note('directus-12.0.0')] })
  assert.equal(c.action, 'blocked-owner-decision'); assert.equal(c.risk, 'high')
  assert.ok(c.reasons.join(' ').toLowerCase().includes('licen'))
})

test('0.x providers treat every minor as high risk and patches as medium', () => {
  assert.deepEqual(classify({ scheme: 'semver-0x', installed: '0.9.3', latest: '0.10.4' }).risk, 'high')
  assert.deepEqual(classify({ scheme: 'semver-0x', installed: '0.3.2', latest: '0.3.3' }).risk, 'medium')
  assert.equal(classify({ scheme: 'semver-0x', installed: '0.13.1', latest: '0.13.1' }).action, 'none')
})

test('stable libraries: patch low, minor medium, major blocked', () => {
  assert.equal(classify({ scheme: 'semver', installed: '8.22.1', latest: '8.22.2' }).risk, 'low')
  assert.equal(classify({ scheme: 'semver', installed: '8.22.1', latest: '8.23.0' }).risk, 'medium')
  const major = classify({ scheme: 'semver', installed: '4.22.3', latest: '5.3.0' })
  assert.equal(major.action, 'blocked-owner-decision')
})

test('source-head providers need manual review on any new commit and never go beyond a proposal', () => {
  assert.equal(classify({ scheme: 'source-head', installed: 'a', latest: 'a' }).action, 'none')
  const c = classify({ scheme: 'source-head', installed: 'a', latest: 'b' })
  assert.equal(c.action, 'manual-review')
})

test('no classification ever yields an automatic merge or deployment', () => {
  for (const scheme of ['semver', 'semver-0x', 'directus', 'source-head'])
    for (const [i, l] of [['1.0.0', '1.0.1'], ['1.0.0', '1.1.0'], ['1.0.0', '2.0.0'], ['0.1.0', '0.2.0']])
      assert.ok(['none', 'proposal', 'manual-review', 'blocked-owner-decision'].includes(classify({ scheme, installed: i, latest: l }).action))
})

test('breaking signals recognise requirement, licence and security wording', () => {
  assert.ok(breakingSignals(['### ⚠️ Potential Breaking Changes']).length)
  assert.ok(breakingSignals(['Raised the minimum required Node.js version to 26']).some((s) => /Node/.test(s)))
  assert.ok(breakingSignals(['fixes GHSA-gwvv-rr68-cmv6']).some((s) => /security/.test(s)))
  assert.deepEqual(breakingSignals(['Fixed a typo']), [])
})

const jsonRes = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body })

test('fetchUpstream collects notes of every release newer than the installed one, ignoring prereleases', async () => {
  const releases = [
    { tag_name: 'v12.7.0-rc.1', prerelease: true, draft: false, body: 'rc', published_at: '2026-12-01T00:00:00Z', html_url: 'u' },
    { tag_name: 'v12.6.1', prerelease: false, draft: false, body: 'patch notes', published_at: '2026-11-04T00:00:00Z', html_url: 'u' },
    { tag_name: 'v12.6.0', prerelease: false, draft: false, body: 'Potential Breaking Changes', published_at: '2026-10-27T00:00:00Z', html_url: 'u' },
    { tag_name: 'v11.9.1', prerelease: false, draft: false, body: 'old', published_at: '2025-06-30T00:00:00Z', html_url: 'u' },
  ]
  const up = await fetchUpstream({ installed: { version: '11.9.1' }, watch: { type: 'github-releases', repo: 'directus/directus', tag_prefix: 'v' } }, { fetchImpl: async () => jsonRes(releases) })
  assert.equal(up.version, '12.6.1'); assert.equal(up.notes.length, 2); assert.match(up.notes.join('\n'), /Potential Breaking Changes/)
})

test('a failing source is reported as an error row without stopping the others', async () => {
  const registry = { providers: [
    { id: 'a', name: 'A', installed: { version: '1.0.0' }, policy: { scheme: 'semver' }, watch: { type: 'npm', package: 'a' } },
    { id: 'b', name: 'B', installed: { version: '1.0.0' }, policy: { scheme: 'semver' }, watch: { type: 'npm', package: 'b' } },
    { id: 'c', name: 'C', installed: { version: 'x' }, policy: { scheme: 'hosted-contract' }, watch: { type: 'none', reason: 'contract tested' } },
  ] }
  const fetchImpl = async (url) => (url.endsWith('/a') ? jsonRes({ 'dist-tags': { latest: '1.0.1' }, time: { '1.0.1': '2026-11-01T00:00:00Z' } }) : jsonRes({}, false))
  const rows = await checkAll(registry, { fetchImpl })
  assert.deepEqual(rows.map((r) => r.status), ['update-available', 'error', 'not-watched'])
  assert.match(toMarkdown(rows, '2026-11-10'), /proposal that needs human review/)
})

test('refreshRegistry only touches latest_observed and never the installed version', () => {
  const reg = { providers: [{ id: 'a', installed: { version: '1.0.0', ref: 'r' }, watch: { type: 'npm' }, latest_observed: { version: '1.0.0', reviewed: true } }] }
  const out = refreshRegistry(structuredClone(reg), [{ id: 'a', status: 'update-available', latest: '1.1.0', date: '2026-11-10' }])
  assert.deepEqual(out.providers[0].installed, reg.providers[0].installed)
  assert.deepEqual(out.providers[0].latest_observed, { version: '1.1.0', date: '2026-11-10', reviewed: false })
  assert.ok(semver('1.2.3'))
})
