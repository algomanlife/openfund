/* Flamingo flight (owner fix 2): the /migrate hero tracks and the menu flock.
   Checks the same data the generated @keyframes are built from:
   head leads the movement in LTR and RTL for every bird and keyframe segment,
   turning only in place; depth (approach and recede); landing, wading,
   feeding and take-off; the copy keep-out; at least four visible birds at
   every instant (three on phones); wingbeats scale with size and never sync;
   the reduced-motion still; the CSS is generated from the data. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const hero = load('../src/features/migration/heroScene.ts')
const art = load('../src/features/navigation/flamingoArt.ts')
const { TRACKS, STILL, MASTER_S, HERO_W, HERO_H, WATER_Y, SAFE_X, SKY_LIMIT_Y, FLIGHT_POSES, FLIGHT_LIFT, sample, loopT, trackCss, stillCss, flapFor } = hero
const GROUND = ['stand', 'wade', 'feed']
const EPS = 0.5
/* the scene mirrored for RTL: x → W − x, facing flips */
const mirror = key => ({ ...key, x: HERO_W - key.x, face: -key.face })

/** approximate scene-unit box of a bird drawn at a sample (body or feet anchor) */
function box(track, p) {
  const s = p.s
  if (track.anchor === 'feet' && !FLIGHT_POSES.includes(p.pose)) return { l: p.x - 22 * s, r: p.x + 40 * s, t: p.y - 96 * s, b: p.y + 2 }
  const cy = track.anchor === 'feet' ? p.y - FLIGHT_LIFT * s : p.y
  return { l: p.x - 44 * s, r: p.x + 46 * s, t: cy - 34 * s, b: cy + 26 * s }
}

for (const dir of ['ltr', 'rtl']) {
  test(`${dir}: every bird faces the way it moves, for every keyframe segment; it turns only in place`, () => {
    for (const track of TRACKS) {
      const keys = dir === 'rtl' ? track.keys.map(mirror) : track.keys
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1], dx = b.x - a.x, dy = b.y - a.y
        const seen = a.o > 0 || b.o > 0
        if (!seen) continue /* an invisible return to the start */
        const where = `${track.id} ${a.t}%→${b.t}% (${dir})`
        if (a.face !== b.face) assert.ok(Math.abs(dx) <= EPS && Math.abs(dy) <= EPS, `${where}: turns only while standing still`)
        else if (Math.abs(dx) > EPS) assert.equal(Math.sign(dx), a.face, `${where}: moves ${dx > 0 ? '+x' : '-x'} but faces ${a.face > 0 ? '+x' : '-x'}`)
        if (a.face !== b.face) assert.ok(GROUND.includes(a.pose) && GROUND.includes(b.pose), `${where}: turns on the water, not in the air`)
      }
    }
  })
}

test('the generated CSS plays the same keys: scaleX sign is the facing, translate is the position', () => {
  for (const track of TRACKS) {
    const css = trackCss(track)
    const frames = [...css.matchAll(new RegExp(`@keyframes mh-${track.id}\\{(.*?)\\}(?=@keyframes|$)`, 'g'))][0][1]
    const parsed = [...frames.matchAll(/([\d.]+)%\{transform:translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([-\d.]+),([-\d.]+)\);opacity:([\d.]+)\}/g)]
      .map(m => ({ t: +m[1], x: +m[2], y: +m[3], sx: +m[4], s: +m[5], o: +m[6] }))
    assert.equal(parsed.length, track.keys.length, `${track.id}: one keyframe per key`)
    parsed.forEach((p, i) => {
      const key = track.keys[i]
      assert.ok(Math.abs(p.t - key.t) < 1e-6 && Math.abs(p.x - key.x) < 1e-3 && Math.abs(p.y - key.y) < 1e-3 && Math.sign(p.sx) === key.face && Math.abs(Math.abs(p.sx) - key.s) < 1e-3, `${track.id} key ${i}`)
    })
    assert.equal(parsed[parsed.length - 1].t, 100); assert.equal(parsed[0].t, 0)
    const last = track.keys[track.keys.length - 1], first = track.keys[0]
    /* the loop closes on its first key; an opacity jump is allowed only where the bird re-enters off-screen */
    const offscreen = first.x < -40 * first.s || first.x > HERO_W + 40 * first.s || first.y < -30 * first.s
    assert.ok(last.x === first.x && last.y === first.y && (last.o === first.o || offscreen), `${track.id}: the loop closes on its first key`)
  }
})

