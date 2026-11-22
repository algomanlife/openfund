import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { dirOf, pick, type AppLocale } from '../../i18n/locales'
import { campaignPage, markSeen, report, selectCampaign, type Campaign } from './campaigns'
import './campaigns.css'

/* one popup per page lifecycle across every mounted instance */
let openCampaign: string | null = null
const SESSION_KEY = 'of-campaign:modal:session'

/** Promotional popup (Backstage → Marketing → Promotional campaigns).
 *
 *  Opens after the campaign's delay (default 12 s) of VISIBLE time on a
 *  public page — the timer pauses while the tab is hidden and restarts per
 *  route — and never on checkout, purchases, sign-in or trading routes.
 *  Accessible modal: labelled dialog, focus moved in and trapped, Escape and
 *  backdrop close it, focus returns to the element that had it, background
 *  scroll is locked, and motion is skipped for prefers-reduced-motion. */
export default function PromoModal({ locale }: { locale: AppLocale }) {
  const { pathname } = useLocation()
  const page = campaignPage(pathname, 'modal')
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!page || openCampaign) return
    /* at most one popup per browser session, whichever campaign it was */
    try { if (sessionStorage.getItem(SESSION_KEY)) return } catch { /* storage blocked: per-campaign caps still apply */ }
    let live = true, timer: ReturnType<typeof setTimeout> | null = null, remaining = 0, started = 0, chosen: Campaign | null = null
    const fire = () => {
      if (!live || !chosen || openCampaign) return
      openCampaign = chosen.id
      returnFocus.current = document.activeElement as HTMLElement | null
      markSeen(chosen)
      try { sessionStorage.setItem(SESSION_KEY, chosen.id) } catch { /* ignore */ }
      setCampaign(chosen)
    }
    const run = () => { if (!chosen || timer || document.hidden) return; started = Date.now(); timer = setTimeout(fire, remaining) }
    const pause = () => { if (!timer) return; clearTimeout(timer); timer = null; remaining = Math.max(0, remaining - (Date.now() - started)) }
    const visibility = () => (document.hidden ? pause() : run())
    void selectCampaign('modal', locale, page).then(c => {
      if (!live || !c) return
      chosen = c; remaining = c.delayMs
      run()
    })
    document.addEventListener('visibilitychange', visibility)
    return () => { live = false; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [locale, page])

  const close = useCallback((how: 'close' | 'click') => {
    if (!campaign) return
    report(campaign, how)
    setCampaign(null)
    openCampaign = null
    const target = returnFocus.current
    if (target?.isConnected) target.focus({ preventScroll: true })
  }, [campaign])

  useEffect(() => {
    if (!campaign) return
    report(campaign, 'impression')
    const { body, documentElement } = document
    const previous = { overflow: body.style.overflow, padding: body.style.paddingInlineEnd }
    const gap = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingInlineEnd = `${gap}px`
    const node = dialog.current
    node?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close('close'); return }
      if (e.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')]
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      else if (!node.contains(document.activeElement)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      body.style.overflow = previous.overflow
      body.style.paddingInlineEnd = previous.padding
    }
  }, [campaign, close])

  useEffect(() => () => { if (openCampaign && campaign && openCampaign === campaign.id) openCampaign = null }, [campaign])

  if (!campaign) return null
  const titleId = `of-promo-title-${campaign.id}`
  const image = campaign.imageDesktop && (
    <picture className="of-promo-media">
      {campaign.imageMobile && <source media="(max-width: 640px)" srcSet={campaign.imageMobile} />}
      <img src={campaign.imageDesktop} alt={campaign.imageAlt} loading="eager" decoding="async" />
    </picture>
  )
  return createPortal(
    <div className="of-promo-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close('close') }}>
      <div ref={dialog} className={`of-promo of-promo-${campaign.template}${image ? '' : ' of-promo-noimage'}`} role="dialog" aria-modal="true"
        aria-labelledby={titleId} dir={dirOf(locale)} lang={locale} data-campaign={campaign.id}>
        <button type="button" className="of-promo-close" onClick={() => close('close')} aria-label={pick(locale, 'بستن', 'Close')} data-autofocus>
          <span aria-hidden="true">×</span>
        </button>
        {image}
        <div className="of-promo-copy">
          <h2 id={titleId}>{campaign.headline}</h2>
          {campaign.template === 'split' && campaign.body && <p>{campaign.body}</p>}
          {campaign.coupon && (
            <p className="of-promo-coupon"><span>{pick(locale, 'کد تخفیف', 'Coupon code')}</span> <code dir="ltr">{campaign.coupon.code}</code></p>
          )}
          {campaign.ctaUrl && campaign.ctaLabel && (
            <a className="button of-promo-cta" href={campaign.ctaUrl} onClick={() => close('click')}
              {...(campaign.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{campaign.ctaLabel}</a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
