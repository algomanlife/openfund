/* The README structure contract — shared by scripts/docs/check-readme.mjs and
   scripts/docs/check-required.mjs and documented in
   docs/development/README_STRUCTURE.md (the gate checks that page for drift).
   The ordered section list lives in docs/readme/sections.json; change it and
   the contract page together, in a reviewed PR.

   The contract sets MINIMUMS, not budgets: the README must stay complete and
   graphical. A change may add content; it may never drop a section, an icon,
   a generated block, a graphic or a single-source link. */
import fs from 'node:fs'
import path from 'node:path'
import { root } from './repo.mjs'

export const SECTIONS = JSON.parse(fs.readFileSync(path.join(root, 'docs/readme/sections.json'), 'utf8')).sections

/** Exact, ordered `##` sections. Nothing else may appear at `##` level. */
export const README_SECTIONS = SECTIONS.map(s => s.title)

/** Floors the README may never drop below. */
export const MINIMUMS = {
  images: 60,          // <img> and ![]() references in the whole README
  badges: 4,           // shields.io badges in the title block
  sectionLines: 3,     // non-empty lines in every section, headings excluded
}

/** Graphics the title block must show. */
export const TITLE_IMAGES = ['docs/assets/graphics/hero.svg']

const WRITERS = {
  'status:summary': 'node scripts/docs/status.mjs (from docs/status/status.json)',
  'retired:summary': 'node scripts/docs/check-retired.mjs --write (from docs/development/RETIRED.json)',
  'gallery': 'node scripts/docs/check-readme.mjs --write (from docs/assets/gallery/gallery.json)',
  'license:summary': 'node scripts/docs/check-readme.mjs --write (from THIRD_PARTY_NOTICES.md)',
}
/** Generated blocks: marker → owning section and generator. */
export const BLOCKS = Object.fromEntries(SECTIONS.flatMap(s => s.blocks.map(b => [b, { section: s.title, by: WRITERS[b] || 'node scripts/docs/check-readme.mjs --write (from docs/readme/*.json)' }])))

/** Single-source links each section must carry (deep detail lives there). */
export const REQUIRED_LINKS = Object.fromEntries(SECTIONS.map(s => [s.title, s.links]))

/** One responsibility per section: hand-written text matching a rule may
    appear only in the named section (generated blocks are exempt). */
export const OWNERSHIP = [
  { what: 'platform version numbers (vX.Y.Z)', pattern: /\bv\d+\.\d+\.\d+\b/, section: 'Versioning and releases' },
  { what: 'typography policy (font names)', pattern: /\b(Dastkhat|Ubuntu)\b/, section: 'Technology stack' },
  { what: 'diagrams', pattern: /^```mermaid/, section: 'Technical architecture' },
  { what: 'license terms', pattern: /\b(OFL|AGPL|Apache-2\.0|GPL-2\.0|BSL 1\.1|all rights reserved)\b/i, section: 'License' },
  { what: 'vulnerability reporting', pattern: /\breport (a )?vulnerabilit/i, section: 'Security' },
]
