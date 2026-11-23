export type SearchKind = 'page' | 'content' | 'docs' | 'whitepaper' | 'market'

export interface SearchEntry {
  id: string
  kind: SearchKind
  title: string
  snippet: string
  url: string
  icon?: string
  keywords?: string[]
  boost?: number
}

export function normalizeWithMap(input: unknown): { text: string; map: number[] }
export function normalizeText(input: unknown): string
export function tokenize(input: unknown): string[]
export function editDistance(a: string, b: string, max?: number): number
export function typoBudget(token: string): number
export function synonymLookup(groups: unknown): Map<string, Set<string>>
export function search<T extends SearchEntry>(entries: readonly T[], query: string, options?: { synonyms?: Map<string, Set<string>>; kinds?: readonly SearchKind[] | null; limit?: number }): T[]
export function highlightRanges(text: string, query: string): [number, number][]
export const MAX_QUERY_LENGTH: number
export function maskQuery(input: unknown): string
