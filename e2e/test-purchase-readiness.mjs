/* Purchase-readiness probe against a locally booted server (CI pattern).
 * Boots the backend twice on a spare port against the isolated test
 * database: once with complete throw-away DePay and settlement test
 * configuration (generated RSA keys, placeholder receiver, no real money;
 * the probe must PASS), once without DePay keys (the probe must report the
 * inactive signed routes). Requires DATABASE_URL (local *_test / *_ci) and a
 * built react/ directory, like the backend CI job. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { purchaseReadiness } from '../scripts/release/purchase-readiness.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new URL(process.env.DATABASE_URL || 'postgres://invalid');
if (!['localhost', '127.0.0.1'].includes(db.hostname) || !/(?:_test|_ci)$/.test(db.pathname)) throw Error('Use an isolated local *_test or *_ci DATABASE_URL.');
const port = Number(process.env.READINESS_TEST_PORT || 8297);
const base = `http://localhost:${port}`;

async function boot(extra) {
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'apps/backend'), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), ALLOWED_DOMAINS: `localhost:${port}`, CORS_ORIGINS: base, SIM_TEST_MODE: '1', OPENFUND_ROLES: 'http', ...extra } });
  let log = ''; child.stdout.on('data', d => { log += d }); child.stderr.on('data', d => { log += d });
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw Error(`server exited: ${log.slice(-800)}`);
    try { if ((await fetch(base + '/health', { signal: AbortSignal.timeout(1000) })).ok) return child } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 500));
  }
  child.kill(); throw Error(`server did not become healthy: ${log.slice(-800)}`);
}
const stop = child => new Promise(resolve => { child.once('exit', resolve); child.kill(); });

const pemPair = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const verify = pemPair(), config = pemPair();
const testPayments = {
  PURCHASE_PAYMENT_RECEIVER: '0x000000000000000000000000000000000000c1a1',
  PURCHASE_PAYMENT_CHAIN: '42161',
  DEPAY_VERIFY_PUBLIC_KEY: verify.publicKey,
  DEPAY_CONFIG_PRIVATE_KEY: config.privateKey,
  VITE_DEPAY_INTEGRATION_ID: 'readiness-test-0001',
};

let server = await boot(testPayments);
try {
  const report = await purchaseReadiness(base);
  const failing = report.checks.filter(c => !c.ok && c.name !== 'walletConnectProjectId').map(c => `${c.name}: ${c.detail}`);
  assert.equal(report.ready, true, failing.join('; '));
  assert.ok(report.checks.some(c => c.name === 'depay /api/payments/depay/config' && c.ok), 'DePay alias route enforces signatures');
  console.log('PASS - configured service reports purchase-test readiness');
} finally { await stop(server); }

const { DEPAY_VERIFY_PUBLIC_KEY, DEPAY_CONFIG_PRIVATE_KEY, ...withoutDepay } = testPayments;
server = await boot(withoutDepay);
try {
  const report = await purchaseReadiness(base);
  assert.equal(report.ready, false);
  assert.ok(report.checks.find(c => c.name === 'paymentsEnabled').ok, 'settlement chain is still ready');
  assert.ok(report.checks.filter(c => c.name.startsWith('depay /')).every(c => !c.ok && /inactive/.test(c.detail) && c.fix), 'inactive DePay routes are named with a fix');
  console.log('PASS - missing DePay keys are reported precisely');
} finally { await stop(server); }
console.log('Purchase readiness boot test passed.');
