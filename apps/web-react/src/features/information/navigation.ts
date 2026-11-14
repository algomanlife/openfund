import brandbookUrl from '../../../../../brand/brandbook/Openfund-brandbook.zip?url'
import type { CmsNavItem, CmsFooterLink } from '../../cms/client'
import { labels, text } from './content'
import { pickRecord, type AppLocale } from '../../i18n/locales'
type Locale = AppLocale

const primary = ['challenges', 'markets', 'rulebook'] as const
/** Economy dropdown: governance, the consolidated Ambassador (IB) page and
 *  Referral & Rewards (formerly "Growth Partner" under Resources; same /referral page). */
const economy = ['governance', 'ambassador', 'transparency', 'revenue-model', 'live-market-access', 'referral'] as const
const resources = ['faq', 'learn', 'tools', 'about', 'contact'] as const
/** Website-owned labels that win over a stale CMS navigation/footer label. */
const FIXED_LABELS = new Set(['referral'])
/** footer "Openfund documents" entries */
const documentLabels = { whitepaper: text('Read the whitepaper', 'مطالعهٔ وایت‌پیپر') }
/** Retired public destinations (the Team section was removed); a stale CMS
 *  footer row naming one is skipped instead of producing a dead link. */
const RETIRED_DESTINATIONS = new Set(['team', 'team-section'])
const navigationLabels = { ...labels, glossary: text('Glossary', 'واژه‌نامه') }

export function navigationHref(route: string, locale: Locale): string {
  if (route === 'accounts-section') return `/${locale}/challenges?section=accounts`
  if (route === 'faq-section') return `/${locale}/faq`
  if (route === 'glossary') return `/${locale}/learn/glossary`
  if (route === 'github') return 'https://github.com/algomanlife/openfund'
  return `/${locale}/${route}`
}

export interface NavigationLink { route: string; href: string; label: string; current: boolean; activeSection: boolean }
export interface NavigationGroup { id: string; label: string; links: NavigationLink[]; current: boolean }
export interface NavigationModel { primary: NavigationLink[]; groups: NavigationGroup[] }

/** One source for the website's primary destinations and dropdown groups:
 *  the desktop header and the off-canvas drawer render the same model. */
export function navigationModel(locale: Locale, pathname: string, navItems: CmsNavItem[] | null): NavigationModel {
  const cmsLabels = new Map(navItems?.map(item => [item.route as string, item.label]))
  const link = (route: string, cmsLabel?: { fa: string; en: string }): NavigationLink => {
    const label = (!FIXED_LABELS.has(route) && (cmsLabel || cmsLabels.get(route))) || navigationLabels[route as keyof typeof navigationLabels]
    const section = route === 'glossary' ? 'learn/glossary' : route
    const current = pathname === `/${locale}/${section}`
    return { route, href: navigationHref(route, locale), label: pickRecord(locale, label), current, activeSection: !current && pathname.startsWith(`/${locale}/${section}/`) }
  }
  const group = (id: string, label: { fa: string; en: string }, links: NavigationLink[]): NavigationGroup =>
    ({ id, label: pickRecord(locale, label), links, current: links.some(item => item.current) })
  return {
    primary: primary.map(route => link(route)),
    groups: [
      group('website-economy', labels.economy, economy.map(route => link(route))),
      /* the economy group alone marks its trigger active (existing behaviour) */
      { ...group('website-resources', labels.resources, resources.flatMap(route => route === 'learn' ? [link(route), link('glossary')] : [link(route)])), current: false },
    ],
  }
}

