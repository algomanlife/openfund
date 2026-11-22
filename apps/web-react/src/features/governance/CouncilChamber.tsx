import { useEffect, useRef, useState } from 'react'
import { text } from '../information/content'
import type { Locale } from '../information/content'
import './council-chamber.css'

/** Council chamber hero banner — ILLUSTRATION ONLY.
 *
 *  Ten council seats in a hemicycle vote on an illustrative proposal: seats
 *  light up one by one (mint approve, #e89483 reject, grey abstain), a tally
 *  counts up and a quorum bar fills toward 7 of 10, then an Approved or
 *  Rejected stamp holds and the chamber resets for the next illustrative
 *  proposal. The rules match apps/backend/governance-rules.js: 10 seats,
 *  quorum 7 participating members, 6 affirmative votes of the full council
 *  to approve; abstaining counts as participation, not approval. The vote
 *  sequences are fixed (deterministic) and are not real decisions.
 *
 *  Decorative (aria-hidden) with a visually hidden description. Runs only on
 *  screen with the tab visible; reduced motion shows a static result frame. */

export const COUNCIL_SEATS = 10
export const QUORUM = 7
export const APPROVE_THRESHOLD = 6
type Vote = 'approve' | 'reject' | 'abstain' | null
/* one entry per seat (left to right); null = did not vote in this illustration */
export const CYCLES: { id: string; title: { en: string; fa: string }; votes: Vote[] }[] = [
  { id: 'OFP-DEMO-12', title: text('Add a Persian glossary to the Learn hub', 'افزودن واژه‌نامهٔ فارسی به بخش آموزش'), votes: ['approve', 'approve', 'abstain', 'approve', 'reject', 'approve', 'approve', 'approve', 'reject', 'approve'] },
  { id: 'OFP-DEMO-13', title: text('Change the community event schedule', 'تغییر برنامهٔ رویدادهای جامعه'), votes: ['reject', 'approve', 'reject', 'reject', 'abstain', 'approve', 'reject', 'approve', 'reject', 'approve'] },
  { id: 'OFP-DEMO-14', title: text('Publish moderation guidelines', 'انتشار راهنمای مدیریت گفتگوها'), votes: ['approve', 'abstain', 'approve', null, 'approve', 'approve', 'abstain', 'approve', 'reject', 'approve'] },
]

/** Outcome by the council rules (same arithmetic as evaluateSession). */
export function outcome(votes: Vote[]) {
  const approve = votes.filter(v => v === 'approve').length, reject = votes.filter(v => v === 'reject').length, abstain = votes.filter(v => v === 'abstain').length
  const participating = approve + reject + abstain
  return { approve, reject, abstain, participating, approved: participating >= QUORUM && approve >= APPROVE_THRESHOLD }
}

/* seat positions on a hemicycle seen slightly from above (an ellipse) */
const CX = 210, CY = 236, RX = 168, RY = 112
const SEATS = Array.from({ length: COUNCIL_SEATS }, (_, i) => {
  const a = Math.PI - (i * Math.PI) / (COUNCIL_SEATS - 1)
  const depth = Math.sin(a) /* back row is further away: smaller */
  return { x: CX + RX * Math.cos(a), y: CY - RY * Math.sin(a), r: 15 - depth * 3 }
})
const STEP_MS = 520, HOLD_MS = 2600, PAUSE_MS = 700

function useLive<T extends Element>() {
  const ref = useRef<T>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let on = false
    const sync = () => setLive(on && !document.hidden)
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; sync() })
    io.observe(el); document.addEventListener('visibilitychange', sync)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return [ref, live] as const
}

