import { useEffect } from 'react'
import landingBody from './landing-body.html?raw'

/**
 * Phase 2a: the landing runs inside the React shell with its proven markup
 * and logic (locale/market/motion scripts) loaded as modules after mount.
 * Phase 2b progressively extracts real React components (see MIGRATION_STATUS).
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

export default function Landing() {
  useEffect(() => {
    const links = STYLES.map(href => {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = href
      l.dataset.page = 'landing'
      document.head.appendChild(l)
      return l
    })
    const scripts = SCRIPTS.map(src => {
      const s = document.createElement('script')
      s.src = src
      s.async = false
      s.dataset.page = 'landing'
      document.body.appendChild(s)
      return s
    })
    return () => {
      links.forEach(l => l.remove())
      scripts.forEach(s => s.remove())
    }
  }, [])

  return <div dangerouslySetInnerHTML={{ __html: landingBody }} />
}
