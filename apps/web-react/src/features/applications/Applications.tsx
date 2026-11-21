import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { tx } from '../information/content'
import { useReveal } from '../company/reveal'
import { applicationCopy as copy } from './content'
import { applicationReleases, type Platform } from './releases'
import builds from './builds.json'
import { useSpotlight } from '../../styles/useSpotlight'
import './applications.css'

const shot = (name: string) => `${import.meta.env.BASE_URL}assets/apps/open-trade/${name}.webp`
/* the real app's title bar (product name and version are identifiers, not copy) */
const WINDOW_TITLE = `${builds.product} · ${builds.version} ${builds.channel.toUpperCase()}`
const PLATFORM_NAME: Record<Platform, string> = { macos: 'macOS', windows: 'Windows', linux: 'Linux' }
/** seconds each frame of a sequence stays on screen (the step chip's progress bar runs for this long) */
const STEP_SECONDS = 3.6
/** after a click on a step chip, auto-advance waits this long before resuming */
const RESUME_AFTER_MS = 9000

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches

/** true while the element is on screen and the tab is visible */
function useLive<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let onScreen = false
    const sync = () => setLive(onScreen && !document.hidden)
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() }, { rootMargin: '60px' })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return [ref, live]
}

/** Pointer tilt (fine pointers only) and scroll parallax written as CSS
 *  variables on the element: one rAF per event, only while on screen. */
function useTilt<T extends HTMLElement>(live: boolean, ref: React.RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || !live || reducedMotion()) return
    let frame = 0, px = 0, py = 0
    const write = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const progress = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight))
      el.style.setProperty('--px', px.toFixed(3)); el.style.setProperty('--py', py.toFixed(3)); el.style.setProperty('--sp', progress.toFixed(3))
    }
    const queue = () => { if (!frame) frame = requestAnimationFrame(write) }
    const move = (e: PointerEvent) => {
      if (!finePointer()) return
      const r = el.getBoundingClientRect()
      px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)); py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2))
      queue()
    }
    const leave = () => { px = 0; py = 0; queue() }
    addEventListener('pointermove', move, { passive: true }); addEventListener('scroll', queue, { passive: true }); el.addEventListener('pointerleave', leave)
    queue()
    return () => { removeEventListener('pointermove', move); removeEventListener('scroll', queue); el.removeEventListener('pointerleave', leave); cancelAnimationFrame(frame) }
  }, [live, ref])
}

/** Desktop window chrome around a real capture. */
function AppWindow({ src, alt = '', className = '', eager = false }: { src: string; alt?: string; className?: string; eager?: boolean }) {
  return <div className={`of-seq-window ${className}`}>
    <div className="of-seq-bar" aria-hidden="true"><i /><i /><i /><span>{WINDOW_TITLE}</span></div>
    <img src={src} alt={alt} width={1440} height={960} loading={eager ? 'eager' : 'lazy'} decoding="async" />
  </div>
}

type Reveal = 'fade' | 'split' | 'side' | 'quad'
interface Frame { src: string; caption: string; reveal?: Reveal }

/** A sequence of real captures. Steps are tabs: the active one shows a
 *  progress bar for STEP_SECONDS, then the next frame is revealed (a clip-path
 *  wipe that follows how the layout splits, or a cross-fade). Clicking or
 *  arrow-keying a step shows that frame and holds auto-advance briefly. Runs
 *  only while on screen and the tab is visible; reduced motion shows the
 *  chosen frame without auto-advance or transitions. */
