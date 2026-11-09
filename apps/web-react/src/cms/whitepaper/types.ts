/* ============================================================
   Openfund Whitepaper — structured content types.

   The whitepaper is a living publication: every chapter is a list of
   typed blocks, every chart reads a structured dataset, and every source
   is a reference record. Nothing here is parsed out of prose. The same
   types describe the bundled repository edition (src/cms/seed/whitepaper)
   and the Directus edition (whitepaper_* collections), which the client
   validates with ./schema.ts before rendering.
   ============================================================ */

export type Bi = { fa: string; en: string }

/** Capability classification used across the publication. */
export type WpStatus = 'live' | 'implemented' | 'development' | 'planned'
/** Roadmap milestone classification. */
export type WpMilestoneStatus = 'completed' | 'in_progress' | 'planned' | 'research'
export type WpCalloutTone = 'info' | 'principle' | 'warning' | 'risk'

export interface WpFeature { title: Bi; text: Bi; status?: WpStatus }
export interface WpStep { title: Bi; text?: Bi; status?: WpStatus }
export interface WpLayer { title: Bi; nodes: WpStep[] }
export interface WpMilestone { phase: Bi; title: Bi; text: Bi; status: WpMilestoneStatus }

export type WpBlock =
  | { type: 'lead'; text: Bi }
  | { type: 'p'; text: Bi }
  | { type: 'h3'; text: Bi }
  | { type: 'list'; ordered?: boolean; items: Bi[] }
  | { type: 'quote'; text: Bi }
  | { type: 'callout'; tone: WpCalloutTone; title: Bi; text: Bi }
  | { type: 'features'; items: WpFeature[] }
  | { type: 'stats'; items: Array<{ value: string; label: Bi; note?: Bi }> }
  | { type: 'definitions'; items: Array<{ term: Bi; text: Bi }> }
  | { type: 'table'; caption: Bi; head: Bi[]; rows: Bi[][] }
  | { type: 'flow'; label: Bi; steps: WpStep[] }
  | { type: 'architecture'; label: Bi; layers: WpLayer[] }
  | { type: 'mapping'; head: Bi[]; rows: Bi[][] }
  | { type: 'timeline'; items: WpMilestone[] }
  | { type: 'chart'; dataset: string; interactive?: boolean }
  | { type: 'pricing'; caption: Bi }
  | { type: 'image'; src: string; alt: Bi; caption?: Bi }
  | { type: 'faq'; items: Array<{ q: Bi; a: Bi }> }
  | { type: 'refs'; keys: string[] }

export type WpBlockType = WpBlock['type']

export interface WpChapter {
  slug: string
  sort: number
  kicker: Bi
  title: Bi
  summary: Bi
  blocks: WpBlock[]
}

export interface WpDocument {
  slug: string
  version: string
  /** ISO date (YYYY-MM-DD) of first publication of this version */
  publishedOn: string
  /** ISO date (YYYY-MM-DD) of the latest editorial revision */
  updatedOn: string
  title: Bi
  subtitle: Bi
  abstract: Bi
  revisionNote: Bi
  seoTitle: Bi
  seoDescription: Bi
}

/** Chart data: numbers are stored once; only labels are translated. */
export type WpDatasetKind = 'waterfall' | 'bars' | 'stacked'
export interface WpDatasetPoint {
  key: string
  label: Bi
  /** waterfall/bars value */
  value?: number
  /** stacked: one value per segment, in segment order */
  values?: number[]
  /** waterfall role */
  role?: 'start' | 'delta' | 'subtotal'
}
export interface WpDataset {
  key: string
  kind: WpDatasetKind
  unit: 'usd' | 'pct'
  title: Bi
  caption: Bi
  note: Bi
  segments?: Array<{ key: string; label: Bi }>
  points: WpDatasetPoint[]
  /** reference keys that support or qualify the figures */
  sources?: string[]
}

export type WpReferenceKind = 'repository' | 'documentation' | 'release' | 'provider' | 'industry'
export interface WpReference {
  key: string
  sort: number
  kind: WpReferenceKind
  title: string
  publisher: string
  url: string
  /** publication date as published by the source, when one exists */
  published?: string
  /** date the link and statement were last checked (YYYY-MM-DD) */
  accessed: string
  note: Bi
}

export interface Whitepaper {
  document: WpDocument
  chapters: WpChapter[]
  datasets: WpDataset[]
  references: WpReference[]
  /** which edition each part came from — shown honestly on the page */
  source: { document: 'cms' | 'bundled'; datasets: 'cms' | 'bundled'; references: 'cms' | 'bundled' }
}
