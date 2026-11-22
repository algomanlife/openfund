/* Direction-aware arrows for Open Trade. Copy of the website primitive
   (apps/web-react/src/ui/arrows.ts), checked identical by
   apps/web-react/test/dir-arrow.test.mjs. */
export type ArrowKind = 'forward' | 'back' | 'forward-down' | 'external' | 'down' | 'up'
export const ARROW_PATHS: Record<ArrowKind, string> = {
  'forward': 'M3 8h10M9 4l4 4-4 4',
  'back': 'M13 8H3M7 4 3 8l4 4',
  'forward-down': 'M4 4l8 8M12 6v6H6',
  'external': 'M4 12l8-8M6 4h6v6',
  'down': 'M8 3v10M4 9l4 4 4-4',
  'up': 'M8 13V3M4 7l4-4 4 4',
}
