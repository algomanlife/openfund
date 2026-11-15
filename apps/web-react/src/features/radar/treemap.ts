/* Squarified treemap (Bruls, Huizing & van Wijk), adapted from drkxbt/charts
   heatmap/heatmap.ts — MIT, © 2026 drk. See third_party/drkxbt-charts. */
export interface Rect { x: number; y: number; w: number; h: number }

export function squarify<T extends { value: number }>(items: T[], rect: Rect): { item: T; rect: Rect }[] {
  const positive = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value)
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

