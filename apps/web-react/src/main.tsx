import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider, Navigate, useParams } from 'react-router-dom'
import Landing from './pages/Landing'
import Home from './features/home/Home'
import Markets from './features/markets/Markets'
import Rulebook from './features/rulebook/Rulebook'
import Transparency from './features/transparency/Transparency'
import Faq from './features/faq/Faq'
import Tools from './features/tools/Tools'
import ToolPage from './features/tools/ToolPage'
import Learn from './features/learn/Learn'
import PathPage from './features/learn/PathPage'
import LessonPage from './features/learn/LessonPage'
import Glossary from './features/learn/Glossary'
import Referral from './features/referral/Referral'
import ReferralEntry from './features/referral/ReferralEntry'
import TerminalShell from './features/terminal/TerminalShell'
import { SharedTradingTerminal } from './features/terminal/TradingPages'
import { ProductDashboard, CapabilityPage } from './features/terminal/Dashboard'
import ProductPortfolio from './features/terminal/Portfolio'
import ProductJournal from './features/terminal/Journal'
import PurchaseHistory from './features/purchase/PurchaseHistory'
import WithdrawalsPage from './features/purchase/WithdrawalsPage'
import { WalletProvider } from './wallet/WalletProvider'
import { SessionProvider } from './session/useOpenfundSession'
import { startThemeSync } from './theme'
import { isLocale, storedLocale, type AppLocale } from './i18n/locales'

startThemeSync()

/* ---- public website architecture ----------------------------------------
   /              → language-aware redirect into the Home product gateway
   /:locale/home  → FA two-product gateway; en/ar/ru/zh-CN the Prop landing
   /:locale/challenges → legacy landing experience (preserved, moved off "/")
   /:locale/markets → Markets directory (Gains Network authoritative data)
   /:locale/rulebook, /:locale/transparency → existing editorial pages
   /terminal, /portfolio → the separate terminal application experience       */

function preferredLocale(): AppLocale {
  return storedLocale()
}

/* '/' — the landing no longer lives at the root; the product gateway does.
   The stored language preference decides fa/en, fa by default. */
function RootRedirect() {
  return <Navigate to={`/${preferredLocale()}/home`} replace />
}

/* Migration for pre-gateway deep links: old landing section hashes
   ('#markets', '#accounts', '#how', '#team', '#rules') and bare locale
   hashes ('#fa') arrive as single-segment paths — send them to the page
   that now owns that content instead of dropping them on Home. */
const LEGACY_SECTIONS: Record<string, { page: 'markets' | 'challenges'; scroll?: string }> = {
  markets: { page: 'markets' },
  accounts: { page: 'challenges', scroll: 'accounts' },
  how: { page: 'challenges', scroll: 'how' },
  team: { page: 'challenges', scroll: 'team' },
  rules: { page: 'challenges', scroll: 'rules' },
  platform: { page: 'challenges', scroll: 'platform' },
  model: { page: 'challenges', scroll: 'model' },
  legal: { page: 'challenges', scroll: 'legal' },
  fa: { page: 'challenges' },
  en: { page: 'challenges' },
}
function LegacyAnchor() {
  const segment = (useParams().section || '').toLowerCase()
  const known = LEGACY_SECTIONS[segment]
  if (known?.scroll) { try { sessionStorage.setItem('ofScrollTo', known.scroll) } catch { /* optional */ } }
  const target = known ? `/${preferredLocale()}/${known.page}` : `/${preferredLocale()}/home`
  return <Navigate to={target} replace />
}

function TerminalRedirect({ page }: { page: string }) { return <Navigate to={`/${preferredLocale()}/prop/${page}`} replace /> }
function ProductRedirect({ product }: { product: 'prop' | 'perpetual' }) { return <Navigate to={`/${preferredLocale()}/${product}/${useParams().page || 'dashboard'}`} replace /> }

/* fa → the Persian two-product gateway; every other supported locale
   follows the established English behaviour (the Prop landing). */
function LocalizedHome() {
  const { locale } = useParams()
  return locale === 'fa' || !isLocale(locale) ? <Home /> : <Landing />
}

