import test from 'node:test';
import assert from 'node:assert/strict';
import { check, REQUIRED_SECTIONS } from './check-pr-description.mjs';

const full = answer => REQUIRED_SECTIONS.map(name => `## ${name}\n${answer}\n`).join('\n');

test('a complete description passes', () => {
  assert.equal(check(full('Real answer.')).ok, true);
});

test('missing sections are listed', () => {
  const r = check('## Objective\nx\n');
  assert.equal(r.ok, false);
  assert.ok(r.problems.some(p => p.includes('Rollback')));
});

test('comment-only, bare N/A and placeholder answers fail; N/A with a reason passes', () => {
  assert.equal(check(full('<!-- fill me -->')).ok, false);
  assert.equal(check(full('N/A')).ok, false);
  assert.equal(check(full('TBD')).ok, false);
  assert.equal(check(full('N/A — documentation only')).ok, true);
});

test('bot-authored descriptions are exempt', () => {
  assert.equal(check('bump x', { author: 'dependabot[bot]' }).ok, true);
});

test('template comments do not satisfy a section', () => {
  const body = full('Done.').replace('## Rollback\nDone.', '## Rollback\n<!-- revert plan -->');
  assert.deepEqual(check(body).problems.length, 1);
});

test('titles must be Conventional Commits', () => {
  const body = full('ok');
  assert.equal(check(body, { title: 'feat(payments): finish DePay checkout' }).ok, true);
  assert.equal(check(body, { title: 'ci: shard browser matrices' }).ok, true);
  assert.equal(check(body, { title: 'Feat/terminal chart quick trade' }).ok, false);
  assert.equal(check(body, { title: 'Update README' }).ok, false);
});
