/* Cloudflare drift check (ADR 0043): a live state equal to the policy passes;
   DNS, TLS, rule and enablement drift each fail. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { compare, expectedRules } from '../check-live.mjs'
import { ZONES, DNS, SETTINGS } from '../../../infra/cloudflare/policy.mjs'

const matching = () => ({ zones: Object.fromEntries(Object.keys(ZONES).map(zone => [zone, {
  dns: Object.entries(DNS).filter(([n]) => n === zone || n.endsWith(`.${zone}`)).map(([name, r]) => ({ name, type: r.type, content: r.content, proxied: r.proxied })),
  settings: { ...SETTINGS },
  rules: expectedRules()[zone].map(r => ({ ref: r.ref, enabled: r.enabled, expression: r.expression, status: r.action_parameters.from_value.status_code })),
}])) })
const has = (drift, re) => assert.ok(drift.some(d => re.test(d)), `expected ${re} in ${JSON.stringify(drift)}`)

test('a live state equal to the policy has no drift', () => assert.deepEqual(compare(matching()), []))

test('the 2026-11-17 DNS drift (www.openfund.cloud → openfi.cloud) is detected', () => {
  const live = matching()
  live.zones['openfund.cloud'].dns.find(r => r.name === 'www.openfund.cloud').content = 'openfi.cloud'
  has(compare(live), /www\.openfund\.cloud → openfi\.cloud, policy says openfund-our6\.onrender\.com/)
})

test('proxy, TLS, rule expression, enablement and unmanaged rules are detected', () => {
  const live = matching()
  live.zones['openfi.cloud'].dns.find(r => r.name === 'cms.openfi.cloud').proxied = true
  live.zones['openfund.cloud'].settings.ssl = 'full'
  live.zones['openfi.cloud'].rules.find(r => r.ref === 'openfund_geo_iran').enabled = true
  live.zones['openfund.cloud'].rules[0].expression = 'http.host eq "openfund.cloud"'
  live.zones['openfi.cloud'].rules.push({ id: '025b', description: 'Static', enabled: true, expression: 'x', status: 302 })
  const d = compare(live)
  has(d, /cms\.openfi\.cloud proxied=true/)
  has(d, /setting ssl=full/)
  has(d, /openfund_geo_iran enabled=true, policy says false/)
  has(d, /openfund_canonical_openfund_cloud expression differs/)
  has(d, /unmanaged redirect rule 025b/)
})
