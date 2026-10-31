import { type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from './config'

const queryClient = new QueryClient()

/**
 * Wagmi + react-query context only.
 *
 * IMPORTANT: RainbowKitProvider renders a `<div data-rk>` wrapper around its
 * children — it must wrap ONLY the wallet button (see RainbowConnect.tsx),
 * never the whole app. The legacy locale.js tree-walker skips every node
 * inside [data-rk] (so wallet UI is not auto-translated); if the provider
 * wrapped the app, the entire page would be skipped and never translate.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
