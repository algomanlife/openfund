import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
export const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
export const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function nextVersion(tags, messages = '') {
  const versions = tags.map(t => t.replace(/^v/, '')).filter(t => semver.test(t)).sort((a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  if (!versions.length) return '0.1.0';
  let [major, minor, patch] = versions.at(-1).split('.').map(Number);
  if (/BREAKING CHANGE:|^[a-z]+(?:\([^\n]*\))?!:/m.test(messages)) { major++; minor = 0; patch = 0; }
  else if (/^feat(?:\([^\n]*\))?:/m.test(messages)) { minor++; patch = 0; }
  else patch++;
  return `${major}.${minor}.${patch}`;
}
export function validateEnv(env, purpose = 'test') {
  if (!env.DATABASE_URL) throw Error('DATABASE_URL is required; no default database is allowed for release tooling.');
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('DATABASE_URL must identify PostgreSQL.');
  if (purpose === 'test' && (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/(?:^|[_-])(test|audit|ci)(?:$|[_-])/.test(url.pathname.slice(1)))) throw Error('Release gates require a local isolated test/audit/ci database.');
  if (purpose === 'production') {
    if (!env.ALLOWED_DOMAINS?.trim()) throw Error('Production ALLOWED_DOMAINS is required.');
    if (env.SIM_TEST_MODE) throw Error('SIM_TEST_MODE must be disabled in production.');
    if (!env.RELEASE_VERSION || !semver.test(env.RELEASE_VERSION) || !/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT || '')) throw Error('Production release version and immutable Render commit are required.');
  }
}
export function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(Error(`${command} ${args.join(' ')} failed (${signal || code})`)));
  });
}
export function filesIn(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name, 'en')).flatMap(e => {
    const relative = prefix + e.name, full = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw Error(`Release payload cannot contain symlinks: ${relative}`);
    return e.isDirectory() ? filesIn(full, relative + '/') : [relative];
  });
}
export function treeHash(dir) {
  return sha256(filesIn(dir).filter(f => f !== 'release-manifest.json').map(f => `${f}\0${sha256(fs.readFileSync(path.join(dir, f)))}`).join('\n'));
}
export async function healthy(url, child) {
  for (let i = 0; i < 60; i++) {
    if (child && child.exitCode !== null) throw Error('Backend stopped before becoming healthy.');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* bounded startup retry */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw Error(`Health timeout: ${url}`);
}
// Download a GitHub Release asset through the REST asset endpoint
// (Accept: application/octet-stream). The browser download URL started
// answering 504 for automated clients on 2026-11-08, so it is not used.
// Retries transient 5xx and network failures with backoff.
export async function releaseAssetBytes(repo, assetId, { attempts = 5, fetchImpl = fetch, delayMs = 2000 } = {}) {
  const url = `https://api.github.com/repos/${repo}/releases/assets/${assetId}`;
  const headers = { Accept: 'application/octet-stream', 'User-Agent': 'openfund-release-verifier' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      last = Error(`Release asset ${assetId} returned ${response.status}`);
      if (response.status < 500 && response.status !== 429) throw last;
    } catch (error) {
      last = error;
      if (/returned 4\d\d/.test(error.message) && !/returned 429/.test(error.message)) throw error;
    }
    if (i < attempts) await new Promise(resolve => setTimeout(resolve, delayMs * i));
  }
  throw Error(`Cannot read release asset ${assetId}: ${last?.message}`);
}
