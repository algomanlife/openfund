/* Shared dismissal for terminal popovers (presentation only).

   The terminal spans two documents: the React shell (header menus, wallet
   menu) and the trading workspace iframe (market selector, More stats).
   Pointer events never cross that boundary, so a menu in one document used
   to stay open when the person clicked in the other. Every popover registers
   here once; a single pointerdown/keydown listener per watched document then
   gives all of them the same behavior:
   - pointerdown outside a popover closes it (inside never does);
   - Escape closes open popovers and returns focus to their trigger;
   - opening one popover closes the others (`closeOthers`).
   No market, account, notification or order state is read or changed. */

export interface Popover {
  /** true when the event target belongs to this popover (trigger included) */
  contains(target: Node | null): boolean
  isOpen(): boolean
  close(restoreFocus: boolean): void
}

const popovers = new Set<Popover>()
const watched = new Map<Document, { count: number; release: () => void }>()

function onPointerDown(event: Event) {
  const target = event.target as Node | null
  popovers.forEach(popover => { if (popover.isOpen() && !popover.contains(target)) popover.close(false) })
}
function onKeyDown(event: Event) {
  if ((event as KeyboardEvent).key !== 'Escape') return
  popovers.forEach(popover => { if (popover.isOpen()) popover.close(true) })
}

/** Listen to one document (the shell document, or the workspace iframe's). */
export function watchDocument(doc: Document): () => void {
  const entry = watched.get(doc)
  if (entry) entry.count++
  else {
    doc.addEventListener('pointerdown', onPointerDown, true)
    doc.addEventListener('keydown', onKeyDown)
    watched.set(doc, { count: 1, release: () => {
      doc.removeEventListener('pointerdown', onPointerDown, true)
      doc.removeEventListener('keydown', onKeyDown)
    } })
  }
  let released = false
  return () => {
    if (released) return
    released = true
    const current = watched.get(doc)
    if (!current) return
    if (--current.count === 0) { current.release(); watched.delete(doc) }
  }
}

export function registerPopover(popover: Popover): () => void {
  popovers.add(popover)
  const unwatch = watchDocument(document)
  return () => { popovers.delete(popover); unwatch() }
}

/** Close every open popover except `keep` (used when one opens). */
export function closeOthers(keep: Popover) {
  popovers.forEach(popover => { if (popover !== keep && popover.isOpen()) popover.close(false) })
}

/** Adapter for a native <details> disclosure. */
export function detailsPopover(details: HTMLDetailsElement): Popover {
  const popover: Popover = {
    contains: target => !!target && details.contains(target),
    isOpen: () => details.open,
    close: restoreFocus => {
      const focusInside = details.contains(details.ownerDocument.activeElement)
      details.open = false
      if (restoreFocus && focusInside) details.querySelector('summary')?.focus()
    },
  }
  details.addEventListener('toggle', () => { if (details.open) closeOthers(popover) })
  return popover
}
