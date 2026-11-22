/* Premium League artwork: original SVG only. The badges carry the unchanged
   OpenFi mark as an image; the prize scene draws a generic console, a
   generic controller and two blank game cases in a neon night city, with no
   product shapes, logos or cover art. Product names appear in text only. */

export type Metal = 'gold' | 'silver' | 'bronze' | 'platinum' | 'emerald' | 'sapphire' | 'ruby' | 'onyx' | 'pearl' | 'copper' | 'mint'
/* ten rank badges, each with its own symbol and metal tier, plus the Finisher */
export const BADGES: { id: string; rank: number | null; metal: Metal; symbol: string }[] = [
  { id: 'rank-1', rank: 1, metal: 'gold', symbol: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z' },
  { id: 'rank-2', rank: 2, metal: 'silver', symbol: 'M5 17l2-9 5 4 5-4 2 9zM5 19h14' },
  { id: 'rank-3', rank: 3, metal: 'bronze', symbol: 'M12 3l8 4v5c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V7z' },
  { id: 'rank-4', rank: 4, metal: 'platinum', symbol: 'M13 2L5 13h6l-1 9 8-11h-6z' },
  { id: 'rank-5', rank: 5, metal: 'emerald', symbol: 'M12 2l8 7-8 13-8-13zM4 9h16' },
  { id: 'rank-6', rank: 6, metal: 'sapphire', symbol: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l3 5-3 5-3-5z' },
  { id: 'rank-7', rank: 7, metal: 'ruby', symbol: 'M12 21c4-3 7-6 7-10a7 7 0 0 0-14 0c0 4 3 7 7 10zM12 7v6' },
  { id: 'rank-8', rank: 8, metal: 'onyx', symbol: 'M3 18l5-9 4 6 3-4 6 7z' },
  { id: 'rank-9', rank: 9, metal: 'pearl', symbol: 'M3 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0' },
  { id: 'rank-10', rank: 10, metal: 'copper', symbol: 'M12 3v18M3 12h18M6 6l12 12M18 6L6 18' },
  { id: 'finisher', rank: null, metal: 'mint', symbol: 'M5 12l4 4 10-10' },
]
const METAL: Record<Metal, [string, string]> = {
  gold: ['#f6d36b', '#a8781e'], silver: ['#e8eef0', '#8b989c'], bronze: ['#e3a06a', '#8c5226'], platinum: ['#d9e4ec', '#6f8796'],
  emerald: ['#7ee0b0', '#1f7a52'], sapphire: ['#8fb3ff', '#2f4fa0'], ruby: ['#f08aa0', '#9a2a44'], onyx: ['#8a9590', '#2b302e'],
  pearl: ['#f4efe6', '#b7ad9b'], copper: ['#e89a76', '#8a4a2c'], mint: ['#82e7bd', '#2f9c72'],
}

export function Badge({ badge, size = 96, markHref, title }: { badge: (typeof BADGES)[number]; size?: number; markHref: string; title?: string }) {
  const [light, dark] = METAL[badge.metal]
  const gid = `tb-${badge.id}`
  return <svg className={`tl-badge is-${badge.metal}`} width={size} height={size} viewBox="0 0 100 100" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false">
    <defs>
      <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={light} /><stop offset="1" stopColor={dark} /></linearGradient>
    </defs>
    <path d="M50 4l39 22v48L50 96 11 74V26z" fill={`url(#${gid}-g)`} />
    <path d="M50 12l32 18v40L50 88 18 70V30z" fill="#0b1210" opacity=".86" />
    <g transform={badge.rank ? "translate(32 17) scale(1.5)" : "translate(26 22) scale(2)"} fill="none" stroke={light} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={badge.symbol} /></g>
    <image href={markHref} x="43" y={badge.rank ? 72 : 68} width="14" height="15" opacity=".9" />
    {badge.rank && <text x="50" y="67" textAnchor="middle" className="tl-badge-rank" fill={light}>{badge.rank}</text>}
  </svg>
}

/* ranks 4–10: a generic console, controller and two blank cases in a neon city */
export function PrizeScene() {
  return <svg className="tl-prize-scene" viewBox="0 0 640 360" role="presentation" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="tl-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a0620" /><stop offset="1" stopColor="#140b2e" /></linearGradient>
      <linearGradient id="tl-glow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff4fd8" /><stop offset="1" stopColor="#38e1ff" /></linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#tl-sky)" />
    <g className="tl-city" fill="#1d1340">
      {[[0, 170, 60], [52, 130, 44], [92, 190, 70], [160, 110, 52], [208, 160, 64], [270, 120, 40], [306, 180, 62], [372, 100, 48], [418, 150, 70], [486, 125, 46], [528, 175, 66], [590, 140, 50]].map(([x, h, w], i) =>
        <rect key={i} x={x} y={300 - h} width={w} height={h} />)}
    </g>
    <g className="tl-windows" fill="#38e1ff" opacity=".35">
      {Array.from({ length: 26 }, (_, i) => <rect key={i} x={12 + i * 24} y={160 + ((i * 37) % 110)} width="4" height="6" />)}
    </g>
    <rect x="0" y="300" width="640" height="60" fill="#0a0620" />
    <path d="M0 300H640" stroke="url(#tl-glow)" strokeWidth="2" opacity=".8" />
    <g className="tl-float is-console">
      <rect x="250" y="150" width="140" height="96" rx="14" fill="#f2f4f8" />
      <rect x="250" y="190" width="140" height="10" fill="#c9cdd8" />
      <rect x="262" y="226" width="40" height="4" rx="2" fill="#38e1ff" />
    </g>
    <g className="tl-float is-controller">
      <path d="M168 238c0-14 12-22 26-22h52c14 0 26 8 26 22 0 18-6 34-20 34-10 0-14-10-22-10h-20c-8 0-12 10-22 10-14 0-20-16-20-34z" fill="#e9ecf2" />
      <circle cx="198" cy="240" r="7" fill="#1d1340" /><circle cx="244" cy="236" r="4" fill="#ff4fd8" /><circle cx="254" cy="246" r="4" fill="#38e1ff" />
    </g>
    <g className="tl-float is-case-a"><rect x="420" y="150" width="70" height="96" rx="6" fill="#1b2340" stroke="#38e1ff" strokeWidth="2" /><path d="M432 228l20-40 14 24 10-14 6 30z" fill="#ff4fd8" opacity=".7" /></g>
    <g className="tl-float is-case-b"><rect x="470" y="176" width="70" height="96" rx="6" fill="#241a3a" stroke="#ff4fd8" strokeWidth="2" /><circle cx="505" cy="214" r="18" fill="#38e1ff" opacity=".6" /></g>
  </svg>
}
