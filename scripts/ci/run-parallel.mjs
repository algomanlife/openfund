#!/usr/bin/env node
/* Run independent shell commands concurrently with prefixed, line-buffered
 * output and a timing summary. Used to shard read-only browser matrices.
 *
 * Contract (deliberately strict):
 *  - every job runs exactly once; there is NO retry, so a deterministic failure
 *    can never be hidden;
 *  - the exit code is non-zero if any job fails, but all jobs are allowed to
 *    finish so one run reports every failure;
 *  - a job that exceeds --timeout-minutes is killed and counts as a failure.
 *
 * CLI:  node scripts/ci/run-parallel.mjs [--timeout-minutes N] \
 *         label cmd arg... +++ label ENV=VALUE cmd arg... +++ ...
 * Leading KEY=VALUE tokens after the label are environment overrides. */
import { spawn } from 'node:child_process';
import readline from 'node:readline';

export function parseJobs(tokens) {
  const jobs = [];
  let current = [];
  for (const token of [...tokens, '+++']) {
    if (token !== '+++') { current.push(token); continue; }
    if (!current.length) continue;
    const [label, ...rest] = current;
    const env = {};
    while (rest.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0])) {
      const [key, ...value] = rest.shift().split('=');
      env[key] = value.join('=');
    }
    if (!rest.length) throw Error(`Job "${label}" has no command.`);
    jobs.push({ label, env, command: rest[0], args: rest.slice(1) });
    current = [];
  }
  return jobs;
}

export async function runParallel(jobs, { cwd = process.cwd(), env: baseEnv = process.env, timeoutMinutes = 0, write = line => console.log(line) } = {}) {
  const width = Math.max(...jobs.map(job => job.label.length));
  const results = await Promise.all(jobs.map(job => new Promise(resolve => {
    const started = Date.now();
    const child = spawn(job.command, job.args, { cwd, env: { ...baseEnv, ...job.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let timedOut = false;
    const timer = timeoutMinutes > 0 ? setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMinutes * 60_000) : null;
    for (const stream of [child.stdout, child.stderr]) {
      readline.createInterface({ input: stream }).on('line', line => write(`[${job.label.padEnd(width)}] ${line}`));
    }
    const finish = (code, signal, error) => {
      if (timer) clearTimeout(timer);
      const seconds = Math.round((Date.now() - started) / 1000);
      resolve({ label: job.label, seconds, ok: code === 0 && !timedOut && !error, detail: error ? error.message : timedOut ? `timed out after ${timeoutMinutes} min` : signal ? `signal ${signal}` : `exit ${code}` });
    };
    child.on('error', error => finish(null, null, error));
    child.on('close', (code, signal) => finish(code, signal));
  })));
  write('\nParallel summary');
  for (const result of results) write(`  ${result.ok ? 'PASS' : 'FAIL'}  ${String(result.seconds).padStart(5)}s  ${result.label}${result.ok ? '' : ` (${result.detail})`}`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  let timeoutMinutes = 0;
  if (argv[0] === '--timeout-minutes') { timeoutMinutes = Number(argv[1]); argv.splice(0, 2); }
  const jobs = parseJobs(argv);
  if (!jobs.length) { console.error('No jobs given.'); process.exit(2); }
  const results = await runParallel(jobs, { timeoutMinutes });
  process.exit(results.every(result => result.ok) ? 0 : 1);
}
