import { arbitrum } from 'wagmi/chains'

/** Wallet network policy — Arbitrum One (chain 42161) for every route:
 * Prop, Perpetual, the website and checkout. The route argument is kept so
 * a future per-product network policy has a single place to live; today it
 * never selects another chain, and the backend rejects any other SIWE chain. */
export const networkForHash = (url: string) => (void url, arbitrum)

/** SessionProvider lives outside the router. Both wallet and SIWE use this
 * same policy; changing network always asks the user's wallet. */
export function useProductNetwork() {
  return arbitrum
}
