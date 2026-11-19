import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSbom } from '../sbom-check.mjs';

const good = { bomFormat: 'CycloneDX', specVersion: '1.6', metadata: { component: { name: 'openfund', version: 'v0.8.0' } }, components: Array.from({ length: 12 }, (_, i) => ({ name: 'p' + i })) };

test('a CycloneDX SBOM for the exact tag passes', () => assert.equal(checkSbom(good, 'v0.8.0'), 12));
test('the wrong tag, format or an empty inventory is refused', () => {
  assert.throws(() => checkSbom(good, 'v0.8.1'), /not openfund@v0.8.1/);
  assert.throws(() => checkSbom({ ...good, bomFormat: 'SPDX' }, 'v0.8.0'), /not CycloneDX/);
  assert.throws(() => checkSbom({ ...good, components: [] }, 'v0.8.0'), /only 0 components/);
});
