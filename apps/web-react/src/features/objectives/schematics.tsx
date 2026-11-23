/* Objective schematics: one small original SVG per rule (decorative; the
   card text carries the numbers). Motion lives in objectives.css and runs
   only while the card is live; Labs (item M) reuses these. */
export type ObjectiveKind = 'target' | 'daily' | 'max' | 'trailing' | 'days' | 'consistency' | 'split' | 'cycle' | 'conduct' | 'refund'

export function ObjectiveArt({ kind }: { kind: ObjectiveKind }) {
  return <svg className={`ob-art is-${kind}`} viewBox="0 0 120 60" aria-hidden="true" focusable="false">{art(kind)}</svg>
}

function art(kind: ObjectiveKind) {
  switch (kind) {
    case 'target': return <>
      <path d="M8 50l18-6 14 4 18-14 14 4 18-16 14-8" className="ob-line ob-draw" />
      <path d="M104 6v20" className="ob-pole" /><path d="M104 6l12 4-12 4z" className="ob-flag" />
    </>
    case 'daily': return <>
      <path d="M8 22c10 0 12 10 22 8s10-8 20-6 8 14 18 12 12-8 22-6 10 6 22 4" className="ob-line" />
      {[0, 1, 2].map(i => <path key={i} d={`M${8 + i * 38} 46h34`} className="ob-floor ob-reset" style={{ ['--i' as string]: i }} />)}
      <path d="M44 40v12M82 40v12" className="ob-tick" />
    </>
    case 'max': return <>
      <path d="M8 24l16 6 14-10 16 8 14-4 16 10 14-6 14 2" className="ob-line ob-draw" />
      <path d="M8 50h104" className="ob-floor" />
    </>
    case 'trailing': return <>
      <path d="M8 40l16-8 14 4 16-14 14 6 16-16 14 2 14-6" className="ob-line ob-draw" />
      <path d="M8 56l30-10 30-12 30-10h14" className="ob-floor ob-trail" />
    </>
    case 'days': return <>{Array.from({ length: 14 }, (_, i) =>
      <circle key={i} cx={14 + (i % 7) * 15} cy={i < 7 ? 20 : 40} r="5" className="ob-dot" style={{ ['--i' as string]: i }} />)}</>
    case 'consistency': return <>
      {[18, 30, 22, 40, 26, 34].map((h, i) => <rect key={i} x={12 + i * 17} y={54 - h} width="10" height={h} rx="2" className="ob-bar" style={{ ['--i' as string]: i }} />)}
      <path d="M6 18h108" className="ob-cap" />
    </>
    case 'split': return <>
      <rect x="8" y="24" width="104" height="12" rx="6" className="ob-track" />
      <rect x="8" y="24" width="104" height="12" rx="6" className="ob-fill" />
    </>
    case 'cycle': return <>
      <circle cx="60" cy="30" r="20" className="ob-ring" />
      <path d="M60 10a20 20 0 0 1 20 20" className="ob-arc" />
      {[0, 1, 2, 3].map(i => <circle key={i} cx={60 + 20 * Math.cos(i * Math.PI / 2 - Math.PI / 2)} cy={30 + 20 * Math.sin(i * Math.PI / 2 - Math.PI / 2)} r="3" className="ob-dot" style={{ ['--i' as string]: i }} />)}
    </>
    case 'conduct': return <>
      <path d="M14 44l10-24 10 24M18 36h12" className="ob-icon" />
      <rect x="48" y="18" width="24" height="26" rx="3" className="ob-icon" /><path d="M52 26h16M52 32h16M52 38h10" className="ob-icon" />
      <path d="M88 24h22v20H88zM88 30h22" className="ob-icon" /><path d="M94 18v8M104 18v8" className="ob-icon" />
    </>
    case 'refund': return <>
      {[0, 1, 2, 3].map(i => <circle key={i} cx={20 + i * 20} cy="30" r="7" className="ob-dot" style={{ ['--i' as string]: i }} />)}
      <path d="M96 22l8 8-8 8M104 30H84" className="ob-unlock" />
    </>
  }
}
