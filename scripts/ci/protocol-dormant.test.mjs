/* OF-2026-11-09 activation block: packages/openfund-protocol is a dormant,
 * imported contract foundation whose development tooling and pinned
 * OpenZeppelin 4.5.0 carry known advisories (docs/security). It must stay
 * outside every install, build, test, release and deploy path until the
 * dependency upgrade, a contract audit and an owner decision activate it.
 * This test fails as soon as anything starts to use it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PKG = 'packages/openfund-protocol';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (dir, filter, out = []) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (['node_modules', 'dist', 'react', 'vendor', 'third_party', '.git', 'release', 'out'].includes(e.name)) continue;
    if (e.isDirectory()) walk(rel, filter, out); else if (filter(rel)) out.push(rel);
  }
  return out;
};

test('no workflow installs, builds, tests or deploys the protocol package', () => {
  for (const wf of fs.readdirSync(path.join(root, '.github/workflows'))) {
    const text = read(`.github/workflows/${wf}`);
    assert.doesNotMatch(text, /openfund-protocol|hardhat/i, `${wf} references the dormant protocol package`);
  }
});

test('no application or script source imports the protocol package or its contracts', () => {
  const code = [...walk('apps', f => /\.(m?js|cjs|ts|tsx|jsx)$/.test(f)), ...walk('scripts', f => /\.(m?js|cjs|ts)$/.test(f)), ...walk('e2e', f => /\.(m?js|cjs|ts)$/.test(f))]
    .filter(f => f !== 'scripts/ci/protocol-dormant.test.mjs');
  const importRe = /(?:from\s+|require\(\s*|import\(\s*)['"][^'"]*(?:openfund-protocol|packages\/openfund-protocol|@openzeppelin\/contracts)[^'"]*['"]/;
  const offenders = code.filter(f => importRe.test(read(f)));
  assert.deepEqual(offenders, []);
});

test('no package manifest, workspace or deployment configuration pulls the protocol package in', () => {
  const manifests = walk('.', f => /(^|\/)package\.json$/.test(f) && !f.startsWith(PKG + '/'));
  for (const m of manifests) {
    const p = JSON.parse(read(m));
    const deps = { ...p.dependencies, ...p.devDependencies, ...p.optionalDependencies, ...p.peerDependencies };
    assert.ok(!Object.keys(deps).some(d => /openfund-protocol|^@openzeppelin\/contracts/.test(d)), `${m} depends on the protocol package or OpenZeppelin`);
    assert.ok(!JSON.stringify(p.workspaces || []).includes('openfund-protocol'), `${m} adds the protocol package to a workspace`);
    assert.ok(!Object.values(p.scripts || {}).some(s => /openfund-protocol|hardhat/.test(s)), `${m} has a script that runs the protocol package`);
  }
  assert.doesNotMatch(read('render.yaml'), /openfund-protocol|hardhat/i);
  assert.doesNotMatch(read('.github/dependabot.yml'), /openfund-protocol/, 'automatic dependency updates must not target the dormant package');
});

test('the package still declares itself dormant and keeps its provenance', () => {
  assert.match(JSON.parse(read(`${PKG}/package.json`)).description, /Dormant module/);
  assert.ok(fs.existsSync(path.join(root, PKG, 'PROVENANCE.md')));
  assert.ok(fs.existsSync(path.join(root, PKG, 'LICENSE')));
});
