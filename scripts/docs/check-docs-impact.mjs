#!/usr/bin/env node
/* Docs-impact gate: every pull request that changes the product must update the
 * records that describe it, in the same pull request (the merge rule in
 * docs/development/README_STRUCTURE.md and AGENTS.md). Runs in CI on pull
 * requests (the `changes` job of .github/workflows/ci.yml) against the list of
 * changed files; read-only, no network.
 *
 * Each rule: when a changed file matches `when`, at least one changed file must
 * match `needs`. A pull request with no documentation impact says so in its
 * description with one line, which reviewers check:
 *     Docs-impact: none — <reason>
 * Bot-authored pull requests (Dependabot) are exempt.
 *
 *   node scripts/docs/check-docs-impact.mjs <changed-files.txt>
 *   env: PR_BODY (description), PR_AUTHOR (login) */
import fs from 'node:fs'

const TESTS = f => /(^|\/)(test|tests|__tests__|e2e|fixtures)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || /^e2e\//.test(f)
const LOCK = f => /(^|\/)package-lock\.json$/.test(f)
const RECORD = f => f === 'CHANGELOG.md' || /^docs\/(readme|product|status)\//.test(f) || f === 'docs/assets/gallery/gallery.json'

export const RULES = [
  { name: 'product code', when: f => /^(apps|packages)\//.test(f) && !TESTS(f) && !LOCK(f) && !/\/README\.md$/.test(f), needs: RECORD,
    why: 'record it in CHANGELOG.md (Unreleased) and, when a product, feature, app or package changed, in docs/readme/*.json or docs/product/FEATURE_STATUS.md; then run npm run docs:write' },
  { name: 'screenshots', when: f => /^docs\/assets\/screenshots\/.+\.(png|jpe?g|webp|gif)$/i.test(f), needs: f => f === 'docs/assets/screenshots/manifest.json',
    why: 'record provenance in docs/assets/screenshots/manifest.json (and curate it in docs/assets/gallery/gallery.json if it belongs in the README)' },
  { name: 'deployment and infrastructure', when: f => f === 'render.yaml' || /^infra(structure)?\//.test(f) || /^\.github\/workflows\/deploy/.test(f), needs: f => /^docs\/(deployment|status|operations)\//.test(f) || f === 'CHANGELOG.md',
    why: 'update docs/deployment (and docs/status/status.json when a runtime changed)' },
  { name: 'README data', when: f => /^docs\/readme\/.+\.json$/.test(f) || f === 'docs/status/status.json', needs: f => f === 'README.md',
    why: 'run npm run docs:write so README.md and its graphics follow the data' },
]

export const EXEMPT = /^\s*Docs-impact:\s*none\s*[—–-]+\s*\S.{5,}$/im

/* Developer-docs merge rule (AGENTS.md "Developer docs (merge rule)"): a change
 * to routes, the backend API, schema.sql, render.yaml or environment
 * variables, package scripts, CI workflows, the release process or
 * apps/open-trade also updates docs/developer-portal/, unless the description
 * says  Developer-docs: none — <reason>. Docs-impact: none does not exempt it. */
export const DEV_DOCS_EXEMPT = /^\s*Developer-docs:\s*none\s*[—–-]+\s*\S.{5,}$/im
export const DEV_DOCS_RULE = {
  name: 'developer-facing surface',
  when: f => !TESTS(f) && !LOCK(f) && (
    f === 'apps/web-react/src/main.tsx' || f === 'apps/web-react/src/cms/editorialRoutes.ts'
    || /^apps\/backend\/[^/]+\.(m?js|sql)$/.test(f)
    || f === 'render.yaml' || /(^|\/)\.env\.example$/.test(f) || f === 'docs/deployment/ENVIRONMENT.md'
    || /(^|\/)package\.json$/.test(f)
    || /^\.github\/workflows\//.test(f)
    || /^scripts\/release\//.test(f) || f === 'docs/deployment/RELEASES.md'
    || (/^apps\/open-trade\//.test(f) && !/\/README\.md$/.test(f))),
  needs: f => /^docs\/developer-portal\//.test(f),
  why: 'update docs/developer-portal/ (the /developers page) in the same pull request, or declare Developer-docs: none — <reason> in the description',
}

export function check(files, { body = '', author = '' } = {}) {
  if (/\[bot\]$/i.test(author)) return { ok: true, problems: [], exempt: 'bot' }
  const problems = []
  if (!DEV_DOCS_EXEMPT.test(body)) {
    const hits = files.filter(DEV_DOCS_RULE.when)
    if (hits.length && !files.some(DEV_DOCS_RULE.needs)) problems.push(`${DEV_DOCS_RULE.name} changed (${hits.slice(0, 3).join(', ')}${hits.length > 3 ? `, +${hits.length - 3} more` : ''}) but docs/developer-portal/ was not updated: ${DEV_DOCS_RULE.why}.`)
  }
  if (EXEMPT.test(body)) return { ok: problems.length === 0, problems, exempt: problems.length ? undefined : 'declared' }
  for (const rule of RULES) {
    const hits = files.filter(rule.when)
    if (hits.length && !files.some(rule.needs)) problems.push(`${rule.name} changed (${hits.slice(0, 3).join(', ')}${hits.length > 3 ? `, +${hits.length - 3} more` : ''}) but no record was updated: ${rule.why}.`)
  }
  return { ok: problems.length === 0, problems }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const list = process.argv[2]
  if (!list || !fs.existsSync(list)) { console.log('docs-impact: no changed-file list (not a pull request); nothing to check.'); process.exit(0) }
  const files = fs.readFileSync(list, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  const result = check(files, { body: process.env.PR_BODY || '', author: process.env.PR_AUTHOR || '' })
  if (result.exempt) console.log(`docs-impact: exempt (${result.exempt === 'bot' ? 'bot-authored' : 'Docs-impact: none declared in the description'}).`)
  else if (result.ok) console.log(`docs-impact OK — ${files.length} changed file(s); every product change carries its record.`)
  else {
    for (const p of result.problems) console.log(`::error title=Docs impact::${p}`)
    console.log('\nEvery merge keeps the repository current: docs/development/README_STRUCTURE.md#the-merge-rule.\nIf this change truly has no documentation impact, add to the PR description:  Docs-impact: none — <reason>')
    process.exit(1)
  }
}
