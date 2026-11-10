#!/usr/bin/env node
/* Dependency-aware change classification for CI tiering.
 *
 * Input: the list of files changed by a pull request. Output (GitHub step
 * outputs): tier, docs_only, web, backend, cms, blueprint, shared, plus the
 * suite switches `run_backend_suite` and `run_presentation_matrices`.
 *
 * Tiers
 *   docs      every changed file is documentation or repository metadata that
 *             no build, test or runtime reads. Heavy gates are skipped; the
 *             job still runs and reports so required check names stay green.
 *   affected  OPT-IN (CI_TIER_AFFECTED=1): code changed but only inside one
 *             component; suites that cannot depend on that component are
 *             skipped. Any shared/unknown path escalates to full.
 *   full      everything else — and always for pushes to main, schedules,
 *             manual runs and release dispatches (decided by the workflow,
 *             not here).
 *
 * Fail-safe rule: a path that matches no rule is treated as shared, which
 * selects the full tier. Adding a new top-level directory therefore can never
 * silently reduce coverage. */
import fs from 'node:fs';

const RULES = [
  // [component, test(path)]
  ['docs', f => /^docs\//.test(f) || /^[A-Za-z0-9_.-]+\.md$/.test(f) || f === '.github/pull_request_template.md' || f === '.github/CODEOWNERS' || /^\.github\/ISSUE_TEMPLATE\//.test(f) || f === '.markdownlint-cli2.jsonc'],
  ['web', f => /^apps\/web-react\//.test(f) && !/package(-lock)?\.json$/.test(f)],
  ['web', f => /^packages\/openfund-(charts|gains-adapter)\//.test(f)],
  ['backend', f => /^apps\/backend\//.test(f) && !/package(-lock)?\.json$/.test(f)],
  ['cms', f => /^apps\/backstage\//.test(f) || /^infrastructure\//.test(f)],
  ['blueprint', f => f === 'render.yaml' || /^infra\/render\//.test(f)],
];
// Docs-contract tooling is shared with the build (docs:check runs in every tier).
const DOCS_TOOLING = f => /^scripts\/docs\//.test(f);

export function classify(files, { affectedTierEnabled = false } = {}) {
  const flags = { docs: false, web: false, backend: false, cms: false, blueprint: false, shared: false };
  let allDocs = files.length > 0;
  for (const file of files) {
    const hit = RULES.find(([, test]) => test(file));
    if (hit) flags[hit[0]] = true;
    else if (DOCS_TOOLING(file)) { flags.shared = true; allDocs = false; continue; }
    else flags.shared = true; // lockfiles, workflows, e2e, scripts, vendor, packages, unknown
    if (!hit || hit[0] !== 'docs') allDocs = false;
  }
  let tier = 'full';
  if (allDocs) tier = 'docs';
  else if (affectedTierEnabled && !flags.shared && !flags.blueprint) tier = 'affected';
  const run_backend_suite = tier !== 'docs' && (tier === 'full' || flags.backend);
  const run_presentation_matrices = tier !== 'docs' && (tier === 'full' || flags.web || flags.cms);
  return { tier, docs_only: allDocs, ...flags, run_backend_suite, run_presentation_matrices, run_gates: tier !== 'docs' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Usage: changes.mjs <file-with-one-path-per-line | ->  (empty/missing => full)
  const input = process.argv[2];
  const text = input && input !== '-' && fs.existsSync(input) ? fs.readFileSync(input, 'utf8') : '';
  const files = text.split('\n').map(line => line.trim()).filter(Boolean);
  const forceFull = process.env.CI_FORCE_FULL === '1' || !files.length;
  const result = forceFull
    ? { ...classify(['unknown-path'], {}), reason: files.length ? 'forced full' : 'no changed-file list (fail-safe full)' }
    : classify(files, { affectedTierEnabled: process.env.CI_TIER_AFFECTED === '1' });
  const lines = Object.entries(result).map(([key, value]) => `${key}=${value}`);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### CI tier: \`${result.tier}\`\n\n${files.length} changed file(s). ${result.reason || ''}\n`);
}
