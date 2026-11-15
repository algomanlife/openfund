import { useEffect } from 'react'

const CARDS = '.co-card, .gv-card, .tool-card, .model-card, .learn-path-card, .feature-card, .co-plan'

/**
 * Public-page motion for the shared information shell:
 * - sections below the fold fade up once when they scroll into view;
 * - card borders follow the pointer (--mx/--my) on hover-capable devices.
 * Content that loads later (CMS) is picked up through a debounced
 * MutationObserver. Nothing runs under prefers-reduced-motion, and content
 * is visible by default if JavaScript or IntersectionObserver is missing.
 */
export function useSiteMotion(root: HTMLElement | null, key: string) {
  useEffect(() => {
    if (!root || typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const seen = new WeakSet<Element>()
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target) }
    }, { rootMargin: '0px 0px -8% 0px' })
    const scan = () => {
      for (const el of root.querySelectorAll(':scope section:not(.info-hero):not(#top)')) {
        if (seen.has(el)) continue
        seen.add(el)
        const box = el.getBoundingClientRect()
        if (box.top < innerHeight && box.bottom > 0) continue /* already on screen: never hide it */
        el.classList.add('site-reveal'); io.observe(el)
      }
    }
    let timer = 0
    const mo = new MutationObserver(() => { clearTimeout(timer); timer = window.setTimeout(scan, 150) })
    scan(); mo.observe(root, { childList: true, subtree: true })
    let frame = 0
    const hover = matchMedia('(hover: hover)').matches
    const move = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(CARDS) as HTMLElement | null
      if (!card) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { const r = card.getBoundingClientRect(); card.style.setProperty('--mx', `${e.clientX - r.left}px`); card.style.setProperty('--my', `${e.clientY - r.top}px`) })
    }
    if (hover) root.addEventListener('pointermove', move, { passive: true })
    return () => {
      io.disconnect(); mo.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame)
      root.removeEventListener('pointermove', move)
      root.querySelectorAll('.site-reveal').forEach(el => el.classList.remove('site-reveal', 'is-visible'))
    }
  }, [root, key])
}
