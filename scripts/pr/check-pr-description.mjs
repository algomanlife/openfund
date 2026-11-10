#!/usr/bin/env node
/* Light check that a pull request description follows the required template.
 *
 * Every required section heading must be present and contain real content
 * (not just the template's HTML comment or a bare placeholder). The check is
 * deliberately structural: it never judges the quality of the answers, and it
 * never calls an external service. Bot-authored pull requests (Dependabot) are
 * exempt because they use their own generated description.
 *
 * CLI: PR_BODY_FILE=<file> PR_AUTHOR=<login> PR_TITLE=<title> node scripts/pr/check-pr-description.mjs */
import fs from 'node:fs';

export const REQUIRED_SECTIONS = [
  'Objective', 'Problem', 'Scope', 'Files and modules', 'Behavior impact',
  'Schema and migration', 'Security', 'Dependencies', 'Tests and results',
  'Screenshots', 'Deployment', 'Rollback', 'Related PRs', 'Documentation',
  'Production-enabled?',
];

export const TITLE = /^(feat|fix|perf|security|refactor|docs|test|ci|build|chore|revert)(\([a-z0-9][a-z0-9,/ .-]*\))?!?: \S.{3,}$/;

const stripComments = text => text.replace(/<!--[\s\S]*?-->/g, '');

export function sections(body) {
  const result = new Map();
  let current = null;
  for (const line of stripComments(body || '').split('\n')) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) { current = heading[1].trim(); result.set(current, []); continue; }
    if (current) result.get(current).push(line);
  }
  return new Map([...result].map(([name, lines]) => [name, lines.join('\n').trim()]));
}

const PLACEHOLDER = /^(?:n\/a|none|todo|tbd|-|\.\.\.|\?)?$/i;

export function check(body, { author = '', title } = {}) {
  if (/\[bot\]$/i.test(author)) return { ok: true, problems: [], exempt: true };
  const found = sections(body);
  const problems = [];
  if (title !== undefined && !TITLE.test(title.trim())) problems.push(`Title must be a Conventional Commit, for example "feat(payments): add checkout recovery" (got "${title.trim()}").`);
  for (const name of REQUIRED_SECTIONS) {
    if (!found.has(name)) { problems.push(`Missing section "## ${name}".`); continue; }
    const text = found.get(name);
    // "N/A" is only a valid answer when it comes with a reason.
    if (!text || PLACEHOLDER.test(text.replace(/[*_`]/g, '').trim())) problems.push(`Section "## ${name}" is empty. Answer it, or write "N/A — <reason>".`);
  }
  return { ok: problems.length === 0, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.env.PR_BODY_FILE;
  const body = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (process.env.PR_BODY || '');
  const result = check(body, { author: process.env.PR_AUTHOR || '', title: process.env.PR_TITLE });
  if (result.exempt) console.log('Bot-authored pull request: description check skipped.');
  else if (result.ok) console.log('Pull request description contains every required section.');
  else {
    for (const problem of result.problems) console.log(`::error title=PR description::${problem}`);
    console.log('\nUse .github/pull_request_template.md. See docs/development/PULL_REQUESTS.md.');
    process.exit(1);
  }
}
