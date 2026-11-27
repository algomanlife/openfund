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
const parts = v => v.replace(/^v/, '').split('.').map(Number);
const compare = (a, b) => { const x = parts(a), y = parts(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
/** An owner-approved explicit version (manual main-branch dispatch only).
 * The conventional-commit allocation still decides the release line:
 * - a patch allocation (e.g. 0.5.1) must be requested exactly — no skipping;
 * - a minor or major allocation (e.g. 0.6.0) lets the owner choose the patch
 *   number inside that new line (0.6.0, 0.6.5 …), never a lower line, a later
 *   minor/major line, or a version that is already tagged. */
export function requestedVersion({ latest, requested, allocated, tags = [], keepMinorLine = false }) {
  if (!semver.test(requested || '')) throw Error('Explicit release version must be MAJOR.MINOR.PATCH.');
  if (!/^v\d+\.\d+\.\d+$/.test(latest || '')) throw Error('An existing SemVer tag is required for an explicit release.');
  if (tags.includes(`v${requested}`)) throw Error(`v${requested} is already released; tags are immutable.`);
  if (compare(requested, latest) <= 0) throw Error(`Explicit release version must be newer than ${latest}.`);
  const [lMajor, lMinor] = parts(latest), [aMajor, aMinor] = parts(allocated), [rMajor, rMinor] = parts(requested);
  /* Opt-in owner patch line (keep_minor_line): when the commits allocate only
   * a minor bump (never a breaking change), an explicit dispatch may keep the
   * release in the latest tag's minor line, for example 0.8.5 after v0.8.0. */
  const minorBumpOnly = aMajor === lMajor && aMinor === lMinor + 1;
  if (keepMinorLine) {
    if (!minorBumpOnly || rMajor !== lMajor || rMinor !== lMinor)
      throw Error(`keep_minor_line needs a feature-only batch and a version in the ${lMajor}.${lMinor}.x line.`);
    return requested;
  }
  if (compare(requested, allocated) < 0) throw Error(`The commits since ${latest} require at least ${allocated}.`);
  const patchOnly = aMajor === lMajor && aMinor === lMinor;
  if (patchOnly) return requestedPatchVersion(latest, requested);
  if (rMajor !== aMajor || rMinor !== aMinor) throw Error(`Explicit release version must stay in the allocated ${aMajor}.${aMinor}.x line.`);
  return requested;
}
/** An explicit patch release may override conventional-commit allocation,
 * but cannot skip or reuse a published version. */
export function requestedPatchVersion(latest, requested) {
  if (!/^v\d+\.\d+\.\d+$/.test(latest || '')) throw Error('An existing SemVer tag is required for an explicit patch release.');
  const [major, minor, patch] = latest.slice(1).split('.').map(Number);
  const expected = `${major}.${minor}.${patch + 1}`;
  if (requested !== expected) throw Error(`Explicit release version must be the next patch ${expected}.`);
  return requested;
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
/* Every repository path the backend imports at runtime must be listed here:
   the release archive and the GHCR image contain only these files.
   payloadImportProblems() fails the release build when one is missing. */
export function releasePayloadFiles() {
  return git('ls-files', 'apps/backend', 'packages/openfund-footprint/src', 'packages/open-oracle/src',
    'packages/plan-validation', 'packages/site-search',
    'third_party/luxalgo-trade-journal', 'LICENSE', 'NOTICE', 'render.yaml').split('\n').filter(Boolean);
}
/** Relative imports in the shipped backend that resolve outside the payload. */
export function payloadImportProblems(files = releasePayloadFiles()) {
  const shipped = new Set(files), problems = [];
  for (const file of files) {
    if (!/^apps\/backend\/(?!test\/|node_modules\/)[^]*\.(?:m?js)$/.test(file)) continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
      if (!shipped.has(target)) problems.push(`${file} imports ${m[1]} (${target}), which is not in the release payload`);
    }
  }
  return problems;
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
