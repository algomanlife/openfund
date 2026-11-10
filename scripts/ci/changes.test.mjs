import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './changes.mjs';

test('documentation-only change selects the docs tier', () => {
  const r = classify(['docs/product/FEATURE_STATUS.md', 'README.md', '.github/pull_request_template.md']);
  assert.equal(r.tier, 'docs');
  assert.equal(r.run_gates, false);
});

test('docs tooling, workflows, lockfiles, e2e and unknown paths are shared → full', () => {
  for (const f of ['scripts/docs/check-links.mjs', '.github/workflows/ci.yml', 'package-lock.json', 'apps/backend/package-lock.json', 'apps/web-react/package.json', 'e2e/test-ui-polish.cjs', 'vendor/vela/x.js', 'some-new-dir/file.txt']) {
    assert.equal(classify(['docs/a.md', f], { affectedTierEnabled: true }).tier, 'full', f);
  }
});

test('mixing code with docs is never docs-only', () => {
  assert.equal(classify(['docs/a.md', 'apps/backend/server.js']).tier, 'full');
});

test('affected tier is opt-in and component-scoped', () => {
  const backendOnly = ['apps/backend/server.js'];
  assert.equal(classify(backendOnly).tier, 'full');
  const r = classify(backendOnly, { affectedTierEnabled: true });
  assert.equal(r.tier, 'affected');
  assert.equal(r.run_backend_suite, true);
  assert.equal(r.run_presentation_matrices, false);
  const web = classify(['apps/web-react/src/App.tsx'], { affectedTierEnabled: true });
  assert.equal(web.run_backend_suite, false);
  assert.equal(web.run_presentation_matrices, true);
});

test('render.yaml and cross-component changes escalate', () => {
  assert.equal(classify(['render.yaml'], { affectedTierEnabled: true }).tier, 'full');
  const both = classify(['apps/backend/a.js', 'apps/web-react/src/a.ts'], { affectedTierEnabled: true });
  assert.equal(both.run_backend_suite && both.run_presentation_matrices, true);
});

test('empty change list is not docs-only', () => {
  assert.equal(classify([]).tier, 'full');
});
