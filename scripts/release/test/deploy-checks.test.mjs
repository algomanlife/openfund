/* Release identity checks: one release, one commit on every service. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { autoDeployOff, webMatches, backstageMatches, backstageVerified, releaseSkew } from '../deploy-checks.mjs'

const source = { commit: 'a'.repeat(40), version: '0.6.6', frontend: { id: 'f1' }, backend: { id: 'b1' } }

test('auto-deploy must be off on a service before an approved release', () => {
  assert.equal(autoDeployOff({ autoDeploy: 'no' }), true)
  assert.equal(autoDeployOff({ autoDeploy: 'yes', autoDeployTrigger: 'off' }), true)
  assert.equal(autoDeployOff({ autoDeploy: 'yes', autoDeployTrigger: 'commit' }), false)
  assert.equal(autoDeployOff({ autoDeploy: 'yes', autoDeployTrigger: 'checksPass' }), false, 'even checks-pass deploys an unreleased main commit')
  assert.equal(autoDeployOff(undefined), false)
})

test('web and backstage identity must equal the release', () => {
  const ok = [{ status: 'matched', commit: source.commit, backend: { id: 'b1' } }, { commit: source.commit, version: '0.6.6', frontend: { id: 'f1' } }]
  assert.equal(webMatches(source, ok), true)
  assert.equal(webMatches(source, [{ ...ok[0], commit: 'c'.repeat(40) }, ok[1]]), false)
  assert.equal(webMatches(source, [ok[0], { ...ok[1], version: '0.6.5' }]), false)
  assert.equal(backstageMatches(source, { ok: true, commit: source.commit }), true)
  assert.equal(backstageMatches(source, { ok: true, commit: null }), false, 'an old Backstage without identity never passes')
  assert.equal(backstageMatches(source, { ok: true, commit: 'c'.repeat(40) }), false)
})

test('rollback to a Backstage without identity needs Render to confirm the exact commit', () => {
  assert.equal(backstageVerified(source, { ok: true, commit: source.commit }, null), true)
  assert.equal(backstageVerified(source, { ok: true }, source.commit), true, 'old build, Render confirmed this commit live')
  assert.equal(backstageVerified(source, { ok: true }, null), false, 'old build, no deploy confirmation')
  assert.equal(backstageVerified(source, { ok: true }, 'c'.repeat(40)), false)
  assert.equal(backstageVerified(source, { ok: true, commit: 'c'.repeat(40) }, source.commit), false, 'a reported commit must match')
  assert.equal(backstageVerified(source, { ok: false }, source.commit), false)
})

test('the 2026-11-17 split (web a87804a, backstage cd057fa) is reported as skew', () => {
  const p = releaseSkew([
    { name: 'GLOBAL web/api', commit: 'a87804a69b27cafa3063807f33f1f7d9d93470dc', version: '0.6.5' },
    { name: 'GLOBAL backstage', commit: 'cd057fa4a1d3077e70db0eeab01957ead7a6aeaf', version: null },
    { name: 'IRAN web/api', commit: 'a87804a69b27cafa3063807f33f1f7d9d93470dc', version: '0.6.5' },
  ])
  assert.ok(p.some(x => /commit skew/.test(x)))
  assert.deepEqual(releaseSkew([{ name: 'a', commit: source.commit, version: '1' }, { name: 'b', commit: source.commit, version: '1' }]), [])
  assert.ok(releaseSkew([{ name: 'GLOBAL backstage', commit: null, error: 'HTTP 404' }])[0].includes('identity unavailable'))
})
