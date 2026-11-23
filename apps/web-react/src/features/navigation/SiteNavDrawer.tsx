import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OffCanvas from './OffCanvas'
import { navigationModel } from '../information/navigation'
import type { CmsNavItem } from '../../cms/client'
import LanguageSelect from '../../i18n/LanguageSelect'
import { chooseTheme, currentTheme } from '../../theme'
import { dirOf, pick, pickFormat, type AppLocale } from '../../i18n/locales'
import { BRAND_WORDMARK } from '../../brand/wordmark'
import { BrandWordmark } from '../../brand/BrandWordmark'
import MegaIcon from './MegaIcon'
import FlamingoScene from './FlamingoScene'
import './mega-menu.css'

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
  /* accordion: the group holding the current page starts open */
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  useEffect(() => { if (open) setOpenGroups(new Set(model.groups.filter(g => g.links.some(l => l.current || l.activeSection)).map(g => g.id))) }, [open, model])
  const toggleGroup = (id: string) => setOpenGroups(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const base = import.meta.env.BASE_URL
  const link = (item: { href: string; label: string; current: boolean; activeSection: boolean }) =>
    <a className="of-drawer-link" href={item.href} onClick={close}
      aria-current={item.current ? 'page' : undefined} data-active-section={item.activeSection || undefined}>{item.label}</a>

  return <OffCanvas open={open} onClose={close} dir={dirOf(locale)} className="of-site-drawer"
    label={pick(locale, 'ناوبری اصلی', 'Main navigation')} closeLabel={pick(locale, 'بستن', 'Close')}
    returnFocus={() => trigger.current}
    header={<a href={`/${locale}/home`} onClick={close} aria-label={pickFormat(locale, 'خانه ${brand}', '${brand} home', { brand: BRAND_WORDMARK })}>
      <img src={`${base}assets/mark-mint.svg`} width="24" height="27" alt="" /><BrandWordmark />
    </a>}
    footer={<>
      <LanguageSelect locale={locale} onChange={next => { setOpen(false); onLocaleChange(next) }} />
      <button type="button" className="of-drawer-theme" aria-pressed={theme === 'dark'} onClick={() => {
        const next = currentTheme() === 'light' ? 'dark' : 'light'
        chooseTheme(next); setTheme(next)
      }}><span aria-hidden="true">◐</span>{pick(locale, 'حالت روشن / تیره', 'Light / dark mode')}</button>
    </>}>
    <nav id={SITE_DRAWER_ID} className="of-drawer-nav" aria-label={pick(locale, 'ناوبری اصلی', 'Main navigation')}>
      {model.groups.map((group, index) => {
        const expanded = openGroups.has(group.id)
        return <div key={group.id} className="of-drawer-group">{index === 1 && <ul>{model.primary.map(item => <li key={item.route}>{link(item)}</li>)}</ul>}<section className="of-drawer-section of-drawer-mega">
          <h3><button type="button" className="of-drawer-accordion" aria-expanded={expanded} aria-controls={`${group.id}-drawer`} onClick={() => toggleGroup(group.id)}>
            <span>{group.label}</span><span className="of-drawer-chevron" aria-hidden="true">⌄</span></button></h3>
          <div id={`${group.id}-drawer`} hidden={!expanded}>
            {group.sections.map(section => <div key={section.id} className="of-drawer-subgroup">
              {section.label && <h4>{section.label}</h4>}
              <ul className="mega-tiles is-drawer">{section.links.map(item => <li key={item.route}>
                <a className="mega-tile" href={item.href} onClick={close} aria-current={item.current ? 'page' : undefined} data-active-section={item.activeSection || undefined}>
                  <span className="mega-icon"><MegaIcon name={item.icon} /></span><span className="mega-text"><b>{item.label}{item.badge && <> <span className="mega-badge">{item.badge}</span></>}</b>{item.countdown && <small className="mega-countdown">{item.countdown}</small>}</span>
                </a></li>)}</ul>
            </div>)}
            {group.banners.length > 0 && <div className={group.banners.length > 1 ? 'mega-banner-row' : undefined}>{group.banners.map(banner =>
              <a key={banner.kind} className={`mega-banner is-compact is-${banner.kind}`} href={banner.href} onClick={close}>
                {banner.kind === 'flamingo'
                  ? <FlamingoScene variant="compact" live={open && expanded} />
                  : <span className="mega-icon"><MegaIcon name={banner.kind === 'council' ? 'governance' : banner.kind === 'whitepaper' ? 'whitepaper' : 'apps'} /></span>}
                <span className="mega-banner-copy"><b>{banner.title}</b><small>{banner.body}</small>
                  {banner.description && <span className="mega-sr">{banner.description}</span>}</span>
              </a>)}</div>}
          </div>
        </section></div>
      })}
      <a className="of-drawer-cta" href={`/${locale}/prop/trade`} onClick={close}>
        {pick(locale, 'ورود به ترمینال', 'Enter Terminal')}
      </a>
    </nav>
  </OffCanvas>
}
