/* The open Labs drop number for the Challenges menu badge (ADR 0055).
   Fetched once per page load from GET /labs; the menu re-renders when it
   arrives. null = no open drop, so no badge. */
/* the session module is imported lazily so navigation.ts stays free of it */

let openDrop: number | null = null
let requested = false
const listeners = new Set<() => void>()

export const openLabDrop = () => openDrop
export function setLabsStatus(number: number | null) {
  if (openDrop === number) return
  openDrop = number
  listeners.forEach(l => l())
}
export function onLabsStatus(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function loadLabsStatus() {
  if (requested) return
  requested = true
  void import('../../session/useOpenfundSession').then(({ apiFetch }) => apiFetch('/labs')).then(r => {
    if (r.ok) setLabsStatus(r.data?.current?.find((d: { status: string }) => d.status === 'open')?.number ?? null)
  }).catch(() => {})
}
