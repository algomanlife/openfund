/**
 * Seasonal header logo (owner-approved designs, 2026-11-11).
 *
 * - Yalda: 28 Azar through the end of 1 Dey (inclusive), by the Iranian
 *   civil date in Asia/Tehran (Jalali calendar from the built-in Intl
 *   Persian calendar, no dependency).
 * - Christmas / New Year: 25-31 December (inclusive), by the visitor's own
 *   local date.
 *
 * Only the header/navigation logo is decorated (website header and the
 * trading terminal header). The master logo file is never changed: the
 * decoration is a separate layer (a pseudo-element of the brand link,
 * styled in seasonal-logo.css) aligned to the measured logo box, so no
 * React-managed node is moved and nothing else on the page shifts. Outside
 * the date ranges the attribute is removed and the normal logo shows; the
 * season is re-evaluated periodically, so a long-open tab reverts by itself.
 */
export type Season = 'yalda' | 'christmas'

const HEADER_LOGOS = '.openfund-header .brand > img, .of-terminal-header .of-brand > img'
const RECHECK_MS = 10 * 60_000

type Ymd = { year: number; month: number; day: number }
function partsOf(date: Date, locale: string, timeZone?: string): Ymd {
  const out: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)) out[p.type] = p.value
  return { year: Number(out.year), month: Number(out.month), day: Number(out.day) }
}
/** Jalali (Solar Hijri) date of an instant in Tehran. */
export const jalaliInTehran = (date: Date): Ymd => partsOf(date, 'en-US-u-ca-persian-nu-latn', 'Asia/Tehran')
/** Gregorian date of an instant in a time zone (undefined = the visitor's). */
export const gregorianIn = (date: Date, timeZone?: string): Ymd => partsOf(date, 'en-US-u-ca-gregory-nu-latn', timeZone)

/** The season shown at `date`, or null for the normal logo. */
export function seasonFor(date: Date = new Date(), localTimeZone?: string): Season | null {
  try {
    const j = jalaliInTehran(date)
    if ((j.month === 9 && j.day >= 28) || (j.month === 10 && j.day === 1)) return 'yalda'
    const g = gregorianIn(date, localTimeZone)
    if (g.month === 12 && g.day >= 25) return 'christmas'
  } catch { /* no Intl calendar support: always the normal logo */ }
  return null
}

/** Decorate (or restore) every header logo in `root` for `season`. */
export function applySeasonalLogo(season: Season | null, root: ParentNode = document) {
  root.querySelectorAll<HTMLImageElement>(HEADER_LOGOS).forEach(img => {
    const link = img.parentElement
    if (!link) return
    if (!season) {
      if (link.dataset.ofSeason) { delete link.dataset.ofSeason; for (const k of ['--sl-x', '--sl-y', '--sl-w', '--sl-h']) link.style.removeProperty(k) }
      return
    }
    const lr = link.getBoundingClientRect(), ir = img.getBoundingClientRect()
    if (!ir.width || !ir.height) return               /* hidden at this breakpoint */
    link.style.setProperty('--sl-x', `${(ir.left - lr.left - link.clientLeft).toFixed(2)}px`)
    link.style.setProperty('--sl-y', `${(ir.top - lr.top - link.clientTop).toFixed(2)}px`)
    link.style.setProperty('--sl-w', `${ir.width.toFixed(2)}px`)
    link.style.setProperty('--sl-h', `${ir.height.toFixed(2)}px`)
    if (link.dataset.ofSeason !== season) link.dataset.ofSeason = season
  })
}

/** Keep header logos in sync with the date for the life of the page. */
export function installSeasonalLogo(now: () => Date = () => new Date()) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}
  let season = seasonFor(now()), queued = false
  const run = () => { queued = false; applySeasonalLogo(season) }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run) } }
  const recheck = () => { season = seasonFor(now()); schedule() }
  /* headers mount, re-render and change breakpoint after boot */
  const mo = new MutationObserver(schedule)
  mo.observe(document.body, { childList: true, subtree: true })
  addEventListener('resize', schedule)
  document.fonts?.ready.then(schedule).catch(() => {})
  const timer = setInterval(recheck, RECHECK_MS)
  const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
  document.addEventListener('visibilitychange', onVisible)
  schedule()
  return () => { mo.disconnect(); clearInterval(timer); removeEventListener('resize', schedule); document.removeEventListener('visibilitychange', onVisible); applySeasonalLogo(null) }
}
