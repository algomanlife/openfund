#!/usr/bin/env node
/* Reviewable release summary generated from merged pull requests.
 *
 * Reads first-parent merge commits between two refs (default: latest tag..HEAD)
 * and prints Markdown grouped by Conventional Commit type. It performs no network
 * access and creates no tag or release; the output is meant to be pasted into a
 * release-candidate review. A pull request whose branch was merged into another
 * pull request's branch first (stacked) is reported under the pull request that
 * actually landed it on the base branch.
 *
 * Usage: node scripts/release/summary.mjs [--from <ref>] [--to <ref>] */
import { execFileSync } from 'node:child_process';

const TYPES = [['feat', 'Features'], ['fix', 'Fixes'], ['perf', 'Performance'], ['security', 'Security'], ['refactor', 'Refactoring'], ['docs', 'Documentation'], ['ci', 'CI'], ['test', 'Tests'], ['build', 'Build'], ['chore', 'Chores'], ['other', 'Other changes']];

export function parseMerges(log) {
  // Records are separated by \x1e, fields by \x1f: sha, subject, body.
  return log.split('\x1e').map(record => record.trim()).filter(Boolean).flatMap(record => {
    const [sha, subject, body = ''] = record.split('\x1f');
    const match = /^Merge pull request #(\d+) from (\S+)/.exec(subject);
    if (!match) return [];
    const title = body.trim().split('\n')[0] || match[2];
    const typed = /^([a-z]+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/i.exec(title);
    return [{ sha: sha.slice(0, 7), number: Number(match[1]), branch: match[2], title, type: typed ? typed[1].toLowerCase() : 'other', scope: typed?.[2] || '', breaking: Boolean(typed?.[3]) }];
  });
}

export function render(prs, { from, to }) {
  const lines = [`# Release summary: ${from}..${to}`, '', `${prs.length} merged pull request(s). Generated from first-parent merge commits; review before use. Not a release: no tag or release has been created.`, ''];
  for (const [type, heading] of TYPES) {
    const group = prs.filter(pr => (TYPES.some(([t]) => t === pr.type) ? pr.type : 'other') === type);
    if (!group.length) continue;
    lines.push(`## ${heading}`, '', ...group.map(pr => `- ${pr.title}${pr.breaking ? ' **(BREAKING)**' : ''} (#${pr.number}, \`${pr.sha}\`)`), '');
  }
  const breaking = prs.filter(pr => pr.breaking);
  if (breaking.length) lines.push('## Breaking changes', '', ...breaking.map(pr => `- #${pr.number} ${pr.title}`), '');
  lines.push('## Reviewer checklist', '', '- [ ] Each entry matches `docs/product/FEATURE_STATUS.md` and the changelog', '- [ ] Schema/migration changes reviewed (additive-first)', '- [ ] Disabled-by-default features remain disabled (payments receiver, Gains execution)', '- [ ] Required checks passed on the exact release commit', '');
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const to = arg('--to') || 'HEAD';
  const from = arg('--from') || git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', to);
  const log = git('log', '--first-parent', '--merges', '--format=%H%x1f%s%x1f%b%x1e', `${from}..${to}`);
  process.stdout.write(render(parseMerges(log), { from, to }) + '\n');
}
