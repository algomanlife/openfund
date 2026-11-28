import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, useSession } from '../../session/useOpenfundSession'
import { number, text, tx, type Locale, type Localized } from '../information/content'

/* Airdrop achievements: one badge per mission. Progress comes only from the
   valid Openfund certificates of the signed-in wallet (GET /airdrop/me); a
   completed mission is claimed with the public post links that share them
   (POST /airdrop/claims). States: locked, in progress, ready to claim,
   submitted, approved, paid, rejected (claim again). */
export type MissionId = 'buy-share' | 'pass-share' | 'payout-share' | 'three-buys-pass' | 'ten-payouts'
type Step = { kind: 'purchase' | 'completion' | 'payout'; need: number; have: number }
type Claim = { id: string; status: 'submitted' | 'approved' | 'rejected' | 'paid'; reason: string | null; paidTxHash: string | null }
type Mission = { id: MissionId; rewardUsd: number; steps: Step[]; complete: boolean; claim: Claim | null }
type Me = { eligible: boolean; counts: Record<Step['kind'], number>; missions: Mission[] }

export const MISSIONS: Array<{ id: MissionId; usd: number; tone: string; title: Localized; body: Localized; needs: Partial<Record<Step['kind'], number>> }> = [
  { id: 'buy-share', usd: 1000, tone: '#12965d', needs: { purchase: 1 },
    title: text('Buy and share', 'بخر و به اشتراک بگذار'),
    body: text('Buy a challenge and share your purchase certificate and a screenshot of the purchase on social media.', 'یک چلنج بخر و گواهی خرید و تصویر خرید را در شبکه‌های اجتماعی به اشتراک بگذار.') },
  { id: 'pass-share', usd: 2000, tone: '#2bb57a', needs: { purchase: 1, completion: 1 },
    title: text('Pass and share', 'پاس کن و به اشتراک بگذار'),
    body: text('Pass your challenge and share the pass certificate together with your purchase certificate.', 'چلنجت را پاس کن و گواهی قبولی را همراه گواهی خرید به اشتراک بگذار.') },
  { id: 'payout-share', usd: 3000, tone: '#f2c14e', needs: { purchase: 1, completion: 1, payout: 1 },
    title: text('Get paid and share', 'برداشت بزن و به اشتراک بگذار'),
    body: text('Receive a payout and share the purchase, pass and payout certificates.', 'برداشت بگیر و گواهی خرید، قبولی و برداشت را به اشتراک بگذار.') },
  { id: 'three-buys-pass', usd: 4000, tone: '#f4a24f', needs: { purchase: 3, completion: 1 },
    title: text('Three purchases and a pass', 'سه خرید و یک قبولی'),
    body: text('Share three purchase certificates and the pass certificate of a challenge, no payout needed.', 'سه گواهی خرید و گواهی قبولی یک چلنج را به اشتراک بگذار؛ برداشت لازم نیست.') },
  { id: 'ten-payouts', usd: 5000, tone: '#f08a6c', needs: { payout: 10 },
    title: text('Ten payouts', 'ده برداشت'),
    body: text('Share ten payout certificates issued to your wallet.', 'ده گواهی برداشتی را که به کیف پولت صادر شده به اشتراک بگذار.') },
]

