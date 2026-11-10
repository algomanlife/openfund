/**
 * Governance API client. Uses the existing credentialed apiFetch (HttpOnly
 * session cookie); the browser never holds a token and never sends an
 * unsigned wallet address as proof of identity.
 */
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../session/useOpenfundSession'
import type { LoadState, VotingSession } from './governanceModel'

export interface SeatView {
  seatId: string; constituency: string; seatNo: number; status: 'seated' | 'vacant'
  displayName: string | null; nameWithheld: boolean
  termStartsAt: string | null; termEndsAt: string | null; membershipType: 'appointed' | 'elected' | null
  participation: { votesCast: number; sessionsEligible: number } | null
}
export interface CouncilData {
  term: { id: string; label: string; startsAt: string; endsAt: string; appointmentMethod: 'appointed' | 'elected' } | null
  seats: SeatView[]; seatedCount: number; vacantCount: number
  config: { councilSize: number; quorum: number; ordinaryThreshold: number; constitutionalThreshold: number; termMonths: number }
}
export interface ProposalRow {
  ofpId: string; title: string; summary: string; category: string; classification: 'binding' | 'advisory'; binding: boolean
  reservedPower: boolean; status: string; author: string; votingDeadline: string | null; commentCount: number
  implementationStatus: string; updatedAt: string
}
export interface ProposalList { total: number; proposals: ProposalRow[] }
export interface ProposalDetail extends ProposalRow {
  description: string; productArea: string | null; technicalImplications: string | null; resourceRequirements: string | null
  expectedBenefits: string | null; risks: string | null; documentation: string[]; githubIssue: string | null; githubPullRequest: string | null
  revision: number; capacityConfirmed: boolean; decision: string | null; decisionRationale: string | null
  history: Array<{ from_status: string | null; to_status: string; actor_role: string; note: string | null; created_at: string }>
  sessions: Array<VotingSession & { tally: { participating: number; quorum: number; threshold: number; approve?: number; reject?: number; abstain?: number; outcome?: string } | null }>
  decisions: Array<{ id: string; outcome: string; binding: boolean; rationale: string | null; decided_at: string; tally: Record<string, number | string | boolean>; amendments: Array<{ reason: string; at: string }> | null }>
  implementation: Array<{ status: string; evidence_url: string | null; blocked_reason: string | null; blocked_evidence: string | null; next_review_on: string | null; created_at: string }>
  viewer: { councilMember: boolean; canVote: boolean; reason: string | null; roles?: string[]; constituency?: string }
}
export interface DecisionRow {
  ofpId: string; title: string; category: string; classification: 'binding' | 'advisory'; outcome: string; binding: boolean
  rationale: string | null; decidedAt: string; proposalStatus: string; implementationStatus: string
  tally: Record<string, number | string | boolean>
}
export interface DecisionsData { decisions: DecisionRow[]; blocked: Array<{ ofp_id: string; title: string; blocker: { blocked_reason: string; blocked_evidence: string; next_review_on: string } | null }> }
export interface OverviewData {
  model: { dao: boolean; token: boolean; onChainVoting: boolean; tagline: string }
  council: CouncilData
  proposalCounts: Record<string, number>
  openVotes: Array<{ ofpId: string; title: string; category: string; classification: string; closesAt: string }>
  elections: { publicEnabled: boolean; elections: Array<{ id: string; constituency: string; status: string; votingOpensAt: string; votingClosesAt: string; termLabel: string; approvedCandidates: number }>; note: string | null }
  initialCouncilNote: string
}
export interface WorkspaceData {
  seat: { constituency: string; seatNo: number; startsAt: string; endsAt: string; membershipType: string }
  responsibilities: Array<{ ofpId: string; title: string; category: string; classification: string; session: VotingSession; canVote: boolean; reason: string | null; myVote: { choice: string; castAt: string } | null }>
  deadlines: Array<{ ofpId: string; closesAt: string }>
  history: Array<{ ofpId: string; title: string; outcome: string; decidedAt: string; myChoice: string | null }>
  conflicts: Array<{ id: string; ofp_id: string; reason: string; status: string; review_note: string | null; created_at: string }>
  participation: { votesCast: number; sessionsEligible: number }
}

export async function governanceFetch<T = unknown>(path: string, init?: RequestInit) {
  const r = await apiFetch(`/governance${path}`, init)
  return { ok: r.ok, status: r.status, data: r.data as T & { error?: string } }
}

/** GET with explicit loading / error / ready states and a retry handle */
export function useGovernance<T>(path: string | null, refreshKey: unknown = 0): { state: LoadState<T>; reload: () => void } {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!path) return
    let live = true
    setState({ status: 'loading' })
    governanceFetch<T>(path).then(r => {
      if (!live) return
      setState(r.ok ? { status: 'ready', data: r.data as T } : { status: 'error', code: (r.data as { error?: string } | null)?.error })
    }).catch(() => { if (live) setState({ status: 'error' }) })
    return () => { live = false }
  }, [path, tick, refreshKey])
  return { state, reload: useCallback(() => setTick(t => t + 1), []) }
}