function ProductGate({ product }: { product: 'prop' | 'perpetual' }) {
  const { locale } = useParams()
  // Presentation availability does not verify nationality or residency.
  return isLocale(locale) && locale !== 'fa' && product === 'perpetual'
    ? <Navigate to={`/${locale}/prop/dashboard`} replace />
    : <TerminalShell product={product} />
}

const router = createHashRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/:locale/home', element: <LocalizedHome /> },
  { path: '/:locale/challenges', element: <Landing /> },
  { path: '/:locale/markets', element: <Markets /> },
  { path: '/:locale/rulebook', element: <Rulebook /> },
  { path: '/:locale/transparency', element: <Transparency /> },
  { path: '/:locale/faq', element: <Faq /> },
  { path: '/:locale/faq/q/:key', element: <Faq /> },
  { path: '/:locale/tools', element: <Tools /> },
  { path: '/:locale/tools/:slug', element: <ToolPage /> },
  { path: '/:locale/learn', element: <Learn /> },
  { path: '/:locale/learn/paths/:slug', element: <PathPage /> },
  { path: '/:locale/learn/lessons/:slug', element: <LessonPage /> },
  { path: '/:locale/learn/glossary', element: <Glossary /> },
  { path: '/:locale/learn/glossary/:slug', element: <Glossary /> },
  { path: '/:locale/referral', element: <Referral /> },
  { path: '/:locale/ref/:code', element: <ReferralEntry /> },
  ...(['prop', 'perpetual'] as const).map(product => ({
    path: `/:locale/${product}`, element: <ProductGate product={product} />, children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: '*', element: <Navigate to="../dashboard" replace /> },
      { path: 'dashboard', element: <ProductDashboard /> },
      { path: 'trade', element: <SharedTradingTerminal /> },
      { path: 'portfolio', element: <ProductPortfolio /> },
      { path: 'journal', element: <ProductJournal /> },
      ...(product === 'prop' ? [
        { path: 'purchases', element: <PurchaseHistory /> },
        { path: 'withdrawals', element: <WithdrawalsPage /> },
      ] : []),
      ...(['leaderboard', ...(product === 'prop' ? ['certificates'] : ['rewards'])]).map(path => ({ path, element: <CapabilityPage /> }))
    ]
  })),
  { path: '/terminal', element: <TerminalRedirect page="trade" /> },
  { path: '/portfolio', element: <TerminalRedirect page="portfolio" /> },
  { path: '/journal', element: <TerminalRedirect page="journal" /> },
  ...(['prop', 'perpetual'] as const).map(product => ({ path: `/${product}/:page`, element: <ProductRedirect product={product} /> })),
  /* single-segment legacy hashes ('#markets', '#accounts', '#fa', …) */
  { path: '/:section', element: <LegacyAnchor /> },
  /* unknown hashes still fall back to the gateway instead of a blank screen */
  { path: '*', element: <RootRedirect /> }
])

/*
 * In-page anchors in the legacy markup (href="#markets", "#accounts", …)
 * would be hijacked by the hash router and blank the page. Handle them
 * ourselves: smooth-scroll, never touch the route. '#/#xxx' links are
 * cross-page anchors (terminal/portfolio → website content): route to the
 * page that now owns that section and remember the target for a post-boot
 * scroll. '#/#markets' goes to the standalone Markets page.
 */
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement | null)?.closest?.('a')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href || !href.startsWith('#')) return
  if (href.startsWith('#/')) return          /* real router links */
  e.preventDefault()
  if (href.length <= 1) return               /* bare '#' placeholders */
  const id = href.slice(1)
  const el = id === 'top' ? document.body : document.getElementById(id)
  if (id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' })
  else el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement | null)?.closest?.('a')
  if (!a) return
  const href = a.getAttribute('href') || ''
  if (!href.startsWith('#/#')) return
  e.preventDefault()
  const id = href.slice(3)
  const w = window as Window & { ofLang?: string; ofUiLang?: string }
  const lang = isLocale(w.ofUiLang) ? w.ofUiLang : isLocale(w.ofLang) ? w.ofLang : preferredLocale()
  if (id === 'markets') { location.hash = `/${lang}/markets`; return }
  try { sessionStorage.setItem('ofScrollTo', id) } catch { /* optional */ }
  location.hash = `/${lang}/challenges`
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </WalletProvider>
  </StrictMode>
)
