import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSource } from '../render-source.mjs';
import { sha256 } from '../lib.mjs';

const sha = 'c'.repeat(40);
const manifest = { version: '0.6.5', tag: 'v0.6.5', commit: sha, official: true, verification: { status: 'passed' }, frontend: { id: 'f' }, backend: { id: 'b' } };
const bytes = Buffer.from(JSON.stringify(manifest));
const release = (over = {}) => ({ tag_name: 'v0.6.5', draft: false, prerelease: false,
  assets: [{ id: 9, name: 'release-manifest.json', digest: `sha256:${sha256(bytes)}` }], ...over });
const getter = ({ tags = [{ name: 'v0.6.5', commit: { sha } }], rel = release() } = {}) => async url => {
  if (url.includes('/tags?')) return tags;
  if (url.includes('/releases/tags/')) return rel;
  throw Error(url);
};
const noCandidate = async () => { throw Error('candidate path must not run for a tagged commit'); };

test('a tagged commit builds the published official release after digest and identity checks', async () => {
  const source = await renderSource(sha, { get: getter(), assetBytes: async () => bytes, candidate: noCandidate });
  assert.equal(source.official, true);
  assert.equal(source.version, '0.6.5');
});

test('the official path refuses drafts, missing or tampered manifests and identity mismatches', async () => {
  await assert.rejects(renderSource(sha, { get: getter({ rel: release({ draft: true }) }), assetBytes: async () => bytes, candidate: noCandidate }), /manifest is missing/);
  await assert.rejects(renderSource(sha, { get: getter({ rel: release({ assets: [] }) }), assetBytes: async () => bytes, candidate: noCandidate }), /manifest is missing/);
  await assert.rejects(renderSource(sha, { get: getter(), assetBytes: async () => Buffer.from('{}'), candidate: noCandidate }), /digest mismatch/);
  const other = Buffer.from(JSON.stringify({ ...manifest, official: false }));
  await assert.rejects(renderSource(sha, { get: getter({ rel: release({ assets: [{ id: 9, name: 'release-manifest.json', digest: `sha256:${sha256(other)}` }] }) }), assetBytes: async () => other, candidate: noCandidate }), /identity/);
});

test('an untagged commit uses the gated candidate, explicitly unofficial', async () => {
  const source = await renderSource(sha, { get: getter({ tags: [] }), assetBytes: async () => bytes,
    candidate: async s => ({ version: '0.5.0', sha: s, checks: ['Release package gates'] }) });
  assert.deepEqual([source.official, source.version, source.commit], [false, '0.5.0', sha]);
});
