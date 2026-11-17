import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateSource } from '../candidate-source.mjs';

const sha = 'a'.repeat(40);
const required = ['Release package gates','Release secret scan','Directus bootstrap and public permissions','Backend (API + engine)','Web (React + Vite)','Secret scan','Render Blueprint'];
const green = required.map(name => ({ name, conclusion: 'success', app: { slug: 'github-actions' } }));
const fake = (overrides = {}) => async route => {
  if (route === 'branches/main') return overrides.branch ?? { commit: { sha } };
  if (route === 'releases/latest') return overrides.release ?? { tag_name: 'v0.5.0', draft: false, prerelease: false };
  if (route.startsWith('commits/')) return { check_runs: overrides.runs ?? green };
  if (route.startsWith('compare/')) return overrides.compare ?? { status: 'ahead', total_commits: 261, commits: Array.from({ length: 250 }, (_, i) => ({ sha: String(i) })) };
  throw Error(`unexpected route ${route}`);
};

test('more than 250 commits since the latest release no longer blocks the gated main candidate', async () => {
  const candidate = await candidateSource(sha, { get: fake() });
  assert.equal(candidate.official, false);
  assert.equal(candidate.latestOfficial, 'v0.5.0');
  assert.equal(candidate.commitsSinceOfficial, 261);
});

test('the candidate guards still hold', async () => {
  await assert.rejects(candidateSource('nope', { get: fake() }), /exact source SHA/);
  await assert.rejects(candidateSource(sha, { get: fake({ branch: { commit: { sha: 'b'.repeat(40) } } }) }), /current main commit/);
  await assert.rejects(candidateSource(sha, { get: fake({ release: { tag_name: 'v0.5.0', draft: true } }) }), /invalid/);
  await assert.rejects(candidateSource(sha, { get: fake({ compare: { status: 'behind', total_commits: 3, commits: [] } }) }), /Cannot derive/);
  await assert.rejects(candidateSource(sha, { get: fake({ compare: { status: 'identical', total_commits: 0, commits: [] } }) }), /Cannot derive/);
  await assert.rejects(candidateSource(sha, { get: fake({ runs: green.slice(1) }) }), /Release package gates/);
  await assert.rejects(candidateSource(sha, { get: fake({ runs: green.map(r => r.name === 'Secret scan' ? { ...r, app: { slug: 'other' } } : r) }) }), /Secret scan/);
});
