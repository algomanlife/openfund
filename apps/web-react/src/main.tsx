import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Terminal from './pages/Terminal'
import { WalletProvider } from './wallet/WalletProvider'

const router = createHashRouter([
  { path: '/', element: <Landing /> },
  { path: '/terminal', element: <Terminal /> },
  /* unknown hashes (e.g. a plain '#markets' fragment) fall back home
     instead of rendering a blank screen */
  { path: '*', element: <Navigate to="/" replace /> }
])

/*
 * In-page anchors in the legacy markup (href="#markets", "#accounts", …)
 * would be hijacked by the hash router and blank the page. Handle them
 * ourselves: smooth-scroll, never touch the route. '#/#xxx' links are
 * cross-page anchors (terminal → landing section): go home and remember
 * the target for the landing to scroll to after it boots.
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
/* terminal → landing section links ('#/#markets') */
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement | null)?.closest?.('a')
  if (!a) return
  const href = a.getAttribute('href') || ''
  if (!href.startsWith('#/#')) return
  e.preventDefault()
  try { sessionStorage.setItem('ofScrollTo', href.slice(3)) } catch { /* ignore */ }
  location.hash = '/'
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <RouterProvider router={router} />
    </WalletProvider>
  </StrictMode>
)
