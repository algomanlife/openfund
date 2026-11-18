/* Squarified treemap (Bruls, Huizing & van Wijk), adapted from drkxbt/charts
   heatmap/heatmap.ts — MIT, © 2026 drk. See third_party/drkxbt-charts. */
export interface Rect { x: number; y: number; w: number; h: number }

/** `keepOrder`: lay items out in the given order (a near-sorted, stable
 *  order keeps tiles from jumping on live updates); otherwise by value. */
export function squarify<T extends { value: number }>(items: T[], rect: Rect, keepOrder = false): { item: T; rect: Rect }[] {
  const positive = items.filter(i => i.value > 0)
  if (!keepOrder) positive.sort((a, b) => b.value - a.value)
  const total = positive.reduce((s, i) => s + i.value, 0), out: { item: T; rect: Rect }[] = []
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return out
  const scale = (rect.w * rect.h) / total, free = { ...rect }
  let row: { item: T; area: number }[] = []
  const worst = (areas: number[], side: number) => {
    const sum = areas.reduce((a, b) => a + b, 0), max = Math.max(...areas), min = Math.min(...areas)
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
  }
  const place = () => {
    const sum = row.reduce((a, e) => a + e.area, 0)
    if (free.w >= free.h) {
      const width = sum / free.h; let y = free.y
      for (const e of row) { const h = e.area / width; out.push({ item: e.item, rect: { x: free.x, y, w: width, h } }); y += h }
      free.x += width; free.w -= width
    } else {
      const height = sum / free.w; let x = free.x
      for (const e of row) { const w = e.area / height; out.push({ item: e.item, rect: { x, y: free.y, w, h: height } }); x += w }
      free.y += height; free.h -= height
    }
    row = []
  }
  for (const item of positive) {
    const area = item.value * scale, side = Math.min(free.w, free.h), areas = row.map(e => e.area)
    if (!row.length || worst([...areas, area], side) <= worst(areas, side)) row.push({ item, area })
    else { place(); row.push({ item, area }) }
  }
  if (row.length) place()
  return out
}


/** Splits items so every kept tile can carry a label: items whose
 *  proportional area in `rect` would be below `minArea` are merged into one
 *  "others" entry worth their summed value. Kept tiles keep exactly the area
 *  their value earns (the total is unchanged), so size stays proportional to
 *  the metric. When everything is tiny, the largest `minKeep` stay visible. */
export function collapseSmall<T extends { value: number }>(items: T[], rect: Rect, minArea: number, minKeep = 1): { kept: T[]; others: T[]; othersValue: number } {
  const positive = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value)
  const total = positive.reduce((s, i) => s + i.value, 0), area = Math.max(0, rect.w) * Math.max(0, rect.h)
  if (!total || !area) return { kept: [], others: [], othersValue: 0 }
  const scale = area / total
  let kept = positive.filter(i => i.value * scale >= minArea)
  if (kept.length < minKeep) kept = positive.slice(0, Math.min(minKeep, positive.length))
  const keptSet = new Set(kept), others = positive.filter(i => !keptSet.has(i))
  return { kept, others, othersValue: others.reduce((s, i) => s + i.value, 0) }
}

/** Keeps the previous order across live updates unless an item clearly
 *  outgrows the one before it (by `margin`), so tiles do not jump on every
 *  refresh. New items join in value order. */
export function stableOrder<T>(items: T[], key: (t: T) => string, value: (t: T) => number, previous: string[] | null, margin = 0.2): T[] {
  const byValue = [...items].sort((a, b) => value(b) - value(a))
  if (!previous?.length) return byValue
  const rank = new Map(previous.map((k, i) => [k, i]))
  const known = items.filter(i => rank.has(key(i))).sort((a, b) => rank.get(key(a))! - rank.get(key(b))!)
  /* one bubble pass with hysteresis: swap only on a clear lead */
  for (let i = 1; i < known.length; i++) {
    let j = i
    while (j > 0 && value(known[j]) > value(known[j - 1]) * (1 + margin)) { [known[j - 1], known[j]] = [known[j], known[j - 1]]; j-- }
  }
  /* new items are inserted where their value belongs */
  for (const item of byValue.filter(i => !rank.has(key(i)))) {
    const at = known.findIndex(k => value(k) < value(item))
    known.splice(at === -1 ? known.length : at, 0, item)
  }
  return known
}

/** Diverging colour weight in [-1, 1] for a value on a symmetric ±range scale. */
export const colourWeight = (v: number | null | undefined, range: number) =>
  v == null || !Number.isFinite(v) || range <= 0 ? null : Math.max(-1, Math.min(1, v / range))