export default function CouncilChamber({ locale }: { locale: Locale }) {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [ref, live] = useLive<HTMLDivElement>()
  const [cycle, setCycle] = useState(0)
  /* seats revealed so far; COUNCIL_SEATS = all cast, then the stamp shows */
  const [shown, setShown] = useState(reduce ? COUNCIL_SEATS : 0)
  useEffect(() => {
    if (reduce || !live) return
    const t = shown < COUNCIL_SEATS
      ? setTimeout(() => setShown(n => n + 1), shown === 0 ? PAUSE_MS : STEP_MS)
      : setTimeout(() => { setShown(0); setCycle(c => (c + 1) % CYCLES.length) }, HOLD_MS)
    return () => clearTimeout(t)
  }, [live, shown, reduce])

  const c = CYCLES[cycle], cast = c.votes.map((v, i) => (i < shown ? v : null))
  const tally = outcome(cast), final = outcome(c.votes)
  const done = shown >= COUNCIL_SEATS
  const L = (en: string, fa: string) => text(en, fa)[locale]
  const rtl = locale === 'fa'
  return <div ref={ref} className={`gv-chamber${done ? ' is-done' : ''}`}>
    <p className="sr-only">{L('Illustration: a ten-seat council votes on an example proposal. Quorum is 7 participating members and approval needs 6 votes; abstaining counts as participation. The outcomes shown are examples, not real decisions.',
      'تصویر نمونه: شورای ده‌نفره دربارهٔ یک پیشنهاد نمونه رأی می‌دهد. حد نصاب ۷ عضو شرکت‌کننده است و تصویب ۶ رأی موافق لازم دارد؛ رأی ممتنع مشارکت به حساب می‌آید. نتیجه‌ها نمونه‌اند و تصمیم واقعی نیستند.')}</p>
    <svg viewBox="0 0 420 300" aria-hidden="true" focusable="false">
      <defs><radialGradient id="gv-floor" cx="50%" cy="80%" r="60%"><stop offset="0" stopColor="var(--mint)" stopOpacity=".16" /><stop offset="1" stopColor="var(--mint)" stopOpacity="0" /></radialGradient></defs>
      <ellipse cx={CX} cy={CY} rx={RX + 30} ry={RY + 22} fill="url(#gv-floor)" />
      <path className="gv-ch-arc" d={`M${CX - RX} ${CY}A${RX} ${RY} 0 0 1 ${CX + RX} ${CY}`} />
      <path className="gv-ch-arc inner" d={`M${CX - RX * 0.62} ${CY}A${RX * 0.62} ${RY * 0.62} 0 0 1 ${CX + RX * 0.62} ${CY}`} />
      {SEATS.map((s, i) => <g key={i} className={`gv-ch-seat${cast[i] ? ` is-${cast[i]}` : ''}`}>
        <circle className="gv-ch-seat-glow" cx={s.x} cy={s.y} r={s.r + 7} />
        <circle className="gv-ch-seat-body" cx={s.x} cy={s.y} r={s.r} />
        <path className="gv-ch-seat-back" d={`M${s.x - s.r * 0.7} ${s.y - s.r * 0.25}a${s.r * 0.7} ${s.r * 0.7} 0 0 1 ${s.r * 1.4} 0`} />
      </g>)}
      {/* rostrum and the proposal card on it */}
      <path className="gv-ch-rostrum" d={`M${CX - 46} 290h92l-10-34h-72z`} />
      <g className="gv-ch-card" key={c.id}>
        <rect x={CX - 78} y="168" width="156" height="66" rx="9" />
        {/* tag at the reading start, id at the other edge, in either direction */}
        <text className="gv-ch-card-tag" x={rtl ? CX + 68 : CX - 68} y="186" direction={rtl ? 'rtl' : 'ltr'}>{L('Illustration', 'تصویر نمونه')}</text>
        <text className="gv-ch-card-id" x={rtl ? CX - 68 : CX + 68} y="186" textAnchor={rtl ? 'start' : 'end'} direction="ltr">{c.id}</text>
        <foreignObject x={CX - 70} y="192" width="140" height="38"><p className="gv-ch-card-title" lang={locale}>{c.title[locale]}</p></foreignObject>
      </g>
      {done && <g className={`gv-ch-stamp ${final.approved ? 'is-approved' : 'is-rejected'}`}>
        <rect x={CX - 66} y="54" width="132" height="34" rx="6" transform={`rotate(-6 ${CX} 71)`} />
        <text x={CX} y="77" textAnchor="middle" transform={`rotate(-6 ${CX} 71)`}>{final.approved ? L('Approved', 'تصویب‌شده') : L('Rejected', 'ردشده')}</text>
      </g>}
    </svg>
    <div className="gv-ch-tally" aria-hidden="true">
      <span className="is-approve"><i />{L('Approve', 'موافق')} <b>{tally.approve}</b></span>
      <span className="is-reject"><i />{L('Reject', 'مخالف')} <b>{tally.reject}</b></span>
      <span className="is-abstain"><i />{L('Abstain', 'ممتنع')} <b>{tally.abstain}</b></span>
    </div>
    <div className="gv-ch-quorum" aria-hidden="true">
      <span>{L('Quorum', 'حد نصاب')} <b dir="ltr">{Math.min(tally.participating, QUORUM)} / {QUORUM}</b></span>
      <i><i style={{ transform: `scaleX(${Math.min(1, tally.participating / COUNCIL_SEATS)})` }} /><em style={{ insetInlineStart: `${(QUORUM / COUNCIL_SEATS) * 100}%` }} /></i>
    </div>
  </div>
}
