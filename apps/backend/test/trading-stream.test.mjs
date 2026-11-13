/**
 * /trading/stream hub (trading-stream.js) — deterministic tests with a fake
 * engine, fake session store and fake sockets (no database, no timers left
 * behind). Covers the contract the per-stream implementation had and the
 * cost guarantees of the shared hub:
 *   - payload is exactly JSON.stringify(engine.state(...)), fresh per push
 *   - every push is preceded by a session check; invalid sessions end streams
 *   - tabs of one account share one state computation per push
 *   - account-specific events wake only that account's streams
 *   - events during an in-flight push are coalesced, never lost
 *   - wallet isolation: a stream only ever receives its own scope's state
 *   - logout revokes immediately; slow readers are bounded; cleanup is total
 *
 * Run: node --test test/trading-stream.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createTradingStreamHub } from '../trading-stream.js'

const tick = () => new Promise(r => setImmediate(r))
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await tick() }

function fakeEngine(accounts) {
  const e = {
    listeners: new Set(), calls: [], gate: null, version: 0,
    onState(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) },
    emit(id) { for (const fn of this.listeners) fn(id) },
    async state(userId, accountId) {
      e.calls.push(`${userId}:${accountId}`)
      if (e.gate) await e.gate
      const acc = accounts[`${userId}:${accountId}`]
      if (acc === 'throw') throw new Error('db down')
      return { as_of: ++e.version, account: acc ? { id: acc, owner: userId } : null, positions: [] }
    },
  }
  return e
}
function fakeSessions(valid) {
  const s = { valid: new Set(valid), calls: [] }
  s.check = async (hashes, userId) => { s.calls.push({ hashes: [...hashes].sort(), userId }); return new Set(hashes.filter(h => s.valid.has(`${userId}/${h}`))) }
  return s
}
function fakeStream() {
  const req = new EventEmitter()
  const res = new EventEmitter()
  Object.assign(res, { chunks: [], writableNeedDrain: false, destroyed: false, writableEnded: false,
    write(c) { this.chunks.push(c); return true }, end() { this.writableEnded = true } })
  res.data = () => res.chunks.filter(c => c.startsWith('data: ')).map(c => JSON.parse(c.slice(6)))
  return { req, res }
}
const hubOf = (engine, sessions) => createTradingStreamHub({ engine, checkSessions: sessions.check, intervalMs: 3_600_000 })

test('payload is the fresh engine.state JSON; first push on connect', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions(['u1/s1'])
  const hub = hubOf(engine, sessions); const t = fakeStream()
  hub.attach(t.req, t.res, { sidHash: 's1', userId: 'u1' })
  await flush()
  assert.deepEqual(t.res.data(), [{ as_of: 1, account: { id: 'A1', owner: 'u1' }, positions: [] }])
  assert.equal(sessions.calls.length, 1, 'session checked before the push')
  hub.close()
})

test('three tabs of one account share one session query and one state computation per push', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions(['u1/s1', 'u1/s2'])
  const hub = hubOf(engine, sessions)
  const tabs = [fakeStream(), fakeStream(), fakeStream()]
  tabs.forEach((t, k) => hub.attach(t.req, t.res, { sidHash: k === 2 ? 's2' : 's1', userId: 'u1' }))
  await flush()
  engine.calls.length = 0; sessions.calls.length = 0
  engine.emit('A1'); await flush()
  assert.equal(engine.calls.length, 1, 'one state() for all tabs')
  assert.equal(sessions.calls.length, 1, 'one session query for all tabs')
  assert.deepEqual(sessions.calls[0].hashes, ['s1', 's2'])
  const last = tabs.map(t => t.res.data().at(-1))
  assert.ok(last.every(d => d.as_of === last[0].as_of), 'every tab got the same snapshot')
  hub.close()
})

test('events are routed by account: other accounts do not recompute', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1', 'u2:null': 'A2' }), sessions = fakeSessions(['u1/s1', 'u2/s2'])
  const hub = hubOf(engine, sessions); const a = fakeStream(), b = fakeStream()
  hub.attach(a.req, a.res, { sidHash: 's1', userId: 'u1' }); hub.attach(b.req, b.res, { sidHash: 's2', userId: 'u2' })
  await flush(); engine.calls.length = 0
  engine.emit('A2'); await flush()
  assert.deepEqual(engine.calls, ['u2:null'])
  assert.ok(a.res.data().every(d => d.account.owner === 'u1') && b.res.data().every(d => d.account.owner === 'u2'), 'no cross-wallet payloads')
  hub.close()
})

test('a scope whose account is not known yet reacts to every event', async () => {
  const accounts = { 'u1:null': null }
  const engine = fakeEngine(accounts), sessions = fakeSessions(['u1/s1'])
  const hub = hubOf(engine, sessions); const t = fakeStream()
  hub.attach(t.req, t.res, { sidHash: 's1', userId: 'u1' }); await flush()
  accounts['u1:null'] = 'A9'; engine.emit('A9'); await flush()
  assert.equal(t.res.data().at(-1).account.id, 'A9')
  engine.calls.length = 0; engine.emit('OTHER'); await flush()
  assert.equal(engine.calls.length, 0, 'resolved scope ignores other accounts')
  hub.close()
})

test('invalid, expired or suspended sessions end the stream before any state is read', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions([])
  const hub = hubOf(engine, sessions); const t = fakeStream()
  hub.attach(t.req, t.res, { sidHash: 's1', userId: 'u1' }); await flush()
  assert.equal(t.res.writableEnded, true)
  assert.equal(engine.calls.length, 0)
  assert.deepEqual(hub.stats(), { scopes: 0, streams: 0, accounts: 0, unresolved: 0 })
  hub.close()
})

test('a session revoked between pushes ends only that tab; the other session keeps streaming', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions(['u1/s1', 'u1/s2'])
  const hub = hubOf(engine, sessions); const a = fakeStream(), b = fakeStream()
  hub.attach(a.req, a.res, { sidHash: 's1', userId: 'u1' }); hub.attach(b.req, b.res, { sidHash: 's2', userId: 'u1' }); await flush()
  sessions.valid.delete('u1/s1')
  const before = b.res.data().length
  engine.emit('A1'); await flush()
  assert.equal(a.res.writableEnded, true); assert.equal(b.res.writableEnded, false)
  assert.equal(b.res.data().length, before + 1)
  hub.close()
})

test('logout revokes the session streams immediately', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions(['u1/s1', 'u1/s2'])
  const hub = hubOf(engine, sessions); const a = fakeStream(), b = fakeStream()
  hub.attach(a.req, a.res, { sidHash: 's1', userId: 'u1' }); hub.attach(b.req, b.res, { sidHash: 's2', userId: 'u1' }); await flush()
  hub.revokeSession('s1')
  assert.equal(a.res.writableEnded, true); assert.equal(b.res.writableEnded, false)
  hub.close()
})

test('events during an in-flight push are coalesced into exactly one follow-up push', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions(['u1/s1'])
  const hub = hubOf(engine, sessions); const t = fakeStream()
  hub.attach(t.req, t.res, { sidHash: 's1', userId: 'u1' }); await flush()
  let open; engine.gate = new Promise(r => { open = r }); engine.calls.length = 0
  engine.emit('A1'); await flush()
  engine.emit('A1'); engine.emit('A1'); engine.emit('A1')
  engine.gate = null; open(); await flush(10)
  assert.equal(engine.calls.length, 2, 'the change during the push is not dropped, and not multiplied')
  const seq = t.res.data().map(d => d.as_of)
  assert.deepEqual(seq, [...seq].sort((x, y) => x - y), 'snapshots are delivered in order')
  hub.close()
})

test('a state failure ends the scope streams (client reconnects), as before', async () => {
  const engine = fakeEngine({ 'u1:null': 'throw' }), sessions = fakeSessions(['u1/s1'])
  const hub = hubOf(engine, sessions); const t = fakeStream()
  hub.attach(t.req, t.res, { sidHash: 's1', userId: 'u1' }); await flush()
  assert.equal(t.res.writableEnded, true)
  hub.close()
})

test('identical snapshots are not re-sent', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions(['u1/s1'])
  engine.state = async () => ({ as_of: 1, account: { id: 'A1' } })
  const hub = hubOf(engine, sessions); const t = fakeStream()
  hub.attach(t.req, t.res, { sidHash: 's1', userId: 'u1' }); await flush()
  engine.emit('A1'); await flush()
  assert.deepEqual(t.res.chunks.map(c => c.slice(0, 5)), ['data:', ': hb\n'])
  hub.close()
})

test('a slow reader keeps one pending snapshot and gets the newest one on drain', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions(['u1/s1'])
  const hub = hubOf(engine, sessions); const t = fakeStream()
  hub.attach(t.req, t.res, { sidHash: 's1', userId: 'u1' }); await flush()
  t.res.writableNeedDrain = true
  for (let i = 0; i < 5; i++) { engine.emit('A1'); await flush() }
  assert.equal(t.res.data().length, 1, 'nothing buffered while the socket is full')
  t.res.writableNeedDrain = false; t.res.emit('drain')
  assert.equal(t.res.data().at(-1).as_of, engine.version, 'newest snapshot delivered on drain')
  hub.close()
})

test('closing every tab removes the scope, its timer and its account index', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1' }), sessions = fakeSessions(['u1/s1'])
  const hub = hubOf(engine, sessions); const a = fakeStream(), b = fakeStream()
  hub.attach(a.req, a.res, { sidHash: 's1', userId: 'u1' }); hub.attach(b.req, b.res, { sidHash: 's1', userId: 'u1' }); await flush()
  assert.deepEqual(hub.stats(), { scopes: 1, streams: 2, accounts: 1, unresolved: 0 })
  a.req.emit('close'); b.req.emit('close')
  assert.deepEqual(hub.stats(), { scopes: 0, streams: 0, accounts: 0, unresolved: 0 })
  hub.close()
  assert.equal(engine.listeners.size, 0, 'hub listener removed on close')
})

test('challenge scope and free-demo scope of one wallet stay separate', async () => {
  const engine = fakeEngine({ 'u1:null': 'A1', 'u1:C1': 'C1' }), sessions = fakeSessions(['u1/s1'])
  const hub = hubOf(engine, sessions); const demo = fakeStream(), ch = fakeStream()
  hub.attach(demo.req, demo.res, { sidHash: 's1', userId: 'u1' }); hub.attach(ch.req, ch.res, { sidHash: 's1', userId: 'u1', accountId: 'C1' }); await flush()
  engine.calls.length = 0; engine.emit('C1'); await flush()
  assert.deepEqual(engine.calls, ['u1:C1'])
  assert.ok(demo.res.data().every(d => d.account.id === 'A1') && ch.res.data().every(d => d.account.id === 'C1'))
  hub.close()
})
