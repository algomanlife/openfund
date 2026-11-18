import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { purchaseReadiness, parseRuntimeConfig, pinnedWidget, DEPAY_ROUTES } from '../purchase-readiness.mjs';

const bundle = Buffer.from('widget');
const integrity = 'sha384-' + crypto.createHash('sha384').update(bundle).digest('base64');
const widget = { file: 'assets/vendor/depay-widgets-x.js', integrity };
const respond = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => body, arrayBuffer: async () => body });
const fetchFor = ({ enabled = true, depay = 401, widgetOn = true, served = bundle, methods = undefined, configStatus = null } = {}) => async (url, init = {}) => {
  const route = new URL(url).pathname;
  if (route === '/purchases/plans') return respond(200, { paymentsEnabled: enabled, payment: enabled ? { manualChains: [{ blockchain: 'arbitrum' }], ...(methods ? { methods } : {}) } : null });
  if (configStatus && /config/.test(route) && init.method === 'POST') return respond(configStatus, { error: configStatus === 404 ? 'depay_disabled' : 'invalid_signature' });
  if (route === '/runtime-config.js') return respond(200, `window.__OPENFUND_RUNTIME_CONFIG__=${JSON.stringify({ depayWidget: widgetOn, depayIntegrationId: widgetOn ? 'integration-0001' : '', depayWidgetUrl: '', walletConnectProjectId: '' })};`);
  if (route === '/' + widget.file) return respond(200, served);
  if (DEPAY_ROUTES.includes(route) && init.method === 'POST') return respond(depay, depay === 401 ? { error: 'invalid_signature' } : { error: 'not_found' });
  throw Error(route);
};

test('the pinned widget and runtime config are read from the repository and the served script', () => {
  const pin = pinnedWidget();
  assert.match(pin.integrity, /^sha384-/);
  assert.match(pin.file, /^assets\/vendor\/depay-widgets-/);
  assert.equal(parseRuntimeConfig('window.__OPENFUND_RUNTIME_CONFIG__={"depayWidget":true};').depayWidget, true);
  assert.throws(() => parseRuntimeConfig('nothing'), /does not define/);
});

test('ready only when payments, widget, integrity and every signed DePay route pass', async () => {
  assert.equal((await purchaseReadiness('http://x.test', { fetchImpl: fetchFor(), widget })).ready, true);
  const inactive = await purchaseReadiness('http://x.test', { fetchImpl: fetchFor({ depay: 404 }), widget });
  assert.equal(inactive.ready, false);
  assert.equal(inactive.checks.filter(c => c.name.startsWith('depay /') && /inactive/.test(c.detail)).length, DEPAY_ROUTES.length);
  assert.equal((await purchaseReadiness('http://x.test', { fetchImpl: fetchFor({ served: Buffer.from('tampered') }), widget })).ready, false);
  assert.equal((await purchaseReadiness('http://x.test', { fetchImpl: fetchFor({ enabled: false }), widget })).ready, false);
  const optional = (await purchaseReadiness('http://x.test', { fetchImpl: fetchFor(), widget })).checks.find(c => c.name === 'walletConnectProjectId');
  assert.equal(optional.ok, false, 'WalletConnect is reported but does not block readiness');
});

test('Openfund Pay: with DePay off for new payments, widget and configuration are informational; callbacks stay required', async () => {
  const off = { wallet: true, manual: true, depay: false }
  const report = await purchaseReadiness('http://x.test', { fetchImpl: fetchFor({ methods: off, configStatus: 404, widgetOn: false }), widget })
  assert.equal(report.ready, true, JSON.stringify(report.checks.filter(c => !c.ok && !c.optional)))
  assert.ok(report.checks.filter(c => /config/.test(c.name) && c.name.startsWith('depay /')).every(c => c.ok && /depay_disabled/.test(c.detail)))
  /* a configuration route that still serves new DePay payments while disabled is a failure */
  assert.equal((await purchaseReadiness('http://x.test', { fetchImpl: fetchFor({ methods: off }), widget })).ready, false)
  /* inactive callback/events routes (legacy reconciliation) still block readiness */
  assert.equal((await purchaseReadiness('http://x.test', { fetchImpl: fetchFor({ methods: off, configStatus: 404, depay: 404 }), widget })).ready, false)
  /* no method at all for new payments blocks readiness */
  assert.equal((await purchaseReadiness('http://x.test', { fetchImpl: fetchFor({ methods: { wallet: false, manual: false, depay: false }, configStatus: 404 }), widget })).ready, false)
})
