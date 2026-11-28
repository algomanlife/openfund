/* Airdrop hero: balloons float over the page and drop prizes (cash notes,
   coins and gift boxes) that fall into a pile. Original SVG; CSS motion only,
   stopped under reduced motion (a still frame with the prizes mid-air). */

type Balloon = { x: number; y: number; r: number; tone: 'green' | 'mint' | 'gold' | 'coral'; prize: 'cash' | 'coin' | 'gift'; delay: number }
const BALLOONS: Balloon[] = [
  { x: 120, y: 92, r: 34, tone: 'green', prize: 'cash', delay: 0 },
  { x: 228, y: 64, r: 40, tone: 'gold', prize: 'gift', delay: 1.1 },
  { x: 340, y: 100, r: 32, tone: 'mint', prize: 'coin', delay: 2.2 },
  { x: 430, y: 72, r: 28, tone: 'coral', prize: 'cash', delay: 0.6 },
  { x: 60, y: 150, r: 24, tone: 'gold', prize: 'coin', delay: 1.7 },
  { x: 492, y: 160, r: 26, tone: 'green', prize: 'gift', delay: 2.8 },
]
/* confetti: [x, colour, delay s, duration s] */
const CONFETTI: Array<[number, string, number, number]> = [
  [40, '#82e7bd', 0, 5.2], [96, '#f2c14e', 1.3, 6], [150, '#f08a6c', 2.4, 5.6], [206, '#12965d', 0.7, 6.4], [262, '#f2c14e', 3.1, 5.4],
  [318, '#82e7bd', 1.8, 6.2], [374, '#f08a6c', 0.4, 5.8], [430, '#12965d', 2.7, 6.6], [486, '#f2c14e', 1.1, 5.3], [520, '#82e7bd', 3.6, 6.1],
]

function Prize({ kind }: { kind: Balloon['prize'] }) {
  if (kind === 'coin') return <g className="bd-coin">
    <ellipse cx="0" cy="0" rx="13" ry="13" />
    <ellipse className="bd-coin-rim" cx="0" cy="0" rx="9" ry="9" />
    <path className="bd-mark" d="M0 -6v12M3.6 -3.4c-.8-1.3-2.2-1.9-3.6-1.9-2 0-3.5 1-3.5 2.4 0 3.3 7.2 1.6 7.2 5 0 1.4-1.6 2.5-3.7 2.5-1.6 0-3-.7-3.8-2" />
  </g>
  if (kind === 'gift') return <g className="bd-gift">
    <rect x="-14" y="-10" width="28" height="22" rx="3" />
    <rect className="bd-gift-lid" x="-16" y="-15" width="32" height="7" rx="2" />
    <path className="bd-ribbon" d="M0 -15v27M-6 -16c-6-6 0-10 6-1 6-9 12-5 6 1" />
  </g>
  return <g className="bd-cash">
    <rect x="-18" y="-10" width="36" height="20" rx="3" />
    <rect className="bd-cash-inner" x="-14" y="-6" width="28" height="12" rx="2" />
    <circle className="bd-cash-dot" cx="0" cy="0" r="4" />
  </g>
}

export default function BalloonDrop({ label }: { label: string }) {
  return <svg className="bd-scene" viewBox="0 0 540 440" role="img" aria-label={label}>
    <defs>
      <radialGradient id="bd-shine" cx="35%" cy="30%" r="70%">
        <stop offset="0" stopColor="#fff" stopOpacity=".55" />
        <stop offset=".35" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="bd-ground" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity=".18" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g className="bd-sparkles" aria-hidden="true">
      {[[70, 40], [500, 46], [30, 190], [512, 210], [286, 18], [168, 210]].map(([x, y], i) =>
        <path key={i} style={{ animationDelay: `${i * 0.7}s` }} d={`M${x} ${y - 6}v12M${x - 6} ${y}h12`} />)}
    </g>
    <g className="bd-confetti" aria-hidden="true">{CONFETTI.map(([x, color, delay, dur], i) =>
      <rect key={i} x={x} y={-12} width={i % 2 ? 6 : 9} height={i % 2 ? 10 : 5} rx="1.5" fill={color} style={{ animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />)}</g>
    <g className="bd-burst" aria-hidden="true"><circle cx="270" cy="392" r="34" /><circle cx="270" cy="392" r="60" /></g>
    {BALLOONS.map((b, i) => <g key={i} className="bd-flight" style={{ animationDelay: `${-b.delay}s` }}>
      <g className={`bd-balloon is-${b.tone}`}>
        <path className="bd-string" d={`M${b.x} ${b.y + b.r + 6}c-6 14 6 24 0 40`} />
        <ellipse className="bd-body" cx={b.x} cy={b.y} rx={b.r * 0.86} ry={b.r} />
        <ellipse cx={b.x} cy={b.y} rx={b.r * 0.86} ry={b.r} fill="url(#bd-shine)" />
        <path className="bd-knot" d={`M${b.x - 4} ${b.y + b.r + 6}h8l-4-6z`} />
        <g transform={`translate(${b.x} ${b.y + b.r + 54})`}><Prize kind={b.prize} /></g>
      </g>
      {[0, 1, 2].map(n => <g key={n} className="bd-drop" style={{ animationDelay: `${b.delay + n * 1.6}s`, ['--bd-fall' as string]: `${392 - (b.y + b.r + 54)}px` }}>
        <g transform={`translate(${b.x} ${b.y + b.r + 54})`}><Prize kind={(['cash', 'coin', 'gift'] as const)[(i + n) % 3]} /></g>
      </g>)}
    </g>)}
    <g className="bd-pile" aria-hidden="true">
      <ellipse cx="270" cy="414" rx="230" ry="20" fill="url(#bd-ground)" />
      <g transform="translate(176 396) rotate(-8)"><Prize kind="cash" /></g>
      <g transform="translate(222 400)"><Prize kind="coin" /></g>
      <g transform="translate(268 392)"><Prize kind="gift" /></g>
      <g transform="translate(314 402) rotate(10)"><Prize kind="cash" /></g>
      <g transform="translate(356 398)"><Prize kind="coin" /></g>
    </g>
  </svg>
}
