import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import terminalBody from './terminal-body.html?raw'
import { RainbowConnect } from '../wallet/RainbowConnect'
import { fetchCmsTranslations } from '../cms/client'

/**
 * Phase 2a: the trading terminal runs inside the React shell with its proven
 * markup, the Vela workspace bundle and the Gains adapters. Phase 2b extracts
 * real React components.
 *
 * Legacy-script contract:
 *  - terminal.js is a self-executing IIFE (no DOMContentLoaded wait), so it
 *    boots as soon as it is injected — the markup must already be on the page
 *    (it is: React renders before effects run).
 *  - In dev, StrictMode runs effects twice — inject the chain ONCE per
 *    browser page (window guard) or every click listener/interval/chart
 *    mount doubles up and the page misbehaves.
 *  - Leaving the page reloads the app so the terminal runtime (WS, intervals,
 *    Vela workspace) is fully torn down, exactly like the classic site.
 */

const SCRIPTS = [
  'legacy/gains-adapter.js',
  'assets/vela-workspace.global.min.js',
  'legacy/vela-bridge.js',
  'legacy/terminal-data.js',
  'legacy/terminal.js'
]
const STYLES = ['legacy/terminal.css']

const w = () => window as any

export default function Terminal() {
  const [walletHost, setWalletHost] = useState<HTMLElement | null>(null)

  /* Phase 3: mount the real RainbowKit connect button in the header
     (replaces the legacy demo wallet button — connection only, no txs) */
  useEffect(() => {
    const nav = document.querySelector('.nav-right')
    if (!nav) return
    if (document.getElementById('rainbow-host')) return
    const host = document.createElement('div')
    host.id = 'rainbow-host'
    nav.insertBefore(host, nav.firstChild)
    setWalletHost(host)
    const legacy = document.getElementById('wallet-btn')
    if (legacy) legacy.style.display = 'none'
    return () => {
      host.remove()
      const l = document.getElementById('wallet-btn')
      if (l) l.style.display = ''
    }
  }, [])

  useEffect(() => {
    /* cancel OUR OWN pending reload (StrictMode re-mount of this page) */
    if (w().__ofReloadTerminal) { clearTimeout(w().__ofReloadTerminal); w().__ofReloadTerminal = null }

    if (!w().__ofLegacyTerminalLoaded) {
      w().__ofLegacyTerminalLoaded = true
      /* CMS (Directus) i18n first — published terminal ui_messages override
         terminal.js's built-in labels; silent fallback if backstage is down.
         terminal.js reads window.ofCmsTerminal at parse time, so the fetch
         must complete BEFORE the script chain is injected. */
      void (async () => {
        const cms = await fetchCmsTranslations()
        if (cms) w().ofCmsTerminal = cms.terminal
        STYLES.forEach(href => {
          const l = document.createElement('link')
          l.rel = 'stylesheet'
          l.href = href
          l.dataset.page = 'terminal'
          document.head.appendChild(l)
        })
        SCRIPTS.forEach(src => {
          const s = document.createElement('script')
          s.src = src
          s.async = false
          s.dataset.page = 'terminal'
          document.body.appendChild(s)
        })
      })()
    }

    return () => {
      /* real navigation away: reload to tear the terminal runtime down.
         Cancelled only by a re-mount of THIS page (StrictMode / route return). */
      w().__ofReloadTerminal = setTimeout(() => location.reload(), 120)
    }
  }, [])

  useEffect(() => {
    document.title = 'Openfund Terminal — معامله'
  }, [])

  return (
    <>
      {walletHost && createPortal(<RainbowConnect />, walletHost)}
      <div dangerouslySetInnerHTML={{ __html: terminalBody }} />
    </>
  )
}
