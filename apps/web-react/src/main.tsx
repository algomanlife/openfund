import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate, useParams } from 'react-router-dom'
import Landing from './pages/Landing'
import Home from './features/home/Home'
import Markets from './features/markets/Markets'
import Rulebook from './features/rulebook/Rulebook'
import Transparency from './features/transparency/Transparency'
import RevenueModel from './features/economy/RevenueModel'
import LiveMarketAccess from './features/economy/LiveMarketAccess'
import Ambassador from './features/partners/Ambassador'
import Coach from './features/partners/Coach'
/* the long-form Whitepaper (content + charts) loads only when visited */
const Whitepaper = lazy(() => import('./features/whitepaper/Whitepaper'))
import Faq from './features/faq/Faq'
const CertificatesPage = lazy(() => import('./features/certificates/CertificatesPage'))
const CertificateVerificationPage = lazy(() => import('./features/certificates/CertificateVerificationPage'))
import Applications from './features/applications/Applications'
import About from './features/company/About'
import Contact from './features/company/Contact'
import Governance from './features/governance/Governance'
import ProposalPage from './features/governance/ProposalPage'
import NewProposal from './features/governance/NewProposal'
import CouncilWorkspace from './features/governance/CouncilWorkspace'
import Tools from './features/tools/Tools'
import ToolPage from './features/tools/ToolPage'
import Learn from './features/learn/Learn'
import PathPage from './features/learn/PathPage'
import LessonPage from './features/learn/LessonPage'
import Glossary from './features/learn/Glossary'
import Referral from './features/referral/Referral'
import ReferralEntry from './features/referral/ReferralEntry'
import TerminalShell from './features/terminal/TerminalShell'
import './theme-toggle.css'
import './styles/header-controls.css'
import './brand/seasonal-logo.css'
import { installSeasonalLogo } from './brand/seasonalLogo'
import { SharedTradingTerminal } from './features/terminal/TradingPages'
import { ProductDashboard, CapabilityPage } from './features/terminal/Dashboard'
import ProductPortfolio from './features/terminal/Portfolio'
import ProductJournal from './features/terminal/Journal'
import PurchaseHistory from './features/purchase/PurchaseHistory'
import CheckoutPage from './features/purchase/CheckoutPage'
import Campaign from './features/campaign/Campaign'
import WithdrawalsPage from './features/purchase/WithdrawalsPage'
import { WalletProvider } from './wallet/WalletProvider'
import { SessionProvider } from './session/useOpenfundSession'
import AppFrame from './features/loading/AppFrame'
import { startThemeSync } from './theme'
import { storedLocale, type AppLocale } from './i18n/locales'
import { translateSource } from './i18n/messages'

startThemeSync()

/* Same-origin legacy documents (terminal iframe) translate their static
   English markup for ar / ru / zh-CN through the app dictionaries; misses
   are reported exactly like React text. */
;(window as Window & { __ofTranslateText?: (locale: string, english: string) => string }).__ofTranslateText = (locale, english) =>
  locale === 'ar' || locale === 'ru' || locale === 'zh-CN' ? translateSource(locale, english) : english

