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

/** A motion sequence made of real captures: frames cross-fade on a CSS loop
 *  (paused for reduced motion, where only the first frame shows). */
function Sequence({ frames, label }: { frames: { src: string; caption: string }[]; label: string }) {
  return <figure className="of-seq" style={{ ['--frames' as string]: frames.length }} aria-label={label}>
    <div className="of-seq-window">
      <div className="of-seq-bar" aria-hidden="true"><i /><i /><i /><span>{WINDOW_TITLE}</span></div>
      <div className="of-seq-stage">
        {frames.map((f, i) => <img key={f.src} src={f.src} alt={i === 0 ? f.caption : ''} aria-hidden={i > 0} loading="lazy" decoding="async" width={1440} height={960} style={{ ['--i' as string]: i }} />)}
      </div>
    </div>
    <figcaption className="of-seq-steps" aria-hidden="true">{frames.map((f, i) => <span key={f.caption} style={{ ['--i' as string]: i }}>{f.caption}</span>)}</figcaption>
  </figure>
}

function SpotCard({ children }: { children: React.ReactNode }) {
  const ref = useSpotlight<HTMLElement>()
  return <article ref={ref} className="of-app-card ds-spotlight">{children}</article>
}

function PlatformIcon({ platform }: { platform: Platform }) {
  return <svg width="34" height="34" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="4" y="5" width="32" height="23" rx={platform === 'macos' ? 6 : 2} /><path d={platform === 'windows' ? 'M20 5v23M4 16h32M13 35h14M20 28v7' : platform === 'linux' ? 'm13 12 6 5-6 5m9 0h6M13 35h14M20 28v7' : 'M13 35h14M20 28v7'} /></svg>
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
        <div className="of-apps-webmark" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="120" height="133" alt="" />
          <ul>{(['webCharts', 'webOrders', 'webAnalytics', 'webAccount'] as const).map(k => <li key={k}>{c(k)}</li>)}</ul>
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
            <Sequence label={c('motion1')} frames={[{ src: shot('chart'), caption: c('frameLayout1') }, { src: shot('two-charts'), caption: c('frameLayout2') }, { src: shot('three-charts'), caption: c('frameLayout3') }, { src: shot('four-charts'), caption: c('frameLayout4') }]} /></div>
          <div><h3>{c('motion2')}</h3><p>{c('motion2Body')}</p>
            <Sequence label={c('motion2')} frames={[{ src: shot('startup'), caption: c('frameStart') }, { src: shot('watchlist-ticket'), caption: c('frameWatch') }, { src: shot('chart'), caption: c('frameChart') }]} /></div>
        </div>
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
            <header><PlatformIcon platform={platform} /><h3 dir="ltr">{PLATFORM_NAME[platform]}</h3></header>
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
                  <div><dt>{c('size')}</dt><dd><bdi dir="ltr">{(f.bytes / 1048576).toFixed(1)} MB</bdi></dd></div>
                </dl>
                <code dir="ltr" className="of-app-sha" title="SHA-256">SHA-256 {f.sha256}</code>
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
