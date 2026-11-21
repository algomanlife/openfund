import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { LOCALES, LOCALE_CODES, LOCALE_NAMES, dirOf, pick, saveLocaleChoice, type AppLocale } from './locales'
import './language.css'

/** The one language selector for every shell (website, landing, terminal).
 *  A change here is the visitor's explicit choice, so it is persisted and
 *  then outranks the Geo-IP default on later locale-less visits (ADR 0043).
 *
 *  Politically neutral by design: a language is not a country, so there are
 *  no flags and no borders. Each option shows a representative script glyph;
 *  the globe turns to the broad region where the language is widely spoken
 *  and lights it with a soft glow. Everything is inline SVG (no requests).
 *
 *  Semantics: a button (aria-haspopup="listbox") opens a listbox whose
 *  options are tracked with aria-activedescendant. Keys: ArrowUp/ArrowDown,
 *  Home/End, Enter/Space to choose, Escape to close (focus returns to the
 *  button), Tab closes, and type-ahead on the language names. */

/** representative script glyph per language (a script, not a flag) */
/* written as entries: these are script samples, not a bilingual copy record */
export const LOCALE_GLYPHS = Object.fromEntries([['fa', 'فا'], ['en', 'En'], ['ar', 'ع'], ['ru', 'Ру'], ['zh-CN', '中']]) as Record<AppLocale, string>
/** broad region where each language is widely spoken: centre longitude and
 *  latitude of a soft glow, never a border */
export const LOCALE_REGIONS: Record<AppLocale, { lon: number; lat: number; r: number }> = {
  fa: { lon: 56, lat: 32, r: 15 },
  ar: { lon: 32, lat: 24, r: 22 },
  en: { lon: -38, lat: 42, r: 30 },
  ru: { lon: 70, lat: 58, r: 26 },
  'zh-CN': { lon: 108, lat: 32, r: 20 },
}

function displayName(code: AppLocale, ui: AppLocale): string {
  try { return new Intl.DisplayNames([ui], { type: 'language' }).of(code) || LOCALE_NAMES[code] } catch { return LOCALE_NAMES[code] }
}

/** Small wireframe globe for the trigger. */
function GlobeIcon() {
  return <svg className="of-globe-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M4.6 7.5h14.8M4.6 16.5h14.8" />
  </svg>
}

/** Globe with a rotating band of soft region glows. `focus` is the language
 *  whose region is centred and lit. */
function Globe({ focus }: { focus: AppLocale }) {
  const D = 120, R = D / 2
  const x = (lon: number) => R + (lon / 180) * D /* one hemisphere spans the diameter */
  const y = (lat: number) => R - (lat / 90) * R * 0.92
  const shift = R - x(LOCALE_REGIONS[focus].lon)
  const clip = useId().replace(/:/g, '')
  const band = (offset: number) => <g transform={`translate(${offset} 0)`}>
    {LOCALES.map(code => { const g = LOCALE_REGIONS[code]; return <circle key={code} className={`of-globe-region${code === focus ? ' is-focus' : ''}`} cx={x(g.lon)} cy={y(g.lat)} r={g.r} /> })}
  </g>
  return <svg className="of-globe" viewBox={`0 0 ${D} ${D}`} width={D} height={D} aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={`gc${clip}`}><circle cx={R} cy={R} r={R - 1} /></clipPath>
      <pattern id={`gd${clip}`} width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".8" /></pattern>
      <radialGradient id={`gs${clip}`} cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity=".14" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
    </defs>
    <g clipPath={`url(#gc${clip})`}>
      <g className="of-globe-band" style={{ transform: `translateX(${shift}px)` }}>
        <rect className="of-globe-dots" x={-2 * D} y="0" width={6 * D} height={D} fill={`url(#gd${clip})`} />
        {band(-2 * D)}{band(0)}{band(2 * D)}
      </g>
      <circle cx={R} cy={R} r={R} fill={`url(#gs${clip})`} />
    </g>
    <g className="of-globe-wire">
      <circle cx={R} cy={R} r={R - 1} /><ellipse cx={R} cy={R} rx={R * 0.5} ry={R - 1} /><ellipse cx={R} cy={R} rx={R * 0.82} ry={R - 1} />
      <path d={`M1 ${R}h${D - 2}M${R * 0.22} ${R * 0.5}h${D - R * 0.44}M${R * 0.22} ${R * 1.5}h${D - R * 0.44}`} />
    </g>
  </svg>
}