const c = {
  title: text('Achievements', 'دستاوردها'),
  lead: text('Each mission is an achievement. Its badge lights up as your wallet earns the certificates; a completed badge is claimed with the links of your public posts. Each pays once per wallet.', 'هر مأموریت یک دستاورد است. نشان آن با گرفتن گواهی‌ها در کیف پولت روشن می‌شود و نشان کامل‌شده با لینک پست‌های عمومی‌ات دریافت می‌شود. هر کدام برای هر کیف پول یک بار پرداخت می‌شود.'),
  reward: text('Cash reward', 'جایزهٔ نقدی'),
  purchase: text('Purchase certificates', 'گواهی خرید'),
  completion: text('Pass certificates', 'گواهی قبولی'),
  payout: text('Payout certificates', 'گواهی برداشت'),
  locked: text('Locked', 'قفل'),
  progress: text('In progress', 'در حال انجام'),
  ready: text('Ready to claim', 'آمادهٔ دریافت'),
  submitted: text('Under review', 'در حال بررسی'),
  approved: text('Approved', 'تأیید شد'),
  paid: text('Paid', 'پرداخت شد'),
  rejected: text('Not accepted: claim again', 'پذیرفته نشد؛ دوباره ثبت کن'),
  claim: text('Claim', 'دریافت جایزه'),
  links: text('Links to your public posts (one per line, up to five)', 'لینک پست‌های عمومی‌ات (هر خط یک لینک، حداکثر پنج)'),
  send: text('Send claim', 'ارسال درخواست'),
  cancel: text('Cancel', 'انصراف'),
  connect: text('Connect your wallet to see your achievements', 'برای دیدن دستاوردهایت کیف پولت را وصل کن'),
  signIn: text('Sign in with your wallet', 'ورود با کیف پول'),
  connectButton: text('Connect wallet', 'اتصال کیف پول'),
  notEligible: text('Your wallet has no challenge purchase yet. The airdrop is for wallets that bought a challenge.', 'کیف پولت هنوز چلنجی نخریده است. ایردراپ برای کیف پول‌هایی است که چلنج خریده‌اند.'),
  buy: text('Buy a challenge', 'خرید چلنج'),
  error: text('The claim could not be sent. Check the links and try again.', 'درخواست ارسال نشد. لینک‌ها را بررسی کن و دوباره امتحان کن.'),
  reason: text('Reason', 'دلیل'),
}

/* original badge artwork: a medal with a per-mission glyph */
const GLYPH: Record<MissionId, string> = {
  'buy-share': 'M-10 -6h20l-2 14h-16zM-6 -6c0-6 12-6 12 0M8 -14l6-6m0 0h-5m5 0v5',
  'pass-share': 'M0 -15l12 5v7c0 8-5 13-12 16-7-3-12-8-12-16v-7zM-6 0l4 4 8-9',
  'payout-share': 'M-14 -8h28v16h-28zM0 -3a3 3 0 1 0 0.01 0M-10 -4v8M10 -4v8M0 -18v-0',
  'three-buys-pass': 'M-14 -10h14v8h-14zM-10 -4h14v8h-14zM-6 2h14v8h-14zM11 -14l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z',
  'ten-payouts': 'M-9 -14h18v6c0 7-4 11-9 11s-9-4-9-11zM-9 -11h-5c0 5 3 7 5 7M9 -11h5c0 5-3 7-5 7M-4 3v4h8v-4M-7 9h14',
}

export function Badge({ id, tone, state, ratio }: { id: MissionId; tone: string; state: string; ratio: number }) {
  const r = 36, len = 2 * Math.PI * r
  return <svg className={`ad-badge-art is-${state}`} viewBox="-50 -50 100 100" aria-hidden="true" style={{ ['--ad-tone' as string]: tone }}>
    <circle className="ad-badge-track" r={r} />
    <circle className="ad-badge-ring" r={r} strokeDasharray={len} strokeDashoffset={len * (1 - ratio)} transform="rotate(-90)" />
    <path className="ad-badge-medal" d="M0 -28l24 14v28l-24 14-24-14v-28z" />
    <path className="ad-badge-glyph" d={GLYPH[id]} />
    <rect className="ad-badge-shine" x="-60" y="-50" width="18" height="100" transform="skewX(-20)" />
    {state === 'locked' && <g className="ad-badge-lock"><rect x="-7" y="-2" width="14" height="11" rx="2" /><path d="M-4 -2v-4a4 4 0 0 1 8 0v4" /></g>}
    {(state === 'paid' || state === 'approved') && <g className="ad-badge-done"><circle cx="22" cy="-22" r="10" /><path d="M17 -22l4 4 6-7" /></g>}
  </svg>
}

