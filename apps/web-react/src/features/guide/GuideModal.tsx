import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dirOf, pick, pickFormat, type AppLocale } from '../../i18n/locales'
import DirArrow from '../../ui/DirArrow'
import { GUIDE_OPEN_EVENT, optedOut, reportGuide, selectGuide, setOptOut, type Guide, type GuideStep } from './guide'
import './guide.css'

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
/* Automated browsers (every existing terminal test) are not interrupted by
   the automatic opening; the guide's own test opts in. The menu entry always
   opens it. */
const autoOpenAllowed = () => !navigator.webdriver || (window as { __OF_GUIDE_AUTOOPEN__?: boolean }).__OF_GUIDE_AUTOOPEN__ === true

/** Subtitles from the CMS may be cross-origin: read them as text and attach
 *  a same-origin blob URL, so the <track> needs no CORS mode on the video. */
function useSubtitle(url: string | null): string | null {
  const [blob, setBlob] = useState<string | null>(null)
  useEffect(() => {
    if (!url) { setBlob(null); return }
    let live = true, made: string | null = null
    fetch(url).then(r => (r.ok ? r.text() : null)).then(text => {
      if (!live || !text || !text.startsWith('WEBVTT')) return
      made = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }))
      setBlob(made)
    }).catch(() => {})
    return () => { live = false; if (made) URL.revokeObjectURL(made); setBlob(null) }
  }, [url])
  return blob
}

function StepMedia({ step, locale, title }: { step: GuideStep; locale: AppLocale; title: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const reduced = reducedMotion()
  const [playing, setPlaying] = useState(!reduced)
  const subtitleFa = useSubtitle(step.subtitles.fa), subtitleEn = useSubtitle(step.subtitles.en)
  useEffect(() => { setPlaying(!reduced) }, [step.id, reduced])
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (playing) void v.play().catch(() => setPlaying(false))
    else v.pause()
  }, [playing, step.id])
  /* never play in a hidden tab */
  useEffect(() => {
    const onVisibility = () => { const v = video.current; if (v && document.hidden) v.pause(); else if (v && playing) void v.play().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [playing])
  if (step.kind === 'image') return <div className="of-guide-media"><img src={step.image!} alt={title} decoding="async" /></div>
  const fa = locale === 'fa'
  return <div className="of-guide-media">
    <video key={step.id} ref={video} muted loop playsInline preload="metadata" poster={step.poster ?? undefined} aria-label={title}
      autoPlay={!reduced} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}>
      {step.webm && <source src={step.webm} type="video/webm" />}
      {step.mp4 && <source src={step.mp4} type="video/mp4" />}
      {subtitleFa && <track kind="subtitles" srcLang="fa" label="فارسی" src={subtitleFa} default={fa} />}
      {subtitleEn && <track kind="subtitles" srcLang="en" label="English" src={subtitleEn} default={!fa} />}
    </video>
    <button type="button" className={`of-guide-play${playing ? '' : ' is-paused'}`} aria-pressed={playing}
      aria-label={playing ? pick(locale, 'توقف ویدیو', 'Pause video') : pick(locale, 'پخش ویدیو', 'Play video')}
      onClick={() => setPlaying(p => !p)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">{playing
        ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
        : <path d="M8 5v14l11-7z" fill="currentColor" />}</svg>
    </button>
  </div>
}

/** Terminal guide (Backstage → Marketing → Terminal guide).
 *
 *  Opens every time the terminal is entered (one mount of the terminal
 *  shell), unless "Don't show again" is stored for this guide version, and
 *  from the menu's "Guide" entry at any time. Large modal: media on top, then
 *  title and body; step dots, Previous / Next / "Start trading", a close
 *  button and the "Don't show again" checkbox. Full screen on phones. Focus
 *  is moved in and trapped, Escape closes it, focus returns afterwards; with
 *  reduced motion the video does not autoplay (poster and a play button). */
