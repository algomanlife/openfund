import type { Whitepaper } from '../../whitepaper/types'
import { whitepaperDocument } from './document'
import { foundationChapters } from './chapters-foundation'
import { economyChapters } from './chapters-economy'
import { futureChapters } from './chapters-future'
import { datasets } from './datasets'
import { references } from './references'

/** The repository edition of Whitepaper v1.0 — the seed source for Directus
 *  (apps/backstage/scripts/seed_whitepaper_content.mjs) and the rendered
 *  edition whenever the CMS is unreachable or its edition fails validation. */
export const bundledWhitepaper: Whitepaper = {
  document: whitepaperDocument,
  chapters: [...foundationChapters, ...economyChapters, ...futureChapters].sort((a, b) => a.sort - b.sort),
  datasets,
  references,
  source: { document: 'bundled', datasets: 'bundled', references: 'bundled' },
}

export { whitepaperDocument, datasets, references }
