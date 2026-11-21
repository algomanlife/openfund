/* The README structure contract — the single source used by
   scripts/docs/check-readme.mjs and scripts/docs/check-required.mjs, and
   documented in docs/development/README_STRUCTURE.md (which the gate checks
   for drift). Change the README's shape here first, in a reviewed PR. */

/** Exact, ordered `##` sections. Nothing else may appear at `##` level. */
export const README_SECTIONS = [
  'Project overview', 'Product ecosystem', 'Feature status', 'Product gallery', 'Business model',
  'Technical architecture', 'Technology stack', 'Development workflow', 'Versioning and releases',
  'Security', 'License', 'Retired and no longer used', 'Contributing',
]

export const BUDGET = { lines: 350, words: 1500, sectionLines: 70 }

/** Generated blocks: marker → owning section and generator. */
export const BLOCKS = {
  'status:summary': { section: 'Feature status', by: 'scripts/docs/status.mjs (from docs/status/status.json)' },
  'gallery': { section: 'Product gallery', by: 'scripts/docs/check-readme.mjs --write (from docs/assets/gallery/gallery.json)' },
  'license:summary': { section: 'License', by: 'scripts/docs/check-readme.mjs --write (from THIRD_PARTY_NOTICES.md)' },
  'retired:summary': { section: 'Retired and no longer used', by: 'scripts/docs/check-retired.mjs --write (from docs/development/RETIRED.json)' },
}

/** Single-source links each section must carry (deep detail lives there). */
export const REQUIRED_LINKS = {
  'Project overview': ['docs/README.md'],
  'Product ecosystem': ['docs/product/PLATFORM_TOUR.md'],
  'Feature status': ['docs/status/README.md', 'docs/product/FEATURE_STATUS.md'],
  'Product gallery': ['docs/assets/gallery/gallery.json'],
  'Business model': ['docs/economy/BUSINESS_DETAIL.md', 'ECONOMY.md'],
  'Technical architecture': ['docs/architecture/ARCHITECTURE.md', 'docs/architecture/PLATFORM_REFERENCE.md'],
  'Technology stack': ['docs/design/DESIGN_SYSTEM.md#typography-and-font-tokens', 'docs/architecture/TECH_STACK.md'],
  'Development workflow': ['docs/development/TESTING.md'],
  'Versioning and releases': ['docs/deployment/RELEASES.md', 'CHANGELOG.md'],
  'Security': ['SECURITY.md'],
  'License': ['THIRD_PARTY_NOTICES.md', 'docs/legal/LICENSING.md'],
  'Retired and no longer used': ['docs/development/RETIRED.md'],
  'Contributing': ['CONTRIBUTING.md', 'AGENTS.md'],
}

/** One responsibility per section: hand-written text matching a rule may
    appear only in the named section (generated blocks are exempt). */
export const OWNERSHIP = [
  { what: 'platform version numbers (vX.Y.Z)', pattern: /\bv\d+\.\d+\.\d+\b/, section: 'Versioning and releases' },
  { what: 'typography policy (font names)', pattern: /\b(Dastkhat|Ubuntu)\b/, section: 'Technology stack' },
  { what: 'diagrams', pattern: /^```mermaid/, section: 'Technical architecture' },
  { what: 'license terms', pattern: /\b(OFL|AGPL|Apache-2\.0|GPL-2\.0|BSL 1\.1|all rights reserved)\b/i, section: 'License' },
  { what: 'vulnerability reporting', pattern: /\breport (a )?vulnerabilit/i, section: 'Security' },
]
