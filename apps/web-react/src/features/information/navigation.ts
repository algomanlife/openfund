import brandbookUrl from '../../../../../brand/brandbook/Openfund-brandbook.zip?url'
import type { CmsNavItem, CmsFooterLink } from '../../cms/client'
import { labels, text } from './content'
import { pickRecord, type AppLocale } from '../../i18n/locales'
import { MEGA_BANNERS, MEGA_DESCRIPTIONS, MEGA_ICONS, RESOURCE_SECTIONS, megaBannerArt, megaIconNode, type MegaBannerKind } from '../navigation/megaMenu'
import { PREMIUM_LEAGUE_START, daysUntil } from '../tournament/schedule'
import { pickFormat } from '../../i18n/locales'
type Locale = AppLocale

const primary = ['markets', 'rulebook'] as const
/** Trading challenges dropdown: compare, buy, migrate, the tournament and the rules.
 *  `challenges` is the comparison page (the former primary link). */
const challengeGroup = ['challenges', 'checkout', 'trading-objectives', 'migrate', 'tournament', 'rulebook'] as const
/** Economy dropdown: governance, the consolidated Ambassador (IB) page and
 *  Referral & Rewards (formerly "Growth Partner" under Resources; same /referral page). */
const economy = ['governance', 'ambassador', 'transparency', 'revenue-model', 'live-market-access', 'referral'] as const
const resources = ['faq', 'learn', 'tools', 'apps', 'roadmap', 'developers', 'certificate-verification', 'about', 'contact'] as const
/** Website-owned labels that win over a stale CMS navigation/footer label. */
const FIXED_LABELS = new Set(['referral'])
/** footer "Openfund documents" entries */
const documentLabels = { whitepaper: text('Read the whitepaper', 'مطالعهٔ وایت‌پیپر') }
/** Retired public destinations (the Team section was removed); a stale CMS
 *  footer row naming one is skipped instead of producing a dead link. */
const RETIRED_DESTINATIONS = new Set(['team', 'team-section'])
const navigationLabels = { ...labels, glossary: text('Glossary', 'واژه‌نامه'),
  migrate: text('Migration to Openfund', 'مهاجرت به اوپن‌فاند'), tournament: text('Openfund Premium League', 'لیگ برتر اوپن‌فاند') }
/** tile titles inside the Challenges group (the header keeps the page names) */
const challengeTileLabels: Record<string, { en: string; fa: string }> = {
  challenges: text('Compare challenges', 'مقایسهٔ چلنج‌ها'),
  checkout: text('Buy a challenge', 'خرید چلنج'),
  'trading-objectives': text('Trading objectives', 'اهداف معاملاتی'),
  migrate: text('Migration to Openfund', 'مهاجرت به اوپن‌فاند'),
  tournament: text('Openfund Premium League', 'لیگ برتر اوپن‌فاند'),
  rulebook: text('Trading rules', 'قوانین معاملاتی'),
}
const tileIcons: Record<string, string> = { challenges: 'compare' }
const newBadge = text('New', 'جدید')

export function navigationHref(route: string, locale: Locale): string {
  if (route === 'accounts-section') return `/${locale}/challenges?section=accounts`
  if (route === 'faq-section') return `/${locale}/faq`
  if (route === 'glossary') return `/${locale}/learn/glossary`
  if (route === 'github') return 'https://github.com/algomanlife/openfund'
  return `/${locale}/${route}`
}

export interface NavigationLink { route: string; href: string; label: string; current: boolean; activeSection: boolean; description: string; icon: string; badge?: string; countdown?: string }
export interface NavigationSection { id: string; label: string; links: NavigationLink[] }
export interface NavigationBanner { kind: MegaBannerKind; href: string; title: string; body: string; cta: string; description: string }
export interface NavigationGroup { id: string; label: string; links: NavigationLink[]; current: boolean; sections: NavigationSection[]; banner: NavigationBanner | null; banners: NavigationBanner[] }
export interface NavigationModel { primary: NavigationLink[]; groups: NavigationGroup[] }

/** One source for the website's primary destinations and dropdown groups:
 *  the desktop header and the off-canvas drawer render the same model. */
