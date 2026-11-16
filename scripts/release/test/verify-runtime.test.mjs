import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRuntime } from '../verify.mjs';
import { smokeDomains } from '../live-siwe-smoke.mjs';

const commit = 'a'.repeat(40);
const source = { tag: 'v9.9.9', version: '9.9.9', commit, frontend: { id: 'fe-id' } };
const liveVersion = { status: 'matched', commit, manifest: { tag: 'v9.9.9', official: true } };
const liveFrontend = { version: '9.9.9', commit, frontend: { id: 'fe-id' } };
const respond = body => ({ ok: true, json: async () => body });
const fetchFor = (overrides = {}) => async url => {
  const route = String(url);
  if (route.includes('/version')) return respond(overrides.version || liveVersion);
  if (route.includes('/react/release-manifest.json')) return respond(overrides.frontend || liveFrontend);
  if (route.includes('/server/health')) return overrides.cms || { ok: true };
  throw Error(`unexpected fetch ${route}`);
};
const siweCalls = [];
const siwe = { liveSiweSmoke: async args => { siweCalls.push(args); return []; }, smokeDomains: () => ['example.test'] };
const base = { baseUrl: 'https://app.example.test', cmsUrl: 'https://cms.example.test', manifest: source, siwe };

test('runtime verification passes on exact identity, CMS health and the SIWE gate', async () => {
  const result = await verifyRuntime({ ...base, fetchImpl: fetchFor() });
  assert.equal(result.status, 'verified');
  assert.equal(siweCalls.at(-1).baseUrl, base.baseUrl);
});

test('runtime verification rejects mismatched, unofficial or unhealthy deployments', async () => {
  await assert.rejects(verifyRuntime({ ...base, fetchImpl: fetchFor({ version: { ...liveVersion, status: 'mismatch' } }) }), /not matched/);
  await assert.rejects(verifyRuntime({ ...base, fetchImpl: fetchFor({ version: { ...liveVersion, manifest: { tag: 'v9.9.9', official: false } } }) }), /not official/);
  await assert.rejects(verifyRuntime({ ...base, fetchImpl: fetchFor({ version: { ...liveVersion, commit: 'b'.repeat(40) } }) }), /release tag commit/);
  await assert.rejects(verifyRuntime({ ...base, fetchImpl: fetchFor({ frontend: { ...liveFrontend, frontend: { id: 'other' } } }) }), /frontend manifest/);
  await assert.rejects(verifyRuntime({ ...base, fetchImpl: fetchFor({ cms: { ok: false, status: 503 } }) }), /CMS health/);
  await assert.rejects(verifyRuntime({ ...base, cmsUrl: '', fetchImpl: fetchFor() }), /CMS URL/);
});

test('an unofficial candidate passes only when explicitly requested', async () => {
  const unofficial = fetchFor({ version: { ...liveVersion, manifest: { tag: 'v9.9.9', official: false } } });
  await assert.rejects(verifyRuntime({ ...base, fetchImpl: unofficial }), /not official/);
  const result = await verifyRuntime({ ...base, requireOfficial: false, fetchImpl: unofficial });
  assert.equal(result.status, 'verified');
});

test('smoke domains come from the environment, never a hardcoded origin', () => {
  assert.deepEqual(
    smokeDomains({ RELEASE_PUBLIC_URL: 'https://a.example.test', RELEASE_SIWE_DOMAINS: 'b.example.test , a.example.test' }),
    ['b.example.test', 'a.example.test']);
  assert.deepEqual(smokeDomains({ ALLOWED_DOMAINS: 'c.example.test' }), ['c.example.test']);
  assert.throws(() => smokeDomains({}), /required/);
});
