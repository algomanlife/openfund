import { useEffect, useState } from 'react'
import { missesFor } from './messages'
import { dirOf, untranslatedNotice, type AppLocale } from './locales'

/** Visible, honest notice: shown only while text on the page has no translation. */
export function useHasMisses(locale: AppLocale) {
  const [has, setHas] = useState(() => locale !== 'fa' && locale !== 'en' && missesFor(locale).length > 0)
  useEffect(() => {
    if (locale === 'fa' || locale === 'en') { setHas(false); return }
    const update = () => setHas(missesFor(locale).length > 0)
    update()
    addEventListener('of-i18n-miss', update)
    return () => removeEventListener('of-i18n-miss', update)
  }, [locale])
  return has
}

export default function UntranslatedNotice({ locale, className = 'container of-locale-fallback' }: { locale: AppLocale; className?: string }) {
  if (!useHasMisses(locale)) return null
  return <p className={className} role="note" lang={locale} dir={dirOf(locale)} data-untranslated-notice>{untranslatedNotice(locale)}</p>
}
