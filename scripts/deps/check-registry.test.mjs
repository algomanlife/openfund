import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, render } from './check-registry.mjs';

const entry = (over = {}) => ({ id: 'x', name: 'X', category: 'c', upstream: 'u', license: 'MIT', version: '1.0.0', pins: [], locations: ['apps/backend'], vendoring: 'v', localModifications: 'none', usedAtRuntime: true, tests: [], updateProcedure: 'p', risks: ['r'], ...over });

test('a matching pin and an existing location validate', () => {
  const problems = validate({ entries: [entry({ pins: [{ file: 'a.json', pattern: '"v": "(1\\.0\\.0)"' }] })] }, () => '{"v": "1.0.0"}', () => true);
  assert.deepEqual(problems, []);
});

test('a drifted pin is reported', () => {
  const problems = validate({ entries: [entry({ pins: [{ file: 'a.json', pattern: '"v": "(1\\.0\\.0)"' }] })] }, () => '{"v": "2.0.0"}', () => true);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no longer matches/);
});

test('missing fields, duplicate ids and missing locations are reported', () => {
  const problems = validate({ entries: [entry(), entry(), { id: 'bare' }] }, () => '', file => file !== 'apps/backend');
  assert.ok(problems.some(p => /duplicate id/.test(p)));
  assert.ok(problems.some(p => /missing field/.test(p)));
  assert.ok(problems.some(p => /location does not exist/.test(p)));
});

test('render lists every entry', () => {
  const md = render({ verifiedOn: 'd', verifiedAgainst: 'm', note: 'n', entries: [entry({ name: 'Alpha' }), entry({ id: 'y', name: 'Beta', truth: 'real' })] });
  assert.match(md, /### Alpha/);
  assert.match(md, /Integration status \(verified from code\):\*\* real/);
});
