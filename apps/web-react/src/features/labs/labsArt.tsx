/* Labs hero art: original line-art glassware, slowly turning molecules and
   rising bubbles. Decorative only (aria-hidden). Motion lives in labs.css,
   uses transform and opacity only, and runs only while the hero is live. */
export function LabHeroArt() {
  return <svg className="lb-art" viewBox="0 0 360 240" aria-hidden="true" focusable="false">
    {/* bench */}
    <path d="M20 214h320" className="lb-bench" />
    {/* round-bottom flask */}
    <path d="M110 70v46a52 52 0 1 0 40 0V70" className="lb-glass" />
    <path d="M102 70h56" className="lb-glass" />
    <path d="M84 168a46 46 0 0 0 92 0z" className="lb-liquid" />
    {/* beaker */}
    <path d="M208 112v92a8 8 0 0 0 8 8h64a8 8 0 0 0 8-8v-92" className="lb-glass" />
    <path d="M202 112h92M220 140h12M220 160h18M220 180h12" className="lb-glass lb-thin" />
    <path d="M210 168h76v36a6 6 0 0 1-6 6h-64a6 6 0 0 1-6-6z" className="lb-liquid" />
    {/* test tube */}
    <path d="M316 92v100a10 10 0 0 1-20 0V92" className="lb-glass" />
    <path d="M298 150h16v40a8 8 0 0 1-16 0z" className="lb-liquid" />
    {/* rising bubbles */}
    {[[118, 160, 0], [132, 176, 1], [144, 156, 2], [126, 146, 3], [236, 190, 1], [254, 182, 2], [270, 194, 0], [306, 176, 3]].map(([x, y, i]) =>
      <circle key={`${x}-${y}`} cx={x} cy={y} r={i % 2 ? 3 : 4} className="lb-bubble" style={{ ['--i' as string]: i }} />)}
    {/* molecules */}
    <g className="lb-molecule" style={{ transformOrigin: '70px 52px' }}>
      <path d="M70 52l-22-14M70 52l24-10M70 52l2 26" className="lb-bond" />
      <circle cx="70" cy="52" r="7" className="lb-atom" /><circle cx="48" cy="38" r="5" className="lb-atom is-b" />
      <circle cx="94" cy="42" r="5" className="lb-atom is-b" /><circle cx="72" cy="78" r="4" className="lb-atom" />
    </g>
    <g className="lb-molecule is-slow" style={{ transformOrigin: '262px 56px' }}>
      <path d="M262 56l20 12M262 56l-18 12M262 56v-22" className="lb-bond" />
      <circle cx="262" cy="56" r="6" className="lb-atom is-b" /><circle cx="282" cy="68" r="4" className="lb-atom" />
      <circle cx="244" cy="68" r="4" className="lb-atom" /><circle cx="262" cy="34" r="5" className="lb-atom" />
    </g>
  </svg>
}

