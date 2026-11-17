/* Site framing policy against a locally booted server (CI pattern).
 * The configured CMS origin (CMS_PUBLIC_URL; the local Directus default
 * outside production; production refuses to start without one) is the only
 * origin added to frame-ancestors, and X-Frame-Options is omitted because it
 * would override the CSP allowance.
 * CSP_EXTRA_FRAME_ANCESTORS accepts exact origins only: paths, wildcards and
 * other schemes are dropped. Requires DATABASE_URL (local *_test / *_ci) and
 * a built react/ directory. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new URL(process.env.DATABASE_URL || 'postgres://invalid');
if (!['localhost', '127.0.0.1'].includes(db.hostname) || !/(?:_test|_ci)$/.test(db.pathname)) throw Error('Use an isolated local *_test or *_ci DATABASE_URL.');
const port = Number(process.env.FRAMING_TEST_PORT || 8298);
const base = `http://localhost:${port}`;
const clean = { ...process.env }; for (const k of ['CMS_PUBLIC_URL', 'VITE_DIRECTUS_HOST', 'CSP_EXTRA_FRAME_ANCESTORS']) delete clean[k];

async function headersWith(extra) {
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'apps/backend'), stdio: 'ignore',
    env: { ...clean, PORT: String(port), ALLOWED_DOMAINS: `localhost:${port}`, SIM_TEST_MODE: '1', OPENFUND_ROLES: 'http', ...extra } });
  try {
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) throw Error('server exited');
      try { const r = await fetch(base + '/health', { signal: AbortSignal.timeout(1000) }); if (r.ok) return r.headers } catch { /* starting */ }
      await new Promise(r => setTimeout(r, 500));
    }
    throw Error('server did not become healthy');
  } finally { await new Promise(resolve => { child.once('exit', resolve); child.kill() }) }
}
const ancestors = h => h.get('content-security-policy').match(/frame-ancestors ([^;]+)/)[1].trim();

let h = await headersWith({})
assert.equal(ancestors(h), "'self' http://localhost:8055"); assert.equal(h.get('x-frame-options'), null)
console.log('PASS - development default: only the local Directus origin may frame the site')

h = await headersWith({ CMS_PUBLIC_URL: 'https://cms.example.test' })
assert.equal(ancestors(h), "'self' https://cms.example.test"); assert.equal(h.get('x-frame-options'), null)
console.log('PASS - configured CMS origin: only that exact origin added; X-Frame-Options omitted')

h = await headersWith({ CMS_PUBLIC_URL: 'http://localhost:8055',
  CSP_EXTRA_FRAME_ANCESTORS: 'http://localhost:8400, https://evil.example/path, *, javascript:alert(1), https://*.example.com, https://backstage.example.test' })
assert.equal(ancestors(h), "'self' http://localhost:8055 http://localhost:8400 https://backstage.example.test")
console.log('PASS - extra ancestors: exact origins kept; paths, wildcards and other schemes dropped')
console.log('Framing policy test passed.')
