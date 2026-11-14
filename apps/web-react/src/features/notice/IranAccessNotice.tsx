import { iranAccessNoticeEnabled } from '../../config/iranAccess'
import './notice.css'

/** Persian-only access notice shown directly below the public header.
 *  Callers render it for the `fa` locale only; see config/iranAccess.ts for
 *  the owner approval gate. Display only. */
export default function IranAccessNotice() {
  if (!iranAccessNoticeEnabled()) return null
  return <aside className="iran-access-notice" dir="rtl" lang="fa" aria-labelledby="iran-access-title">
    <div className="container iran-access-inner">
      <span className="iran-access-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M1.5 8h13M8 1.5c1.8 1.9 2.7 4 2.7 6.5S9.8 12.6 8 14.5C6.2 12.6 5.3 10.5 5.3 8S6.2 3.4 8 1.5Z" stroke="currentColor" strokeWidth="1.1" /></svg>
      </span>
      <p>
        <strong id="iran-access-title">نشانی جایگزین اوپن‌فاند در ایران</strong>
        <span>
          نشانی{' '}
          <a href="https://iran.openfund.cloud" dir="ltr" rel="noopener">iran.openfund.cloud</a>{' '}
          همان سرویس اوپن‌فاند را از طریق میزبانی داخلی نمایش می‌دهد. این نشانی همچنان به سرورهای بین‌المللی اوپن‌فاند وابسته است و هنگام قطع اینترنت بین‌الملل در دسترس نخواهد بود. ورود در این نشانی جداگانه است و باید کیف پول خود را دوباره متصل کنید.
        </span>
      </p>
    </div>
  </aside>
}
