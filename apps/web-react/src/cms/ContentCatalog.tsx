import { useState } from 'react'
import { pick, type AppLocale } from '../i18n/locales'
import { EDITORIAL_LOCALES, missingLocales, type EditTarget } from './editorialSurfaces'
import { editTarget, isVisualEditingActive, syncVisualLocale, visualCatalog } from './visualEditing'

/** Editor-only inventory for copy that is conditional, ambiguous, or not on
 * the current screen. It is not a route and it is not rendered for visitors.
 */
export default function ContentCatalog({ locale }: { locale: AppLocale }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const active = isVisualEditingActive()
  const entries = active && open ? visualCatalog() : []
  if (!active) return null
  const filtered = entries.filter(entry => {
    const missing = missingLocales(entry.localesPresent)
    if (missingOnly && missing.length === 0) return false
    const haystack = `${entry.text} ${entry.contentKey || ''} ${entry.page || ''} ${entry.route || ''} ${entry.collection} ${entry.fields.join(' ')}`.toLocaleLowerCase()
    return haystack.includes(query.toLocaleLowerCase())
  }).slice(0, 80)
  return (
    <div data-of-visual-control="" style={{ position: 'fixed', insetInlineEnd: 16, bottom: 16, zIndex: 2147483000, maxWidth: 'min(420px, calc(100vw - 32px))' }}>
      <button type="button" onClick={() => setOpen(value => !value)} style={buttonStyle}>
        {pick(locale, 'فهرست محتوا', 'Content catalog')}
      </button>
      {open ? (
        <section role="dialog" aria-label={pick(locale, 'فهرست محتوای قابل ویرایش', 'Editable content catalog')} style={panelStyle}>
          <p style={{ margin: 0 }}>{pick(locale, 'متن‌های ثابت همین نما و رکوردهایی که در صفحه دیده نمی‌شوند. مقادیر قیمت، موجودی و معامله اینجا نیستند.', 'Static copy on this view, plus records that are not on screen. Prices, balances and trades are not listed.')}</p>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={pick(locale, 'جستجو', 'Search')} aria-label={pick(locale, 'جستجوی محتوا', 'Search content')} style={inputStyle} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={missingOnly} onChange={event => setMissingOnly(event.target.checked)} />
            {pick(locale, 'فقط ترجمه‌های ناقص', 'Missing translations only')}
          </label>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflow: 'auto', maxHeight: '50vh' }}>
            {filtered.map(entry => <CatalogRow key={rowKey(entry)} entry={entry} locale={locale} onEdit={() => { syncVisualLocale(locale); editTarget(entry) }} />)}
          </ul>
          <p style={{ margin: 0 }}>{filtered.length} / {entries.length}. {pick(locale, 'پیش‌نویس تا زمان انتشار برای بازدیدکننده دیده نمی‌شود. بازگشت نسخه از تاریخچهٔ Directus است.', 'Drafts stay hidden from visitors until published. Restore earlier copy from the Directus revision history.')}</p>
        </section>
      ) : null}
    </div>
  )
}

function CatalogRow({ entry, locale, onEdit }: { entry: EditTarget; locale: AppLocale; onEdit: () => void }) {
  const missing = missingLocales(entry.localesPresent)
  return (
    <li style={{ borderTop: '1px solid #638071', padding: '8px 0' }}>
      <button type="button" onClick={onEdit} style={{ ...buttonStyle, width: '100%', textAlign: 'start' }}>
        <span dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>{entry.text || entry.contentKey || entry.collection}</span>
      </button>
      <small>
        {entry.collection}.{entry.fields.join(',')} · {entry.item}
        {entry.contentKey ? ` · ${entry.contentKey}` : ''}
        {missing.length ? ` · ${pick(locale, 'بدون ترجمه', 'missing')}: ${missing.join(', ')}` : ` · ${EDITORIAL_LOCALES.join(', ')}`}
      </small>
    </li>
  )
}

function rowKey(entry: EditTarget): string {
  return `${entry.collection}:${entry.item}:${entry.fields.join(',')}:${entry.contentKey || entry.text}`
}

const buttonStyle = { font: 'inherit', padding: '8px 12px', borderRadius: 6, border: '1px solid #6644ff', background: '#16161d', color: '#fff' }
const panelStyle = { marginTop: 8, padding: 12, background: '#10141c', color: '#f3f6f4', border: '1px solid #6644ff', borderRadius: 8, display: 'grid', gap: 8 }
const inputStyle = { font: 'inherit', padding: 8, borderRadius: 6, border: '1px solid #638071', background: 'transparent', color: 'inherit' }
