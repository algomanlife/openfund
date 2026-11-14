import { useEffect, useRef } from 'react'

/** Adds `is-visible` once the element scrolls into view. Content is visible
 *  by default (no-JS, print, reduced motion): the hidden starting state is
 *  applied only while `.co-motion` is set on the element, which this hook
 *  sets when motion is allowed and IntersectionObserver exists. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = el.getBoundingClientRect()
    if (box.top < innerHeight && box.bottom > 0) return /* already on screen: no flash */
    el.classList.add('co-motion')
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { el.classList.add('is-visible'); io.disconnect() }
    }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
