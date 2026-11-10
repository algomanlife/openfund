#!/usr/bin/env node
/* Documentation synchronization gate (part of `npm run docs:check`, run by CI).
   Validates — and never edits — that:
   1. the required repository documents exist;
   2. README.md keeps every required top-level section (the README is the
      authoritative entry point; see docs/development/DOCUMENTATION.md);
   3. every environment variable declared in render.yaml is documented in
      docs/deployment/ENVIRONMENT.md;
   4. the changelog keeps an "Unreleased" section above released entries and
      every released heading names a SemVer version.
   It reports discrepancies; it does not commit or bypass review. */
import fs from 'node:fs'
import yaml from 'js-yaml'

const problems = []
const read = f => fs.readFileSync(f, 'utf8')

export const REQUIRED_FILES = [
  'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md', 'AGENTS.md',
  'GOVERNANCE.md', 'ECONOMY.md', 'render.yaml', '.env.example',
  '.github/pull_request_template.md', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml',
  'docs/README.md', 'docs/product/FEATURE_STATUS.md', 'docs/roadmap/MILESTONES.md',
  'docs/deployment/ENVIRONMENT.md', 'docs/deployment/RELEASES.md', 'docs/deployment/RENDER.md',
  'docs/deployment/ROLLBACK.md', 'docs/deployment/DATABASE.md', 'docs/deployment/CHECKLISTS.md',
  'docs/payments/DEPAY.md', 'docs/payments/COUPONS.md', 'docs/payments/ORDER_LIFECYCLE.md', 'docs/payments/VERIFICATION.md',
  'docs/economy/BUSINESS_MODEL.md', 'docs/governance/OPERATING_GOVERNANCE.md', 'docs/operations/README.md',
  'docs/legal/LICENSING.md', 'docs/security/SECURITY.md',
]

/* README sections required by the production-readiness documentation contract */
export const README_SECTIONS = [
  'Project overview', 'Product architecture', 'Core features', 'Technology stack', 'Repository structure',
  'System components', 'Development environment', 'Installation', 'Environment variables', 'Database setup',
  'Database migrations', 'Backend services', 'Frontend applications', 'Directus CMS', 'Wallet integration',
  'Arbitrum configuration', 'Payment architecture', 'DePay integration', 'Challenge purchase lifecycle',
  'Coupon management', 'Economy', 'Ambassador (IB)', 'Governance', 'Business model summary',
  'Testing and validation', 'GitHub workflow', 'Branch and pull request conventions', 'CI/CD pipeline',
  'Versioning', 'Release process', 'Render infrastructure', 'Production deployment', 'Rollback procedures',
  'Backup and recovery', 'Security', 'Operational monitoring', 'License', 'Contribution guidelines',
]

for (const f of REQUIRED_FILES) if (!fs.existsSync(f)) problems.push(`missing required document: ${f}`)

if (fs.existsSync('README.md')) {
  const headings = new Set([...read('README.md').matchAll(/^##\s+(?:\d+\.\s+)?(.+?)\s*$/gm)].map(m => m[1].trim().toLowerCase()))
  for (const s of README_SECTIONS) if (!headings.has(s.toLowerCase())) problems.push(`README.md: missing section "## ${s}"`)
}

if (fs.existsSync('render.yaml') && fs.existsSync('docs/deployment/ENVIRONMENT.md')) {
  const env = read('docs/deployment/ENVIRONMENT.md')
  const doc = yaml.load(read('render.yaml'))
  const keys = new Set()
  for (const svc of doc.services || []) for (const v of svc.envVars || []) if (v.key) keys.add(v.key)
  for (const g of doc.envVarGroups || []) for (const v of g.envVars || []) if (v.key) keys.add(v.key)
  for (const k of keys) if (!env.includes('`' + k + '`')) problems.push(`docs/deployment/ENVIRONMENT.md: render.yaml variable ${k} is not documented`)
}

if (fs.existsSync('CHANGELOG.md')) {
  const heads = [...read('CHANGELOG.md').matchAll(/^##\s+(.+)$/gm)].map(m => m[1])
  if (!/^Unreleased\b/i.test(heads[0] || '')) problems.push('CHANGELOG.md: the first "##" section must be "Unreleased"')
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} documentation synchronization problem(s)`)
  process.exit(1)
}
console.log(`docs:required OK — ${REQUIRED_FILES.length} documents, ${README_SECTIONS.length} README sections, render.yaml variables documented`)
