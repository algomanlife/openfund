import { useEffect, useRef } from 'react'
/** Feeds pointer coordinates to a `.ds-spotlight` element as --mx/--my.
 *  Passive, rAF-throttled, and inert on touch devices or reduced motion. */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
    }
    el.addEventListener('pointermove', move, { passive: true })
    return () => { cancelAnimationFrame(frame); el.removeEventListener('pointermove', move) }
  }, [])
  return ref
}
