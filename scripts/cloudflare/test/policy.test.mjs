/* Cloudflare policy (ADR 0043): rule expressions never redirect machine
   traffic, agree with the application's alias redirect, and keep the
   geographic rule temporary, Iran-only and gated. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalRule, geoRule, MACHINE_PREFIXES, DNS, SETTINGS, CANONICAL } from '../../../infra/cloudflare/policy.mjs'
import { canonicalConfig, canonicalRedirect } from '../../../apps/backend/canonical-host.js'

test('canonical aliases: 301, path via concat, query preserved, GET/HEAD only', () => {
  for (const zone of ['openfi.cloud', 'openfund.cloud']) {
    const r = canonicalRule(zone)
    assert.equal(r.action_parameters.from_value.status_code, 301)
    assert.equal(r.action_parameters.from_value.preserve_query_string, true)
    assert.equal(r.action_parameters.from_value.target_url.expression, `concat("${CANONICAL.GLOBAL}", http.request.uri.path)`)
    assert.match(r.expression, /http\.request\.method in \{"GET" "HEAD"\}/)
    assert.ok(!r.expression.includes('"openfi.cloud"'), 'the canonical host is never a source (no loop)')
  }
})

test('geographic rule: IR only, 302, document navigation, opt-out and sessions respected, disabled by default', () => {
  const r = geoRule()
  assert.equal(r.enabled, false)
  assert.equal(r.action_parameters.from_value.status_code, 302)
  assert.match(r.expression, /ip\.src\.country eq "IR"/)
  assert.ok(!/"XX"|"T1"/.test(r.expression), 'unknown and Tor are never Iran')
  assert.match(r.expression, /sec-fetch-dest/)
  assert.match(r.expression, /text\/html/)
  assert.match(r.expression, /of-region=global/)
  assert.match(r.expression, /openfund_session=/)
  assert.match(r.expression, /\(http\.request\.method eq "GET"\)/)
})

test('every path the application refuses to redirect is also excluded at Cloudflare', () => {
  const app = canonicalConfig({ PUBLIC_ORIGIN: 'https://openfi.cloud', CANONICAL_ALIAS_HOSTS: 'openfund.cloud' })
  const samples = ['/sync/v1/batches', '/health', '/ready', '/version', '/runtime/status', '/runtime-config.js', '/.well-known/x', '/cms/items/x',
    '/admin', '/admin/x', '/auth/nonce', '/products/prop/orders', '/purchases/depay/callback', '/invoices/1', '/api/payments/depay/events',
    '/notifications/x', '/support/x', '/rewards/x', '/referral/x', '/chart/x', '/governance/x', '/live/x', '/economy/x', '/certificates/x']
  for (const path of samples) {
    assert.equal(canonicalRedirect(app, { method: 'GET', host: 'openfund.cloud', path, url: path }), null, `app redirects ${path}`)
    assert.ok(MACHINE_PREFIXES.some(p => path.startsWith(p)), `Cloudflare would redirect ${path}`)
  }
  for (const page of ['/fa/home', '/en/challenges', '/ru/prop/dashboard'])
    assert.ok(!MACHINE_PREFIXES.some(p => page.startsWith(p)), `${page} must stay redirectable`)
})

test('operational hosts stay DNS-only and the TLS policy is strict', () => {
  assert.equal(DNS['cms.openfi.cloud'].proxied, false)
  assert.equal(DNS['backstage.openfi.cloud'].proxied, false)
  assert.equal(DNS['www.openfund.cloud'].proxied, true)
  assert.deepEqual(SETTINGS, { ssl: 'strict', min_tls_version: '1.2', always_use_https: 'on' })
})
