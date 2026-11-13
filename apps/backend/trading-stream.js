/**
 * /trading/stream fan-out hub — one state computation per trading account
 * scope, shared by every open stream (browser tab) of that scope.
 *
 * Contract kept from the per-stream implementation it replaces:
 *  - every push is preceded by a fresh session check: a stream whose session
 *    is gone, expired or whose user is not `active` is ended (now one query
 *    for all streams of the scope instead of one per stream);
 *  - the payload is exactly `JSON.stringify(engine.state(userId, accountId))`,
 *    computed fresh for each push (no cached financial state is served);
 *  - a 1 s timer per scope, plus an immediate push on connect and on every
 *    engine state change of that scope's account;
 *  - identical snapshots are not re-sent (": hb" comment instead);
 *  - a failed state computation ends the stream (the client reconnects).
 *
 * Changed only in cost and fairness:
 *  - engine events are routed by account id: a change on account A no longer
 *    wakes the streams of every other account (a scope whose account id is
 *    not known yet still reacts to every event);
 *  - a change that arrives while a push is in flight is coalesced into one
 *    follow-up push instead of being dropped until the next tick;
 *  - a client that does not read (socket buffer full) is skipped until it
 *    drains, then receives the latest snapshot; buffered memory is bounded.
 */
const scopeKey = (userId, accountId) => `${userId}:${accountId || ''}`

export function createTradingStreamHub({ engine, checkSessions, intervalMs = 1000 }) {
  const scopes = new Map()       /* scopeKey → scope */
  const byAccount = new Map()    /* resolved account id → Set<scope> */
  const unresolved = new Set()   /* scopes whose account id is not known yet */

  const index = (scope, accountId) => {
    if (scope.accountId === accountId) return
    if (scope.accountId) byAccount.get(scope.accountId)?.delete(scope)
    else unresolved.delete(scope)
    scope.accountId = accountId
    if (accountId) {
      if (!byAccount.has(accountId)) byAccount.set(accountId, new Set())
      byAccount.get(accountId).add(scope)
    } else unresolved.add(scope)
  }

  const end = stream => {
    if (stream.closed) return
    stream.closed = true
    try { stream.res.end() } catch {}
    detach(stream)
  }

  const write = (stream, snapshot) => {
    if (stream.closed || stream.res.destroyed || stream.res.writableEnded) return
    /* slow reader: keep at most one snapshot in flight; the newest one is
       written when the socket drains (full snapshots, nothing is lost) */
    if (stream.res.writableNeedDrain) { stream.pending = snapshot; return }
    stream.pending = null
    if (snapshot !== stream.last) {
      stream.last = snapshot
      stream.res.write(`data: ${snapshot}\n\n`)
    } else stream.res.write(': hb\n\n')
  }

  async function run(scope) {
    scope.busy = true
    try {
      do {
        scope.dirty = false
        const live = [...scope.streams].filter(s => !s.closed)
        if (!live.length) return
        const valid = await checkSessions([...new Set(live.map(s => s.sidHash))], scope.userId)
        for (const s of live) if (!valid.has(s.sidHash)) end(s)
        if (!scope.streams.size) return
        let snapshot
        try {
          const state = await engine.state(scope.userId, scope.requestedAccountId)
          if (state?.account?.id) index(scope, state.account.id)
          snapshot = JSON.stringify(state)
        } catch {
          for (const s of [...scope.streams]) end(s)
          return
        }
        for (const s of [...scope.streams]) write(s, snapshot)
      } while (scope.dirty && scope.streams.size)
    } catch {
      for (const s of [...scope.streams]) end(s)
    } finally {
      scope.busy = false
    }
  }

  /* timer ticks while a push is running are dropped (as before); state
     changes and new connections are coalesced into one follow-up push */
  const tick = scope => { if (!scope.busy) run(scope) }
  const wake = scope => { if (scope.busy) scope.dirty = true; else run(scope) }

  const onState = accountId => {
    for (const scope of byAccount.get(accountId) || []) wake(scope)
    for (const scope of unresolved) wake(scope)
  }
  engine.onState(onState)

  function detach(stream) {
    const scope = stream.scope
    if (!scope.streams.delete(stream)) return
    if (scope.streams.size) return
    clearInterval(scope.timer)
    scopes.delete(scope.key)
    if (scope.accountId) {
      const set = byAccount.get(scope.accountId)
      set?.delete(scope)
      if (set && !set.size) byAccount.delete(scope.accountId)
    } else unresolved.delete(scope)
  }

  return {
    /** start streaming to an authenticated SSE response */
    attach(req, res, { sidHash, userId, accountId = null }) {
      const key = scopeKey(userId, accountId)
      let scope = scopes.get(key)
      if (!scope) {
        scope = { key, userId, requestedAccountId: accountId, accountId: null, streams: new Set(), busy: false, dirty: false, timer: null }
        scopes.set(key, scope)
        unresolved.add(scope)
        if (accountId) index(scope, accountId)
        scope.timer = setInterval(() => tick(scope), intervalMs)
      }
      const stream = { scope, res, sidHash, last: '', pending: null, closed: false }
      scope.streams.add(stream)
      res.on('drain', () => { if (stream.pending != null) write(stream, stream.pending) })
      req.on('close', () => { stream.closed = true; detach(stream) })
      wake(scope)
    },
    /** end every stream of a session now (logout) */
    revokeSession(sidHash) {
      for (const scope of [...scopes.values()])
        for (const s of [...scope.streams]) if (s.sidHash === sidHash) end(s)
    },
    stats() {
      let streams = 0
      for (const s of scopes.values()) streams += s.streams.size
      return { scopes: scopes.size, streams, accounts: byAccount.size, unresolved: unresolved.size }
    },
    close() {
      engine.listeners.delete(onState)
      for (const scope of [...scopes.values()]) for (const s of [...scope.streams]) end(s)
    },
  }
}
