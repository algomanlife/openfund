import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OffCanvas from './OffCanvas'
import { navigationModel } from '../information/navigation'
import type { CmsNavItem } from '../../cms/client'
import LanguageSelect from '../../i18n/LanguageSelect'
import { chooseTheme, currentTheme } from '../../theme'
import { dirOf, pick, type AppLocale } from '../../i18n/locales'

export const SITE_DRAWER_ID = 'site-navigation-drawer'
const TRIGGER = '.openfund-header .menu'

/**
 * Website off-canvas navigation. The header markup stays the shared
 * landing-body template; its existing `.menu` button becomes the drawer
 * trigger whenever the header is in compact (`nav-overflow`) mode. Links come
 * from the same navigation model as the desktop header and keep plain
 * anchors, so route handling is unchanged.
 */
export default function SiteNavDrawer({ locale, pathname, navItems, onLocaleChange }: {
  locale: AppLocale
  pathname: string
  navItems: CmsNavItem[] | null
  onLocaleChange: (next: AppLocale) => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLElement | null>(null)
  const model = useMemo(() => navigationModel(locale, pathname, navItems), [locale, pathname, navItems])

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.<HTMLElement>(TRIGGER)
      if (!button) return
      event.preventDefault()
      event.stopPropagation()
      trigger.current = button
      setOpen(value => !value)
    }
    document.addEventListener('click', click, true)
    return () => document.removeEventListener('click', click, true)
  }, [])

  /* keep the trigger's ARIA in step with the drawer (it is template markup) */
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(TRIGGER).forEach(button => {
      button.setAttribute('aria-controls', SITE_DRAWER_ID)
      button.setAttribute('aria-haspopup', 'dialog')
      button.setAttribute('aria-expanded', String(open))
    })
  })

  /* a route or language change closes the drawer */
  useEffect(() => { setOpen(false) }, [pathname, locale])

  const close = useCallback(() => setOpen(false), [])
  const [theme, setTheme] = useState(currentTheme)
  useEffect(() => { if (open) setTheme(currentTheme()) }, [open])
  const base = import.meta.env.BASE_URL
  const link = (item: { href: string; label: string; current: boolean; activeSection: boolean }) =>
    <a className="of-drawer-link" href={item.href} onClick={close}
      aria-current={item.current ? 'page' : undefined} data-active-section={item.activeSection || undefined}>{item.label}</a>

  return <OffCanvas open={open} onClose={close} dir={dirOf(locale)} className="of-site-drawer"
    label={pick(locale, 'ناوبری اصلی', 'Main navigation')} closeLabel={pick(locale, 'بستن', 'Close')}
    returnFocus={() => trigger.current}
    header={<a href={`/${locale}/home`} onClick={close} aria-label={pick(locale, 'خانه اوپن‌فاند', 'Openfund home')}>
      <img src={`${base}assets/mark-mint.svg`} width="24" height="27" alt="" /><span dir="ltr">openfund</span>
    </a>}
    footer={<>
      <LanguageSelect locale={locale} onChange={next => { setOpen(false); onLocaleChange(next) }} />
      <button type="button" className="of-drawer-theme" aria-pressed={theme === 'dark'} onClick={() => {
        const next = currentTheme() === 'light' ? 'dark' : 'light'
        chooseTheme(next); setTheme(next)
      }}><span aria-hidden="true">◐</span>{pick(locale, 'حالت روشن / تیره', 'Light / dark mode')}</button>
    </>}>
    <nav id={SITE_DRAWER_ID} className="of-drawer-nav" aria-label={pick(locale, 'ناوبری اصلی', 'Main navigation')}>
      <ul>{model.primary.map(item => <li key={item.route}>{link(item)}</li>)}</ul>
      {model.groups.map(group => <section key={group.id} className="of-drawer-section" aria-labelledby={`${group.id}-drawer`}>
        <h3 id={`${group.id}-drawer`}>{group.label}</h3>
        <ul>{group.links.map(item => <li key={item.route}>{link(item)}</li>)}</ul>
      </section>)}
      <a className="of-drawer-cta" href={`/${locale}/prop/trade`} onClick={close}>
        {pick(locale, 'ورود به ترمینال', 'Enter Terminal')}
      </a>
    </nav>
  </OffCanvas>
}