/** Shared navigation only; the legacy page keeps its body and runtime. */
export function renderNavigation(root: ParentNode, locale: Locale, pathname: string, navItems: CmsNavItem[] | null, footerLinks: CmsFooterLink[] | null) {
  const cmsLabels = new Map(navItems?.map(item => [item.route as string, item.label]))
  const anchor = (item: NavigationLink) => {
    const a = document.createElement('a')
    a.href = item.href
    a.textContent = item.label
    if (item.current) a.setAttribute('aria-current', 'page')
    else if (item.activeSection) a.setAttribute('data-active-section', 'true')
    return a
  }
  const link = (route: string, cmsLabel?: { fa: string; en: string }) => {
    const label = (!FIXED_LABELS.has(route) && (cmsLabel || cmsLabels.get(route))) || navigationLabels[route as keyof typeof navigationLabels]
    const section = route === 'glossary' ? 'learn/glossary' : route
    const current = pathname === `/${locale}/${section}`
    return anchor({ route, href: navigationHref(route, locale), label: pickRecord(locale, label), current, activeSection: !current && pathname.startsWith(`/${locale}/${section}/`) })
  }
  /* one dropdown group (same markup/behaviour as the Resources menu) */
  const dropdownGroup = (item: NavigationGroup) => {
    const group = document.createElement('div')
    group.className = 'nav-account'
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'resources-toggle'
    trigger.setAttribute('aria-expanded', 'false')
    trigger.setAttribute('aria-controls', item.id)
    if (item.current) trigger.setAttribute('data-active-section', 'true')
    trigger.append(item.label + ' ')
    const chevron = document.createElement('span')
    chevron.className = 'chevron'; chevron.setAttribute('aria-hidden', 'true'); chevron.textContent = '⌄'
    trigger.append(chevron)
    const dropdown = document.createElement('div')
    dropdown.className = 'nav-dropdown'; dropdown.id = item.id
    const heading = document.createElement('span')
    heading.textContent = item.label
    dropdown.append(heading, ...item.links.map(anchor))
    group.append(trigger, dropdown)
    return group
  }
  const nav = root.querySelector('#navigation')
  if (nav) {
    // The legacy landing translator must not translate React-localized links again.
    (nav as HTMLElement).dataset.localeOwned = 'react'
    const model = navigationModel(locale, pathname, navItems)
    nav.replaceChildren(...model.primary.map(anchor), ...model.groups.map(dropdownGroup))
  }
  const footer = root.querySelector('#footer-links')
  if (footer) {
    (footer as HTMLElement).dataset.localeOwned = 'react'
    const defaults = [...primary, ...economy, ...resources, 'glossary' as const].map(route => ({ destination: route, label: navigationLabels[route] }))
    const seen = new Set<string>()
    footer.replaceChildren()
    for (const item of [...(footerLinks || []), ...defaults]) {
      if (RETIRED_DESTINATIONS.has(item.destination)) continue
      const href = navigationHref(item.destination, locale)
      const identity = item.destination === 'accounts-section' ? navigationHref('challenges', locale) : href
      if (seen.has(identity)) continue
      seen.add(identity)
      const a = link(item.destination, item.label)
      if (item.destination === 'github') { a.target = '_blank'; a.rel = 'noopener' }
      footer.append(a)
    }
  }
  root.querySelector('a[href$="downloads/Openfund-brandbook.zip"]')?.setAttribute('href', brandbookUrl)
  /* Footer document link: the official Whitepaper (one link, locale-aware, no '/react' prefix) */
  root.querySelectorAll<HTMLAnchorElement>('a[data-doc-link="whitepaper"]').forEach(a => {
    a.setAttribute('href', `/${locale}/whitepaper`)
    a.textContent = pickRecord(locale, documentLabels.whitepaper)
    if (pathname === `/${locale}/whitepaper`) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  })
  root.querySelector('.nav-cta')?.setAttribute('href', `/${locale}/prop/trade`)
}

export function navigationClick(event: MouseEvent, root: ParentNode): boolean {
  const trigger = (event.target as Element)?.closest<HTMLButtonElement>('.resources-toggle')
  if (!trigger) {
    root.querySelectorAll('.resources-toggle').forEach(button => {
      button.setAttribute('aria-expanded', 'false')
      button.parentElement?.classList.remove('resources-open')
    })
    return false
  }
  trigger.parentElement?.classList.remove('resources-dismissed')
  const open = trigger.getAttribute('aria-expanded') !== 'true'
  trigger.setAttribute('aria-expanded', String(open))
  trigger.parentElement?.classList.toggle('resources-open', open)
  trigger.parentElement?.classList.toggle('resources-dismissed', !open)
  return true
}