test('depth: birds approach from the horizon (smaller → larger, fainter → brighter, lower → higher) and one recedes', () => {
  const approach = TRACKS.filter(t => t.kind === 'approach')
  assert.ok(approach.length >= 2)
  for (const track of approach) {
    const seen = track.keys.filter(k => k.o > 0)
    const [a, z] = [seen[0], seen[seen.length - 1]]
    assert.ok(a.y > WATER_Y - 80 && a.s < 0.3 && a.o < 0.2, `${track.id} starts small and faint near the horizon`)
    assert.ok(z.s > 2.5 && z.o > 0.9 && z.y < 0, `${track.id} leaves the frame large, bright and high`)
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i].s >= seen[i - 1].s && seen[i].y <= seen[i - 1].y, `${track.id} grows and rises monotonically`)
    /* curved: the climb angle changes along the path */
    const slopes = seen.slice(1).map((k, i) => (k.y - seen[i].y) / (k.x - seen[i].x))
    assert.ok(Math.max(...slopes) - Math.min(...slopes) > 0.5, `${track.id} follows a curve`)
  }
  const recede = TRACKS.filter(t => t.kind === 'recede')
  assert.ok(recede.length >= 1)
  for (const track of recede) {
    const seen = track.keys.filter(k => k.o > 0)
    assert.ok(seen[0].s > 2.5 && seen[seen.length - 1].s < 0.3 && seen[seen.length - 1].y > WATER_Y - 90, `${track.id} shrinks towards the horizon`)
  }
  assert.deepEqual([...new Set(TRACKS.filter(t => t.kind === 'cross').map(t => t.depth))].sort(), ['far', 'mid', 'near'], 'crossers at three depths')
})

test('landing, wading and take-off are natural, for a far and a near bird', () => {
  const landers = TRACKS.filter(t => t.kind === 'lander')
  assert.ok(landers.some(t => t.depth === 'far' && t.keys[0].s < 0.8), 'a far, small lander near the horizon')
  assert.ok(landers.some(t => t.depth === 'near' && t.keys[0].s > 1.4), 'a near, large lander')
  for (const track of landers) {
    const poses = track.keys.map(k => k.pose).filter((p, i, all) => i === 0 || p !== all[i - 1])
    const order = ['fly', 'glide', 'flare', 'stand']
    assert.deepEqual(poses.slice(0, 4), order, `${track.id}: fly → glide (wings fixed) → flare (legs down) → stand (wings folded)`)
    assert.ok(poses.includes('wade') && poses.includes('feed'), `${track.id}: wades and feeds`)
    const runAt = poses.indexOf('run')
    assert.ok(runAt > 3 && poses[runAt + 1] === 'fly', `${track.id}: running steps on the water, then flight`)
    const touch = track.keys.find(k => k.pose === 'stand')
    const before = track.keys.filter(k => k.t < touch.t && k.o > 0)
    assert.ok(before.every(k => k.face === touch.face) && Math.sign(touch.x - before[0].x) === touch.face, `${track.id}: approaches from behind its heading`)
    for (let i = 1; i < before.length; i++) assert.ok(before[i].y >= before[i - 1].y, `${track.id}: descends to the water`)
    assert.ok(track.splashes.some(sp => Math.abs(sp.t - touch.t) < 0.6), `${track.id}: a ripple on touchdown`)
    assert.ok(track.splashes.filter(sp => sp.t > touch.t).length >= 3, `${track.id}: splashes from the running steps`)
    const run = track.keys.filter(k => k.pose === 'run'), lastSeen = track.keys.filter(k => k.o > 0).at(-1)
    assert.ok(run.every(k => k.face === run[0].face) && lastSeen.face === run[0].face, `${track.id}: takes off forward and leaves on the same heading`)
    assert.ok(lastSeen.y < run[0].y - 150, `${track.id}: climbs away`)
    /* a reversal on the water: turn first, then walk the other way */
    const turns = track.keys.filter((k, i) => i && k.face !== track.keys[i - 1].face && k.o > 0)
    for (const turn of turns) assert.ok(GROUND.includes(turn.pose), `${track.id}: turns on the water`)
  }
  assert.ok(landers.some(t => t.keys.some((k, i) => i && k.o > 0 && k.face !== t.keys[i - 1].face)), 'at least one bird reverses on the water (body turns first)')
})

test('wingbeats scale with size and never sync', () => {
  for (const track of TRACKS) {
    assert.equal(track.flap, flapFor(track.size), `${track.id}: wingbeat from its size`)
    const sizes = track.keys.map(k => k.s)
    assert.ok(track.size >= Math.min(...sizes) && track.size <= Math.max(...sizes), `${track.id}: reference size within its range`)
  }
  const mean = depth => { const t = TRACKS.filter(x => x.depth === depth && x.kind !== 'approach'); return t.reduce((n, x) => n + x.flap, 0) / t.length }
  assert.ok(mean('far') < mean('mid') && mean('mid') < mean('near'), 'far birds flap faster than mid, mid faster than near')
  assert.ok(flapFor(0.4) < flapFor(1) && flapFor(1) < flapFor(2.5), 'the rule is monotonic')
  assert.equal(new Set(TRACKS.map(t => t.phase)).size, TRACKS.length, 'every bird has its own wing phase')
})

