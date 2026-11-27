/* The release archive and the GHCR image contain only releasePayloadFiles():
   every repository module the backend imports at runtime must be in it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { releasePayloadFiles, payloadImportProblems } from '../lib.mjs';

test('the release payload holds every module the backend imports', () => {
  assert.deepEqual(payloadImportProblems(), []);
});

test('a payload without a shared package is reported', () => {
  const without = releasePayloadFiles().filter(file => !file.startsWith('packages/open-oracle/'));
  assert.ok(payloadImportProblems(without).some(problem => problem.includes('packages/open-oracle/src/')));
});
