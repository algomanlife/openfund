import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMerges, render } from '../summary.mjs';

const record = (sha, subject, body) => `${sha}\x1f${subject}\x1f${body}\x1e`;

test('parses pull request merges and ignores other merges', () => {
  const log = record('a'.repeat(40), 'Merge pull request #7 from o/feat-x', 'feat(chart): quick trade\n') +
    record('b'.repeat(40), "Merge branch 'main' into x", '') +
    record('c'.repeat(40), 'Merge pull request #8 from o/fix-y', 'fix!: wrong rounding');
  const prs = parseMerges(log);
  assert.deepEqual(prs.map(p => [p.number, p.type, p.scope, p.breaking]), [[7, 'feat', 'chart', false], [8, 'fix', '', true]]);
});

test('renders groups, breaking changes and the review checklist; never claims a release', () => {
  const md = render(parseMerges(record('a'.repeat(40), 'Merge pull request #9 from o/x', 'ci: shard\n') + record('b'.repeat(40), 'Merge pull request #10 from o/y', 'Untyped title')), { from: 'v0.4.4', to: 'HEAD' });
  assert.match(md, /## CI/);
  assert.match(md, /## Other changes/);
  assert.match(md, /Reviewer checklist/);
  assert.match(md, /Not a release/);
});