test('birds never cross the copy (desktop keep-out) and stay inside the visible scene when seen', () => {
  for (const track of TRACKS) {
    for (let t = 0; t <= 100; t += 0.1) {
      const p = sample(track, t)
      if (p.o < 0.05) continue
      const b = box(track, p)
      const inCopy = b.l < SAFE_X && b.b > SKY_LIMIT_Y
      assert.ok(!inCopy, `${track.id} at ${t.toFixed(1)}%: box ${JSON.stringify(b)} enters the copy area (x < ${SAFE_X}, y > ${SKY_LIMIT_Y})`)
    }
  }
})

test('always alive: at least four birds visible at every instant (three on phones)', () => {
  for (const track of TRACKS) assert.equal(MASTER_S % track.dur, 0, `${track.id}: its loop divides the ${MASTER_S}s scene loop`)
  /* the smallest visible regions: 1920 px crops the top (y ≥ 120); phones show x ≥ 358 */
  const desktop = { l: 0, r: HERO_W, t: 120, b: HERO_H }, phone = { l: 358, r: HERO_W, t: 0, b: HERO_H }
  const visible = (track, sec, view) => {
    const p = sample(track, loopT(track, sec))
    if (p.o < 0.3) return false
    const b = box(track, p)
    return b.r > view.l + 10 && b.l < view.r - 10 && b.b > view.t + 10 && b.t < view.b - 10
  }
  let minDesk = 99, minPhone = 99
  for (let sec = 0; sec < MASTER_S; sec += 0.25) {
    minDesk = Math.min(minDesk, TRACKS.filter(t => visible(t, sec, desktop)).length)
    minPhone = Math.min(minPhone, TRACKS.filter(t => t.mobile && visible(t, sec, phone)).length)
  }
  assert.ok(minDesk >= 4, `desktop: at least 4 visible at every instant (min ${minDesk})`)
  assert.ok(minPhone >= 3, `phones: at least 3 visible at every instant (min ${minPhone})`)
  assert.ok(TRACKS.filter(t => t.mobile).length < TRACKS.length, 'phones show fewer birds')
})

test('reduced motion shows a composed still: one flying, one landing, two standing', () => {
  const poses = STILL.map(({ id, t }) => sample(TRACKS.find(tr => tr.id === id), t).pose)
  assert.equal(poses.filter(p => p === 'fly').length, 1)
  assert.equal(poses.filter(p => p === 'flare' || p === 'glide').length, 1)
  assert.equal(poses.filter(p => GROUND.includes(p)).length, 2)
  const css = stillCss()
  assert.match(css, /^@media \(prefers-reduced-motion:reduce\)\{\.mh-root \.mh-bird,\.mh-root \.mh-splash\{display:none\}/)
  for (const { id } of STILL) assert.ok(css.includes(`.mh-bird.b-${id}{display:inline;transform:translate(`), id)
  const sheet = read('../src/features/migration/migration-hero.css')
  assert.match(sheet, /@media \(prefers-reduced-motion:reduce\)\{\s*\.mh-root \*\{animation:none!important\}/)
  assert.match(sheet, /\.mh-root\[data-live\] :is\(\.mh-bird,\.mh-pose,\.mh-splash,\.mh-wing,\.mh-step\)\{animation-play-state:running\}/, 'runs only while live')
  assert.match(sheet, /@media \(max-width:760px\)\{\s*\.mh-root \.is-desktop\{display:none\}/, 'fewer birds on phones')
  /* transform and opacity only */
  const generated = TRACKS.map(trackCss).join('') + stillCss()
  for (const prop of generated.matchAll(/[{;]([a-z-]+):/g)) assert.ok(['transform', 'opacity', 'display'].includes(prop[1]), `animated property ${prop[1]}`)
})

test('menu banner: the flock moves only the way its heads face, wingbeats scale with size, phases differ', () => {
  const css = read('../src/features/navigation/flamingo.css')
  const glide = css.match(/@keyframes fl-glide\{(.*?)\}\}/)[1] + '}'
  const xs = [...glide.matchAll(/translate\(([-\d.]+)%,([-\d.]+)%\)/g)].map(m => +m[1])
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1], 'the flock glides only towards +x')
  assert.equal(art.FLOCK_FACING, 1, 'every bird is drawn facing +x')
  const src = read('../src/features/navigation/flamingoArt.ts')
  assert.match(src, /const HEAD = 'M33 -5/, 'the head is drawn at +x')
  assert.doesNotMatch(css, /\[dir=rtl\][^{]*flamingo-scene[^{]*\{[^}]*scaleX\(-1\)/, 'the menu scene is not mirrored, so its movement and heads stay together')
  assert.ok(art.flapFor(0.6) < art.flapFor(0.95), 'smaller birds flap faster')
  assert.equal(art.flapFor(1.3), flapFor(1.3), 'one wingbeat rule for the hero and the menu')
})
