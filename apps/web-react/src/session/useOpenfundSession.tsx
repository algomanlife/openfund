import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { createSiweMessage } from 'viem/siwe'

/**
 * Openfund session — wallet-based identity via SIWE (EIP-4361).
 *
 * States: anonymous → connecting → connected-unauthenticated → signing →
 * authenticated (or suspended / error). Wallet connection alone is NEVER
 * treated as login — a signature over a fresh single-use nonce is required.
 *
 * The backend (apps/backend) owns verification + HttpOnly session cookies;
 * this hook never sees any token.
 */
const BACKEND = ((import.meta.env.VITE_BACKEND_URL as string | undefined) || (import.meta.env.PROD ? window.location.origin : 'http://localhost:8080')).replace(/\/+$/, '')

export type SessionStatus =
  | 'anonymous'          /* no wallet connected */
  | 'unauthenticated'    /* wallet connected, not signed in */
  | 'signing'            /* SIWE signature requested */
  | 'authenticated'
  | 'suspended'
  | 'error'

export interface OpenfundUser {
  id: string
  walletAddress: string
  displayName: string | null
  status: string
  createdAt: string
  lastLoginAt: string | null
}
export interface OpenfundChallenge {
  id: string
  status: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  plan_slug: string
  plan_name: string
}

export function backendUrl() { return BACKEND }

export function useOpenfundSession() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [status, setStatus] = useState<SessionStatus>('anonymous')
  const [user, setUser] = useState<OpenfundUser | null>(null)
  const [challenges, setChallenges] = useState<OpenfundChallenge[]>([])
  const [error, setError] = useState<string | null>(null)
  const addressRef = useRef<string | undefined>(undefined)

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const res = await fetch(BACKEND + path, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  }, [])

  const loadMe = useCallback(async () => {
    const expected = addressRef.current
    const r = await api('/auth/me')
    if (expected !== addressRef.current) return null
    if (r.ok && expected && r.data?.user?.walletAddress?.toLowerCase() !== expected.toLowerCase()) { setUser(null); setChallenges([]); setStatus('unauthenticated'); return null }
    if (r.ok && r.data?.user) {
      setUser(r.data.user)
      setChallenges(r.data.challenges || [])
      setStatus(r.data.user.status === 'suspended' ? 'suspended' : 'authenticated')
      return r.data.user
    }
    setUser(null)
    setChallenges([])
    setStatus('unauthenticated')
    return null
  }, [api])

  /* boot + wallet/chain/account change handling */
  useEffect(() => {
    if (!isConnected || !address) {
      addressRef.current = undefined
      setUser(null)
      setChallenges([])
      setStatus('anonymous')
      return
    }
    const changed = addressRef.current && addressRef.current !== address
    addressRef.current = address
    ;(async () => {
      if (changed) {
        setStatus('unauthenticated')
        setUser(null)
        setChallenges([])
        /* a previously authenticated session must never silently follow a
           different connected wallet — invalidate and re-authenticate */
        await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {})
        setStatus('unauthenticated')
        return
      }
      const me = await loadMe().catch(() => null)
      if (me && me.walletAddress.toLowerCase() !== address.toLowerCase()) {
        await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {})
        setStatus('unauthenticated')
      }
    })()
  }, [isConnected, address, api, loadMe])

  const signIn = useCallback(async () => {
    if (!address) return
    setError(null)
    setStatus('signing')
    try {
      const n = await api('/auth/nonce', { method: 'POST', body: JSON.stringify({ address }) })
      if (!n.ok) throw new Error('nonce')
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        uri: window.location.origin + '/',
        chainId: 421614,
        nonce: n.data.nonce,
        version: '1'
      })
      const signature = await signMessageAsync({ account: address, message })
      const v = await api('/auth/verify', { method: 'POST', body: JSON.stringify({ message, signature }) })
      if (!v.ok) {
        if (v.data?.error === 'account_suspended') { setStatus('suspended'); return }
        throw new Error(v.data?.error || 'verify')
      }
      await loadMe()
    } catch (e: any) {
      /* user rejected the signature request → back to unauthenticated */
      setStatus('unauthenticated')
      setError(String(e?.message || e))
    }
  }, [address, api, loadMe, signMessageAsync])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {})
    setUser(null)
    setChallenges([])
    setStatus('unauthenticated')
  }, [api])

  return { status, user, challenges, signIn, logout, error, reload: loadMe }
}


/* ---------- shared session context (ONE instance for the whole app) ----------
   RainbowConnect, TradingBridge and future consumers must observe the SAME
   session — sign-in in one place activates everywhere immediately. */
const SessionCtx = createContext<ReturnType<typeof useOpenfundSession> | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useOpenfundSession()
  return <SessionCtx.Provider value={session}>{children}</SessionCtx.Provider>
}

export function useSession() {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession requires <SessionProvider>')
  return ctx
}