export function navigationKeyDown(event: KeyboardEvent, root: ParentNode): boolean {
  const target = event.target as HTMLElement
  const group = target.closest('.nav-account')
  if (!group) return false
  const trigger = group.querySelector<HTMLButtonElement>('.resources-toggle')!
  const links = Array.from(group.querySelectorAll<HTMLAnchorElement>('.nav-dropdown a'))
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopPropagation()
    trigger.setAttribute('aria-expanded', 'false'); group.classList.remove('resources-open'); group.classList.add('resources-dismissed'); trigger.focus()
    return true
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault(); group.classList.remove('resources-dismissed'); group.classList.add('resources-open'); trigger.setAttribute('aria-expanded', 'true')
    const index = links.indexOf(target as HTMLAnchorElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : event.key === 'ArrowDown' ? (index + 1) % links.length : (index <= 0 ? links.length : index) - 1
    links[next]?.focus()
    return true
  }
  group.classList.remove('resources-dismissed')
  return false
}

export function bindNavigation(root: ParentNode) {
  const close = () => root.querySelectorAll('.nav-account').forEach(group => {
    group.classList.remove('resources-open', 'resources-dismissed')
    group.querySelector('.resources-toggle')?.setAttribute('aria-expanded', 'false')
  })
  const outside = (event: Event) => {
    if (!(event.target as Element)?.closest('.nav-account')) close()
  }
  const leave = (event: Event) => {
    const focus = event as FocusEvent
    if (!(focus.relatedTarget as Element)?.closest?.('.nav-account')) close()
  }
  const enter = (event: Event) => {
    const pointer = event as PointerEvent
    const group = (pointer.target as Element)?.closest('.nav-account')
    if (group && !group.contains(pointer.relatedTarget as Node)) group.classList.remove('resources-dismissed')
  }
  document.addEventListener('pointerdown', outside)
  root.addEventListener('focusout', leave)
  root.addEventListener('pointerover', enter)
  return () => {
    document.removeEventListener('pointerdown', outside)
    root.removeEventListener('focusout', leave)
    root.removeEventListener('pointerover', enter)
  }
}

/** Width-aware header: when the navigation labels plus the header actions do
 *  not fit on one row (long locales such as Russian, or a narrow window), the
 *  header switches to its existing menu button instead of letting labels clip
 *  or overlap. Measured from real rendered widths, never from a breakpoint
 *  that assumes English label lengths. Returns a cleanup function. */
export function fitNavigation(root: ParentNode): () => void {
  const header = root.querySelector<HTMLElement>('.openfund-header')
  const nav = header?.querySelector<HTMLElement>('.nav')
  const links = header?.querySelector<HTMLElement>('#navigation')
  const actions = header?.querySelector<HTMLElement>('.nav-actions')
  if (!header || !nav || !links || !actions) return () => {}
  let frame = 0
  const measure = () => {
    frame = 0
    header.classList.remove('nav-overflow', 'nav-tight', 'nav-tighter')
    /* Sum the in-flow items (scrollWidth would also count the hidden,
       absolutely positioned dropdown panels and report false overflow). */
    const needed = (row: HTMLElement) => {
      const items = [...row.children].filter(el => {
        const style = getComputedStyle(el)
        return style.display !== 'none' && style.position !== 'absolute' && style.position !== 'fixed'
      })
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0
      return items.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) + gap * Math.max(0, items.length - 1)
    }
    const rowFits = () => needed(nav) <= nav.clientWidth - parseFloat(getComputedStyle(nav).paddingInlineStart) - parseFloat(getComputedStyle(nav).paddingInlineEnd) + 1
    /* links hidden by a narrow-screen stylesheet count as compact too, so
       there is one compact mode instead of breakpoint and measured variants */
    const fits = getComputedStyle(links).display !== 'none'
      && needed(links) <= links.getBoundingClientRect().width + 1
      && needed(actions) <= actions.getBoundingClientRect().width + 1
      && rowFits()
    if (fits) return
    /* compact: links move to the drawer; if the single row still does not
       fit, the drawer also takes the terminal entry, then language/theme */
    header.classList.add('nav-overflow')
    if (!rowFits()) header.classList.add('nav-tight')
    if (!rowFits()) header.classList.add('nav-tighter')
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
  const resize = new ResizeObserver(schedule)
  resize.observe(nav)
  const content = new MutationObserver(schedule)
  content.observe(links, { childList: true, subtree: true, characterData: true })
  content.observe(actions, { childList: true, subtree: true })
  void document.fonts?.ready.then(schedule)
  schedule()
  return () => { cancelAnimationFrame(frame); resize.disconnect(); content.disconnect() }
}
