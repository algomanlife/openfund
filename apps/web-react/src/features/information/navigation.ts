import brandbookUrl from '../../../../../brand/brandbook/Openfund-brandbook.zip?url'
import type { CmsNavItem, CmsFooterLink } from '../../cms/client'
import { labels, text } from './content'
import { pickRecord, type AppLocale } from '../../i18n/locales'
type Locale = AppLocale

const primary = ['challenges', 'markets', 'rulebook'] as const
/** Economy dropdown: governance and the consolidated Ambassador (IB) page. */
const economy = ['governance', 'ambassador', 'transparency', 'revenue-model', 'live-market-access'] as const
const resources = ['faq', 'learn', 'tools', 'referral'] as const
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

/** Shared navigation only; the legacy page keeps its body and runtime. */
export function renderNavigation(root: ParentNode, locale: Locale, pathname: string, navItems: CmsNavItem[] | null, footerLinks: CmsFooterLink[] | null) {
  const cmsLabels = new Map(navItems?.map(item => [item.route as string, item.label]))
  const link = (route: string, label = cmsLabels.get(route) || navigationLabels[route as keyof typeof navigationLabels]) => {
    const a = document.createElement('a')
    a.href = navigationHref(route, locale)
    a.textContent = pickRecord(locale, label)
    const section = route === 'glossary' ? 'learn/glossary' : route
    if (pathname === `/${locale}/${section}`) a.setAttribute('aria-current', 'page')
    else if (pathname.startsWith(`/${locale}/${section}/`)) a.setAttribute('data-active-section', 'true')
    return a
  }
  /* one dropdown group (same markup/behaviour as the Resources menu) */
  const dropdownGroup = (id: string, label: { fa: string; en: string }, links: HTMLAnchorElement[], current = false) => {
    const group = document.createElement('div')
    group.className = 'nav-account'
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'resources-toggle'
    trigger.setAttribute('aria-expanded', 'false')
    trigger.setAttribute('aria-controls', id)
    if (current) trigger.setAttribute('data-active-section', 'true')
    trigger.append(pickRecord(locale, label) + ' ')
    const chevron = document.createElement('span')
    chevron.className = 'chevron'; chevron.setAttribute('aria-hidden', 'true'); chevron.textContent = '⌄'
    trigger.append(chevron)
    const dropdown = document.createElement('div')
    dropdown.className = 'nav-dropdown'; dropdown.id = id
    const heading = document.createElement('span')
    heading.textContent = pickRecord(locale, label)
    dropdown.append(heading, ...links)
    group.append(trigger, dropdown)
    return group
  }
  const nav = root.querySelector('#navigation')
  if (nav) {
    // The legacy landing translator must not translate React-localized links again.
    (nav as HTMLElement).dataset.localeOwned = 'react'
    const economyLinks = economy.map(route => link(route))
    nav.replaceChildren(...primary.map(route => link(route)),
      dropdownGroup('website-economy', labels.economy, economyLinks, economyLinks.some(a => a.hasAttribute('aria-current'))),
      dropdownGroup('website-resources', labels.resources, resources.flatMap(route => route === 'learn' ? [link(route), link('glossary')] : [link(route)])))
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
