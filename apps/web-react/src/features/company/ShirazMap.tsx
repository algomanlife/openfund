import { tx, type Locale } from '../information/content'
import { locationCopy as c, SHIRAZ_LOCATION as P } from './contactContent'

/**
 * Branded location map — an original stylised SVG (no tile provider, no API
 * key, no third-party artwork). It is an illustration of the street pattern,
 * not a survey map: the precise point is provided by the external map links,
 * which open OpenStreetMap / Google Maps at the verified street-level
 * coordinates. Colours come from the theme tokens, so it follows dark/light.
 */
export default function ShirazMap({ locale }: { locale: Locale }) {
  const osm = `https://www.openstreetmap.org/?mlat=${P.lat}&mlon=${P.lon}#map=${P.zoom}/${P.lat}/${P.lon}`
  const google = `https://www.google.com/maps/search/?api=1&query=${P.lat},${P.lon}`
  /* minor streets: a deterministic grid, rotated like the district */
  const minor = Array.from({ length: 13 }, (_, i) => i)
  return <figure className="co-map">
    <svg viewBox="0 0 640 400" role="img" aria-label={tx(locale, c.mapLabel)} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="co-map-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--mint)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--mint)" stopOpacity="0" />
        </radialGradient>
        <pattern id="co-map-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".8" className="co-map-dot" />
        </pattern>
      </defs>
      <rect width="640" height="400" className="co-map-bg" />
      <rect width="640" height="400" fill="url(#co-map-dots)" />
      <g transform="rotate(-33 320 200)" className="co-map-minor">
        {minor.map(i => <line key={`h${i}`} x1="-200" x2="840" y1={-120 + i * 52} y2={-120 + i * 52} />)}
        {minor.map(i => <line key={`v${i}`} y1="-200" y2="600" x1={-100 + i * 70} x2={-100 + i * 70} />)}
      </g>
      {/* parks / blocks */}
      <path className="co-map-block" d="M70 300l70-40 46 70-70 40zM470 70l80-30 30 60-80 30z" />
      {/* Mehr Boulevard */}
      <path className="co-map-major" d="M-20 120 C 160 150, 300 196, 660 250" />
      {/* Daneshamooz Street (highlighted) */}
      <path className="co-map-focus" d="M120 420 L 330 205 L 520 -20" />
      {/* Alley 13 (approximate, dashed) */}
      <path className="co-map-alley" d="M352 182 l 54 40" />
      <circle cx="330" cy="205" r="90" fill="url(#co-map-glow)" />
      <g className="co-map-pin" transform="translate(330 205)">
        <circle r="26" className="co-map-pulse" />
        <circle r="13" className="co-map-ring" />
        <path d="M0-30c-11 0-19 8-19 19 0 14 19 31 19 31s19-17 19-31c0-11-8-19-19-19z" className="co-map-marker" transform="translate(0 -6)" />
        <text y="-18" textAnchor="middle" className="co-map-mark">OF</text>
      </g>
      <text x="400" y="110" className="co-map-label" transform="rotate(-49 400 110)">{tx(locale, c.street)}</text>
      <text x="520" y="232" className="co-map-label muted" transform="rotate(10 520 232)">{tx(locale, c.boulevard)}</text>
      <text x="24" y="380" className="co-map-city">{tx(locale, c.city)}</text>
    </svg>
    <figcaption>{tx(locale, c.credit)}</figcaption>
    <div className="co-map-actions">
      <a className="button" href={osm} target="_blank" rel="noopener noreferrer">{tx(locale, c.openOsm)} <span aria-hidden="true">↗</span></a>
      <a className="text-link" href={google} target="_blank" rel="noopener noreferrer">{tx(locale, c.openGoogle)} <span aria-hidden="true">↗</span></a>
    </div>
  </figure>
}
