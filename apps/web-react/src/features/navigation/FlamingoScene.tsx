import { useEffect, useRef, useState } from 'react'
import { flamingoSceneNode, type FlamingoVariant } from './flamingoArt'
import './flamingo.css'

/** React host for the flamingo migration scene. `live` allows motion; it then
 *  runs only while the scene is on screen and the tab is visible. Reduced
 *  motion (flamingo.css) always shows the static frame. */
export default function FlamingoScene({ variant, live, className }: { variant: FlamingoVariant; live: boolean; className?: string }) {
  const host = useRef<HTMLSpanElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')
  useEffect(() => {
    host.current?.replaceChildren(flamingoSceneNode(variant, `${import.meta.env.BASE_URL || '/'}assets/mark-mint.svg`))
  }, [variant])
  useEffect(() => {
    if (!live || !host.current) return
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => setOnScreen(entries.some(e => e.isIntersecting))) : null
    if (io) io.observe(host.current); else setOnScreen(true)
    return () => { document.removeEventListener('visibilitychange', onVisibility); io?.disconnect() }
  }, [live])
  return <span ref={host} className={className ? `flamingo-host ${className}` : 'flamingo-host'} data-flamingo-live={live && onScreen && tabVisible ? '' : undefined} aria-hidden="true" />
}
