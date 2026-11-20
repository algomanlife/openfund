import type { ReactNode } from 'react'

/**
 * Horizontal scroll container for a data table on information pages.
 * Phones narrower than the table scroll it inside this box instead of the
 * document. It is a named, focusable region, so keyboard users can scroll it
 * (WCAG 2.1.1; axe `scrollable-region-focusable`). `label` is the table's
 * caption, which is already localized copy.
 */
export default function TableScroll({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className ? `info-table-wrap ${className}` : 'info-table-wrap'} role="region" aria-label={label} tabIndex={0}>{children}</div>
}
