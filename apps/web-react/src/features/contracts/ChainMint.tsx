/* Smart contracts hero: a certificate seal sends records down into a moving
   chain of blocks, and the trade ledger below fills row by row. Original SVG;
   CSS motion only, stopped under reduced motion. */
const BLOCKS = [0, 1, 2, 3, 4, 5, 6, 7]
const SPACING = 86
const ROWS = [0, 1, 2, 3]

export default function ChainMint({ label, ledger }: { label: string; ledger: string }) {
  return <svg className="cm-scene" viewBox="0 0 540 430" role="img" aria-label={label}>
    <defs>
      <linearGradient id="cm-fade" x1="0" x2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".14" stopColor="#fff" stopOpacity="1" />
        <stop offset=".86" stopColor="#fff" stopOpacity="1" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id="cm-track-mask"><rect x="0" y="160" width="540" height="130" fill="url(#cm-fade)" /></mask>
      <radialGradient id="cm-glow"><stop offset="0" stopColor="currentColor" stopOpacity=".45" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></radialGradient>
    </defs>
    {/* seal */}
    <g className="cm-seal">
      <circle className="cm-halo" cx="270" cy="78" r="70" fill="url(#cm-glow)" />
      <path className="cm-ribbon" d="M248 112l-12 40 18-9 10 16 8-42M292 112l12 40-18-9-10 16-8-42" />
      <path className="cm-hex" d="M270 28l43 25v50l-43 25-43-25V53z" />
      <path className="cm-hex-inner" d="M270 40l33 19v38l-33 19-33-19V59z" />
      <path className="cm-check" d="M255 79l10 10 20-22" />
    </g>
    {/* records travelling down into the minting slot */}
    <path className="cm-beam" d="M270 134V196" />
    {[0, 1, 2].map(i => <circle key={i} className="cm-packet" cx="270" cy="134" r="4" style={{ animationDelay: `${i * 0.8}s` }} />)}
    {/* chain */}
    <g mask="url(#cm-track-mask)">
      <path className="cm-rail" d="M0 262H540" />
      <g className="cm-track">
        {BLOCKS.map(i => {
          const x = 6 + i * SPACING
          return <g key={i} className="cm-block" transform={`translate(${x} 206)`}>
            <path className="cm-link" d={`M58 34h${SPACING - 58}`} />
            <path className="cm-top" d="M0 12l12-12h46l-12 12z" />
            <path className="cm-side" d="M46 12l12-12v46l-12 12z" />
            <rect className="cm-front" x="0" y="12" width="46" height="46" rx="3" />
            <path className="cm-hash" d="M8 26h30M8 34h22M8 42h26" />
          </g>
        })}
      </g>
    </g>
    <rect className="cm-slot" x="244" y="200" width="66" height="70" rx="8" />
    {/* ledger */}
    <g className="cm-ledger">
      <rect className="cm-panel" x="60" y="306" width="420" height="112" rx="14" />
      <text className="cm-ledger-title" x="80" y="330" style={{ direction: 'ltr' }}>{ledger}</text>
      {ROWS.map(i => <g key={i} className="cm-row" style={{ animationDelay: `${i * 0.9}s` }} transform={`translate(80 ${346 + i * 17})`}>
        <circle className={i % 2 ? 'cm-dot is-close' : 'cm-dot is-open'} cx="4" cy="0" r="4" />
        <rect className="cm-bar" x="16" y="-4" width={150 - i * 18} height="8" rx="4" />
        <rect className="cm-bar is-faint" x={190} y="-4" width={90 + (i % 2) * 40} height="8" rx="4" />
        <rect className="cm-bar is-value" x={326} y="-4" width="48" height="8" rx="4" />
      </g>)}
    </g>
  </svg>
}
