/* Direction-aware arrows: the single source of arrow geometry for the
   website, terminal, Backstage and Open Trade.

   Every arrow is drawn for a left-to-right reading direction. Mirroring is
   decided by the element's resolved direction (CSS `:dir(rtl)`, see
   dir-arrow.css), never by the interface language, so ru and zh-CN behave
   like en and ar behaves like fa.

   kinds
     forward       points to where the reader goes next (→ in LTR, ← in RTL)
     back          points to where the reader came from (← in LTR, → in RTL)
     forward-down  "continue below" (↘ in LTR, ↙ in RTL)
     external      opens another page or site (↗ in LTR, ↖ in RTL)
     down, up      vertical; never mirrored

   Copy and translations never contain arrow glyphs (scripts/check-arrow-glyphs.mjs). */

export const ARROW_KINDS = ['forward', 'back', 'forward-down', 'external', 'down', 'up'] as const
export type ArrowKind = (typeof ARROW_KINDS)[number]

/** 16 × 16 stroke paths, LTR orientation. Copies elsewhere are checked against these. */
export const ARROW_PATHS: Record<ArrowKind, string> = {
  forward: 'M3 8h10M9 4l4 4-4 4',
  back: 'M13 8H3M7 4 3 8l4 4',
  'forward-down': 'M4 4l8 8M12 6v6H6',
  external: 'M4 12l8-8M6 4h6v6',
  down: 'M8 3v10M4 9l4 4 4-4',
  up: 'M8 13V3M4 7l4-4 4 4',
}

/** Kinds that flip in a right-to-left context. */
export const MIRRORED: ReadonlySet<ArrowKind> = new Set(['forward', 'back', 'forward-down', 'external'])

/** The SVG markup, for HTML templates and string-built UI. Decorative: the
 *  surrounding link or button carries the accessible name. */
export function arrowSvg(kind: ArrowKind, className = ''): string {
  const extra = className ? ` ${className}` : ''
  return `<svg class="of-arrow${extra}" data-arrow="${kind}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="${ARROW_PATHS[kind]}"/></svg>`
}

const GLYPH: Record<ArrowKind, [string, string]> = {
  /* arrow-glyphs: allow */ forward: ['→', '←'], back: ['←', '→'], 'forward-down': ['↘', '↙'], external: ['↗', '↖'], down: ['↓', '↓'], up: ['↑', '↑'],
}

/** Plain-text fallback for places that cannot hold markup (SVG <text>,
 *  <option>, document title). It is chosen by direction at render time and is
 *  never stored in copy. */
export function arrowGlyph(kind: ArrowKind, dir: 'ltr' | 'rtl'): string {
  return GLYPH[kind][dir === 'rtl' ? 1 : 0]
}
