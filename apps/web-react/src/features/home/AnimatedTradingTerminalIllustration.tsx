/** Fictional decorative terminal: never connected to quotes or order APIs. */
export default function AnimatedTradingTerminalIllustration() {
  return <svg className="landing-terminal" viewBox="0 0 520 320" aria-hidden="true">
    <path d="m70 260 190 34 190-34-190-32Z" fill="#82e7bd" opacity=".035" />
    <path d="M230 230v34l-67 13h194l-67-13v-34" fill="#10231c" stroke="#395d4c" />
    <rect x="45" y="30" width="430" height="214" rx="12" fill="#0e1c17" stroke="#476d5b" />
    <rect x="56" y="41" width="408" height="191" rx="6" fill="#07100d" />
    <circle className="terminal-pulse" cx="451" cy="58" r="3" fill="#82e7bd" />
    <g stroke="#82e7bd" opacity=".09"><path d="M70 96h271M70 129h271M70 162h271M70 195h271M114 77v134M158 77v134M202 77v134M246 77v134M290 77v134" /></g>
    <g>{[158,141,151,123,131,103,113,95,112,126,115,101,110,92].map((y,i) => <g key={i} className="terminal-candle" style={{ animationDelay: `${i * .12}s` }}>
      <path d={`M${82+i*18} ${y-13}v44`} stroke={i%3===1 ? '#b59888' : '#82e7bd'} />
      <rect x={78+i*18} y={y} width="8" height={i%3===1 ? 18 : 23} rx="1" fill={i%3===1 ? '#8f766b' : '#558d72'} />
    </g>)}</g>
    <path className="terminal-price" d="m76 182 20-12 19 5 18-23 20 9 20-27 19 10 19-16 19 20 19 7 18-11 18-16 19 6 18-17" fill="none" stroke="#b3f0cf" strokeWidth="1.5" pathLength="1" />
    <g fill="#14251d" stroke="#294b3b"><rect x="357" y="79" width="92" height="38" rx="4" /><rect x="357" y="126" width="92" height="24" rx="4" /><rect x="357" y="158" width="92" height="24" rx="4" /></g>
    <g stroke="#668b77" strokeWidth="3" strokeLinecap="round"><path d="M367 90h35m-35 9h61m-61 9h23M367 202h26m12 0h34M367 214h38m13 0h21" /></g>
    <path d="M71 217h264" stroke="#294336" /><path d="m71 217 20-4 17 2 20-5 22 4 18-1 18 3 15-5 24 3 19-3 24 2 20-3 24 5 23-2" fill="none" stroke="#668b77" />
    <g className="terminal-widget"><rect x="17" y="184" width="99" height="51" rx="6" fill="#10231c" stroke="#395d4c" /><path d="m28 220 12-10 11 4 12-16 12 8 14-10 15 5" fill="none" stroke="#82e7bd" /><circle cx="30" cy="196" r="2" fill="#82e7bd" /></g>
  </svg>
}
