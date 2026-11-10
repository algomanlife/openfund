#!/usr/bin/env node
/* Validates docs/integrations/upstream-registry.json against the repository:
 *  - every entry has the required fields;
 *  - every declared pin still matches the version in its manifest, workflow or
 *    PROVENANCE file (so the registry cannot silently drift);
 *  - every vendored/source location that names a repository path exists;
 *  - docs/integrations/UPSTREAM_REGISTRY.md is the current rendering
 *    (`--write` regenerates it).
 * No network access, no dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const registryPath = path.join(root, 'docs/integrations/upstream-registry.json');
const markdownPath = path.join(root, 'docs/integrations/UPSTREAM_REGISTRY.md');
const REQUIRED = ['id', 'name', 'category', 'upstream', 'license', 'version', 'pins', 'locations', 'vendoring', 'localModifications', 'usedAtRuntime', 'tests', 'updateProcedure', 'risks'];

export function validate(registry, read = file => fs.readFileSync(path.join(root, file), 'utf8'), exists = file => fs.existsSync(path.join(root, file))) {
  const problems = [];
  const ids = new Set();
  for (const entry of registry.entries) {
    for (const key of REQUIRED) if (!(key in entry)) problems.push(`${entry.id || '?'}: missing field "${key}"`);
    if (ids.has(entry.id)) problems.push(`${entry.id}: duplicate id`);
    ids.add(entry.id);
    for (const pin of entry.pins || []) {
      if (!exists(pin.file)) { problems.push(`${entry.id}: pin file missing ${pin.file}`); continue; }
      const match = new RegExp(pin.pattern).exec(read(pin.file));
      if (!match) problems.push(`${entry.id}: ${pin.file} no longer matches /${pin.pattern}/ — update the registry together with the dependency`);
    }
    for (const location of entry.locations || []) {
      const candidate = /^([A-Za-z0-9_./-]+)/.exec(location)?.[1];
      if (candidate && /^(vendor|third_party|packages|apps|infrastructure|scripts|docs)\//.test(candidate) && !exists(candidate.replace(/\/$/, ''))) problems.push(`${entry.id}: location does not exist: ${candidate}`);
    }
  }
  return problems;
}

export function render(registry) {
  const rows = registry.entries.map(e => `| ${e.name} | ${e.version} | ${e.license.split(' (')[0].split(';')[0]} | ${e.usedAtRuntime ? 'yes' : 'no'} | ${e.locations[0].split(' (')[0]} |`);
  const details = registry.entries.map(e => [
    `### ${e.name}`, '',
    `- **Upstream:** ${e.upstream}`,
    `- **License:** ${e.license}`,
    `- **Pinned version:** ${e.version}`,
    e.commit ? `- **Source commit:** ${e.commit}` : null,
    `- **Where:** ${e.locations.join('; ')}`,
    `- **Vendoring method:** ${e.vendoring}`,
    `- **Local Openfund modifications:** ${e.localModifications}`,
    `- **Used by the running application:** ${e.usedAtRuntime ? 'yes' : 'no'}`,
    e.truth ? `- **Integration status (verified from code):** ${e.truth}` : null,
    `- **Tests:** ${e.tests.length ? e.tests.join('; ') : 'none (not exercised by any build or test)'}`,
    `- **Update procedure:** ${e.updateProcedure}`,
    `- **Risks:** ${e.risks.join(' ')}`, '',
  ].filter(line => line !== null).join('\n'));
  return [
    '# Upstream dependency registry', '',
    '<!-- Generated from upstream-registry.json by scripts/deps/check-registry.mjs --write. Edit the JSON, not this file. -->', '',
    `Verified against \`${registry.verifiedAgainst}\` on ${registry.verifiedOn}. ${registry.note}`, '',
    'The process for changing any of these is in [Dependency governance](../development/DEPENDENCY_GOVERNANCE.md). Source-management rules for vendored code are in [Upstream source management](UPSTREAM.md).', '',
    '## Summary', '',
    '| Dependency | Version | License | Runtime | Primary location |', '| --- | --- | --- | --- | --- |', ...rows, '',
    '## Details', '', ...details,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const rendered = render(registry);
  if (process.argv.includes('--write')) { fs.writeFileSync(markdownPath, rendered); console.log('Wrote', path.relative(root, markdownPath)); }
  const problems = validate(registry);
  if (!fs.existsSync(markdownPath) || fs.readFileSync(markdownPath, 'utf8') !== rendered) problems.push('docs/integrations/UPSTREAM_REGISTRY.md is stale — run: node scripts/deps/check-registry.mjs --write');
  if (problems.length) { for (const p of problems) console.error(`registry: ${p}`); process.exit(1); }
  console.log(`Upstream registry OK: ${registry.entries.length} entries, ${registry.entries.reduce((n, e) => n + e.pins.length, 0)} pins verified.`);
}
