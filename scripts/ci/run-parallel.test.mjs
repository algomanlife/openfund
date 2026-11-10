import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJobs, runParallel } from './run-parallel.mjs';

test('parseJobs splits jobs and leading env overrides', () => {
  const jobs = parseJobs(['a', 'X=1', 'Y=a=b', 'node', '-e', '1', '+++', 'b', 'node', '-v']);
  assert.deepEqual(jobs.map(j => j.label), ['a', 'b']);
  assert.deepEqual(jobs[0].env, { X: '1', Y: 'a=b' });
  assert.deepEqual(jobs[0].args, ['-e', '1']);
  assert.throws(() => parseJobs(['lonely']), /no command/);
});

test('every job runs once, failures are reported and never retried', async () => {
  const lines = [];
  const results = await runParallel(parseJobs([
    'ok', process.execPath, '-e', 'console.log("hi")', '+++',
    'bad', process.execPath, '-e', 'console.error("boom");process.exit(3)',
  ]), { write: l => lines.push(l) });
  assert.deepEqual(results.map(r => [r.label, r.ok]), [['ok', true], ['bad', false]]);
  assert.ok(lines.some(l => /\[bad\s*\] boom/.test(l)));
});

test('a job over the timeout is killed and counted as a failure', async () => {
  const [result] = await runParallel(parseJobs(['slow', process.execPath, '-e', 'setTimeout(()=>{},60000)']), { timeoutMinutes: 0.002, write: () => {} });
  assert.equal(result.ok, false);
  assert.match(result.detail, /timed out/);
});
