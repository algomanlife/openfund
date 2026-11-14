import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { tx } from '../information/content'
import { applicationCopy as copy } from './content'
import { applicationReleases } from './releases'
import './applications.css'

export default function Applications() {
  const locale = useInformationLocale()
  const c = (key: keyof typeof copy) => tx(locale, copy[key])
  return <InformationShell page="apps" description={c('intro')}>
    <section className="container of-apps-hero">
      <div className="eyebrow">OPENFUND · {c('eyebrow')}</div>
      <h1>{c('title')}</h1><p className="hero-intro">{c('intro')}</p>
      <Link className="button" to={`/${locale}/prop/trade`}>{c('open')} <span aria-hidden="true">↗</span></Link>
    </section>
    <div className="container of-apps-body">
      <section className="of-web-app" aria-labelledby="web-app-title">
        <div className="of-app-symbol" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="64" height="72" alt="" /></div>
        <div><span className="of-app-status">{c('available')}</span><h2 id="web-app-title">{c('web')}</h2><p>{c('webDescription')}</p></div>
        <Link className="text-link" to={`/${locale}/prop/trade`}>{c('open')} ↗</Link>
      </section>
      <section aria-labelledby="desktop-title"><h2 id="desktop-title">{c('desktop')}</h2><p>{c('desktopDescription')}</p>
        <div className="of-app-grid">{(['macos', 'windows', 'linux'] as const).map(platform => {
          const releases = applicationReleases.filter(r => r.platform === platform)
          return <article className="of-app-card" key={platform}>
            <svg width="38" height="38" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="4" y="5" width="32" height="23" rx={platform === 'macos' ? 6 : 2} /><path d={platform === 'windows' ? 'M20 5v23M4 16h32M13 35h14M20 28v7' : platform === 'linux' ? 'm13 12 6 5-6 5m9 0h6M13 35h14M20 28v7' : 'M13 35h14M20 28v7'} /></svg>
            <h3 dir="ltr">{({ macos: 'macOS', windows: 'Windows', linux: 'Linux' })[platform]}</h3>
            {!releases.length ? <><span className="of-app-status muted">{c('unavailable')}</span><p>{c('noInstaller')}</p></> : releases.map(r => <div key={`${r.version}-${r.architecture}`}>
              <span className="of-app-status">{c(r.channel === 'beta' ? 'beta' : 'available')}</span>
              {r.channel === 'beta' && <p>{c('experimental')}</p>}
              <dl>{([['version', r.version], ['channel', r.channel], ['architecture', r.architecture], ['format', r.format], ['size', `${(r.bytes / 1048576).toFixed(1)} MB`], ['date', r.releasedAt]] as const).map(([key, value]) => <div key={key}><dt>{c(key)}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>
              <a className="button" href={r.downloadUrl}>{c('download')}</a>
              <p><a href={r.notesUrl}>{c('notes')}</a> · <a href={r.guideUrl}>{c('install')}</a></p>
            </div>)}
          </article>
        })}</div>
      </section>
      <section className="of-app-guide"><h2>{c('guide')}</h2><ol>{(['step1', 'step2', 'step3'] as const).map(key => <li key={key}>{c(key)}</li>)}</ol></section>
      <section className="of-app-faq"><h2>{c('faq')}</h2>{([['faq1', 'answer1'], ['faq2', 'answer2'], ['faq3', 'answer3']] as const).map(([question, answer]) => <details key={question}><summary>{c(question)}</summary><p>{c(answer)}</p></details>)}<Link className="text-link" to={`/${locale}/contact`}>{c('support')} ↗</Link></section>
    </div>
  </InformationShell>
}
