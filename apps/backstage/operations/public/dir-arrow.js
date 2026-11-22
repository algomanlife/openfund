/* Direction-aware arrows for the Backstage console. Copy of the website
   primitive (apps/web-react/src/ui/arrows.ts); the geometry is checked to be
   identical by apps/web-react/test/dir-arrow.test.mjs. Mirroring follows the
   element's direction (dir-arrow.css), never the interface language. */
export const ARROW_PATHS = {
  'forward': 'M3 8h10M9 4l4 4-4 4',
  'back': 'M13 8H3M7 4 3 8l4 4',
  'forward-down': 'M4 4l8 8M12 6v6H6',
  'external': 'M4 12l8-8M6 4h6v6',
  'down': 'M8 3v10M4 9l4 4 4-4',
  'up': 'M8 13V3M4 7l4-4 4 4',
}

/** Decorative SVG arrow element; the surrounding control carries the name. */
export function arrow(kind) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  for (const [name, value] of Object.entries({ class: 'of-arrow', 'data-arrow': kind, viewBox: '0 0 16 16', width: '16', height: '16', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(name, value)
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', ARROW_PATHS[kind])
  svg.append(path)
  return svg
}
