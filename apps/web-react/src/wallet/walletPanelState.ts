import type { SessionStatus } from '../session/useOpenfundSession'

export type WalletPanelState = 'restoring' | 'disconnected' | 'connected' | 'signing' | 'authenticated' | 'suspended'

/** Pure mapping from the existing wallet (wagmi) and SIWE session state to
 *  the panel state. A connected wallet is never reported as signed in: only
 *  the session's own 'authenticated' status is. While wagmi reconnects, or a
 *  connected wallet's session is still being restored ('anonymous' with a
 *  connected wallet), the panel waits instead of asking to connect. */
export function walletPanelState(walletStatus: string, isConnected: boolean, session: SessionStatus): WalletPanelState {
  if (walletStatus === 'reconnecting' || walletStatus === 'connecting') return 'restoring'
  if (!isConnected) return 'disconnected'
  if (session === 'anonymous') return 'restoring'
  if (session === 'authenticated') return 'authenticated'
  if (session === 'suspended') return 'suspended'
  if (session === 'signing') return 'signing'
  return 'connected'
}
