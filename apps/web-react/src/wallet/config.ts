import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { sepolia, arbitrum } from 'wagmi/chains'
import { publicRuntimeConfig } from '../config/runtime'

/**
 * Wallet configuration — Phase 3.
 *
 * - Prop uses Ethereum Sepolia; Perpetual reads Gains on Arbitrum One.
 *   No on-chain execution or testnet Gains contracts are assumed.
 * - WalletConnect projectId comes from VITE_WALLETCONNECT_PROJECT_ID
 *   (.env / .env.local). WITH a project id, the full RainbowKit config
 *   (WalletConnect v2 + injected wallets) is used.
 *   WITHOUT one, RainbowKit throws at boot ("No projectId found"), so we
 *   fall back to an injected-wallets-only wagmi config (MetaMask / Rabby
 *   still work; WalletConnect is simply not offered until configured).
 * - Connection only: no transactions, no token approvals.
 */
export const WALLETCONNECT_PROJECT_ID =
  (import.meta.env?.PROD ? publicRuntimeConfig().walletConnectProjectId : import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim() || ''

export const walletConnectEnabled = WALLETCONNECT_PROJECT_ID.length > 0

export const wagmiConfig = walletConnectEnabled
  ? getDefaultConfig({
      appName: 'Openfund',
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [sepolia, arbitrum],
      ssr: false
    })
  : createConfig({
      chains: [sepolia, arbitrum],
      transports: { [sepolia.id]: http(), [arbitrum.id]: http() },
      connectors: [injected({ shimDisconnect: true })]
    })
