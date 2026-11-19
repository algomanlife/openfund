import test from 'node:test';
import assert from 'node:assert/strict';
import { summarise } from './osv-summary.mjs';

test('lists only lockfiles with vulnerable packages, without the container prefix', () => {
  const md = summarise({ results: [
    { source: { path: '/repo/apps/web-react/package-lock.json' }, packages: [{ vulnerabilities: [{}] }, { vulnerabilities: [] }] },
    { source: { path: '/repo/apps/backend/package-lock.json' }, packages: [{ vulnerabilities: [] }] },
  ] });
  assert.match(md, /`apps\/web-react\/package-lock.json`: 1/);
  assert.doesNotMatch(md, /backend/);
  assert.match(summarise({}), /- none/);
});
