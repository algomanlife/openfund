/* README renderer: turns the README data in docs/readme/*.json (plus
   docs/status/status.json, docs/README.md and the package manifests) into
   1. brand SVG graphics under docs/assets/readme/, and
   2. the generated Markdown blocks of README.md.
   Used by scripts/docs/check-readme.mjs (`--write` regenerates, plain run
   fails on any drift). Node built-ins only. Contract:
   docs/development/README_STRUCTURE.md. */
import fs from 'node:fs'
import path from 'node:path'
import { root, read } from './repo.mjs'
import { ICONS } from './readme-icons.mjs'

export const ASSET_DIR = 'docs/assets/readme'
const json = f => JSON.parse(read(f))
export function loadData() {
  return {
    sections: json('docs/readme/sections.json').sections,
    products: json('docs/readme/products.json').products,
    features: json('docs/readme/features.json').groups,
    regions: json('docs/readme/regions.json'),
    structure: json('docs/readme/structure.json').groups,
    stack: json('docs/readme/stack.json').layers,
    business: json('docs/readme/business.json'),
    roadmap: json('docs/readme/roadmap.json').phases,
    status: json('docs/status/status.json'),
  }
}

/* ---------- brand palette (docs/design/DESIGN_SYSTEM.md) ---------- */
const C = { bg: '#060808', panel: '#0c1412', panel2: '#0f1c18', border: '#1f3029', mint: '#82e7bd', lime: '#c6ff52', text: '#e6f3ec', muted: '#93aaa0', dim: '#5d7369', amber: '#f2c46d' }
const FONT = 'Ubuntu,Segoe UI,Helvetica,Arial,sans-serif'
const MONO = 'Ubuntu Mono,SFMono-Regular,Menlo,Consolas,monospace'
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const svg = (w, h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title><g font-family="${FONT}">${body}</g></svg>\n`
const text = (x, y, s, { size = 16, fill = C.text, weight = 400, anchor = 'start', family } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}"${family ? ` font-family="${family}"` : ''}>${esc(s)}</text>`
/** Greedy word wrap by an approximate glyph width (Ubuntu ≈ 0.53 em). */
export function wrap(s, size, width) {
  const max = Math.max(4, Math.floor(width / (size * 0.53)))
  const lines = []; let line = ''
  for (const word of String(s).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word } else line = (line + ' ' + word).trim()
  }
  if (line) lines.push(line)
  return lines
}
const glyph = (name, x, y, size, stroke = C.mint, width = 1.7) => {
  if (!ICONS[name]) throw new Error(`unknown icon "${name}" (scripts/docs/lib/readme-icons.mjs)`)
  return `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`
}
const tile = (name, x, y, size) => `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.24}" fill="${C.panel2}" stroke="#2b4a3f"/>` + glyph(name, x + size * 0.2, y + size * 0.2, size * 0.6)
const STATE = {
  running: { label: 'RUNNING', fill: '#123326', fg: C.mint },
  candidate: { label: 'CANDIDATE', fill: '#2c2a12', fg: C.lime },
  planned: { label: 'PLANNED', fill: '#1a2220', fg: C.muted },
  dormant: { label: 'DORMANT', fill: '#1a2220', fg: C.muted },
  delivered: { label: 'DELIVERED', fill: '#123326', fg: C.mint },
  'in-progress': { label: 'IN PROGRESS', fill: '#2c2a12', fg: C.lime },
}
const pill = (x, y, label, st, anchor = 'end') => {
  const w = label.length * 7.4 + 22, x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
  return `<rect x="${x0}" y="${y}" width="${w}" height="26" rx="13" fill="${st.fill}"/>` + text(x0 + w / 2, y + 17.5, label, { size: 12, fill: st.fg, weight: 700, anchor: 'middle' })
}

/* ---------- asset renderers ---------- */
function iconSvg(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${esc(name)}"><rect x="1" y="1" width="62" height="62" rx="15" fill="${C.panel}" stroke="#2b4a3f" stroke-width="1.5"/>${glyph(name, 14, 14, 36, C.mint, 1.8)}</svg>\n`
}

