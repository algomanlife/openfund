import { useSyncExternalStore } from 'react'
import { sepolia, arbitrum } from 'wagmi/chains'

const subscribe = (fn: () => void) => {
  addEventListener('hashchange', fn)
  return () => removeEventListener('hashchange', fn)
}
/** SessionProvider lives outside the hash router. Both wallet and SIWE use
 * this same product policy; changing network always asks the user's wallet. */
export function useProductNetwork() {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return /\/(?:perpetual)(?:\/|$)/.test(hash) ? arbitrum : sepolia
}
