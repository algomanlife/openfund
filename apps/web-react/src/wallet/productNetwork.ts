import { useSyncExternalStore } from 'react'
import { sepolia, arbitrum } from 'wagmi/chains'
import { isLocale } from '../i18n/locales'

const subscribe = (fn: () => void) => {
  addEventListener('hashchange', fn)
  addEventListener('popstate', fn)
  // TerminalShell publishes this after router-driven product/locale changes.
  addEventListener('of-language', fn)
  addEventListener('of-terminal-route', fn)
  return () => {
    removeEventListener('hashchange', fn)
    removeEventListener('popstate', fn)
    removeEventListener('of-language', fn)
    removeEventListener('of-terminal-route', fn)
  }
}
/** `/:locale/perpetual/...` (any supported locale, legacy `#/` prefix
 * tolerated) → Arbitrum One; every other route → Sepolia (Prop). */
export const networkForHash = (url: string) => {
  const [first, second] = url.split(/[?#]/).filter(Boolean)[0]?.split('/').filter(Boolean) ?? []
  return isLocale(first) && second === 'perpetual' ? arbitrum : sepolia
}
/** SessionProvider lives outside the router. Both wallet and SIWE use
 * this same product policy; changing network always asks the user's wallet. */
export function useProductNetwork() {
  const chainId = useSyncExternalStore(subscribe, () => networkForHash(location.pathname).id)
  return chainId === arbitrum.id ? arbitrum : sepolia
}