export default function GuideModal({ locale }: { locale: AppLocale }) {
  const [guide, setGuide] = useState<Guide | null>(null)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [dontShow, setDontShow] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const loaded = useRef<Promise<Guide | null> | null>(null)

  const load = useCallback(() => (loaded.current ??= selectGuide(locale)), [locale])
  const show = useCallback((g: Guide) => {
    returnFocus.current = document.activeElement as HTMLElement | null
    setGuide(g); setIndex(0); setDontShow(optedOut(g)); setOpen(true)
  }, [])

  /* entering the terminal: once per mount */
  useEffect(() => {
    let live = true
    loaded.current = null
    void load().then(g => { if (live && g && !optedOut(g) && autoOpenAllowed()) show(g) })
    return () => { live = false }
  }, [load, show])
  /* the menu's "Guide" entry */
  useEffect(() => {
    const onOpen = () => { void load().then(g => { if (g) show(g) }) }
    window.addEventListener(GUIDE_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(GUIDE_OPEN_EVENT, onOpen)
  }, [load, show])

  const close = useCallback((completed = false) => {
    if (!guide) return
    if (completed) reportGuide(guide, 'completed')
    if (dontShow !== optedOut(guide)) { setOptOut(guide, dontShow); if (dontShow) reportGuide(guide, 'opted_out') }
    setOpen(false)
    const target = returnFocus.current
    if (target?.isConnected) target.focus({ preventScroll: true })
  }, [guide, dontShow])

  useEffect(() => {
    if (!open || !guide) return
    reportGuide(guide, 'shown')
    const { body } = document
    const previous = body.style.overflow
    body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      const node = dialog.current
      if (e.key === 'Escape') { e.preventDefault(); close(); return }
      if (e.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled])')]
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      else if (!node.contains(document.activeElement)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); body.style.overflow = previous }
  }, [open, guide, close])

  if (!open || !guide) return null
  const step = guide.steps[index]
  const last = index === guide.steps.length - 1
  const titleId = `of-guide-title-${guide.id}`
  const copyLang = locale === 'fa' ? 'fa' : 'en'
  return createPortal(
    <div className="of-guide-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <div ref={dialog} className="of-guide" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${titleId}-body`}
        dir={dirOf(locale)} lang={locale} data-guide={guide.id} data-version={guide.version}>
        <button type="button" className="of-guide-close" onClick={() => close()} aria-label={pick(locale, 'بستن راهنما', 'Close the guide')} data-autofocus>
          <span aria-hidden="true">×</span>
        </button>
        <StepMedia step={step} locale={locale} title={step.title} />
        <div className="of-guide-copy">
          <p className="of-guide-count">{pickFormat(locale, 'مرحلهٔ ${n} از ${total}', 'Step ${n} of ${total}', { n: index + 1, total: guide.steps.length })}</p>
          {/* step copy exists in fa and en; other locales read en */}
          <h2 id={titleId} lang={copyLang}>{step.title}</h2>
          {step.body && <p id={`${titleId}-body`} lang={copyLang}>{step.body}</p>}
        </div>
        <div className="of-guide-foot">
          <ol className="of-guide-dots" aria-label={pick(locale, 'مراحل راهنما', 'Guide steps')}>
            {guide.steps.map((s, i) => <li key={s.id}>
              <button type="button" aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}
                aria-label={pickFormat(locale, 'مرحلهٔ ${n}: ${title}', 'Step ${n}: ${title}', { n: i + 1, title: s.title })}><span aria-hidden="true" /></button>
            </li>)}
          </ol>
          <label className="of-guide-optout">
            <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} />
            <span>{pick(locale, 'دیگر نشان نده', "Don't show again")}</span>
          </label>
          <div className="of-guide-nav">
            <button type="button" className="button secondary" disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))}>
              <DirArrow kind="back" /> {pick(locale, 'قبلی', 'Previous')}
            </button>
            {last
              ? <button type="button" className="button" onClick={() => close(true)}>{pick(locale, 'شروع معامله', 'Start trading')} <DirArrow kind="forward" /></button>
              : <button type="button" className="button" onClick={() => setIndex(i => i + 1)}>{pick(locale, 'بعدی', 'Next')} <DirArrow kind="forward" /></button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