export function navigationModel(locale: Locale, pathname: string, navItems: CmsNavItem[] | null, now = Date.now()): NavigationModel {
  const cmsLabels = new Map(navItems?.map(item => [item.route as string, item.label]))
  const cmsItems = new Map(navItems?.map(item => [item.route as string, item]))
  const link = (route: string, cmsLabel?: { fa: string; en: string }): NavigationLink => {
    const label = (!FIXED_LABELS.has(route) && (cmsLabel || cmsLabels.get(route))) || navigationLabels[route as keyof typeof navigationLabels]
    const section = route === 'glossary' ? 'learn/glossary' : route
    const current = pathname === `/${locale}/${section}`
    const cms = cmsItems.get(route)
    const description = cms?.description || MEGA_DESCRIPTIONS[route]
    const icon = cms?.icon && MEGA_ICONS[cms.icon] ? cms.icon : route
    return { route, href: navigationHref(route, locale), label: pickRecord(locale, label), current, activeSection: !current && pathname.startsWith(`/${locale}/${section}/`),
      description: description ? pickRecord(locale, description) : '', icon }
  }
  const banners = (id: string): NavigationBanner[] => {
    const defs = MEGA_BANNERS[id]
    return (Array.isArray(defs) ? defs : defs ? [defs] : []).map(b => ({ kind: b.kind, href: navigationHref(b.route, locale) + (b.hash || ''), title: pickRecord(locale, b.title),
      body: pickRecord(locale, b.body), cta: pickRecord(locale, b.cta), description: b.description ? pickRecord(locale, b.description) : '' }))
  }
  const group = (id: string, label: { fa: string; en: string }, links: NavigationLink[], sections?: NavigationSection[]): NavigationGroup =>
    ({ id, label: pickRecord(locale, label), links, current: links.some(item => item.current), sections: sections || [{ id, label: '', links }], banner: banners(id)[0] ?? null, banners: banners(id) })
  const resourceLinks = resources.flatMap(route => route === 'learn' ? [link(route), link('glossary')] : [link(route)])
  const byRoute = new Map(resourceLinks.map(item => [item.route, item]))
  const resourceSections = RESOURCE_SECTIONS.map(section => ({ id: section.id, label: pickRecord(locale, section.label), links: section.routes.flatMap(route => byRoute.get(route) || []) }))
  const challengeLinks = challengeGroup.map(route => {
    const item = { ...link(route, challengeTileLabels[route]), icon: tileIcons[route] || route }
    if (tileIcons[route] && MEGA_DESCRIPTIONS[tileIcons[route]] && !cmsItems.get(route)?.description) item.description = pickRecord(locale, MEGA_DESCRIPTIONS[tileIcons[route]])
    if (route === 'tournament') {
      const days = daysUntil(PREMIUM_LEAGUE_START, now)
      item.badge = pickRecord(locale, newBadge)
      if (days !== null) item.countdown = pickFormat(locale, '${days} روز تا شروع', 'Starts in ${days} d', { days: new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(days) })
    }
    return item
  })
  return {
    primary: primary.map(route => link(route)),
    groups: [
      group('website-challenges', labels.challenges, challengeLinks),
      group('website-economy', labels.economy, economy.map(route => link(route))),
      /* the economy group alone marks its trigger active (existing behaviour) */
      { ...group('website-resources', labels.resources, resourceLinks, resourceSections), current: false },
    ],
  }
}

