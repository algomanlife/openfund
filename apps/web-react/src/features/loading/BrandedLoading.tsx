import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './loading.css'

/* ---- shared branded loading gate -------------------------------------------
   One loader for the whole platform.

   - The static pre-React instance lives in index.html (#of-boot-loader)
     and covers the genuine boot window (bundle parse → first route paint).
   - After boot, this React overlay covers genuine transitions declared by
     the app (locale switches, legacy landing bootstrap). Pages never build
     their own loaders; they declare pending work with loadingGate.
   - A short display threshold keeps instant transitions loader-free (no
     flashing on fast navigation), and a long-run backstop guarantees the
     loader can never stay stuck. */

const listeners = new Set<() => void>()
const holds = new Set<string>()
let bootReported = false

const emit = () => listeners.forEach(fn => fn())
const removeBootNode = () => document.getElementById('of-boot-loader')?.remove()

export const loadingGate = {
  /** Declare pending critical work that should keep the branded loader up. */
  hold(key: string) {
    if (holds.has(key)) return
    holds.add(key)
    emit()
  },
  /** Release a previously declared hold (safe when already released). */
  release(key: string) {
    if (!holds.delete(key)) return
    if (holds.size === 0) removeBootNode()
    emit()
  },
  /** Called once the first route has painted (AppFrame boot). */
  bootReady() {
    bootReported = true
    if (holds.size === 0) removeBootNode()
    emit()
  },
  /** Backstop: clears every hold (used by the timeout and error paths). */
  reset() {
    holds.clear()
    removeBootNode()
    emit()
  },
  pending: () => holds.size,
  bootDone: () => bootReported,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
}

function useLoadingPending() {
  const [, force] = useState(0)
  useEffect(() => loadingGate.subscribe(() => force(n => n + 1)), [])
  return loadingGate.pending() > 0
}

export function BrandedLoading() {
  const pending = useLoadingPending()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (pending) {
      /* short threshold: instant transitions never flash the loader —
         this is the only "delay" and it hides, never shows, work */
      const show = window.setTimeout(() => setVisible(true), 50)
      return () => window.clearTimeout(show)
    }
    setVisible(false)
  }, [pending])

  /* never stuck: a hold that never resolves clears itself and reveals the
     page behind the loader (fail visible, not forever) */
  useEffect(() => {
    if (!visible) return
    const backstop = window.setTimeout(() => {
      loadingGate.reset()
      console.error('Openfund: a loading hold never resolved — the page was revealed as a failsafe.')
    }, 15000)
    return () => window.clearTimeout(backstop)
  }, [visible])

  if (!visible) return null
  /* during boot the static index.html instance is still on screen — do not
     stack two identical overlays on top of each other */
  if (!loadingGate.bootDone() && document.getElementById('of-boot-loader')) return null
  return createPortal(
    <div className="of-loading" role="status" aria-live="polite">
      <img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} alt="" width={40} height={45} />
    </div>,
    document.body,
  )
}
