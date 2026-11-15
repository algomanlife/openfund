import { useEffect, useState } from 'react'
import { IRAN_ACCESS_DOMAINS, IRAN_INDEPENDENT_DOMAIN, iranAccessNoticeEnabled } from '../../config/iranAccess'
import { publicRuntimeConfig } from '../../config/runtime'
import { dirOf, pick, type AppLocale } from '../../i18n/locales'
import './notice.css'

type Mode = 'GLOBAL_CONNECTED' | 'IRAN_ISOLATED' | 'RECOVERY'

/** Iran access notice shown directly below the public header, in every locale.
 *
 *  What it says follows the verified operational state, never the hostname:
 *   - the serving region comes from /runtime-config.js (OPENFUND_REGION);
 *   - on the Iran runtime, the current mode comes from /runtime/status.
 *  It never claims availability during an international outage, never claims
 *  independence for a deployment that has not reported region IRAN, and never
 *  promises trading without authoritative market data. Strings go through
 *  pick(), so they are registered and editable in the CMS content registry. */
export default function IranAccessNotice({ locale }: { locale: AppLocale }) {
  const region = publicRuntimeConfig().region === 'IRAN' ? 'IRAN' : 'GLOBAL'
  const [mode, setMode] = useState<Mode | null>(null)
  const [expanded, setExpanded] = useState(false) /* narrow screens: the explanation is clamped until opened */
  useEffect(() => {
    if (region !== 'IRAN') return
    let live = true
    fetch('/runtime/status', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(s => { if (live && s && ['GLOBAL_CONNECTED', 'IRAN_ISOLATED', 'RECOVERY'].includes(s.mode)) setMode(s.mode) })
      .catch(() => {})
    return () => { live = false }
  }, [region])
  if (!iranAccessNoticeEnabled()) return null

  const title = pick(locale, 'دسترسی به اوپن‌فاند از داخل ایران', 'Accessing Openfund from Iran')
  const body = region === 'IRAN'
    ? pick(locale,
      'این صفحه از زیرساخت ایران اوپن‌فاند روی لیارا ارائه می‌شود و از هر سه نشانی زیر در دسترس است. دامنهٔ openfi.live مسیر مستقل دیگری برای دسترسی به نسخهٔ ایران است. وضعیت خدمات و امکانات معاملاتی به شرایط اتصال و دسترسی به داده‌های معتبر بازار بستگی دارد. خرید چالش جدید فعلاً فقط در نشانی بین‌المللی اوپن‌فاند انجام می‌شود.',
      'This page is served by Openfund\'s Iran infrastructure on Liara and is available at all three addresses below. openfi.live is a separately managed route to the Iran version. Service and trading features depend on connectivity and on access to authoritative market data. New challenge purchases are currently available only on Openfund\'s international address.')
    : pick(locale,
      'برای دسترسی از داخل ایران می‌توانید از نشانی‌های زیر استفاده کنید. این نشانی‌ها روی زیرساخت لیارا میزبانی می‌شوند و openfi.live دامنهٔ جداگانهٔ اوپن‌فاند برای ایران است. وضعیت خدمات و امکانات معاملاتی به شرایط اتصال و دسترسی به داده‌های معتبر بازار بستگی دارد. در هر نشانی باید جداگانه با کیف پول وارد شوید.',
      'From inside Iran you can use the addresses below. They are hosted on Liara infrastructure, and openfi.live is Openfund\'s separately managed domain for Iran. Service and trading features depend on connectivity and on access to authoritative market data. Sign in with your wallet separately on each address.')
  const state = region !== 'IRAN' || !mode || mode === 'GLOBAL_CONNECTED' ? null
    : mode === 'IRAN_ISOLATED'
      ? pick(locale,
        'اتصال بین‌المللی در حال حاضر برقرار نیست: معامله و ثبت پرداخت موقتاً متوقف است. اطلاعات حساب و درخواست برداشت در دسترس می‌ماند.',
        'International connectivity is currently unavailable: trading and payout recording are paused. Account information and withdrawal requests remain available.')
      : pick(locale,
        'اتصال بین‌المللی در حال بازیابی است و داده‌ها تطبیق داده می‌شوند. معامله تا پایان این بررسی متوقف است.',
        'International connectivity is being restored and data is being reconciled. Trading is paused until this review is complete.')
  const label = pick(locale, 'نشانی‌های دسترسی از ایران', 'Access addresses from Iran')
  const toggle = expanded ? pick(locale, 'کمتر', 'Less') : pick(locale, 'بیشتر', 'More')

  return <aside className="iran-access-notice" dir={dirOf(locale)} lang={locale} aria-labelledby="iran-access-title" data-region={region} data-mode={mode ?? undefined}>
    <div className="container iran-access-inner">
      <span className="iran-access-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M1.5 8h13M8 1.5c1.8 1.9 2.7 4 2.7 6.5S9.8 12.6 8 14.5C6.2 12.6 5.3 10.5 5.3 8S6.2 3.4 8 1.5Z" stroke="currentColor" strokeWidth="1.1" /></svg>
      </span>
      <div className="iran-access-text">
        <p className={`iran-access-body${expanded ? ' is-expanded' : ''}`} id="iran-access-body"><strong id="iran-access-title">{title}</strong><span>{body}</span></p>
        <button type="button" className="iran-access-toggle" aria-expanded={expanded} aria-controls="iran-access-body" onClick={() => setExpanded(v => !v)}>{toggle}</button>
        {state && <p className="iran-access-state" role="status">{state}</p>}
        <ul className="iran-access-domains" aria-label={label}>
          {IRAN_ACCESS_DOMAINS.map(domain => <li key={domain}>
            <a href={`https://${domain}/`} dir="ltr" rel="noopener" className={domain === IRAN_INDEPENDENT_DOMAIN ? 'is-independent' : undefined}>{domain}</a>
          </li>)}
        </ul>
      </div>
    </div>
  </aside>
}
