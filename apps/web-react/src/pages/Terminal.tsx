import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import terminalBody from './terminal-body.html?raw'
import { RainbowConnect } from '../wallet/RainbowConnect'

/**
 * Phase 2a: the trading terminal runs inside the React shell with its proven
 * markup, the Vela workspace bundle and the Gains adapters. Phase 2b extracts
 * real React components; Phase 3 adds RainbowKit around this page.
 */
const SCRIPTS = [
  'legacy/gains-adapter.js',
  'assets/vela-workspace.global.min.js',
  'legacy/vela-bridge.js',
  'legacy/terminal-data.js',
  'legacy/terminal.js'
]
const STYLES = ['legacy/terminal.css']

export default function Terminal() {
  const [walletHost, setWalletHost] = useState<HTMLElement | null>(null)

  /* Phase 3: mount the real RainbowKit connect button in the header
     (replaces the legacy demo wallet button — connection only, no txs) */
  useEffect(() => {
    const nav = document.querySelector('.nav-right')
    if (!nav) return
    const host = document.createElement('div')
    host.id = 'rainbow-host'
    nav.insertBefore(host, nav.firstChild)
    setWalletHost(host)
    const legacy = document.getElementById('wallet-btn')
    if (legacy) legacy.style.display = 'none'
    return () => {
      host.remove()
      if (legacy) legacy.style.display = ''
    }
  }, [])

  useEffect(() => {
    const links = STYLES.map(href => {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = href
      l.dataset.page = 'terminal'
      document.head.appendChild(l)
      return l
    })
    const scripts = SCRIPTS.map(src => {
      const s = document.createElement('script')
      s.src = src
      s.async = false
      s.dataset.page = 'terminal'
      document.body.appendChild(s)
      return s
    })
    return () => {
      links.forEach(l => l.remove())
      scripts.forEach(s => s.remove())
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
