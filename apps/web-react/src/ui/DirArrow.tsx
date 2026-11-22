import { ARROW_PATHS, type ArrowKind } from './arrows'
import './dir-arrow.css'

/** Decorative, direction-aware arrow. The parent link or button carries the
 *  accessible name; mirroring follows the element's direction (dir-arrow.css). */
export default function DirArrow({ kind, className }: { kind: ArrowKind; className?: string }) {
  return (
    <svg className={className ? `of-arrow ${className}` : 'of-arrow'} data-arrow={kind} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={ARROW_PATHS[kind]} />
    </svg>
  )
}
