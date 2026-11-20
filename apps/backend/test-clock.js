/**
 * Test-mode conduct clock.
 *
 * Conduct rules (conduct.js: the funded daily holding window, the weekend
 * rule, news windows) read time through ConductService's injectable `now`.
 * Production never uses this module: server.js builds the clock only when
 * SIM_TEST_MODE=1 runs against a test database, and otherwise leaves
 * ConductService on its default real clock (Date.now) with every restriction
 * unchanged.
 *
 * In test mode the clock follows the real time until a test pins it to an
 * explicit instant; a pinned clock is frozen there until it is moved or
 * released. `SIM_TEST_CLOCK` (ISO time) pins it from start-up, which lets CI
 * reproduce "the server is running inside the close window".
 */
export function parseInstant(value) {
  if (value === null || value === undefined || value === '') return null
  const ms = typeof value === 'number' ? value : Date.parse(String(value))
  if (!Number.isFinite(ms)) throw new RangeError('invalid_instant')
  return ms
}

export function createTestClock({ initial = null, real = () => Date.now() } = {}) {
  const startup = parseInstant(initial)
  let pinned = startup
  return {
    /** current conduct time in epoch ms */
    now: () => (pinned === null ? real() : pinned),
    /** pin to an instant (epoch ms or ISO string); null returns to the start-up state */
    set(value) { pinned = value === null ? startup : parseInstant(value); return this.state() },
    state: () => ({ pinned: pinned !== null, now: new Date(pinned === null ? real() : pinned).toISOString() }),
  }
}
