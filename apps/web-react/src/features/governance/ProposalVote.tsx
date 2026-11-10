import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useOpenfundSession } from '../../session/useOpenfundSession'
import type { Locale } from '../information/content'
import { governanceFetch, useGovernance, type ProposalDetail } from './api'
import { StateBox, VotePanel } from './GovernanceViews'
import { text } from '../information/content'

/**
 * Voting container. The server decides eligibility and enforces every rule;
 * this component only presents the server's answer and submits the choice.
 * A wallet signature is optional extra evidence (domain-separated, single-use,
 * free of charge): it is never a transaction.
 */
export default function ProposalVote({ ofp, locale, onChanged }: { ofp: string; locale: Locale; onChanged?: () => void }) {
  const { status } = useOpenfundSession()
  const signedIn = status === 'authenticated'
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [refresh, setRefresh] = useState(0)
  const { state, reload } = useGovernance<ProposalDetail>(`/proposals/${encodeURIComponent(ofp)}`, `${status}:${refresh}`)
  const [busy, setBusy] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<{ choice: string; signed: boolean } | null>(null)
  const [sign, setSign] = useState(true)

  async function vote(choice: 'approve' | 'reject' | 'abstain') {
    setBusy(true); setErrorCode(null)
    try {
      let body: Record<string, string> = { choice }
      if (sign && address) {
        const ch = await governanceFetch<{ nonce: string; message: string }>(`/proposals/${encodeURIComponent(ofp)}/vote-challenge?choice=${choice}`)
        if (!ch.ok) { setErrorCode(ch.data?.error ?? 'error'); return }
        const signature = await signMessageAsync({ account: address, message: ch.data.message })
        body = { choice, nonce: ch.data.nonce, signature }
      }
      const r = await governanceFetch(`/proposals/${encodeURIComponent(ofp)}/vote`, { method: 'POST', body: JSON.stringify(body) })
      if (!r.ok) { setErrorCode(r.data?.error ?? 'error'); return }
      setSubmitted({ choice, signed: Boolean(body.signature) })
      setRefresh(n => n + 1); onChanged?.()
    } catch {
      setErrorCode('error') /* wallet rejected the signature or the network failed: nothing was recorded */
    } finally { setBusy(false) }
  }

  return <StateBox state={state} locale={locale} empty={text('No vote.', 'رأی‌گیری وجود ندارد.')[locale]} onRetry={reload}>
    {(p) => <VotePanel proposal={p} locale={locale} signedIn={signedIn} busy={busy} submitted={submitted} errorCode={errorCode} sign={sign && Boolean(address)} onSignChange={setSign} onVote={vote} />}
  </StateBox>
}
