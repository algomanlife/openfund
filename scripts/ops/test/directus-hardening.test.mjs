/* OF-2026-11-11 compensating controls for Directus 11.x, verified against a
 * running Directus started with the literal openfund-cms environment from
 * render.yaml (scripts/ops/directus-env.mjs).
 *
 *   DIRECTUS_URL (local), DIRECTUS_ADMIN_EMAIL, DIRECTUS_ADMIN_PASSWORD
 *   DIRECTUS_INTERNAL_PORT  port Directus listens on inside its own network
 *                           namespace (default 8055)
 *
 * The probes are aimed at Directus itself (loopback) and at private ranges;
 * no external host is contacted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { directusEnv } from '../directus-env.mjs';

const BASE = process.env.DIRECTUS_URL;
const PORT = process.env.DIRECTUS_INTERNAL_PORT || '8055';
const ready = BASE && ['localhost', '127.0.0.1'].includes(new URL(BASE).hostname);
if (process.env.DIRECTUS_HARDENING_REQUIRE === '1' && !ready) throw Error('DIRECTUS_HARDENING_REQUIRE=1 but DIRECTUS_URL is not a local Directus');
const skip = !ready && 'no local Directus';

async function call(method, p, { token, body, form } = {}) {
  const r = await fetch(new URL(p, BASE), { method, signal: AbortSignal.timeout(20000),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(form ? {} : { 'content-type': 'application/json' }) },
    body: form || (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: r.status, body: json };
}
const admin = async () => (await call('POST', '/auth/login', { body: { email: process.env.DIRECTUS_ADMIN_EMAIL, password: process.env.DIRECTUS_ADMIN_PASSWORD } })).body.data.access_token;

test('render.yaml carries the 11.x compensating controls', () => {
  const env = Object.fromEntries(directusEnv());
  assert.equal(env.CACHE_ENABLED, 'false');
  assert.equal(env.WEBSOCKETS_ENABLED, 'false');
  for (const r of ['0.0.0.0', '0.0.0.0/8', '127.0.0.0/8', '::', '::1', '169.254.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'])
    assert.ok(env.IMPORT_IP_DENY_LIST.split(',').includes(r), r);
  assert.doesNotMatch(env.FILES_MIME_TYPE_ALLOW_LIST, /html|svg|xml|javascript|\*/);
});

test('GHSA-j5h6-vqc3-phqh: file import cannot reach Directus itself, loopback, link-local or private ranges', { skip }, async () => {
  const token = await admin();
  const targets = [`http://0.0.0.0:${PORT}/server/ping`, `http://0.0.0.1:${PORT}/server/ping`, `http://[::]:${PORT}/server/ping`,
    `http://127.0.0.1:${PORT}/server/ping`, `http://localhost:${PORT}/server/ping`, 'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/', 'http://172.16.0.1/', 'http://192.168.0.1/', 'http://100.64.0.1/'];
  for (const url of targets) {
    const r = await call('POST', '/files/import', { token, body: { url } });
    assert.ok(r.status >= 400, `import of ${url} was accepted (${r.status})`);
  }
});

test('uploads are limited to the allowed media types', { skip }, async () => {
  const token = await admin();
  const upload = async (type, name, content) => {
    const form = new FormData();
    form.append('file', new Blob([content], { type }), name);
    return call('POST', '/files', { token, form });
  };
  const html = await upload('text/html', 'x.html', '<script>alert(1)</script>');
  assert.ok(html.status >= 400, `HTML upload accepted (${html.status})`);
  const svg = await upload('image/svg+xml', 'x.svg', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
  assert.ok(svg.status >= 400, `SVG upload accepted (${svg.status})`);
  /* a real 1x1 PNG is accepted and removed again */
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5f0000000049454e44ae426082', 'hex');
  const ok = await upload('image/png', 'pixel.png', png);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await call('DELETE', `/files/${ok.body.data.id}`, { token })).status, 204);
});

test('anonymous users cannot upload or import files', { skip }, async () => {
  const form = new FormData();
  form.append('file', new Blob(['x'], { type: 'image/png' }), 'x.png');
  assert.ok((await call('POST', '/files', { form })).status >= 400);
  assert.ok((await call('POST', '/files/import', { body: { url: 'https://example.com/' } })).status >= 400);
});

test('GHSA-7h45-q5jx-7r87: no non-admin policy may create or update shares; no policy grants directus_files to the public beyond read', { skip }, async () => {
  const token = await admin();
  const policies = (await call('GET', '/policies?fields=id,name,admin_access&limit=-1', { token })).body.data;
  const nonAdmin = new Set(policies.filter(p => !p.admin_access).map(p => p.id));
  const perms = (await call('GET', '/permissions?fields=policy,collection,action&limit=-1', { token })).body.data;
  const shareWrites = perms.filter(p => nonAdmin.has(p.policy) && p.collection === 'directus_shares' && ['create', 'update'].includes(p.action));
  assert.deepEqual(shareWrites, [], 'a non-admin policy can create or update directus_shares');
  const pub = policies.find(p => /public/i.test(p.name));
  const publicFiles = perms.filter(p => p.policy === pub?.id && p.collection === 'directus_files' && p.action !== 'read');
  assert.deepEqual(publicFiles, []);
});

test('GHSA-c6w9-5g5j-jh2p: the response cache is off at runtime', { skip }, async () => {
  /* with CACHE_ENABLED=false Directus never sets a cache status header */
  const r1 = await fetch(new URL('/items/ui_messages?limit=1', BASE));
  const r2 = await fetch(new URL('/items/ui_messages?limit=1', BASE));
  await r1.text(); await r2.text();
  assert.equal(r2.headers.get('x-cache-status'), null);
  assert.doesNotMatch(r2.headers.get('cache-control') || '', /max-age=[1-9]/);
});

test('WebSockets are disabled', { skip }, async () => {
  const { request } = await import('node:http');
  const status = await new Promise((resolve, reject) => {
    const req = request(new URL('/websocket', BASE), { headers: { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': randomBytes(16).toString('base64') }, timeout: 10000 });
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(101); });
    req.on('response', res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end();
  });
  assert.notEqual(status, 101, 'Directus accepted a WebSocket upgrade');
});
