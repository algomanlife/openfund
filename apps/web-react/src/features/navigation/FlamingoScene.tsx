import { useEffect, useRef } from 'react'
import { flamingoSceneNode, type FlamingoVariant } from './flamingoArt'
import './flamingo.css'

/** React host for the flamingo migration scene. `live` starts the motion;
 *  without it (or with reduced motion) the scene is a static frame. */
export default function FlamingoScene({ variant, live, className }: { variant: FlamingoVariant; live: boolean; className?: string }) {
  const host = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    host.current?.replaceChildren(flamingoSceneNode(variant, `${import.meta.env.BASE_URL || '/'}assets/mark-mint.svg`))
  }, [variant])
  return <span ref={host} className={className ? `flamingo-host ${className}` : 'flamingo-host'} data-flamingo-live={live || undefined} aria-hidden="true" />
}