function statsSvg(d) {
  const groups = d.structure.flatMap(g => g.entries).filter(e => /^(apps|packages)\//.test(e.path)).length
  const tiles = [
    ['tag', d.status.release.latestOfficial.tag, 'Latest official release'],
    ['apps', String(d.products.length), 'Products and surfaces'],
    ['sparkles', String(d.features.length), 'Capability groups'],
    ['globe', String(d.regions.languages.length), 'Interface languages'],
    ['server', String(d.regions.regions.length), 'Operating regions'],
    ['package', String(groups), 'Apps and packages'],
  ]
  const W = 1280, pad = 24, gap = 16, tw = (W - pad * 2 - gap * (tiles.length - 1)) / tiles.length
  let body = `<rect width="${W}" height="168" rx="24" fill="${C.bg}"/>`
  tiles.forEach(([icon, value, label], i) => {
    const x = pad + i * (tw + gap)
    body += `<rect x="${x}" y="24" width="${tw}" height="120" rx="18" fill="${C.panel}" stroke="${C.border}"/>` + tile(icon, x + 18, 42, 40)
    body += text(x + 18, 116, value, { size: 34, weight: 700, fill: C.mint }) + text(x + 18, 136, label, { size: 13, fill: C.muted })
  })
  return svg(W, 168, 'Openfund at a glance', body)
}

function productSvg(p) {
  const W = 640, x = 32
  const tag = wrap(p.tagline, 17, W - 64)
  let y = 132, body = ''
  tag.forEach((l, i) => { body += text(x, y + i * 24, l, { size: 17, fill: C.muted }) })
  y += tag.length * 24 + 18
  for (const h of p.highlights) {
    body += `<circle cx="${x + 9}" cy="${y - 5}" r="9" fill="#123326"/><path d="M${x + 4.5} ${y - 5}l3 3 6-6" fill="none" stroke="${C.mint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    body += text(x + 28, y, h, { size: 16 }); y += 30
  }
  const H = y + 40
  const st = STATE[p.state]
  if (!st) throw new Error(`products.json: unknown state "${p.state}" for ${p.id}`)
  const head = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="24" fill="${C.panel}" stroke="${C.border}" stroke-width="1.5"/>` + tile(p.icon, x, 30, 64)
    + text(x + 84, 62, p.name, { size: 27, weight: 700 }) + text(x + 84, 88, p.stateNote, { size: 14, fill: C.dim })
    + pill(W - 32, 34, st.label, st)
  const foot = `<line x1="${x}" y1="${H - 44}" x2="${W - 32}" y2="${H - 44}" stroke="${C.border}"/>` + text(x, H - 18, '→ ' + p.where, { size: 14, fill: C.mint, family: MONO })
  return svg(W, H, `${p.name}: ${p.tagline}`, head + body + foot)
}

function lifecycleSvg(b) {
  const W = 1280, n = b.lifecycle.length, pad = 24, arrow = 44, cw = (W - pad * 2 - arrow * (n - 1)) / n, H = 236
  let body = `<rect width="${W}" height="${H}" rx="24" fill="${C.bg}"/>`
  b.lifecycle.forEach((s, i) => {
    const x = pad + i * (cw + arrow)
    body += `<rect x="${x}" y="24" width="${cw}" height="${H - 48}" rx="18" fill="${C.panel}" stroke="${C.border}"/>` + tile(s.icon, x + 18, 42, 44)
    body += text(x + cw - 18, 70, String(i + 1).padStart(2, '0'), { size: 22, weight: 700, fill: C.dim, anchor: 'end' })
    body += text(x + 18, 118, s.title, { size: 18, weight: 700 })
    wrap(s.text, 14, cw - 36).forEach((l, j) => { body += text(x + 18, 146 + j * 20, l, { size: 14, fill: C.muted }) })
    if (i < n - 1) { const ax = x + cw + 8; body += `<path d="M${ax} ${H / 2}h${arrow - 16}m-7 -7 7 7-7 7" fill="none" stroke="${C.mint}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` }
  })
  return svg(W, H, 'Challenge lifecycle: ' + b.lifecycle.map(s => s.title).join(', '), body)
}

function regionsSvg(r) {
  const W = 1280, H = 72 + Math.max(r.languages.length * 56, r.regions.length * 148 - 16) + 24
  let body = `<rect width="${W}" height="${H}" rx="24" fill="${C.bg}"/>`
  body += text(32, 50, 'Interface languages', { size: 20, weight: 700 }) + text(700, 50, 'Operating regions', { size: 20, weight: 700 })
  r.languages.forEach((l, i) => {
    const y = 72 + i * 56
    body += `<rect x="24" y="${y}" width="632" height="46" rx="12" fill="${C.panel}" stroke="${C.border}"/>`
    body += `<rect x="36" y="${y + 9}" width="64" height="28" rx="8" fill="#123326"/>` + text(68, y + 28, l.code, { size: 14, weight: 700, fill: C.mint, anchor: 'middle', family: MONO })
    body += text(116, y + 29, l.name, { size: 17 }) + pill(420, y + 10, l.dir, l.dir === 'RTL' ? STATE.candidate : STATE.planned, 'start')
    body += text(640, y + 29, 'default: ' + l.default, { size: 13, fill: C.muted, anchor: 'end' })
  })
  const rh = 132
  r.regions.forEach((g, i) => {
    const y = 72 + i * (rh + 16)
    body += `<rect x="684" y="${y}" width="572" height="${rh}" rx="18" fill="${C.panel}" stroke="${C.border}"/>` + tile('server', 704, y + 20, 48)
    body += text(768, y + 44, g.name, { size: 22, weight: 700 }) + text(768, y + 64, g.provider, { size: 14, fill: C.muted })
    body += text(1236, y + 46, g.domain, { size: 20, fill: C.mint, family: MONO, weight: 700, anchor: 'end' }) + text(1236, y + 66, 'aliases: ' + g.aliases.join(', '), { size: 13, fill: C.dim, anchor: 'end' })
    body += `<line x1="704" y1="${y + 86}" x2="1236" y2="${y + 86}" stroke="${C.border}"/>` + text(704, y + 112, wrap(g.note, 14, 530)[0], { size: 14, fill: C.muted })
  })
  return svg(W, H, 'Languages and regions', body)
}

function structureSvg(groups) {
  const W = 1280, colW = 600, gx = [24, 656], head = 52, row = 48
  const heights = groups.map(g => head + g.entries.length * row + 16)
  const cols = [[], []], colH = [0, 0]
  groups.forEach((g, i) => { const c = colH[0] <= colH[1] ? 0 : 1; cols[c].push(g); colH[c] += heights[i] + 16 })
  const H = Math.max(...colH) + 64
  let body = `<rect width="${W}" height="${H}" rx="24" fill="${C.bg}"/>` + text(32, 44, 'openfund/', { size: 20, weight: 700, fill: C.mint, family: MONO })
  cols.forEach((list, c) => {
    let y = 64
    for (const g of list) {
      const h = head + g.entries.length * row + 16, x = gx[c]
      body += `<rect x="${x}" y="${y}" width="${colW}" height="${h}" rx="18" fill="${C.panel}" stroke="${C.border}"/>` + tile(g.icon, x + 16, y + 12, 32)
      body += text(x + 60, y + 34, g.title, { size: 18, weight: 700 })
      g.entries.forEach((e, i) => {
        const ey = y + head + i * row
        body += `<path d="M${x + 32} ${ey - 4}v${i === g.entries.length - 1 ? 22 : row}M${x + 32} ${ey + 18}h14" fill="none" stroke="${C.dim}" stroke-width="1.4"/>`
        body += text(x + 54, ey + 14, e.path, { size: 15, weight: 700, fill: C.mint, family: MONO })
        body += text(x + 54, ey + 34, wrap(e.role, 13, colW - 80)[0], { size: 13, fill: C.muted })
      })
      y += h + 16
    }
  })
  return svg(W, H, 'Repository structure', body)
}

function roadmapSvg(phases) {
  const W = 1280, H = 300, pad = 40, step = (W - pad * 2) / phases.length, cy = 92
  let body = `<rect width="${W}" height="${H}" rx="24" fill="${C.bg}"/>` + text(32, 44, 'Seven development phases', { size: 20, weight: 700 })
  body += `<line x1="${pad + step / 2}" y1="${cy}" x2="${W - pad - step / 2}" y2="${cy}" stroke="${C.border}" stroke-width="4" stroke-linecap="round"/>`
  phases.forEach((p, i) => {
    const x = pad + step * i + step / 2, st = STATE[p.state]
    if (!st) throw new Error(`roadmap.json: unknown state "${p.state}"`)
    if (i < phases.length - 1 && p.state !== 'planned') body += `<line x1="${x}" y1="${cy}" x2="${x + step}" y2="${cy}" stroke="${p.state === 'delivered' ? C.mint : C.lime}" stroke-width="4" stroke-linecap="round" opacity="${p.state === 'delivered' ? 1 : 0.5}"/>`
    body += `<circle cx="${x}" cy="${cy}" r="20" fill="${p.state === 'planned' ? C.panel : st.fill}" stroke="${st.fg}" stroke-width="2.5"/>` + text(x, cy + 6, p.n, { size: 15, weight: 700, fill: st.fg, anchor: 'middle' })
    wrap(p.title, 16, step - 16).forEach((l, j) => { body += text(x, 150 + j * 21, l, { size: 16, weight: 700, anchor: 'middle' }) })
    wrap(p.note, 13, step - 20).slice(0, 4).forEach((l, j) => { body += text(x, 200 + j * 18, l, { size: 13, fill: C.muted, anchor: 'middle' }) })
    body += pill(x, 256, st.label, st, 'middle')
  })
  return svg(W, H, 'Roadmap: ' + phases.map(p => `${p.n} ${p.title} (${p.state})`).join(', '), body)
}

/** Every generated SVG, keyed by repository path. */
export function renderAssets(d = loadData()) {
  const out = new Map()
  const icons = new Set([...d.sections.map(s => s.icon), ...d.products.map(p => p.icon), ...d.features.map(f => f.icon), ...d.structure.map(g => g.icon), ...docsAreas().map(a => a.icon)])
  for (const name of [...icons].sort()) out.set(`${ASSET_DIR}/icons/${name}.svg`, iconSvg(name))
  out.set(`${ASSET_DIR}/stats.svg`, statsSvg(d))
  for (const p of d.products) out.set(`${ASSET_DIR}/products/${p.id}.svg`, productSvg(p))
  out.set(`${ASSET_DIR}/lifecycle.svg`, lifecycleSvg(d.business))
  out.set(`${ASSET_DIR}/regions.svg`, regionsSvg(d.regions))
  out.set(`${ASSET_DIR}/structure.svg`, structureSvg(d.structure))
  out.set(`${ASSET_DIR}/roadmap.svg`, roadmapSvg(d.roadmap))
  return out
}

/* ---------- Markdown blocks ---------- */
const icon = (name, size = 22) => `<img src="${ASSET_DIR}/icons/${name}.svg" width="${size}" height="${size}" alt="${name} icon" />`
export const headingLine = s => `## ${icon(s.icon, 30)} ${s.title}`
export const anchorLine = s => `<a name="${s.id}"></a>`
const block = (name, lines) => [`<!-- ${name} -->`, '', ...lines, '', `<!-- /${name} -->`].join('\n')

function versionOf(spec) {
  const [file, key] = spec.split(':')
  const pkg = JSON.parse(read(file))
  const v = key.startsWith('engines.') ? pkg.engines?.[key.slice(8)] : (pkg.dependencies?.[key] ?? pkg.devDependencies?.[key])
  if (!v) throw new Error(`stack.json: ${spec} is not declared`)
  return v.replace(/^[\^~>=<\s]+/, '')
}
const shield = s => encodeURIComponent(String(s).replace(/-/g, '--').replace(/_/g, '__'))

/** Areas of docs/README.md (each `##` except the canonical-sources table). */
const AREA_ICONS = [[/product|business/i, 'apps'], [/architecture/i, 'topology'], [/website/i, 'browser'], [/trading/i, 'candles'], [/governance|economy|partner/i, 'coins'],
  [/wallet|identity/i, 'wallet'], [/payment/i, 'bolt'], [/protocol/i, 'package'], [/integration/i, 'link'], [/deploy/i, 'server'], [/develop/i, 'terminal'],
  [/security/i, 'shield'], [/legal/i, 'scale'], [/roadmap/i, 'route'], [/decision/i, 'notebook'], [/brand|evidence/i, 'brush'], [/histor/i, 'archive']]
const slug = s => s.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/ /g, '-')
export function docsAreas() {
  const text = read('docs/README.md')
  const areas = []
  for (const m of text.matchAll(/^## (.+)\n+([\s\S]*?)(?=^## |(?![\s\S]))/gm)) {
    const title = m[1].trim()
    if (/canonical sources/i.test(title)) continue
    const links = [...m[2].matchAll(/\[([^\]]+)\]\(([^)\s#]+)(#[^)]*)?\)/g)].filter(l => !/^[a-z]+:/i.test(l[2]))
      .map(l => ({ label: l[1].replace(/`/g, ''), href: path.posix.normalize(path.posix.join('docs', l[2])) + (l[3] || '') }))
    areas.push({ title, anchor: slug(title), icon: (AREA_ICONS.find(([re]) => re.test(title)) || [, 'book'])[1], links })
  }
  return areas
}

export function renderBlocks(d = loadData()) {
  const b = {}
  const toc = d.sections.map(s => `<a href="#${s.id}">${icon(s.icon, 18)}&nbsp;${s.title}</a>`)
  const rows = []; for (let i = 0; i < toc.length; i += 3) rows.push('<tr>' + toc.slice(i, i + 3).map(c => `<td>${c}</td>`).join('') + '</tr>')
  b.toc = block('toc', ['<table>', ...rows, '</table>'])
  b.stats = block('stats', [`<img src="${ASSET_DIR}/stats.svg" width="100%" alt="Openfund at a glance: latest release, products, capability groups, languages, regions, apps and packages" />`])

  const cards = d.products.map(p => `<a href="${p.href}"><img src="${ASSET_DIR}/products/${p.id}.svg" width="49%" alt="${esc(p.name)} — ${esc(p.tagline)}" /></a>`)
  b.products = block('products', ['<p align="center">', `<img src="docs/assets/graphics/ecosystem.svg" width="100%" alt="Openfund ecosystem: discovery and identity, Prop and Perpetual products, shared terminal and planned Protocol" />`, '</p>', '', '<p align="center">', ...cards, '</p>'])

  const cell = g => `<td width="50%" valign="top">${icon(g.icon, 26)}&nbsp;<b><a href="${g.href}">${g.title}</a></b><ul>${g.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></td>`
  const frows = []; for (let i = 0; i < d.features.length; i += 2) frows.push('<tr>' + d.features.slice(i, i + 2).map(cell).join('') + '</tr>')
  b.features = block('features', ['<table>', ...frows, '</table>'])

  b.regions = block('regions', [`<img src="${ASSET_DIR}/regions.svg" width="100%" alt="Five interface languages and two operating regions" />`, '', '**Which language a visitor sees**', '', ...d.regions.rules.map((r, i) => `${i + 1}. ${r}`)])

  b.business = block('business', [`<img src="${ASSET_DIR}/lifecycle.svg" width="100%" alt="Challenge lifecycle: ${d.business.lifecycle.map(s => s.title).join(', ')}" />`, '',
    '| Revenue | Costs |', '| --- | --- |', ...Array.from({ length: Math.max(d.business.revenue.length, d.business.costs.length) }, (_, i) => `| ${d.business.revenue[i] ?? ''} | ${d.business.costs[i] ?? ''} |`)])

  const all = d.structure.flatMap(g => g.entries.map(e => `| ${icon(g.icon, 18)} | \`${e.path}\` | ${e.role} |`))
  b.structure = block('structure', [`<img src="${ASSET_DIR}/structure.svg" width="100%" alt="Repository structure by group: applications, packages, content and assets, delivery and tooling, upstream" />`, '',
    '<details>', '<summary>Repository map as a table</summary>', '', '| | Path | Responsibility |', '| --- | --- | --- |', ...all, '', '</details>'])

  const srows = d.stack.map(l => `| **${l.layer}** | ${l.items.map(it => {
    const v = it.from ? versionOf(it.from) : it.version
    return `<img src="https://img.shields.io/badge/${shield(it.name)}-${shield(v)}-${it.color}?style=for-the-badge&logo=${it.logo}&logoColor=white&labelColor=0c1412" alt="${esc(it.name)} ${esc(v)}" />`
  }).join(' ')} |`)
  b.stack = block('stack', ['<p align="center">', `<img src="docs/assets/graphics/technology.svg" width="100%" alt="Openfund technology layers" />`, '</p>', '', '| Layer | Technology |', '| --- | --- |', ...srows, '', 'Versions are read from the package manifests when the README is generated.'])

  b.roadmap = block('roadmap', [`<img src="${ASSET_DIR}/roadmap.svg" width="100%" alt="Roadmap phases and their states" />`, '',
    '| Phase | State | Scope |', '| --- | --- | --- |', ...d.roadmap.map(p => `| ${p.n} ${p.title} | ${STATE[p.state].label.toLowerCase()} | ${p.note} |`)])

  const areas = docsAreas()
  b['docs-map'] = block('docs-map', ['| | Area | Start with |', '| --- | --- | --- |',
    ...areas.map(a => `| ${icon(a.icon, 20)} | [${a.title}](docs/README.md#${a.anchor}) | ${a.links.slice(0, 3).map(l => `[${l.label}](${l.href})`).join(' · ')}${a.links.length > 3 ? ` · +${a.links.length - 3} more` : ''} |`)])
  return b
}

/** Write (or compare) the generated SVGs. Returns the paths that differ. */
export function syncAssets(write) {
  const want = renderAssets(), stale = []
  for (const [file, content] of want) {
    const abs = path.join(root, file)
    if (!fs.existsSync(abs) || fs.readFileSync(abs, 'utf8') !== content) { stale.push(file); if (write) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, content) } }
  }
  const dir = path.join(root, ASSET_DIR)
  const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : []
  for (const abs of walk(dir)) {
    const rel = path.relative(root, abs).split(path.sep).join('/')
    if (!want.has(rel)) { stale.push(rel + ' (orphan)'); if (write) fs.rmSync(abs) }
  }
  return stale
}
