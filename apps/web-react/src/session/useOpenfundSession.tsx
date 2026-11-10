import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccount, useSignMessage, useSwitchChain } from 'wagmi'
import { networkForHash, useProductNetwork } from '../wallet/productNetwork'
import { createSiweMessage } from 'viem/siwe'
import { classifyWalletError, OpenfundAuthError, type ClassifiedWalletError, type WalletStage } from '../wallet/errors'

export interface SessionError extends ClassifiedWalletError { stage: WalletStage }

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
  avatarUrl: string | null
  status: string
  createdAt: string
  lastLoginAt: string | null
}

/** credentialed JSON fetch against the Openfund backend (purchase/profile APIs) */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(BACKEND + path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
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
  const { address, isConnected, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const targetChain = useProductNetwork()
  const generation = useRef(0)
  const signing = useRef(false)
  const { signMessageAsync } = useSignMessage()
  const [status, setStatus] = useState<SessionStatus>('anonymous')
  const [user, setUser] = useState<OpenfundUser | null>(null)
  const [challenges, setChallenges] = useState<OpenfundChallenge[]>([])
  const [error, setError] = useState<SessionError | null>(null)
  const addressRef = useRef<string | undefined>(undefined)
  const currentAddress = useRef(address)
  currentAddress.current = isConnected ? address : undefined

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    let res: Response
    try {
      res = await fetch(BACKEND + path, {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
      })
    } catch { throw new OpenfundAuthError('server_unreachable') }
    const data = await res.json().catch(() => null)
    if (res.status >= 500 && path === '/auth/me') throw new OpenfundAuthError('server_unreachable', res.status)
    return { ok: res.ok, status: res.status, data }
  }, [])

  // Cookie-changing requests are ordered: an old verification cannot restore
  // the previous wallet's session after a wallet-change logout.
  const authQueue = useRef<Promise<any>>(Promise.resolve())
  const mutateAuth = useCallback((path: string, init: RequestInit) => {
    const run = authQueue.current.catch(() => {}).then(() => api(path, init))
    authQueue.current = run
    return run
  }, [api])

  const loadMe = useCallback(async () => {
    const expected = addressRef.current
    const r = await api('/auth/me')
    if (!expected || expected !== currentAddress.current || expected !== addressRef.current) return null
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
    generation.current++
    signing.current = false
    setError(null)
    if (!isConnected || !address) {
      if (addressRef.current) void mutateAuth('/auth/logout', { method:'POST', body:'{}' }).catch(() => {})
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
        const expected = address
        await mutateAuth('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {})
        if (currentAddress.current === expected) setStatus('unauthenticated')
        return
      }
      const me = await loadMe().catch(e => {
        /* restore failure is reported with its cause; the wallet stays connected */
        if (currentAddress.current === address) { setStatus('unauthenticated'); setError({ stage: 'restore', ...classifyWalletError(e) }) }
        return null
      })
      if (me && me.walletAddress.toLowerCase() !== address.toLowerCase()) {
        await mutateAuth('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {})
        setStatus('unauthenticated')
      }
    })()
  }, [isConnected, address, mutateAuth, loadMe])

  const signIn = useCallback(async () => {
    if (!address || signing.current) return
    signing.current = true
    const signingChain = networkForHash(window.location.pathname)
    const run = generation.current, expected = address
    const active = () => generation.current === run && currentAddress.current === expected && networkForHash(window.location.pathname).id === signingChain.id
    setError(null)
    setStatus('signing')
    let stage: WalletStage = 'network'
    try {
      await authQueue.current.catch(() => {})
      if (!active()) return
      if (chainId !== signingChain.id) await switchChainAsync({ chainId: signingChain.id })
      if (!active()) return
      stage = 'session'
      const n = await api('/auth/nonce', { method: 'POST', body: JSON.stringify({ address }) })
      if (!active()) return
      if (!n.ok || !n.data?.nonce) throw new OpenfundAuthError(n.data?.error || (n.status === 429 ? 'rate_limited' : 'nonce'), n.status)
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        uri: window.location.origin + '/',
        chainId: signingChain.id,
        issuedAt: new Date(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000),
        nonce: n.data.nonce,
        version: '1'
      })
      stage = 'sign'
      const signature = await signMessageAsync({ account: address, message })
      if (!active()) return
      stage = 'session'
      const v = await mutateAuth('/auth/verify', { method: 'POST', body: JSON.stringify({ message, signature }) })
      if (!active()) { await mutateAuth('/auth/logout', {method:'POST',body:'{}'}).catch(() => {}); return }
      if (!v.ok) {
        if (v.data?.error === 'account_suspended') { setStatus('suspended'); return }
        throw new OpenfundAuthError(v.data?.error || (v.status === 429 ? 'rate_limited' : 'verify'), v.status)
      }
      await loadMe()
    } catch (e: any) {
      /* a declined switch/signature is a user choice (neutral message);
         every other failure names its cause — see wallet/errors.ts */
      if (active()) { setStatus('unauthenticated'); setError({ stage, ...classifyWalletError(e) }) }
    } finally {
      if (generation.current === run) {
        signing.current = false
        if (!active()) setStatus(value => value === 'signing' ? 'unauthenticated' : value)
      }
    }
  }, [address, api, loadMe, signMessageAsync, chainId, targetChain.id, switchChainAsync, mutateAuth])

  const logout = useCallback(async () => {
    generation.current++
    signing.current = false
    setError(null)
    setUser(null); setChallenges([]); setStatus('unauthenticated')
    await mutateAuth('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {})
    setUser(null)
    setChallenges([])
    setStatus('unauthenticated')
  }, [mutateAuth])

  /* profile editing (display name + avatar) — wallet identity stays immutable */
  const updateProfile = useCallback(async (patch: { displayName?: string | null, avatarUrl?: string | null }) => {
    const r = await apiFetch('/auth/profile', { method: 'PATCH', body: JSON.stringify(patch) })
    if (!r.ok) throw new Error(r.data?.error || 'profile_update_failed')
    if (currentAddress.current) await loadMe()
    return r.data
  }, [loadMe])

  const belongs = isConnected && address && user?.walletAddress.toLowerCase() === address.toLowerCase()
  const clearError = useCallback(() => setError(null), [])
  return { clearError, status: user && !belongs ? (isConnected ? 'unauthenticated' : 'anonymous') as SessionStatus : status, user: belongs ? user : null, challenges: belongs ? challenges : [], signIn, logout, updateProfile, error, reload: loadMe }
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
