import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { AppLocale } from '../../i18n/locales'
import { tx } from '../information/content'
import { searchCopy as c } from './copy'
import './search-trigger.css'

/* Site search host (ADR 0052), mounted once in AppFrame. Every element with
   `data-site-search` opens the palette: the button beside the theme toggle in
   the website header (landing-body.html), the terminal header
   (SearchTrigger) and the mobile header. Ctrl/⌘+K and "/" open it from
   anywhere except a text field. The palette and the index load only on
   first use. */
const SearchPalette = lazy(() => import('./SearchPalette'))
const SEARCH_PATH = 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4'
export const SEARCH_TRIGGER_MARKUP = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="${SEARCH_PATH}"/></svg>`

const editable = (el: EventTarget | null) => {
  const node = el as HTMLElement | null
  return !!node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) || !!node.closest?.('[contenteditable="true"], .cm-editor, .monaco-editor'))
}

/** label the static header triggers in the current locale */
function labelTriggers(locale: AppLocale) {
  const label = tx(locale, c.open), hint = tx(locale, c.openHint)
  document.querySelectorAll<HTMLElement>('[data-site-search]').forEach(el => {
    if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label)
    if (el.title !== hint) el.title = hint
    el.setAttribute('aria-haspopup', 'dialog')
    if (!el.innerHTML.trim()) el.innerHTML = SEARCH_TRIGGER_MARKUP
  })
}

export default function SiteSearch({ locale }: { locale: AppLocale }) {
  const [open, setOpen] = useState(false)
  const [initial, setInitial] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)
  const { pathname } = useLocation()

  const show = useCallback((query = '') => {
    returnFocus.current = document.activeElement as HTMLElement | null
    setInitial(query); setOpen(true)
  }, [])
  const hide = useCallback(() => {
    setOpen(false)
    const target = returnFocus.current
    requestAnimationFrame(() => { if (target?.isConnected) target.focus() })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); show(); return }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !editable(e.target)) { e.preventDefault(); show() }
    }
    const onClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement | null)?.closest?.('[data-site-search]')
      if (!trigger) return
      e.preventDefault()
      show()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick) }
  }, [show])

  /* header markup is re-rendered per route and locale: keep the triggers labelled */
  useEffect(() => {
    labelTriggers(locale)
    let frame = 0
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => labelTriggers(locale)) })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [locale, pathname])

  /* a route change (a result was opened, Back/Forward) closes the palette */
  useEffect(() => { setOpen(false) }, [pathname])

  return open ? <Suspense fallback={null}><SearchPalette locale={locale} initialQuery={initial} onClose={hide} /></Suspense> : null
}

/** the terminal header's trigger (React header) */
export function SearchTrigger({ locale, className = '' }: { locale: AppLocale; className?: string }) {
  return <button type="button" className={`of-search-trigger ${className}`.trim()} data-site-search=""
    aria-label={tx(locale, c.open)} title={tx(locale, c.openHint)} aria-haspopup="dialog"
    dangerouslySetInnerHTML={{ __html: SEARCH_TRIGGER_MARKUP }} />
}
