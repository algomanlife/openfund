import { Link } from 'react-router-dom'
import { labels, type Locale } from '../information/content'

export const ECONOMY_PAGES = ['transparency', 'revenue-model', 'live-market-access'] as const
export type EconomyPage = typeof ECONOMY_PAGES[number]

/** In-page navigation between the three Economy sub-pages. */
export default function EconomyNav({ locale, current }: { locale: Locale; current: EconomyPage }) {
  return <nav className="econ-subnav" aria-label={labels.economy[locale]}>
    {ECONOMY_PAGES.map(page => <Link key={page} to={`/${locale}/${page}`} aria-current={page === current ? 'page' : undefined}>{labels[page][locale]}</Link>)}
  </nav>
}
