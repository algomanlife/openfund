/**
 * Render a run's resource time series as standalone SVG files
 * (<runDir>/graphs/*.svg) and an embeddable JSON of downsampled series
 * (<runDir>/series.json) for the report.
 * Series: SSE target/active streams, backend CPU %, event-loop p99,
 * pg pool queue, PostgreSQL TPS + CPU %, SSE event gap p95, market-data delay p95,
 * engine loop passes/s.
 */
import fs from 'node:fs'
const RUN = process.argv[2]
const jsonl = f => { try { return fs.readFileSync(`${RUN}/${f}`, 'utf8').trim().split('\n').map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) } catch { return [] } }
const sse = jsonl('sse.jsonl'), be = jsonl('backend-metrics.jsonl'), mon = jsonl('monitor.jsonl')
const t0 = Math.min(...[sse[0]?.t, mon[0]?.t].filter(Boolean))
const series = {
  streams: { unit: 'streams', lines: { target: sse.map(r => [r.t, r.target]), active: sse.map(r => [r.t, r.active]), stalled: sse.map(r => [r.t, r.stalled]) } },
  backendCpu: { unit: '% of one core', lines: { backend: be.map(r => [r.t, r.cpuPct]), postgres: mon.map(r => [r.t, r.cpu.postgres]), generators: mon.map(r => [r.t, r.cpu.generators]) } },
  eventLoop: { unit: 'ms', lines: { 'event-loop p99': be.map(r => [r.t, r.eld.p99]) } },
  poolQueue: { unit: 'queued queries', lines: { 'pg pool waiting': be.map(r => [r.t, r.pool?.waiting ?? 0]) } },
  pgTps: { unit: 'transactions/s', lines: { tps: mon.filter(r => r.tps != null).map(r => [r.t, r.tps]) } },
  sseGap: { unit: 'ms', lines: { 'event gap p95': sse.filter(r => r.gapMs.p95 != null).map(r => [r.t, r.gapMs.p95]), 'market-data delay p95': sse.filter(r => r.mdDelayMs.p95 != null).map(r => [r.t, r.mdDelayMs.p95]) } },
  engineLoop: { unit: 'passes/s', lines: { 'engine loop': mon.filter(r => r.engineLoopPassesPs != null).map(r => [r.t, r.engineLoopPassesPs]) } },
}
/* downsample to ≤ 400 points per line (bucket mean) */
for (const s of Object.values(series)) for (const [k, pts] of Object.entries(s.lines)) {
  const step = Math.ceil(pts.length / 400) || 1, out = []
  for (let i = 0; i < pts.length; i += step) { const b = pts.slice(i, i + step); out.push([Math.round((b[0][0] - t0) / 1000), +(b.reduce((a, p) => a + p[1], 0) / b.length).toFixed(2)]) }
  s.lines[k] = out
}
fs.writeFileSync(`${RUN}/series.json`, JSON.stringify({ t0, series }))
fs.mkdirSync(`${RUN}/graphs`, { recursive: true })
const COLORS = ['#2a78d6', '#d6602a', '#1f9e6e', '#a33bb5']
for (const [name, s] of Object.entries(series)) {
  const W = 760, H = 260, L = 56, R = 12, T = 16, B = 34
  const all = Object.values(s.lines).flat()
  if (!all.length) continue
  const xmax = Math.max(...all.map(p => p[0])) || 1, ymax = (Math.max(...all.map(p => p[1])) || 1) * 1.08
  const x = v => L + (W - L - R) * v / xmax, y = v => T + (H - T - B) * (1 - v / ymax)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif" font-size="11"><rect width="${W}" height="${H}" fill="#fff"/>`
  for (let i = 0; i <= 4; i++) { const v = ymax * i / 4; svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e5e5"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" fill="#666">${v >= 100 ? Math.round(v) : v.toFixed(1)}</text>` }
  for (let i = 0; i <= 6; i++) { const v = xmax * i / 6; svg += `<text x="${x(v)}" y="${H - 14}" text-anchor="middle" fill="#666">${Math.round(v / 60)}m</text>` }
  svg += `<text x="${L}" y="${H - 2}" fill="#666">${s.unit}</text>`
  Object.entries(s.lines).forEach(([k, pts], i) => {
    if (!pts.length) return
    svg += `<polyline fill="none" stroke="${COLORS[i]}" stroke-width="1.6" points="${pts.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')}"/>`
    svg += `<rect x="${L + 10 + i * 170}" y="${T}" width="10" height="3" fill="${COLORS[i]}"/><text x="${L + 24 + i * 170}" y="${T + 5}" fill="#333">${k}</text>`
  })
  fs.writeFileSync(`${RUN}/graphs/${name}.svg`, svg + '</svg>')
}
console.log(`graphs → ${RUN}/graphs (${Object.keys(series).length})`)
