import { useEffect, useRef, useState } from 'react'
import { migrationHeroNode } from './heroScene'
import './migration-hero.css'

/* The full-bleed /migrate hero scene. Motion runs only while the hero is on
   screen and the tab is visible ([data-live]); reduced motion is static. */
export default function MigrationHero() {
  const host = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const node = host.current; if (!node) return
    node.replaceChildren(migrationHeroNode())
    let seen = false
    const sync = () => setLive(seen && document.visibilityState === 'visible')
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(e => { seen = e.some(x => x.isIntersecting); sync() }) : null
    if (io) io.observe(node); else { seen = true; sync() }
    document.addEventListener('visibilitychange', sync)
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return <div ref={host} className="mh-root" data-live={live || undefined} aria-hidden="true" />
}
