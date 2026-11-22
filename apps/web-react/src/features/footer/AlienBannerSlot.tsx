import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './alien-banner-slot.css'

/* The scene and its stylesheet are a separate chunk: nothing is fetched until
   the footer comes within ~600 px of the viewport. The slot already reserves
   the banner's height, so loading it never shifts the page. */
const AlienBanner = lazy(() => import('./AlienBanner'))

export default function AlienBannerSlot() {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver !== 'function') { setNear(true); return }
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  return <div ref={ref} className="of-alien-frame">
    {near && <Suspense fallback={null}><AlienBanner /></Suspense>}
  </div>
}
