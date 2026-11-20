/* Test-mode conduct clock (test-clock.js): pinning, release and start-up pin,
   and its effect on the real conduct decisions through ConductService. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createTestClock, parseInstant } from '../test-clock.js'
import { ConductService } from '../conduct.js'

const T = s => Date.parse(s)
const realAt = T('2026-11-18T12:00:00.000Z')

test('follows the real clock until pinned, then stays frozen at the pin', () => {
  let real = realAt
  const clock = createTestClock({ real: () => real })
  assert.equal(clock.now(), realAt)
  real += 5000
  assert.equal(clock.now(), realAt + 5000)
  assert.deepEqual(clock.set('2026-11-18T21:50:00Z'), { pinned: true, now: '2026-11-18T21:50:00.000Z' })
  real += 60_000
  assert.equal(clock.now(), T('2026-11-18T21:50:00Z'))
  assert.deepEqual(clock.set(null), { pinned: false, now: new Date(real).toISOString() })
})

test('a start-up pin is where release returns', () => {
  const clock = createTestClock({ initial: '2026-11-21T12:00:00Z', real: () => realAt })
  assert.equal(clock.now(), T('2026-11-21T12:00:00Z'))
  clock.set(T('2026-11-18T12:00:00Z'))
  assert.equal(clock.now(), T('2026-11-18T12:00:00Z'))
  clock.set(null)
  assert.equal(clock.now(), T('2026-11-21T12:00:00Z'))
})

test('rejects instants that are not times', () => {
  assert.throws(() => parseInstant('tomorrow-ish'), RangeError)
  assert.throws(() => createTestClock().set('not a time'), RangeError)
  assert.equal(parseInstant(''), null)
})

test('ConductService decisions follow the injected clock (no database needed for the holding rules)', async () => {
  const clock = createTestClock({ real: () => realAt })
  const conduct = new ConductService(null, { now: clock.now })
  const funded = { rulesVersion: 3, funded: true, conduct: { holding: { mode: 'auto_close_daily', stage: 'funded' } } }
  const instant = { rulesVersion: 3, phases: 0, conduct: { holding: { mode: 'prohibit_weekend', stage: 'all' } } }
  const at = async (iso, rules) => { clock.set(iso); return conduct.preTradeBlock(null, { rules, market: 'BTC/USD' }) }
  assert.equal(await at('2026-11-18T21:44:59.999Z', funded), null)
  assert.equal(await at('2026-11-18T21:45:00.000Z', funded), 'holding_window_closing')
  assert.equal(await at('2026-11-18T22:00:00.000Z', funded), null)
  assert.equal(conduct.autoCloseDue(funded), false)
  clock.set('2026-11-18T21:50:00Z')
  assert.equal(conduct.autoCloseDue(funded), true)
  assert.equal(await at('2026-11-21T12:00:00Z', instant), 'weekend_trading_prohibited')
  assert.equal(await at('2026-11-22T22:00:00Z', instant), null)
})

test('the default ConductService keeps the real clock', () => {
  const before = Date.now()
  const t = new ConductService(null).now()
  assert.ok(t >= before && t <= Date.now())
})