export default function LanguageSelect({ locale, onChange, className }: {
  locale: AppLocale; onChange: (next: AppLocale) => void; className?: string
}) {
  const label = pick(locale, 'زبان', 'Language')
  const id = useId().replace(/:/g, '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(LOCALES.indexOf(locale))
  const [place, setPlace] = useState<{ top: number; left: number; sheet: boolean } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const names = useMemo(() => LOCALES.map(code => ({ code, own: LOCALE_NAMES[code], ui: displayName(code, locale) })), [locale])

  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus() }
  const choose = (next: AppLocale) => { close(); if (next !== locale) { saveLocaleChoice(next); onChange(next) } }
  const show = (index = LOCALES.indexOf(locale)) => { setActive(index); setOpen(true) }

  /* place the panel under the trigger (inline-end aligned), or as a bottom sheet */
  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const measure = () => {
      const r = trigger.current!.getBoundingClientRect()
      const sheet = innerWidth < 768 || matchMedia('(pointer: coarse)').matches
      const width = 320, rtl = (trigger.current!.parentElement?.closest('[dir]')?.getAttribute('dir') || document.documentElement.dir) === 'rtl'
      const left = Math.min(Math.max(8, rtl ? r.left : r.right - width), innerWidth - width - 8)
      setPlace({ top: r.bottom + 8, left, sheet })
    }
    measure()
    list.current?.focus({ preventScroll: true })
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!list.current?.closest('.of-language-panel')?.contains(t) && !trigger.current?.contains(t)) close(false)
    }
    addEventListener('resize', measure); document.addEventListener('pointerdown', outside)
    return () => { removeEventListener('resize', measure); document.removeEventListener('pointerdown', outside) }
  }, [open])
  useEffect(() => { if (!open) setActive(LOCALES.indexOf(locale)) }, [locale, open])

  const onTriggerKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(e.key === 'ArrowUp' ? LOCALES.length - 1 : LOCALES.indexOf(locale)) }
  }
  const onListKey = (e: ReactKeyboardEvent) => {
    const last = LOCALES.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(last, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(last) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(LOCALES[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') close(false)
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      /* type-ahead across the code, the own-script name and the UI-language name */
      const now = Date.now(), t = typed.current
      t.text = (now - t.at > 700 ? '' : t.text) + e.key.toLowerCase(); t.at = now
      const hit = names.findIndex(n => [n.code, n.own, n.ui].some(s => s.toLowerCase().startsWith(t.text)))
      if (hit >= 0) setActive(hit)
    }
  }
  const focus = LOCALES[active] || locale

  return <>
    <button ref={trigger} type="button" className={'of-language-select' + (className ? ' ' + className : '')} title={label}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-label={`${label}: ${LOCALE_NAMES[locale]}`}
      data-locale={locale} onClick={() => (open ? close(false) : show())} onKeyDown={onTriggerKey}>
      <GlobeIcon /><span className="of-language-code" lang="en">{LOCALE_CODES[locale]}</span>
    </button>
    {open && place && createPortal(<div className={`of-language-panel${place.sheet ? ' is-sheet' : ''}`} dir={dirOf(locale)} lang={locale}
      style={place.sheet ? undefined : { top: place.top, left: place.left }}>
      {place.sheet && <div className="of-language-scrim" aria-hidden="true" onClick={() => close()} />}
      <div className="of-language-sheet">
        <div className="of-language-globe"><Globe focus={focus} /></div>
        <ul ref={list} id={`${id}-list`} role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`${id}-${focus}`} onKeyDown={onListKey}>
          {names.map(({ code, own, ui }, i) => <li key={code} id={`${id}-${code}`} role="option" aria-selected={code === locale} data-locale={code}
            className={i === active ? 'is-active' : undefined} onPointerEnter={() => setActive(i)} onClick={() => choose(code)}>
            <span className="of-language-glyph" lang={code} aria-hidden="true">{LOCALE_GLYPHS[code]}</span>
            <span className="of-language-names"><b lang={code} dir={dirOf(code)}>{own}</b>{ui !== own && <small>{ui}</small>}</span>
            <span className="of-language-dir" lang="en" aria-hidden="true">{dirOf(code).toUpperCase()}</span>
            <svg className="of-language-check" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3.5 8.4 3 3 6-6.6" /></svg>
          </li>)}
        </ul>
      </div>
    </div>, document.body)}
  </>
}
