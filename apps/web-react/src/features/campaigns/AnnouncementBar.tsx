import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { dirOf, pick, type AppLocale } from '../../i18n/locales'
import { campaignPage, markSeen, report, selectCampaign, type Campaign } from './campaigns'
import './campaigns.css'

/** Announcement bar above the public header (Backstage → Marketing →
 *  Announcement banners). In normal document flow, so the sticky header and
 *  layout below it are never overlapped. Closing hides it for the rest of
 *  the browser session. Copy and destination come from published content. */
export default function AnnouncementBar({ locale }: { locale: AppLocale }) {
  const { pathname } = useLocation()
  const page = campaignPage(pathname)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  useEffect(() => {
    let live = true
    setCampaign(null)
    if (!page) return
    void selectCampaign('announcement_bar', locale, page).then(c => { if (live) setCampaign(c) })
    return () => { live = false }
  }, [locale, page])
  useEffect(() => {
    if (campaign) report(campaign, 'impression')
    /* layouts that size to the viewport (the home gateway) re-measure */
    requestAnimationFrame(() => dispatchEvent(new Event('of-announcement')))
  }, [campaign])
  if (!campaign) return null
  const close = () => { report(campaign, 'close'); markSeen(campaign); setCampaign(null) }
  return (
    <aside className={`of-announcement of-announcement-${campaign.style}`} dir={dirOf(locale)} lang={locale}
      aria-label={campaign.headline} data-campaign={campaign.id}>
      <div className="of-announcement-inner">
        <p className="of-announcement-text">{campaign.headline}</p>
        {campaign.ctaUrl && campaign.ctaLabel && (
          <a className="of-announcement-cta" href={campaign.ctaUrl} onClick={() => report(campaign, 'click')}
            {...(campaign.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {campaign.ctaLabel}
          </a>
        )}
        <button type="button" className="of-announcement-close" onClick={close} aria-label={pick(locale, 'بستن', 'Close')}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </aside>
  )
}