/* ---- public website architecture ----------------------------------------
   /              → language-aware redirect into the Home product gateway
   /:locale/home  → two-product gateway (every supported locale)
   /:locale/challenges → legacy landing experience (preserved, moved off "/")
   /:locale/markets → Markets directory (Gains Network authoritative data)
   /:locale/rulebook, /:locale/transparency → existing editorial pages
   /terminal, /portfolio → the separate terminal application experience

   Clean SEO URLs: browser-history routing at the site root (no '/react'
   prefix, no '#'). Legacy '/react/#/…' links are normalized to clean paths
   by the pre-paint script in index.html BEFORE this module runs — a hash
   fragment never reaches the server, so client-side recovery is the only
   complete migration mechanism (the backend additionally redirects the
   '/react' document prefix). */

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
const LEGACY_SECTIONS: Record<string, { page: 'markets' | 'challenges' | 'about' | 'contact'; scroll?: string }> = {
  markets: { page: 'markets' },
  accounts: { page: 'challenges', scroll: 'accounts' },
  how: { page: 'challenges', scroll: 'how' },
  /* the public Team section was removed; old '#team' links land on Challenges */
  team: { page: 'challenges' },
  rules: { page: 'challenges', scroll: 'rules' },
  platform: { page: 'challenges', scroll: 'platform' },
  model: { page: 'challenges', scroll: 'model' },
  legal: { page: 'challenges', scroll: 'legal' },
  about: { page: 'about' },
  contact: { page: 'contact' },
  support: { page: 'contact' },
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

/* Every supported locale gets the two-product gateway; language alone never
   hides a product. Unknown locale segments fall back to the gateway too. */
function LocalizedHome() {
  return <Home />
}

/* Language does not gate products. Presentation availability does not verify
   nationality or residency, and Prop/Perpetual data stay isolated by
   product (apps/backend/products.js), not by locale. */
function ProductGate({ product }: { product: 'prop' | 'perpetual' }) {
  return <TerminalShell product={product} />
}

const routes = [
  { path: '/', element: <RootRedirect /> },
  { path: '/:locale/home', element: <LocalizedHome /> },
  { path: '/:locale/challenges', element: <Landing /> },
  { path: '/:locale/checkout', element: <CheckoutPage /> },
  /* sales-campaign landing: fa (RTL) and en (LTR) only; other locales → /en/campaign */
  { path: '/:locale/campaign', element: <Campaign /> },
  { path: '/:locale/markets', element: <Markets /> },
  { path: '/:locale/rulebook', element: <Rulebook /> },
  { path: '/:locale/transparency', element: <Transparency /> },
  { path: '/:locale/governance', element: <Governance /> },
  { path: '/:locale/governance/new', element: <NewProposal /> },
  { path: '/:locale/governance/workspace', element: <CouncilWorkspace /> },
  { path: '/:locale/governance/proposals/:ofp', element: <ProposalPage /> },
  /* Economy menu: Transparency, Revenue Model, Live Market Access */
  { path: '/:locale/economy', element: <Navigate to="../transparency" replace /> },
  { path: '/:locale/revenue-model', element: <RevenueModel /> },
  { path: '/:locale/live-market-access', element: <LiveMarketAccess /> },
  { path: '/:locale/ambassador', element: <Ambassador /> },
  { path: '/:locale/coach', element: <Coach /> },
  /* Official Whitepaper v1.0 — one anchor-navigated page (footer document link) */
  { path: '/:locale/whitepaper', element: <Suspense fallback={null}><Whitepaper /></Suspense> },
  { path: '/:locale/certificate-verification', element: <Suspense fallback={null}><CertificateVerificationPage /></Suspense> },
  { path: '/:locale/apps', element: <Applications /> },
  { path: '/:locale/about', element: <About /> },
  { path: '/:locale/contact', element: <Contact /> },
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
      /* same element type + position as 'trade': React keeps one workspace instance across the two tabs */
      { path: 'chart', element: <SharedTradingTerminal /> },
      { path: 'portfolio', element: <ProductPortfolio /> },
      { path: 'journal', element: <ProductJournal /> },
      ...(product === 'prop' ? [
        { path: 'certificates', element: <Suspense fallback={null}><CertificatesPage /></Suspense> },
        { path: 'purchases', element: <PurchaseHistory /> },
        { path: 'withdrawals', element: <WithdrawalsPage /> },
      ] : []),
      ...(['leaderboard', ...(product === 'perpetual' ? ['rewards'] : [])]).map(path => ({ path, element: <CapabilityPage /> }))
    ]
  })),
  { path: '/terminal', element: <TerminalRedirect page="trade" /> },
  { path: '/portfolio', element: <TerminalRedirect page="portfolio" /> },
  { path: '/journal', element: <TerminalRedirect page="journal" /> },
  ...(['prop', 'perpetual'] as const).map(product => ({ path: `/${product}/:page`, element: <ProductRedirect product={product} /> })),
  /* single-segment legacy hashes ('#markets', '#accounts', '#fa', …) —
     recovered as clean '/markets'-style paths by the pre-paint normalizer */
  { path: '/:section', element: <LegacyAnchor /> },
  /* unknown paths still fall back to the gateway instead of a blank screen */
  { path: '*', element: <RootRedirect /> }
]

const router = createBrowserRouter([
  /* AppFrame wraps every route: pre-paint locale/direction sync, the shared
     branded loading gate, route-driven SEO head, the legacy DOM link
     bridge (in-page '#section' scrolls and '#/#section' cross-page
     anchors, previously wired here at module scope) and Back/Forward
     scroll restoration. */
  { element: <AppFrame />, children: routes }
])
/* Yalda / Christmas header logo (header and terminal navigation only) */
installSeasonalLogo()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </WalletProvider>
  </StrictMode>
)
