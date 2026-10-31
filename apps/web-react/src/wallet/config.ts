import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { arbitrumSepolia } from 'wagmi/chains'

/**
 * Wallet configuration — Phase 3.
 *
 * - Arbitrum Sepolia is the configurable TEST network. No Gains contracts
 *   are assumed to exist or be operational there.
 * - WalletConnect projectId comes from VITE_WALLETCONNECT_PROJECT_ID
 *   (.env / .env.local). WITH a project id, the full RainbowKit config
 *   (WalletConnect v2 + injected wallets) is used.
 *   WITHOUT one, RainbowKit throws at boot ("No projectId found"), so we
 *   fall back to an injected-wallets-only wagmi config (MetaMask / Rabby
 *   still work; WalletConnect is simply not offered until configured).
 * - Connection only: no transactions, no token approvals.
 */
export const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim() || ''

export const walletConnectEnabled = WALLETCONNECT_PROJECT_ID.length > 0

export const wagmiConfig = walletConnectEnabled
  ? getDefaultConfig({
      appName: 'Openfund',
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [arbitrumSepolia],
      ssr: false
    })
  : createConfig({
      chains: [arbitrumSepolia],
      transports: { [arbitrumSepolia.id]: http() },
      connectors: [injected({ shimDisconnect: true })]
    })
