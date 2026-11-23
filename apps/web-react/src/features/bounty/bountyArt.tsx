/* Bug bounty hero: an original "security scan" drawing. A shield carrying
 * the OpenFi mark (the approved asset, geometry unchanged) sits among five
 * component nodes; a mint scan line sweeps the graph and now and then a bug
 * at a node turns into a reward coin. Decorative and labelled
 * "illustrative"; motion runs only while the hero is visible (data-live on
 * the section) and never with prefers-reduced-motion. */
type Nodes = { backend: string; wallet: string; payments: string; terminal: string; desktop: string }
const POS: [keyof Nodes, number, number][] = [
  ['backend', 210, 58], ['wallet', 368, 132], ['payments', 330, 302], ['terminal', 90, 302], ['desktop', 52, 132],
]

export function BountyHeroArt({ label, nodes }: { label: string; nodes: Nodes }) {
  const mark = `${import.meta.env.BASE_URL}assets/mark-mint.svg`
  return <svg className="bb-art" viewBox="0 0 420 360" role="img" aria-label={label}>
    <defs>
      <linearGradient id="bb-scan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#82e7bd" stopOpacity="0" />
        <stop offset=".55" stopColor="#82e7bd" stopOpacity=".28" />
        <stop offset="1" stopColor="#82e7bd" stopOpacity=".9" />
      </linearGradient>
      <clipPath id="bb-clip"><rect x="0" y="0" width="420" height="360" rx="18" /></clipPath>
    </defs>
    <rect className="bb-art-bg" x="0" y="0" width="420" height="360" rx="18" />
    <g className="bb-edges">{POS.map(([k, x, y]) => <line key={k} x1="210" y1="190" x2={x} y2={y} />)}
      {POS.map(([k, x, y], i) => { const [, x2, y2] = POS[(i + 1) % POS.length]; return <line key={k + 'r'} x1={x} y1={y} x2={x2} y2={y2} className="is-ring" /> })}</g>
    <g className="bb-shield" transform="translate(210 190)">
      <path d="M0 -62 L50 -42 V6 C50 38 28 58 0 70 C-28 58 -50 38 -50 6 V-42 Z" />
      <image href={mark} x="-21" y="-30" width="42" height="47" />
    </g>
    {POS.map(([k, x, y], i) => <g key={k} className={`bb-node n${i}`} transform={`translate(${x} ${y})`}>
      <circle r="22" />
      <text y="40" textAnchor="middle">{nodes[k]}</text>
      <g className="bb-bug"><circle r="6" /><path d="M-9 -4h4M5 -4h4M-9 4h4M5 4h4M-3 -8l-2 -3M3 -8l2 -3" /></g>
      <g className="bb-coin"><circle r="10" /><text y="4" textAnchor="middle">$</text></g>
    </g>)}
    <g clipPath="url(#bb-clip)"><rect className="bb-scanline" x="0" y="-60" width="420" height="60" fill="url(#bb-scan)" /></g>
  </svg>
}
