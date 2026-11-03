import { useEffect, useRef } from 'react'

/** One scheduled frame per pointer update, no React state or idle render loop. */
export default function LandingMotionBackground() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = root.current
    const page = element?.closest<HTMLElement>('.home-gateway')
    if (!element || !page) return
    const header = page.closest('.information-page')?.querySelector('header')
    const sizeHeader = () => { if (header) page.style.setProperty('--landing-header-height', `${header.getBoundingClientRect().height}px`) }
    const resize = new ResizeObserver(sizeHeader)
    if (header) resize.observe(header)
    sizeHeader()
    const preference = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    let frame = 0
    let x = 0, y = 0
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0
      element.style.setProperty('--pointer-x', '0px')
      element.style.setProperty('--pointer-y', '0px')
    }
    const move = (event: PointerEvent) => {
      if (!preference.matches || document.hidden) return
      const bounds = page.getBoundingClientRect()
      x = (event.clientX - bounds.left - bounds.width / 2) / bounds.width * 22
      y = (event.clientY - bounds.top - bounds.height / 2) / bounds.height * 16
      if (!frame) frame = requestAnimationFrame(() => {
        element.style.setProperty('--pointer-x', `${x}px`)
        element.style.setProperty('--pointer-y', `${y}px`)
        frame = 0
      })
    }
    const visibility = () => { page.dataset.paused = String(document.hidden); if (document.hidden) reset() }
    page.addEventListener('pointermove', move, { passive: true })
    page.addEventListener('pointerleave', reset)
    preference.addEventListener('change', reset)
    document.addEventListener('visibilitychange', visibility)
    visibility()
    return () => {
      reset()
      resize.disconnect()
      page.removeEventListener('pointermove', move)
      page.removeEventListener('pointerleave', reset)
      preference.removeEventListener('change', reset)
      document.removeEventListener('visibilitychange', visibility)
      delete page.dataset.paused
    }
  }, [])
  return <div ref={root} className="landing-motion" aria-hidden="true">
    <div className="landing-light" />
    <svg className="landing-network network-far" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice">
      <path d="M-60 470 160 340 380 460 730 190 980 310 1230 160 1510 290M-30 150 160 340 80 670 380 460 540 720M980 310 1120 600 1440 470M730 190 690 -20" />
      {[ [160,340], [380,460], [730,190], [980,310], [1230,160], [1120,600], [80,670] ].map(([cx,cy],i) => <circle key={i} cx={cx} cy={cy} r={i%2 ? 3 : 4} />)}
    </svg>
    <svg className="landing-network network-near" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice">
      <path d="M40 170 240 100 390 190M1180 700 1300 560 1460 590" />
      <circle cx="240" cy="100" r="3" /><circle cx="1300" cy="560" r="4" />
    </svg>
  </div>
}
