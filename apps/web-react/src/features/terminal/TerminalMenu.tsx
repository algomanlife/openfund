import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import OffCanvas from '../navigation/OffCanvas'
import { primary, route, type Locale, type Product } from './model'
import { dirOf, pick } from '../../i18n/locales'

/**
 * Terminal compact navigation: the menu trigger and its off-canvas drawer.
 * Open/closed state lives here, so toggling never re-renders TerminalShell or
 * the trading workspace below it (chart, market, timeframe, drawings and the
 * active tab are untouched). Destinations are the existing terminal routes.
 */
function TerminalMenu({ locale, product, page, accountsHref, accountsSection, pathname, search }: {
  locale: Locale
  product: Product
  page: string
  accountsHref: string
  accountsSection: boolean
  pathname: string
  search: string
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => { setOpen(false) }, [pathname, search, locale])
  const current = (id: string) => id === 'journal' ? page === 'journal' && !accountsSection : page === id
  const item = (key: string, to: string, label: string, active: boolean) =>
    <li key={key}><Link className="of-drawer-link" to={to} onClick={close} aria-current={active ? 'page' : undefined}>{label}</Link></li>

  return <>
    <button ref={trigger} type="button" className="of-terminal-menu-trigger" aria-haspopup="dialog"
      aria-expanded={open} aria-controls="terminal-navigation-drawer" onClick={() => setOpen(value => !value)}>
      <span className="of-terminal-menu-icon" aria-hidden="true"><i /><i /><i /></span>
      <span className="of-terminal-menu-label">{t('منو', 'Menu')}</span>
    </button>
    <OffCanvas open={open} onClose={close} dir={dirOf(locale)} className="of-terminal-drawer"
      label={t('ناوبری ترمینال', 'Terminal navigation')} closeLabel={t('بستن', 'Close')}
      returnFocus={() => trigger.current}
      header={<Link to={`/${locale}/home`} onClick={close} aria-label={t('خانه اوپن‌فاند', 'Openfund home')}>
        <img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="24" height="27" alt="" /><b dir="ltr">openfund</b>
      </Link>}>
      <nav id="terminal-navigation-drawer" className="of-drawer-nav" aria-label={t('ناوبری ترمینال', 'Terminal navigation')}>
        <ul>
          {primary[product].map(([id, fa, en]) => item(id, route(locale, product, id), id === 'trade' ? t('معاملات', 'Trading') : t(fa, en), current(id)))}
          {item('journal', route(locale, product, 'journal'), t('ژورنال', 'Journal'), current('journal'))}
          {item('accounts', accountsHref, t('حساب‌ها', 'Accounts'), accountsSection)}
        </ul>
      </nav>
    </OffCanvas>
  </>
}

export default memo(TerminalMenu)