export default function Achievements({ locale }: { locale: Locale }) {
  const t = (v: Localized) => tx(locale, v)
  const session = useSession()
  const authenticated = session.status === 'authenticated'
  const [me, setMe] = useState<Me | null>(null)
  const [open, setOpen] = useState<MissionId | null>(null)
  const [draft, setDraft] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const load = useCallback(async () => {
    if (!authenticated) { setMe(null); return }
    const r = await apiFetch('/airdrop/me').catch(() => null)
    if (r?.ok) setMe(r.data as Me)
  }, [authenticated])
  useEffect(() => { void load() }, [load])
  const send = async (mission: MissionId) => {
    setBusy(true); setError('')
    try {
      const links = draft.split(/\s+/).map(s => s.trim()).filter(Boolean)
      const r = await apiFetch('/airdrop/claims', { method: 'POST', body: JSON.stringify({ mission, links }) })
      if (!r.ok) setError(t(c.error)); else { setOpen(null); setDraft(''); await load() }
    } catch { setError(t(c.error)) } finally { setBusy(false) }
  }
  const money = (v: number) => number(v, locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  return <section className="container ad-section" id="achievements" aria-labelledby="ad-ach-title">
    <h2 id="ad-ach-title">{t(c.title)}</h2>
    <p className="ad-lead">{t(c.lead)}</p>
    {!authenticated && <div className="ad-signin">
      <span>{t(c.connect)}</span>
      {session.status === 'unauthenticated'
        ? <button type="button" className="button" onClick={() => void session.signIn()}>{t(c.signIn)}</button>
        : <button type="button" className="button" onClick={() => (window as Window & { __ofOpenConnect?: () => void }).__ofOpenConnect?.()}>{t(c.connectButton)}</button>}
    </div>}
    {me && !me.eligible && <div className="ad-signin"><span>{t(c.notEligible)}</span><Link className="button" to={`/${locale}/checkout`}>{t(c.buy)}</Link></div>}
    <ul className="ad-achievements">{MISSIONS.map((m, i) => {
      const live = me?.missions.find(x => x.id === m.id)
      const steps: Step[] = live?.steps ?? Object.entries(m.needs).map(([kind, need]) => ({ kind: kind as Step['kind'], need: need!, have: 0 }))
      const done = steps.reduce((n, s) => n + s.have, 0), need = steps.reduce((n, s) => n + s.need, 0)
      const claim = live?.claim
      const state = claim && claim.status !== 'rejected' ? claim.status : live?.complete ? 'ready' : done > 0 && me?.eligible ? 'progress' : 'locked'
      const label = { locked: c.locked, progress: c.progress, ready: c.ready, submitted: c.submitted, approved: c.approved, paid: c.paid }[state]!
      return <li key={m.id} className={`ad-achievement is-${state}`} data-mission={m.id} style={{ ['--ad-tone' as string]: m.tone, animationDelay: `${i * 90}ms` }}>
        <Badge id={m.id} tone={m.tone} state={state} ratio={need ? done / need : 0} />
        <div className="ad-ach-body">
          <span className={`ad-state is-${state}`}>{t(label)}</span>
          <h3>{t(m.title)}</h3>
          <span className="ad-reward"><small>{t(c.reward)}</small><bdi>{money(m.usd)}</bdi></span>
          <p>{t(m.body)}</p>
          <ul className="ad-steps-mini">{steps.map(s => <li key={s.kind}>
            <span>{t(c[s.kind])}</span>
            <bdi className="ad-count">{number(s.have, locale)} / {number(s.need, locale)}</bdi>
            <i className="ad-bar" style={{ ['--ad-fill' as string]: `${Math.round((s.have / s.need) * 100)}%` }} />
          </li>)}</ul>
          {claim?.status === 'rejected' && claim.reason && <p className="ad-reason">{t(c.reason)}: {claim.reason}</p>}
          {claim?.status === 'rejected' && <p className="ad-reason">{t(c.rejected)}</p>}
          {state === 'ready' && open !== m.id && <button type="button" className="button ad-claim" onClick={() => { setOpen(m.id); setError('') }}>{t(c.claim)}</button>}
          {open === m.id && <form className="ad-claim-form" onSubmit={e => { e.preventDefault(); void send(m.id) }}>
            <label>{t(c.links)}<textarea dir="ltr" rows={3} required value={draft} onChange={e => setDraft(e.target.value)} /></label>
            {error && <p className="ad-error" role="alert">{error}</p>}
            <div className="ad-actions"><button className="button" disabled={busy}>{t(c.send)}</button>
              <button type="button" className="text-link" onClick={() => setOpen(null)}>{t(c.cancel)}</button></div>
          </form>}
        </div>
      </li>
    })}</ul>
  </section>
}
