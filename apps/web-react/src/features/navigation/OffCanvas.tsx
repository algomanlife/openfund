import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './offcanvas.css'

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
/** matches the CSS slide duration; reduced motion closes immediately */
const EXIT_MS = 220

/** Locks page scrolling while any drawer is open and restores the exact
 *  previous inline styles (and scroll position) when the last one closes. */
let locks = 0
let restore: (() => void) | null = null
function lockScroll() {
  if (locks++ > 0) return
  const { body, documentElement: html } = document
  const previous = { bodyOverflow: body.style.overflow, htmlOverflow: html.style.overflow, paddingInlineEnd: body.style.paddingInlineEnd }
  const gutter = window.innerWidth - html.clientWidth
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  if (gutter > 0) body.style.paddingInlineEnd = `${gutter}px`
  restore = () => {
    html.style.overflow = previous.htmlOverflow
    body.style.overflow = previous.bodyOverflow
    body.style.paddingInlineEnd = previous.paddingInlineEnd
  }
}
function unlockScroll() {
  if (--locks > 0) return
  locks = 0
  restore?.(); restore = null
}

/**
 * Shared off-canvas primitive for the website and terminal drawers: a modal
 * dialog portalled to <body>, opening from the inline-start edge of the given
 * direction (right for fa/ar, left for en/ru/zh-CN). Backdrop click, Escape,
 * and the close button dismiss it; focus is trapped while open and returned to
 * the trigger on close. Content is unmounted when closed, so no hidden
 * duplicate links stay focusable.
 */
export default function OffCanvas({ open, onClose, dir, label, closeLabel, header, children, footer, className = '', returnFocus }: {
  open: boolean
  onClose: () => void
  dir: 'rtl' | 'ltr'
  label: string
  closeLabel: string
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** element that receives focus after closing (the menu trigger) */
  returnFocus?: () => HTMLElement | null | undefined
}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const returnFocusRef = useRef(returnFocus)
  returnFocusRef.current = returnFocus

  /* mount → "shown" before the first paint (slide in without waiting for an
     animation frame, which a busy trading workspace can delay);
     close → slide out, then unmount */
  useEffect(() => {
    if (open) { setMounted(true); return }
    setShown(false)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setMounted(false), reduce ? 0 : EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useLayoutEffect(() => {
    if (!open || !mounted || shown || !panel.current) return
    panel.current.getBoundingClientRect() /* commit the off-screen start position */
    setShown(true)
    closeButton.current?.focus({ preventScroll: true })
  }, [open, mounted, shown])

  /* scroll lock and focus restore follow `open` exactly */
  useEffect(() => {
    if (!open) return
    lockScroll()
    const previous = document.activeElement as HTMLElement | null
    return () => {
      unlockScroll()
      const target = returnFocusRef.current?.() || previous
      if (target && document.contains(target)) target.focus({ preventScroll: true })
    }
  }, [open])

  /* Escape and Tab containment, scoped to the open drawer */
  useEffect(() => {
    if (!open) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); return }
      if (event.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!panel.current.contains(active)) { event.preventDefault(); first.focus(); return }
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown, true)
    return () => document.removeEventListener('keydown', keydown, true)
  }, [open])

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(
    <div className={`of-offcanvas ${className}`} data-state={shown ? 'open' : 'closed'} dir={dir} data-locale-owned="react">
      <div className="of-offcanvas-backdrop" aria-hidden="true" onClick={() => onCloseRef.current()} />
      <div ref={panel} className="of-offcanvas-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="of-offcanvas-head">
          <div className="of-offcanvas-brand">{header}</div>
          <span id={titleId} className="sr-only">{label}</span>
          <button ref={closeButton} type="button" className="of-offcanvas-close" aria-label={closeLabel} onClick={() => onCloseRef.current()}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="of-offcanvas-body">{children}</div>
        {footer && <div className="of-offcanvas-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