function Sequence({ id, frames, label }: { id: string; frames: Frame[]; label: string }) {
  const [root, live] = useLive<HTMLElement>()
  const [active, setActive] = useState(0)
  const [previous, setPrevious] = useState<number | null>(null)
  const [heldUntil, setHeldUntil] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const go = (next: number) => { setActive(current => { if (current !== next) setPrevious(current); return next }) }
  const running = live && !reducedMotion() && Date.now() >= heldUntil
  useEffect(() => {
    if (!running) {
      if (!heldUntil || Date.now() >= heldUntil) return
      const wait = setTimeout(() => setHeldUntil(0), heldUntil - Date.now())
      return () => clearTimeout(wait)
    }
    const timer = setTimeout(() => go((active + 1) % frames.length), STEP_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [running, active, frames.length, heldUntil])
  const choose = (i: number) => { go(i); setHeldUntil(Date.now() + RESUME_AFTER_MS) }
  const keys = (e: React.KeyboardEvent, i: number) => {
    const dir = getComputedStyle(e.currentTarget).direction === 'rtl' ? -1 : 1
    const step = e.key === 'ArrowRight' ? dir : e.key === 'ArrowLeft' ? -dir : 0
    const next = step ? (i + step + frames.length) % frames.length : e.key === 'Home' ? 0 : e.key === 'End' ? frames.length - 1 : -1
    if (next < 0) return
    e.preventDefault(); choose(next); tabs.current[next]?.focus()
  }
  /* wrapping back to the first frame always cross-fades */
  const reveal = (i: number) => (i === active && previous !== null && !(i === 0 && previous === frames.length - 1) ? frames[i].reveal || 'fade' : 'fade')
  return <figure ref={root} className={`of-seq${running ? ' is-running' : ''}`} style={{ ['--frames' as string]: frames.length, ['--step' as string]: `${STEP_SECONDS}s` }}>
    <div className="of-seq-window">
      <div className="of-seq-bar" aria-hidden="true"><i /><i /><i /><span>{WINDOW_TITLE}</span></div>
      <div className="of-seq-stage" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`}>
        {frames.map((f, i) => <img key={f.src + i} src={f.src} alt={i === active ? f.caption : ''} aria-hidden={i !== active}
          className={i === active ? 'is-active' : i === previous ? 'is-previous' : ''} data-reveal={reveal(i)}
          onAnimationEnd={i === active ? () => setPrevious(null) : undefined}
          loading="lazy" decoding="async" width={1440} height={960} />)}
      </div>
    </div>
    <figcaption>
      <div className="of-seq-steps" role="tablist" aria-label={label}>
        {frames.map((f, i) => <button key={f.caption} ref={el => { tabs.current[i] = el }} type="button" role="tab" id={`${id}-tab-${i}`}
          aria-selected={i === active} aria-controls={`${id}-panel`} tabIndex={i === active ? 0 : -1}
          onClick={() => choose(i)} onKeyDown={e => keys(e, i)}>
          <span>{f.caption}</span><i className="of-seq-progress" aria-hidden="true" key={i === active ? `on-${active}-${running}` : 'off'} />
        </button>)}
      </div>
    </figcaption>
  </figure>
}

/** Hero: the real desktop window floating with a gentle perspective tilt,
 *  pointer and scroll parallax, a mint under-glow and a faint floor reflection. */
function HeroWindow() {
  const [ref, live] = useLive<HTMLDivElement>()
  useTilt(live, ref)
  return <div ref={ref} className="of-apps-hero-stage" aria-hidden="true">
    <div className="of-apps-hero-float">
      <AppWindow src={shot('four-charts')} className="of-apps-hero-window" eager />
      <div className="of-apps-hero-reflection"><img src={shot('four-charts')} alt="" width={1440} height={960} loading="lazy" decoding="async" /></div>
    </div>
    <div className="of-apps-hero-underglow" />
  </div>
}

/** Depth scene: one primary window and two smaller secondary windows at
 *  different depths, all real captures, moving with the pointer. */
function DepthScene() {
  const [ref, live] = useLive<HTMLDivElement>()
  useTilt(live, ref)
  return <div ref={ref} className="of-apps-depth" aria-hidden="true">
    <AppWindow src={shot('startup')} className="of-depth-back" />
    <AppWindow src={shot('three-charts')} className="of-depth-main" />
    <AppWindow src={shot('settings-glass')} className="of-depth-front" />
  </div>
}

/** Web Terminal card preview: a real capture slowly panned inside a browser frame. */
function WebPreview({ locale }: { locale: string }) {
  const [ref, live] = useLive<HTMLDivElement>()
  const capture = `${import.meta.env.BASE_URL}assets/campaign/terminal-${locale === 'fa' ? 'fa' : 'en'}.jpg`
  return <div ref={ref} className={`of-apps-webpreview${live ? ' is-running' : ''}`}>
    <div className="of-apps-webframe" aria-hidden="true">
      <div className="of-apps-webbar"><i /><i /><i /><span dir="ltr">/prop/trade</span></div>
      <div className="of-apps-webshot"><img src={capture} alt="" width={1440} height={823} loading="lazy" decoding="async" /><span className="of-apps-webscan" /></div>
    </div>
  </div>
}

function SpotCard({ children }: { children: React.ReactNode }) {
  const ref = useSpotlight<HTMLElement>()
  return <article ref={ref} className="of-app-card ds-spotlight">{children}</article>
}

/** Original line glyphs (no vendor logos): a laptop with a rounded screen,
 *  a desktop monitor with a window on it, and a monitor with a shell prompt. */
function PlatformIcon({ platform }: { platform: Platform }) {
  return <svg className="of-app-glyph" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {platform === 'macos' ? <><rect x="7" y="8" width="26" height="18" rx="3" /><path d="M3 30h34l-2 3H5z" /><path d="M17 17.5h6" /><circle cx="20" cy="12" r=".6" fill="currentColor" /></>
      : platform === 'windows' ? <><rect x="4" y="6" width="32" height="22" rx="2" /><path d="M14 34h12M20 28v6" /><rect x="10" y="11" width="14" height="10" rx="1" /><path d="M10 14h14M27 13h4M27 17h4" /></>
      : <><rect x="4" y="6" width="32" height="22" rx="2" /><path d="M14 34h12M20 28v6" /><path d="m11 13 5 4-5 4M19 21h8" /></>}
  </svg>
}

/** A small check that draws itself once when the card scrolls into view. */
function HashCheck({ label }: { label: string }) {
  return <span className="of-app-hashcheck"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" /><path d="m4.8 8.2 2.1 2.1 4.3-4.6" /></svg>{label}</span>
}

export default function Applications() {
  const locale = useInformationLocale()
  const c = (key: keyof typeof copy) => tx(locale, copy[key])
  const r1 = useReveal<HTMLElement>(), r2 = useReveal<HTMLElement>(), r3 = useReveal<HTMLElement>(), r4 = useReveal<HTMLElement>()
  const rows: [keyof typeof copy, keyof typeof copy, keyof typeof copy][] = [
    ['rowBest', 'webBest', 'deskBest'], ['rowCharts', 'webCharts', 'deskCharts'], ['rowOrders', 'webOrders', 'deskOrders'],
    ['rowAccount', 'webAccount', 'deskAccount'], ['rowAnalytics', 'webAnalytics', 'deskAnalytics'], ['rowInstall', 'webInstall', 'deskInstall'], ['rowStatus', 'webStatus', 'deskStatus'],
  ]
  return <InformationShell page="apps" description={c('heroIntro')}>
    <section id="top" className="of-apps-hero">
      <div className="of-apps-glow" aria-hidden="true" />
      <div className="container of-apps-hero-inner">
        <div className="eyebrow">OPENFUND · {c('eyebrow')}</div>
        <h1>{c('heroTitle')}</h1>
        <p className="hero-intro">{c('heroIntro')}</p>
        <div className="of-apps-ctas">
          <Link className="button" to={`/${locale}/prop/trade`}>{c('open')} <span aria-hidden="true">↗</span></Link>
          <a className="button ghost" href="#desktop-builds">{c('getDesktop')}</a>
        </div>
        <HeroWindow />
      </div>
    </section>

    <div className="container of-apps-body">
      <section ref={r1} className="of-apps-product of-reveal" aria-labelledby="web-app-title">
        <div className="of-apps-copy">
          <span className="of-app-tag">{c('webTag')}</span>
          <h2 id="web-app-title">{c('web')}</h2>
          <p>{c('webLead')}</p>
          <Link className="text-link" to={`/${locale}/prop/trade`}>{c('open')} ↗</Link>
        </div>
        <div className="of-apps-webcol">
          <WebPreview locale={locale} />
          <p className="of-apps-note">{c('webCaptured')}</p>
        </div>
      </section>

      <section ref={r2} className="of-apps-product is-desktop of-reveal" aria-labelledby="desktop-title">
        <div className="of-apps-copy">
          <span className="of-app-tag">{c('desktopTag')}</span>
          <h2 id="desktop-title">{c('desktopName')}</h2>
          <p>{c('desktopLead')}</p>
          <p className="of-apps-note">{c('captured')}</p>
        </div>
        <div className="of-apps-sequences">
          <div><h3>{c('motion1')}</h3><p>{c('motion1Body')}</p>
            <Sequence id="seq-layout" label={c('motion1')} frames={[{ src: shot('chart'), caption: c('frameLayout1') }, { src: shot('two-charts'), caption: c('frameLayout2'), reveal: 'split' }, { src: shot('three-charts'), caption: c('frameLayout3'), reveal: 'side' }, { src: shot('four-charts'), caption: c('frameLayout4'), reveal: 'quad' }]} /></div>
          <div><h3>{c('motion2')}</h3><p>{c('motion2Body')}</p>
            <Sequence id="seq-focus" label={c('motion2')} frames={[{ src: shot('watchlist-ticket'), caption: c('frameWatch') }, { src: shot('chart'), caption: c('frameChart') }, { src: shot('settings-glass'), caption: c('frameSettings') }]} /></div>
        </div>
        <DepthScene />
      </section>

      <section ref={r3} className="of-apps-compare of-reveal" aria-labelledby="compare-title">
        <h2 id="compare-title">{c('compare')}</h2><p>{c('compareIntro')}</p>
        <div className="of-apps-table" role="region" tabIndex={0} aria-labelledby="compare-title"><table>
          <thead><tr><th scope="col"><span className="sr-only">{c('rowBest')}</span></th><th scope="col">{c('web')}</th><th scope="col">{c('desktopName')}</th></tr></thead>
          <tbody>{rows.map(([row, web, desk]) => <tr key={row}><th scope="row">{c(row)}</th><td>{c(web)}</td><td>{c(desk)}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section ref={r4} id="desktop-builds" className="of-apps-downloads of-reveal" aria-labelledby="builds-title">
        <h2 id="builds-title">{c('desktop')}</h2>
        <p>{c('builtBody')}</p>
        <div className="of-app-grid">{(['macos', 'windows', 'linux'] as const).map(platform => {
          const published = applicationReleases.filter(r => r.platform === platform)
          const built = builds.files.filter(f => f.platform === platform)
          return <SpotCard key={platform}>
            <div className="of-app-card-head"><PlatformIcon platform={platform} /><h3 dir="ltr">{PLATFORM_NAME[platform]}</h3></div>
            {published.length ? published.map(r => <div key={`${r.version}-${r.architecture}-${r.format}`} className="of-app-release">
              <span className="of-app-status">{c(r.channel === 'beta' ? 'beta' : 'available')}</span>
              <dl>{([['version', r.version], ['architecture', r.architecture], ['format', r.format], ['size', `${(r.bytes / 1048576).toFixed(1)} MB`], ['date', r.releasedAt]] as const).map(([key, value]) => <div key={key}><dt>{c(key)}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>
              <a className="button" href={r.downloadUrl}>{c('download')}</a>
              <p><a href={r.notesUrl}>{c('notes')}</a> · <a href={r.guideUrl}>{c('install')}</a></p>
            </div>) : built.length ? <>
              <span className="of-app-status is-pending">{c('awaiting')}</span>
              <ul className="of-app-files">{built.map(f => <li key={f.file}>
                <dl>
                  <div><dt>{c('version')}</dt><dd><bdi dir="ltr">{builds.version} {builds.channel}</bdi></dd></div>
                  <div><dt>{c('architecture')}</dt><dd><bdi dir="ltr">{f.architecture}</bdi></dd></div>
                  <div><dt>{c('format')}</dt><dd><bdi dir="ltr">.{f.format}</bdi></dd></div>
                  <div><dt>{c('size')}</dt><dd><bdi dir="ltr">{`${(f.bytes / 1048576).toFixed(1)} MB`}</bdi></dd></div>
                </dl>
                {f.sha256 && <HashCheck label={c('hashRecorded')} />}
                <code dir="ltr" className="of-app-sha" title="SHA-256">{`SHA-256 ${f.sha256}`}</code>
                <code dir="ltr">{f.file}</code>
              </li>)}</ul>
              <p className="of-apps-note">{c('unsignedNote')}</p>
              <a className="text-link" href={builds.ciRun} rel="noopener noreferrer" target="_blank">{c('ciRecord')} ↗</a>
            </> : <><span className="of-app-status muted">{c('unavailable')}</span><p>{c('noInstaller')}</p></>}
          </SpotCard>
        })}</div>
      </section>

      <section className="of-app-guide"><h2>{c('guide')}</h2><ol>{(['step1', 'step2', 'step3'] as const).map(key => <li key={key}>{c(key)}</li>)}</ol></section>
      <section className="of-app-faq"><h2>{c('faq')}</h2>{([['faq1', 'answer1'], ['faq2', 'answer2'], ['faq3', 'answer3']] as const).map(([question, answer]) => <details key={question}><summary>{c(question)}</summary><p>{c(answer)}</p></details>)}<Link className="text-link" to={`/${locale}/contact`}>{c('support')} ↗</Link></section>
    </div>
  </InformationShell>
}
