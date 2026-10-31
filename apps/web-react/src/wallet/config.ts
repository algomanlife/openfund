import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { arbitrumSepolia } from 'wagmi/chains'

/**
 * Wallet configuration — Phase 3.
 *
 * - Arbitrum Sepolia is the configurable TEST network. No Gains contracts
 *   are assumed to exist or be operational there.
 * - WalletConnect projectId comes from VITE_WALLETCONNECT_PROJECT_ID
 *   (.env / .env.local). Without a real project id, injected wallets
 *   (MetaMask / Rabby) still work; WalletConnect pairing will not.
 * - Connection only: no transactions, no token approvals (Phase 4 keeps
 *   wallet connection separate from Openfund sessions).
 */
export const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) || ''

export const wagmiConfig = getDefaultConfig({
  appName: 'Openfund',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [arbitrumSepolia],
  ssr: false
})
