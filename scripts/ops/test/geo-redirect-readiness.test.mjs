/* ADR 0043 §Gates: the readiness script evaluates public observations and
   can never report "ready". A fake transport replaces the network. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { observe, evaluateGates, formatReport, parseRuntimeConfig, GATE } from '../geo-redirect-readiness.mjs'

const GLOBAL = 'https://openfi.cloud', IRAN = 'https://openfi.live'
const version = (v, commit, official) => JSON.stringify({ status: 'matched', version: v, commit, manifest: { official } })
const config = extra => `window.__OPENFUND_RUNTIME_CONFIG__=${JSON.stringify({ cmsUrl: 'x', ...extra })};`
const ok = body => ({ status: 200, body })

/* production on 2026-11-20 */
function today(url) {
  const routes = {
    [`${GLOBAL}/version`]: ok(version('0.7.0', '34ef7ec719d2bb0e5b20d10e6112a8ccc33261a0', true)),
    [`${GLOBAL}/runtime-config.js`]: ok(config({ region: 'GLOBAL', geoLocale: 'en' })),
    [`${GLOBAL}/runtime/ingress`]: ok(JSON.stringify({ forwardedHops: 3, hopsFromRight: ['162.158.1.1', '198.51.100.7'], lastHopCloudflare: true, countrySource: 'cloudflare', country: 'TJ' })),
    [`${GLOBAL}/ready`]: ok(JSON.stringify({ region: 'GLOBAL', marketData: { execution: 'available_for_fresh_markets' } })),
    [`${IRAN}/version`]: ok(version('0.6.5', 'a87804a69b27cafa3063807f33f1f7d9d93470dc', false)),
    [`${IRAN}/runtime-config.js`]: ok(config({ region: 'IRAN' })),
    [`${IRAN}/runtime/ingress`]: { status: 404, body: '{"error":"not_found"}' },
    [`${IRAN}/ready`]: ok(JSON.stringify({ region: 'IRAN', marketData: { execution: 'suspended_no_authoritative_marks' } })),
    'https://iran.openfi.cloud/fa/challenges?plan=25k': ok(''),
    'https://iran.openfund.cloud/en/home': ok(''),
    'https://www.openfi.live/': { status: 301, location: 'https://openfi.live/', body: '' },
    'https://iran.openfi.cloud/version': ok('{}'),
    'https://iran.openfi.cloud/trading/state': { status: 401, body: '' },
    'https://openfund-iran-worker.liara.run/health': { status: 404, body: '<!DOCTYPE html><title>Liara | Application Error</title>' },
  }
  return routes[url] ?? { status: null, error: `unexpected ${url}`, body: '' }
}
const fake = routes => async (url, opts) => routes(url, opts)

test('today: GLOBAL 0.7.0, IRAN 0.6.5 unofficial → not ready, gates 1, 2 and 4 fail', async () => {
  const report = evaluateGates(await observe({ get: fake(today) }))
  assert.equal(report.verdict, 'not_ready')
  assert.deepEqual(report.gates.map(g => g.result), [GATE.fail, GATE.fail, GATE.pass, GATE.fail, GATE.owner])
  const text = formatReport(report)
  assert.match(text, /NOT READY/)
  assert.match(text, /IRAN 0\.6\.5 a87804a/)
  /* the caller's addresses and country never reach the report */
  for (const secret of ['162.158.1.1', '198.51.100.7', 'TJ']) assert.ok(!JSON.stringify(report).includes(secret) && !text.includes(secret), secret)
})

test('all verifiable gates pass → still only awaiting the owner; never "ready"', async () => {
  const commit = 'b'.repeat(40)
  const good = url => {
    if (url.endsWith('/version') && !url.includes('iran.')) return ok(version('0.8.0', commit, true))
    if (url === `${IRAN}/runtime-config.js`) return ok(config({ region: 'IRAN', geoLocale: 'fa' }))
    if (url === `${IRAN}/runtime/ingress`) return ok(JSON.stringify({ forwardedHops: 1, lastHopCloudflare: false, countrySource: 'ip-database' }))
    if (url === `${IRAN}/ready`) return ok(JSON.stringify({ region: 'IRAN', marketData: { execution: 'available_for_fresh_markets' } }))
    if (url === 'https://iran.openfi.cloud/fa/challenges?plan=25k') return { status: 301, location: 'https://openfi.live/fa/challenges?plan=25k', body: '' }
    if (url === 'https://iran.openfund.cloud/en/home') return { status: 301, location: 'https://openfi.live/en/home', body: '' }
    return today(url)
  }
  const observed = await observe({ get: fake(good) })
  /* ADR 0044 still says Proposed in the repository: gate 4 fails on its own */
  assert.equal(evaluateGates(observed).gates[3].result, GATE.fail)
  const report = evaluateGates({ ...observed, adr0044Status: 'Accepted; implemented (#200)' })
  assert.deepEqual(report.gates.map(g => g.result), [GATE.pass, GATE.pass, GATE.pass, GATE.owner, GATE.owner])
  assert.equal(report.verdict, 'awaiting_owner_approval')
  assert.ok(report.advisory.every(a => a.ok))
})

test('a worker that answers on its default subdomain fails gate 3; unreachable endpoints fail, never pass', async () => {
  const exposed = url => (url.includes('worker') ? ok('{"ok":true,"ts":1}') : today(url))
  assert.equal(evaluateGates(await observe({ get: fake(exposed) })).gates[2].result, GATE.fail)
  const down = () => ({ status: null, error: 'ECONNREFUSED', body: '' })
  const report = evaluateGates(await observe({ get: fake(down) }))
  assert.equal(report.verdict, 'not_ready')
  assert.deepEqual(report.gates.map(g => g.result), [GATE.fail, GATE.fail, GATE.pass, GATE.fail, GATE.owner], 'gate 3 passes only because nothing answers as Openfund')
})

test('the script only reads: every request is a GET to a public URL', async () => {
  const seen = []
  await observe({ get: async (url, opts) => { seen.push({ url, opts }); return today(url) } })
  assert.ok(seen.length >= 10)
  for (const { url, opts } of seen) {
    assert.match(url, /^https:\/\//)
    assert.ok(!opts?.method || opts.method === 'GET', url)
    assert.ok(!JSON.stringify(opts ?? {}).match(/authorization|token|cookie/i), url)
  }
})

test('runtime-config parsing', () => {
  assert.deepEqual(parseRuntimeConfig(config({ region: 'IRAN' })), { cmsUrl: 'x', region: 'IRAN' })
  assert.equal(parseRuntimeConfig('<html>'), null)
})