/** Shared navigation only; the legacy page keeps its body and runtime. */
export function renderNavigation(root: ParentNode, locale: Locale, pathname: string, navItems: CmsNavItem[] | null, footerLinks: CmsFooterLink[] | null) {
  const cmsLabels = new Map(navItems?.map(item => [item.route as string, item.label]))
  const anchor = (item: Pick<NavigationLink, 'route' | 'href' | 'label' | 'current' | 'activeSection'>) => {
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
  const tile = (item: NavigationLink) => {
    const a = anchor(item)
    a.className = 'mega-tile'
    a.replaceChildren()
    const icon = document.createElement('span'); icon.className = 'mega-icon'; icon.append(megaIconNode(item.icon))
    const textBox = document.createElement('span'); textBox.className = 'mega-text'
    const title = document.createElement('b'); title.textContent = item.label
    textBox.append(title)
    if (item.badge) { const badge = document.createElement('span'); badge.className = 'mega-badge'; badge.textContent = item.badge; title.append(' ', badge) }
    if (item.description) { const d = document.createElement('small'); d.textContent = item.description; textBox.append(d) }
    if (item.countdown) { const c = document.createElement('small'); c.className = 'mega-countdown'; c.textContent = item.countdown; textBox.append(c) }
    a.append(icon, textBox)
    return a
  }
  const bannerCard = (b: NavigationBanner) => {
    const a = document.createElement('a')
    a.className = `mega-banner is-${b.kind}`; a.href = b.href
    const copy = document.createElement('span'); copy.className = 'mega-banner-copy'
    const title = document.createElement('b'); title.textContent = b.title
    const p = document.createElement('small'); p.textContent = b.body
    const cta = document.createElement('em'); cta.textContent = b.cta
    copy.append(title, p, cta)
    if (b.description) { const d = document.createElement('span'); d.className = 'mega-sr'; d.textContent = b.description; copy.append(d) }
    a.append(megaBannerArt(b.kind), copy)
    return a
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
    /* mega panel: icon tiles (with sub-groups) and a featured banner */
    const dropdown = document.createElement('div')
    dropdown.className = 'nav-dropdown nav-mega'; dropdown.id = item.id
    const heading = document.createElement('span')
    heading.className = 'mega-heading'
    heading.textContent = item.label
    const body = document.createElement('div')
    body.className = 'mega-body'
    const sections = document.createElement('div')
    sections.className = 'mega-sections'
    for (const section of item.sections) {
      const block = document.createElement('section')
      block.className = 'mega-section'
      if (section.label) { const h = document.createElement('h3'); h.textContent = section.label; block.append(h) }
      const tiles = document.createElement('div')
      tiles.className = 'mega-tiles'
      tiles.append(...section.links.map(tile))
      block.append(tiles)
      sections.append(block)
    }
    body.append(sections)
    if (item.banners.length === 1) body.append(bannerCard(item.banners[0]))
    else if (item.banners.length > 1) { const column = document.createElement('div'); column.className = 'mega-banners'; column.append(...item.banners.map(bannerCard)); body.append(column) }
    dropdown.append(heading, body)
    group.append(trigger, dropdown)
    return group
  }
  const nav = root.querySelector('#navigation')
  if (nav) {
    // The legacy landing translator must not translate React-localized links again.
    (nav as HTMLElement).dataset.localeOwned = 'react'
    const model = navigationModel(locale, pathname, navItems)
    /* Trading challenges keeps the first position the primary link had */
    const [challenges, ...others] = model.groups
    nav.replaceChildren(dropdownGroup(challenges), ...model.primary.map(anchor), ...others.map(dropdownGroup))
  }
  const footer = root.querySelector('#footer-links')
  if (footer) {
    (footer as HTMLElement).dataset.localeOwned = 'react'
    const defaults = [...challengeGroup, ...primary, ...economy, ...resources, 'glossary' as const].map(route => ({ destination: route, label: navigationLabels[route] }))
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

/* a soft scrim under the open mega panel (desktop) */
function syncScrim(root: ParentNode) {
  document.documentElement.classList.toggle('mega-open', !!root.querySelector('.nav-account.resources-open .nav-mega'))
}
/* centre the wide panel in the viewport from measured geometry: its containing
   block differs between shells, so a CSS percentage would not be centred */
function placePanel(group: Element) {
  const panel = group.querySelector<HTMLElement>('.nav-mega')
  if (!panel || group.closest('.openfund-header')?.classList.contains('nav-overflow')) return
  const width = Math.min(1040, document.documentElement.clientWidth - 32)
  const base = (panel.offsetParent as HTMLElement | null)?.getBoundingClientRect().left || 0
  panel.style.width = `${width}px`
  panel.style.left = `${(document.documentElement.clientWidth - width) / 2 - base}px`
  panel.style.right = 'auto'
}
function openGroup(root: ParentNode, group: Element) {
  root.querySelectorAll('.nav-account.resources-open').forEach(other => { if (other !== group) { other.classList.remove('resources-open'); other.querySelector('.resources-toggle')?.setAttribute('aria-expanded', 'false') } })
  placePanel(group)
  group.classList.add('resources-open')
  group.querySelector('.resources-toggle')?.setAttribute('aria-expanded', 'true')
  syncScrim(root)
}
/** close every open mega-menu panel (route changes call this too) */
export function closeNavigation(root: ParentNode) { closeDisclosures(root) }
function closeDisclosures(root: ParentNode) {
  root.querySelectorAll('.resources-toggle[aria-expanded="true"]').forEach(button => {
    button.setAttribute('aria-expanded', 'false')
    button.parentElement?.classList.remove('resources-open')
  })
  syncScrim(root)
}

export function navigationClick(event: MouseEvent, root: ParentNode): boolean {
  const trigger = (event.target as Element)?.closest<HTMLButtonElement>('.resources-toggle')
  const open = trigger?.getAttribute('aria-expanded') === 'false'
  closeDisclosures(root)
  if (!trigger) return false
  if (open && trigger.parentElement) openGroup(root, trigger.parentElement)
  return true
}

export function navigationKeyDown(event: KeyboardEvent, root: ParentNode): boolean {
  const target = event.target as HTMLElement
  const group = target.closest('.nav-account')
  const trigger = group?.querySelector<HTMLButtonElement>('.resources-toggle')
  if (!group || !trigger) return false
  const links = Array.from(group.querySelectorAll<HTMLAnchorElement>('.nav-dropdown a'))
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopPropagation()
    trigger.setAttribute('aria-expanded', 'false'); group.classList.remove('resources-open'); syncScrim(root); trigger.focus()
    return true
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    openGroup(root, group)
    const index = links.indexOf(target as HTMLAnchorElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : event.key === 'ArrowDown' ? (index + 1) % links.length : (index <= 0 ? links.length : index) - 1
    links[next]?.focus()
    return true
  }
  return false
}

export function bindNavigation(root: ParentNode) {
  const outside = (event: Event) => {
    if (!(event.target as Element)?.closest('.nav-account')) closeDisclosures(root)
  }
  const leave = (event: Event) => {
    const focus = event as FocusEvent
    const group = (focus.target as Element)?.closest('.nav-account')
    if (group && !group.contains(focus.relatedTarget as Node | null)) closeDisclosures(root)
  }
  /* hover-open with a short intent delay on fine pointers; touch keeps click/tap */
  const view = document.defaultView
  const fine = view?.matchMedia ? view.matchMedia('(hover: hover) and (pointer: fine)') : null
  let openTimer: ReturnType<typeof setTimeout> | undefined, closeTimer: ReturnType<typeof setTimeout> | undefined
  const over = (event: Event) => {
    if (!fine?.matches) return
    const group = (event.target as Element)?.closest?.('.openfund-header:not(.nav-overflow) .nav-account')
    clearTimeout(closeTimer)
    if (!group || group.classList.contains('resources-open')) return
    clearTimeout(openTimer)
    openTimer = setTimeout(() => openGroup(root, group), 140)
  }
  const out = (event: Event) => {
    if (!fine?.matches) return
    const pointer = event as PointerEvent
    const group = (pointer.target as Element)?.closest?.('.nav-account')
    if (!group || group.contains(pointer.relatedTarget as Node | null)) return
    clearTimeout(openTimer)
    closeTimer = setTimeout(() => { if (!group.matches(':focus-within')) closeDisclosures(root) }, 240)
  }
  const resize = () => closeDisclosures(root)
  /* Escape closes an open panel wherever focus is (also after a hover-open);
     focus returns to the trigger only when it was inside the menu */
  const escape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    const open = root.querySelector('.nav-account.resources-open')
    if (!open) return
    const inside = open.contains(document.activeElement)
    closeDisclosures(root)
    if (inside) open.querySelector<HTMLButtonElement>('.resources-toggle')?.focus()
  }
  view?.addEventListener('resize', resize)
  document.addEventListener('keydown', escape)
  document.addEventListener('pointerdown', outside)
  root.addEventListener('focusout', leave)
  root.addEventListener('pointerover', over)
  root.addEventListener('pointerout', out)
  return () => {
    document.removeEventListener('pointerdown', outside)
    document.removeEventListener('keydown', escape)
    root.removeEventListener('focusout', leave)
    root.removeEventListener('pointerover', over)
    root.removeEventListener('pointerout', out)
    view?.removeEventListener('resize', resize)
    clearTimeout(openTimer); clearTimeout(closeTimer)
    document.documentElement.classList.remove('mega-open')
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
