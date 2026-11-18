/* Purchase-test readiness probe — read-only, no money, no signatures.
 *
 * Checks that a deployed (or locally booted) Openfund service is configured
 * for the owner's DePay and manual purchase test:
 *  - GET /purchases/plans: paymentsEnabled and non-empty manual chains;
 *  - GET /runtime-config.js: DePay widget enabled with an integration id;
 *  - the vendored DePay widget bundle served same-origin matches its pinned
 *    Subresource Integrity hash (DEPAY_WIDGETS_INTEGRITY);
 *  - every DePay signed route, canonical and /api/payments/depay/* aliases,
 *    is mounted and enforces signatures: an unsigned empty POST must be
 *    refused with 401 invalid_signature (404 means the route is inactive).
 *    Unsigned requests are rejected before any processing; nothing is
 *    created, paid or changed.
 *
 * Openfund Pay (ADR 0046): when /purchases/plans reports
 * `payment.methods.depay === false` (DePay off for NEW payments), the DePay
 * widget and configuration-route checks are informational and the
 * configuration routes must answer 404 `depay_disabled`; the callback and
 * events routes stay REQUIRED (legacy DePay payments must still reconcile),
 * and at least one method must be enabled for new payments.
 *
 * Usage: node scripts/release/purchase-readiness.mjs <base-url> [--json]
 * Exit 0 only when every check passes; the report names what is missing.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';

export const DEPAY_ROUTES = [
  '/purchases/depay/configuration', '/api/payments/depay/config', '/api/payments/depay/configuration',
  '/purchases/depay/callback', '/api/payments/depay/callback',
  '/purchases/depay/events', '/api/payments/depay/events',
];

export function pinnedWidget(source = fs.readFileSync(path.join(root, 'apps/web-react/src/features/purchase/depay-bundle.ts'), 'utf8')) {
  const integrity = source.match(/DEPAY_WIDGETS_INTEGRITY = '([^']+)'/)?.[1];
  const file = source.match(/DEPAY_WIDGETS_PATH = '([^']+)'/)?.[1];
  if (!integrity || !file) throw Error('Cannot read the pinned DePay widget from depay-bundle.ts.');
  return { integrity, file };
}

export function parseRuntimeConfig(script) {
  const json = String(script).match(/__OPENFUND_RUNTIME_CONFIG__\s*=\s*(\{[\s\S]*?\})\s*;?\s*$/m)?.[1];
  if (!json) throw Error('runtime-config.js does not define __OPENFUND_RUNTIME_CONFIG__.');
  return JSON.parse(json);
}

const CONFIG_ROUTES = new Set(DEPAY_ROUTES.filter(r => /config/.test(r)));

export async function purchaseReadiness(baseUrl, { fetchImpl = fetch, widget = pinnedWidget() } = {}) {
  const base = new URL(baseUrl);
  const checks = [];
  /* DePay-for-new-payments state reported by the server (null = not reported: legacy server) */
  let depayNew = null;
  /* optional checks are reported but do not block readiness */
  const add = (name, ok, detail, fix = null, optional = false) => checks.push({ name, ok: Boolean(ok), detail, ...(ok || !fix ? {} : { fix }), ...(optional ? { optional: true } : {}) });
  const get = route => fetchImpl(new URL(route, base), { cache: 'no-store', signal: AbortSignal.timeout(20000) });

  try {
    const plans = await (await get('/purchases/plans')).json();
    add('paymentsEnabled', plans.paymentsEnabled === true, `paymentsEnabled=${plans.paymentsEnabled}`,
      'Set PURCHASE_PAYMENT_RECEIVER and the settlement chain/token/RPC variables (PURCHASE_PAYMENT_CHAINS or PURCHASE_PAYMENT_CHAIN, PURCHASE_PAYMENT_TOKEN, PURCHASE_RPC_URL/PURCHASE_RPC_URLS); see the [payments] readiness line in the service log.');
    const manual = plans.payment?.manualChains ?? [];
    add('manualChains', manual.length > 0, `${manual.length} manual chain(s): ${manual.map(c => c.blockchain ?? c.chainId).join(', ') || 'none'}`,
      'Manual payment needs at least one ready chain with a token (production); configure PURCHASE_PAYMENT_CHAINS.');
    const methods = plans.payment?.methods;
    if (methods && typeof methods === 'object') {
      depayNew = methods.depay === true;
      const on = ['wallet', 'manual', 'depay'].filter(m => methods[m] === true);
      add('newPaymentMethods', on.length > 0, `enabled for new payments: ${on.join(', ') || 'none'}`,
        'Enable at least one method (Backstage → Payment methods, or PAYMENT_WALLET_ENABLED / PAYMENT_MANUAL_ENABLED).');
    }
  } catch (error) { add('purchases/plans', false, error.message, 'The service is unreachable or /purchases/plans failed.'); }

  let config = null;
  try {
    config = parseRuntimeConfig(await (await get('/runtime-config.js')).text());
    add('depayWidget', config.depayWidget === true, `depayWidget=${config.depayWidget}`, 'Set VITE_DEPAY_INTEGRATION_ID (and leave VITE_DEPAY_WIDGET unset or 1).', depayNew === false);
    add('depayIntegrationId', /^[A-Za-z0-9-]{8,64}$/.test(config.depayIntegrationId || ''), config.depayIntegrationId ? 'present' : 'missing',
      'Set VITE_DEPAY_INTEGRATION_ID to the public integration id from app.depay.com.', depayNew === false);
    add('walletConnectProjectId', Boolean(config.walletConnectProjectId), config.walletConnectProjectId ? 'present' : 'missing (optional: mobile wallets)');
  } catch (error) { add('runtime-config.js', false, error.message); }

  if (config && !config.depayWidgetUrl) {
    try {
      const response = await get('/' + widget.file);
      const bytes = Buffer.from(await response.arrayBuffer());
      const actual = 'sha384-' + crypto.createHash('sha384').update(bytes).digest('base64');
      add('depayWidgetIntegrity', response.ok && actual === widget.integrity, response.ok ? (actual === widget.integrity ? `/${widget.file} matches ${widget.integrity}` : `served ${actual}, pinned ${widget.integrity}`) : `/${widget.file} returned ${response.status}`,
        'Redeploy the release: the served vendored widget must match the pinned bundle.', depayNew === false);
    } catch (error) { add('depayWidgetIntegrity', false, error.message); }
  } else if (config) {
    add('depayWidgetIntegrity', Boolean(config.depayWidgetIntegrity), `external bundle ${config.depayWidgetUrl} with ${config.depayWidgetIntegrity ? 'SRI' : 'no SRI'}`);
  }

  for (const route of DEPAY_ROUTES) {
    try {
      const response = await fetchImpl(new URL(route, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000) });
      const body = await response.json().catch(() => ({}));
      if (depayNew === false && CONFIG_ROUTES.has(route)) {
        /* DePay off for new payments: the configuration route must refuse */
        add(`depay ${route}`, response.status === 404 && body.error === 'depay_disabled',
          response.status === 404 && body.error === 'depay_disabled' ? 'disabled for new payments (depay_disabled)' : `unexpected ${response.status} ${body.error || ''}`.trim(),
          'DePay is disabled for new payments: the configuration route must answer 404 depay_disabled.');
        continue;
      }
      add(`depay ${route}`, response.status === 401 && body.error === 'invalid_signature',
        response.status === 401 ? 'active; unsigned request refused' : response.status === 404 ? 'inactive (404)' : `unexpected ${response.status}`,
        'DePay routes are active only with paymentsEnabled, DEPAY_VERIFY_PUBLIC_KEY (and DEPAY_CONFIG_PRIVATE_KEY for the configuration route).');
    } catch (error) { add(`depay ${route}`, false, error.message); }
  }

  const required = checks.filter(c => c.name !== 'walletConnectProjectId' && !c.optional);
  return { url: base.origin, checkedAt: new Date().toISOString(), ready: required.every(c => c.ok), checks };
}

if (process.argv[1]?.endsWith('/purchase-readiness.mjs')) {
  const target = process.argv[2] || process.env.RELEASE_PUBLIC_URL;
  if (!target) throw Error('Usage: node scripts/release/purchase-readiness.mjs <base-url> [--json]');
  const report = await purchaseReadiness(target);
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    for (const c of report.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}${c.fix ? `\n      fix: ${c.fix}` : ''}`);
    console.log(report.ready ? 'Purchase test readiness: PASS' : 'Purchase test readiness: NOT READY');
  }
  process.exitCode = report.ready ? 0 : 1;
}
