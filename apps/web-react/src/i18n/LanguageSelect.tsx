import { LOCALES, LOCALE_CODES, LOCALE_NAMES, dirOf, pick, saveLocaleChoice, type AppLocale } from './locales'
import './language.css'

/** The one language selector for every shell (website, landing, terminal).
 *  A native select keeps it keyboard/touch accessible on every device.
 *  A change here is the visitor's explicit choice, so it is persisted and
 *  then outranks the Geo-IP default on later locale-less visits (ADR 0043). */
export default function LanguageSelect({ locale, onChange, className }: {
  locale: AppLocale; onChange: (next: AppLocale) => void; className?: string
}) {
  const label = pick(locale, 'زبان', 'Language')
  return <label className={'of-language-select' + (className ? ' ' + className : '')} title={label}>
    {/* compact visible face; the transparent native select above it keeps
        keyboard, screen-reader and touch behaviour */}
    <span className="of-language-face" aria-hidden="true"><span className="of-language-icon">◎</span>{LOCALE_CODES[locale]}</span>
    <select aria-label={label} value={locale} onChange={event => { const next = event.target.value as AppLocale; saveLocaleChoice(next); onChange(next) }}>
      {LOCALES.map(code => <option key={code} value={code} lang={code} dir={dirOf(code)}>{LOCALE_NAMES[code]}</option>)}
    </select>
  </label>
}
