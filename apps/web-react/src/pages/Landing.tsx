import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import landingBody from './landing-body.html?raw'
import { RainbowConnect } from '../wallet/RainbowConnect'
import { fetchCmsTranslations } from '../cms/client'

/**
 * Phase 2a: the landing runs inside the React shell with its proven markup
 * and logic (locale/market/motion scripts) loaded as modules after mount.
 * Phase 2b progressively extracts real React components (see MIGRATION_STATUS).
 *
 * Legacy-script contract (classic page assumptions we must satisfy):
 *  - locale.js waits for DOMContentLoaded on WINDOW. React injects scripts
 *    after that event fired, so we re-dispatch it once the chain loads.
 *    The synthetic event MUST bubble (document → window) or window
 *    listeners never see it.
 *  - In dev, StrictMode mounts/unmounts effects twice. We must inject the
 *    legacy script chain ONCE per browser page (window guard), otherwise
 *    every listener is wired twice and clicks toggle twice (net no-op).
 *  - Leaving this page fully tears the legacy runtime down by reloading
 *    (classic pages were separate documents). The reload is scheduled on
 *    unmount and only cancelled by a re-mount of the SAME page.
 */

const SCRIPTS = [
  'legacy/locale.js',
  'legacy/app.js',
  'legacy/features.js',
  'legacy/market.js',
  'legacy/motion.js'
]
const STYLES = [
  'legacy/style.css',
  'legacy/wallet.css'
]

const w = () => window as any

/* ---- theme (owned by React; was an inline script in the classic page) ---- */
function initTheme() {
  const b = document.getElementById('theme-toggle')
  if (!b) return
  const set = (t: string) => {
    document.documentElement.setAttribute('data-theme', t)
    b.textContent = t === 'dark' ? '◐' : '◑'
    try { localStorage.setItem('of-theme', t) } catch { /* ignore */ }
  }
  let t = 'dark'
  try { t = localStorage.getItem('of-theme') || 'dark' } catch { /* ignore */ }
  set(t)
  if (!(b as any).__ofThemeWired) {
    ;(b as any).__ofThemeWired = true
    b.addEventListener('click', () =>
      set(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'))
  }
}

/* ---- arrow glyph direction (owned by React; was inline) ---- */
const ARROW_MAP: Record<string, string> = {
  '←': '→', '→': '←', '↙': '↘', '↘': '↙', '↖': '↗', '↗': '↖'
}
function swapArrows() {
  document.querySelectorAll<HTMLAnchorElement>('[data-info-page]').forEach(a => {
    a.href = `#/${w().ofLang === "en" ? "en" : "fa"}/${a.dataset.infoPage}`
  })
  const en = w().ofLang === 'en'
  document
    .querySelectorAll('.button>span,.text-link>span,.nav-cta>span,.team-profile-link>span')
    .forEach((sp) => {
      const ch = (sp.textContent || '').trim()
      if (ch.length === 1 && ARROW_MAP[ch]) {
        if (en) {
          if (!(sp as HTMLElement).dataset.orig) (sp as HTMLElement).dataset.orig = ch
          sp.textContent = ARROW_MAP[ch]
        } else if ((sp as HTMLElement).dataset.orig) {
          sp.textContent = (sp as HTMLElement).dataset.orig
          delete (sp as HTMLElement).dataset.orig
        }
      }
    })
}

export default function Landing() {
  /* wallet connect button in the landing header (#wallet-root placeholder,
     right next to nav-actions). Same RainbowKit mount as the terminal. */
  const [walletHost, setWalletHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const host = document.getElementById('wallet-root')
    if (!host || document.getElementById('rainbow-landing-host')) return
    const mount = document.createElement('div')
    mount.id = 'rainbow-landing-host'
    host.appendChild(mount)
    setWalletHost(mount)
    /* the "ورود با کیف پول وب۳" feature card opens the real RainbowKit modal
       (window.__ofOpenConnect is exposed by RainbowConnect) */
    const trigger = document.getElementById('wallet-trigger')
    const onTrigger = () => { (window as any).__ofOpenConnect?.() }
    trigger?.addEventListener('click', onTrigger)
    return () => {
      trigger?.removeEventListener('click', onTrigger)
      mount.remove()
    }
  }, [])

  useEffect(() => {
    /* cancel OUR OWN pending reload (StrictMode re-mount of this page) */
    if (w().__ofReloadLanding) { clearTimeout(w().__ofReloadLanding); w().__ofReloadLanding = null }

    if (!w().__ofLegacyLandingLoaded) {
      w().__ofLegacyLandingLoaded = true
      /* CMS (Directus) translations first — published ui_messages override the
         static translations.json; silent fallback keeps the page usable when
         the backstage is down. Legacy scripts boot AFTER the fetch. */
      void (async () => {
        const cms = await fetchCmsTranslations()
        if (cms) {
          w().ofCmsLanding = cms.landing
          w().ofCmsLandingFa = cms.landingFa
          w().ofCmsTerminal = cms.terminal
        }
        STYLES.forEach(href => {
        const l = document.createElement('link')
        l.rel = 'stylesheet'
        l.href = href
        l.dataset.page = 'landing'
        document.head.appendChild(l)
      })
      const scripts = SCRIPTS.map(src => {
        const s = document.createElement('script')
        s.src = src
        s.async = false
        s.dataset.page = 'landing'
        document.body.appendChild(s)
        return s
      })
      /* re-fire DOMContentLoaded for the late-loaded legacy scripts.
         MUST bubble: locale.js listens on window, we dispatch on document. */
      const kick = () => {
        if (w().__ofLandingKicked) return
        w().__ofLandingKicked = true
        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }))
        setTimeout(() => { initTheme(); swapArrows() }, 60)
        setTimeout(swapArrows, 600)
      }
      scripts[scripts.length - 1].addEventListener('load', kick)
      /* safety: if load already fired before we attached */
      setTimeout(kick, 1500)
      })()
    }

    initTheme()
    const langHandler = () => setTimeout(swapArrows, 60)
    addEventListener('of-language', langHandler)

    /* pending cross-page scroll (e.g. terminal → "Markets" link) */
    const scrollTo = (() => { try { return sessionStorage.getItem('ofScrollTo') } catch { return null } })()
    if (scrollTo) {
      try { sessionStorage.removeItem('ofScrollTo') } catch { /* ignore */ }
      setTimeout(() => {
        const el = document.getElementById(scrollTo)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 400)
    }

    return () => {
      removeEventListener('of-language', langHandler)
      /* real navigation away: reload to tear the legacy runtime down.
         Cancelled only by a re-mount of THIS page (StrictMode / route return). */
      w().__ofReloadLanding = setTimeout(() => location.reload(), 120)
    }
  }, [])

  return (
    <>
      {walletHost && createPortal(<RainbowConnect />, walletHost)}
      <div dangerouslySetInnerHTML={{ __html: landingBody }} />
    </>
  )
}
