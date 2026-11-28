/* Openfund gateway: small spacecraft at the scene's own scale — deep-space
 * probes with a high-gain dish and instrument booms, satellites with solar
 * panels, a modular station, and transfer ships with a soft engine plume.
 * Generic, original procedural drawings (no real mission insignia or
 * liveries). Every craft is drawn at the origin, pointing along +x, in a
 * unit where 1 is its half-size; the caller sets the transform. */

export type CraftKind = 'probe' | 'satellite' | 'station' | 'ship'

/** sun: direction toward the light in the craft's own frame (rad) */
export function drawCraft(g: CanvasRenderingContext2D, kind: CraftKind, sun: number, thrust = 0) {
  const lx = Math.cos(sun), ly = Math.sin(sun)
  const lit = (x0: number, y0: number, r: number, light: string, dark: string) => {
    const gr = g.createLinearGradient(x0 + lx * r, y0 + ly * r, x0 - lx * r, y0 - ly * r)
    gr.addColorStop(0, light); gr.addColorStop(1, dark)
    return gr
  }
  const panel = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = lit(x + w / 2, y + h / 2, Math.max(w, h), '#7fa8e8', '#1b2c55')
    g.fillRect(x, y, w, h)
    g.strokeStyle = 'rgba(200,220,255,.35)'; g.lineWidth = .06
    g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke()
  }
  g.lineCap = 'round'
  if (kind === 'probe') {
    /* instrument boom and power unit trailing behind the dish */
    g.strokeStyle = 'rgba(210,205,190,.75)'; g.lineWidth = .07
    g.beginPath(); g.moveTo(-.1, .05); g.lineTo(-1.9, .5); g.stroke()
    g.fillStyle = lit(-1.95, .52, .2, '#bdb6a6', '#3e3a33')
    g.fillRect(-2.15, .38, .42, .28)
    /* long thin magnetometer boom */
    g.strokeStyle = 'rgba(210,205,190,.45)'; g.lineWidth = .04
    g.beginPath(); g.moveTo(-.05, -.1); g.lineTo(-1.6, -2.3); g.stroke()
    /* bus */
    g.fillStyle = lit(0, .1, .35, '#a99f8c', '#2f2b25')
    g.beginPath()
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * .34, .12 + Math.sin(a) * .26) }
    g.closePath(); g.fill()
    /* high-gain dish, seen obliquely */
    g.fillStyle = lit(.32, -.05, .9, '#fbf8f0', '#77756e')
    g.beginPath(); g.ellipse(.32, -.05, .42, .95, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(40,38,34,.35)'
    g.beginPath(); g.ellipse(.38, -.05, .26, .7, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(240,236,226,.8)'; g.lineWidth = .05
    g.beginPath(); g.moveTo(.32, -.05); g.lineTo(.95, -.05); g.stroke()
  } else if (kind === 'satellite') {
    panel(-1.75, -.24, 1.32, .48)
    panel(.43, -.24, 1.32, .48)
    g.strokeStyle = 'rgba(200,200,190,.7)'; g.lineWidth = .06
    g.beginPath(); g.moveTo(-.45, 0); g.lineTo(.45, 0); g.stroke()
    /* gold-foiled body */
    g.fillStyle = lit(0, 0, .4, '#f3d98d', '#5e4512')
    g.fillRect(-.3, -.32, .6, .64)
    g.fillStyle = lit(0, -.5, .2, '#f2f0ea', '#6b6962')
    g.beginPath(); g.ellipse(0, -.48, .2, .09, 0, 0, Math.PI * 2); g.fill()
  } else if (kind === 'station') {
    /* truss with four panel pairs and pressurised modules in the middle */
    g.strokeStyle = 'rgba(214,210,200,.8)'; g.lineWidth = .08
    g.beginPath(); g.moveTo(-1.8, 0); g.lineTo(1.8, 0); g.stroke()
    for (const sx of [-1.55, -1.05, 1.05, 1.55]) { panel(sx - .18, -1.05, .36, .82); panel(sx - .18, .23, .36, .82) }
    g.fillStyle = lit(0, 0, .5, '#f0eee8', '#55524c')
    g.fillRect(-.6, -.15, 1.2, .3)
    g.fillRect(-.12, -.55, .24, 1.1)
    g.fillStyle = lit(.75, 0, .2, '#e6e2d8', '#4b4842')
    g.fillRect(.6, -.1, .3, .2)
  } else {
    /* transfer ship: a slim hull, a crew section and an engine bell */
    if (thrust > 0) {
      const plume = g.createRadialGradient(-1.2, 0, 0, -1.2, 0, 1.6 + thrust)
      plume.addColorStop(0, `rgba(240,255,250,${(.9 * thrust).toFixed(3)})`)
      plume.addColorStop(.25, `rgba(130,231,189,${(.55 * thrust).toFixed(3)})`)
      plume.addColorStop(1, 'rgba(130,231,189,0)')
      g.fillStyle = plume
      g.beginPath(); g.ellipse(-1.9, 0, 1.2 + thrust * .8, .32, 0, 0, Math.PI * 2); g.fill()
    }
    g.fillStyle = lit(-1, 0, .3, '#9a968c', '#2f2d29')
    g.beginPath(); g.moveTo(-.95, -.14); g.lineTo(-1.25, -.26); g.lineTo(-1.25, .26); g.lineTo(-.95, .14); g.closePath(); g.fill()
    g.fillStyle = lit(0, 0, 1, '#f4f2ec', '#5c5953')
    g.beginPath()
    g.moveTo(1.15, 0); g.quadraticCurveTo(.9, -.26, .35, -.26); g.lineTo(-.95, -.2); g.lineTo(-.95, .2); g.lineTo(.35, .26); g.quadraticCurveTo(.9, .26, 1.15, 0)
    g.fill()
    g.fillStyle = 'rgba(130,231,189,.8)'
    g.fillRect(.45, -.07, .22, .05)
    panel(-.55, -.78, .5, .5)
    panel(-.55, .28, .5, .5)
  }
}
