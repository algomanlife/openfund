/* Premium League neon prize wall (owner fix 4). Original SVG and CSS only, in
 * a night-city mood: a generic standing console with a neon halo and a floor
 * reflection, a generic controller whose round buttons light in sequence, a
 * football with a looping shot trail, a skyline with flickering signs and a
 * car's headlights sweeping down a street, rising neon candles with a trend
 * line, and an OpenFi account card. Nothing reproduces a real product's
 * design, a game's characters, logos, typefaces or cover layout, or a
 * platform's button symbols; product names appear in text only (in the
 * prize list). Every tile is decorative (aria-hidden); the prize list and the
 * coupon carry the information. Motion is transform/opacity only and runs
 * only while the wall is on screen and the tab is visible ([data-live]);
 * reduced motion shows the signs lit and steady (tournament.css). */

/** the six tiles of the wall, in reading order (the console is the large tile) */
export const WALL_TILES = ['console', 'controller', 'football', 'city', 'trading', 'account'] as const

function Console() {
  return <svg viewBox="0 0 240 240" className="pw-art" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="pw-halo" cx="50%" cy="46%" r="50%"><stop offset="0" stopColor="#38e1ff" stopOpacity=".55" /><stop offset=".55" stopColor="#ff4fd8" stopOpacity=".22" /><stop offset="1" stopColor="#ff4fd8" stopOpacity="0" /></radialGradient>
      <linearGradient id="pw-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <mask id="pw-fade"><rect x="0" y="176" width="240" height="64" fill="url(#pw-floor)" /></mask>
    </defs>
    <ellipse className="pw-halo" cx="120" cy="104" rx="104" ry="96" fill="url(#pw-halo)" />
    {/* a plain upright box with a light bar: a generic console, no product shape */}
    <g className="pw-console">
      <rect x="92" y="40" width="56" height="136" rx="10" className="pw-console-body" />
      <rect x="99" y="48" width="4" height="120" rx="2" className="pw-neon-cyan" />
      <rect x="137" y="48" width="4" height="120" rx="2" className="pw-neon-pink" />
      <circle cx="120" cy="158" r="3" className="pw-neon-cyan" />
    </g>
    <g mask="url(#pw-fade)" transform="translate(0 352) scale(1 -1)" opacity=".5">
      <rect x="92" y="40" width="56" height="136" rx="10" className="pw-console-body" />
      <rect x="99" y="48" width="4" height="120" rx="2" className="pw-neon-cyan" />
      <rect x="137" y="48" width="4" height="120" rx="2" className="pw-neon-pink" />
    </g>
    <path d="M10 176H230" className="pw-floor-line" />
  </svg>
}
function Controller() {
  return <svg viewBox="0 0 200 120" className="pw-art" aria-hidden="true" focusable="false">
    <path d="M40 46c0-12 10-18 22-18h76c12 0 22 6 22 18 0 26-8 50-26 50-12 0-16-14-26-14H92c-10 0-14 14-26 14-18 0-26-24-26-50z" className="pw-pad" />
    <path d="M62 52h16M70 44v16" className="pw-dpad" />
    {/* four identical round buttons light one after another (no platform symbols) */}
    {[[132, 44], [146, 56], [132, 68], [118, 56]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="6" className={`pw-button b${i}`} />)}
  </svg>
}
function Football() {
  return <svg viewBox="0 0 200 120" className="pw-art" aria-hidden="true" focusable="false">
    <g className="pw-pitch"><rect x="6" y="10" width="188" height="100" rx="4" /><path d="M100 10v100" /><circle cx="100" cy="60" r="16" /><rect x="168" y="38" width="26" height="44" /></g>
    <path d="M40 92Q110 6 178 58" className="pw-trail" />
    <g className="pw-ball"><circle cx="0" cy="0" r="9" /><path d="M0-4l4 3-1.5 4.5h-5L-4-1z" /></g>
  </svg>
}
function City() {
  return <svg viewBox="0 0 200 120" className="pw-art" aria-hidden="true" focusable="false">
    <g className="pw-skyline">
      {[[0, 54, 22], [20, 34, 18], [36, 62, 26], [60, 26, 20], [78, 48, 24], [100, 20, 16], [114, 58, 26], [138, 30, 20], [156, 50, 24], [178, 38, 22]].map(([x, top, w], i) => <rect key={i} x={x} y={top} width={w} height={96 - top} />)}
    </g>
    <rect x="26" y="66" width="22" height="7" rx="2" className="pw-sign s0" /><rect x="118" y="70" width="18" height="6" rx="2" className="pw-sign s1" /><rect x="160" y="56" width="14" height="6" rx="2" className="pw-sign s2" />
    <path d="M0 96H200M0 110H200" className="pw-street" />
    {/* a car's headlights sweeping down the street */}
    <g className="pw-car"><path d="M0 103l46-9v18z" className="pw-beam" /><rect x="-14" y="99" width="14" height="7" rx="2" className="pw-carbody" /></g>
  </svg>
}
function Trading() {
  const candles = [[22, 70, 26, true], [44, 60, 30, false], [66, 54, 26, true], [88, 44, 28, true], [110, 50, 22, false], [132, 34, 30, true], [154, 22, 30, true], [176, 14, 28, true]] as const
  return <svg viewBox="0 0 200 120" className="pw-art" aria-hidden="true" focusable="false">
    <path d="M10 108H192" className="pw-axis" />
    {candles.map(([x, top, h, up], i) => <g key={i} className={`pw-candle c${i} ${up ? 'is-up' : 'is-down'}`}><path d={`M${x} ${top - 6}v${h + 12}`} /><rect x={x - 5} y={top} width="10" height={h} rx="1.5" /></g>)}
    <path d="M14 96L62 78 106 66 150 44 190 24" className="pw-trend" />
  </svg>
}
function Account({ markHref, amount }: { markHref: string; amount: string }) {
  return <svg viewBox="0 0 200 120" className="pw-art" aria-hidden="true" focusable="false">
    <rect x="16" y="14" width="168" height="92" rx="12" className="pw-card" />
    <image href={markHref} x="28" y="24" width="18" height="20" />
    <text x="52" y="39" className="pw-card-brand">OpenFi</text>
    <text x="100" y="78" textAnchor="middle" className="pw-card-amount" direction="ltr">{amount}</text>
    <rect x="28" y="88" width="56" height="4" rx="2" className="pw-neon-cyan" />
  </svg>
}

/** The wall: a neon sign over a bento grid of six tiles. */
export function PrizeWall({ sign, markHref, amount, illustrative }: { sign: string; markHref: string; amount: string; illustrative: string }) {
  return <figure className="pw-wall">
    <p className="pw-sign-board" aria-hidden="true"><span>{sign}</span></p>
    <div className="pw-grid">
      {WALL_TILES.map(tile => <div key={tile} className={`pw-tile is-${tile}`}>
        {tile === 'console' ? <Console /> : tile === 'controller' ? <Controller /> : tile === 'football' ? <Football /> : tile === 'city' ? <City /> : tile === 'trading' ? <Trading /> : <Account markHref={markHref} amount={amount} />}
      </div>)}
    </div>
    <figcaption className="tl-illustrative">{illustrative}</figcaption>
  </figure>
}

/** prize list icons (24 × 24 line glyphs, original) */
export const PRIZE_ICONS = {
  account: 'M3 7h18v12H3zM3 11h18M7 15h4',
  console: 'M9 3h6v18H9zM11 6v12',
  game: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3',
}

/** Ranks 11–100: a neon coupon with a perforated edge whose stub tears off. */
export function NeonCoupon({ value, label }: { value: string; label: string }) {
  return <div className="pw-coupon" aria-hidden="true">
    <div className="pw-coupon-main"><b dir="ltr">{value}</b><span>{label}</span></div>
    <div className="pw-coupon-stub"><i /><i /><i /></div>
  </div>
}
