import { useSyncExternalStore } from 'react'
import { sepolia, arbitrum } from 'wagmi/chains'

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
export const networkForHash = (hash: string) => /^#?\/(?:fa|en)\/perpetual(?:\/|$)/.test(hash.split("?")[0]) ? arbitrum : sepolia
/** SessionProvider lives outside the hash router. Both wallet and SIWE use
 * this same product policy; changing network always asks the user's wallet. */
export function useProductNetwork() {
  const chainId = useSyncExternalStore(subscribe, () => networkForHash(location.hash).id)
  return chainId === arbitrum.id ? arbitrum : sepolia
}
