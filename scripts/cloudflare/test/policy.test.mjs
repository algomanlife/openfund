/* Cloudflare policy (ADR 0043): the rules Cloudflare runs are serialized
   from the same expression tree the backend evaluates
   (apps/backend/redirect-policy.js); apps/backend/test/geo.test.mjs
   evaluates that tree against every backend route. This file checks the
   serialization and the declared DNS/TLS state. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalRule, geoRule, DNS, SETTINGS, CANONICAL } from '../../../infra/cloudflare/policy.mjs'
import { canonicalCondition, geoCondition, toCloudflare } from '../../../apps/backend/redirect-policy.js'

const balanced = s => { let d = 0; for (const c of s) { if (c === '(') d++; if (c === ')' && --d < 0) return false } return d === 0 }

test('canonical aliases: the shared tree, 301, path via concat, query preserved', () => {
  for (const [zone, hosts] of [['openfi.cloud', ['www.openfi.cloud']], ['openfund.cloud', ['openfund.cloud', 'www.openfund.cloud']]]) {
    const r = canonicalRule(zone)
    assert.equal(r.expression, toCloudflare(canonicalCondition(hosts)))
    assert.equal(r.action_parameters.from_value.status_code, 301)
    assert.equal(r.action_parameters.from_value.preserve_query_string, true)
    assert.equal(r.action_parameters.from_value.target_url.expression, `concat("${CANONICAL.GLOBAL}", http.request.uri.path)`)
    assert.ok(!r.expression.includes('{"openfi.cloud"'), 'the canonical host is never a source (no loop)')
  }
})

test('geographic rule: the shared tree, 302, disabled by default', () => {
  const r = geoRule()
  assert.equal(r.enabled, false)
  assert.equal(r.expression, toCloudflare(geoCondition()))
  assert.equal(r.action_parameters.from_value.status_code, 302)
  for (const part of ['ip.src.country eq "IR"', 'sec-fetch-dest', 'text/html', 'of-region=global', 'openfund_session=', 'region=global'])
    assert.ok(r.expression.includes(part), part)
})

test('expressions use Free-plan functions only and fit the size limit', () => {
  for (const r of [canonicalRule('openfi.cloud'), canonicalRule('openfund.cloud'), geoRule()]) {
    assert.ok(balanced(r.expression), `${r.ref}: unbalanced parentheses`)
    assert.ok(!/\bmatches\b|\blookup_json|\bregex_replace/.test(r.expression), `${r.ref}: uses a paid-plan function`)
    assert.ok(r.expression.length < 4096, `${r.ref}: ${r.expression.length} characters`)
  }
})

test('declared DNS matches the live zone (checked 2026-11-17) and TLS policy is strict', () => {
  assert.deepEqual({ ...DNS['www.openfund.cloud'], role: undefined }, { type: 'CNAME', content: 'openfund-our6.onrender.com', proxied: true, role: undefined })
  assert.equal(DNS['cms.openfi.cloud'].proxied, false)
  assert.equal(DNS['backstage.openfi.cloud'].proxied, false)
  assert.deepEqual(SETTINGS, { ssl: 'strict', min_tls_version: '1.2', always_use_https: 'on' })
})
