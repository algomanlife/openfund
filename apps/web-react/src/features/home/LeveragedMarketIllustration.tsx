/** Original decorative leveraged-market study. No quotes or execution data. */
export default function LeveragedMarketIllustration() {
  return <svg className="leveraged-market" viewBox="0 0 520 320" aria-hidden="true">
    <defs>
      <linearGradient id="perpetual-surface" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#14291f" /><stop offset="1" stopColor="#0a1510" />
      </linearGradient>
    </defs>
    <ellipse cx="260" cy="268" rx="195" ry="21" fill="#82e7bd" opacity=".025" />
    <ellipse cx="258" cy="174" rx="212" ry="101" fill="none" stroke="#82e7bd" strokeOpacity=".08" strokeDasharray="3 8" />
    <path d="M44 132 113 101M394 235l64 17M414 79l40-31" stroke="#82e7bd" strokeOpacity=".24" strokeDasharray="3 5" />

    <g transform="translate(62 58)">
      <g transform="rotate(-5 165 90)">
        <rect x="0" y="8" width="322" height="195" rx="11" fill="#08110d" stroke="#294b3b" />
        <rect width="322" height="195" rx="11" fill="url(#perpetual-surface)" stroke="#476d5b" />
        <rect x="10" y="10" width="302" height="174" rx="5" fill="#07100d" />
        <path d="M12 37h298" stroke="#294336" />
        <circle className="terminal-pulse" cx="297" cy="24" r="3" fill="#82e7bd" />
        <g stroke="#82e7bd" strokeOpacity=".09">
          <path d="M22 65h208M22 93h208M22 121h208M22 149h208M61 47v103M102 47v103M143 47v103M184 47v103M225 47v103" />
        </g>
        {[94,83,98,87,67,75,84,65,72,57,65].map((y,index) => <g key={index} className="terminal-candle" style={{animationDelay:`${index * .15}s`}}>
          <path d={`M${32+index*18} ${y-10}v37`} stroke={index%3===2?'#b59888':'#82e7bd'} />
          <rect x={28+index*18} y={y} width="8" height={index%3===2?18:22} rx="1" fill={index%3===2?'#8f766b':'#558d72'} />
        </g>)}
        <path className="terminal-price" d="m26 127 19-9 18 6 18-13 19-17 18 7 18 9 18-21 18 5 18-17 19 9" stroke="#b3f0cf" strokeWidth="1.5" fill="none" pathLength="1" />
        <path d="M243 48v112" stroke="#294336" />
        <g stroke="#56846d" strokeWidth="4" strokeLinecap="round">
          <path d="M255 56h41M255 68h27M255 80h34M255 92h20" />
        </g>
        <g stroke="#8f766b" strokeWidth="4" strokeLinecap="round" opacity=".7">
          <path d="M255 112h22M255 124h36M255 136h28M255 148h41" />
        </g>
        <path d="M253 169h43" stroke="#82e7bd" strokeOpacity=".3" />
      </g>
    </g>

    <g className="terminal-widget">
      <rect x="350" y="94" width="109" height="153" rx="9" fill="#10231c" stroke="#476d5b" />
      <path d="M360 124h89" stroke="#395d4c" />
      <path d="M374 179a30 30 0 1 1 60 0" fill="none" stroke="#294b3b" strokeWidth="5" strokeLinecap="round" />
      <path d="M374 179a30 30 0 0 1 40-28" fill="none" stroke="#82e7bd" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" />
      <path d="m395 172 18 13m-1-14-16 14" stroke="#d4ecdf" strokeWidth="2" strokeLinecap="round" />
      <path d="M364 202h80" stroke="#294b3b" strokeWidth="3" strokeLinecap="round" />
      <path d="M364 202h31" stroke="#82e7bd" strokeWidth="3" strokeLinecap="round" />
    </g>

    <g className="terminal-pulse">
      <path d="m44 103 25 14v29l-25 14-25-14v-29Z" fill="#10231c" stroke="#476d5b" />
      <image href={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} x="32" y="115" width="24" height="31" />
      <circle cx="456" cy="47" r="14" fill="#10231c" stroke="#476d5b" />
      <path d="m456 38 6 9-6 4-6-4Z m-6 12 6 7 6-7-6 3Z" fill="#82e7bd" opacity=".7" />
      <circle cx="459" cy="253" r="10" fill="#10231c" stroke="#476d5b" />
      <path d="M455 253h8m-4-4v8" stroke="#82e7bd" />
    </g>
  </svg>
}
