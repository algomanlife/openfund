/* A second engine "process" for test/split-process-engine.test.mjs: a worker
   thread has its own module instances, so its Engine does NOT share the
   in-memory account lock map with the main thread. Only PostgreSQL row locks
   can serialize the two, exactly as between the Iran web and worker apps. */
import { parentPort, workerData } from 'node:worker_threads'
import pg from 'pg'
import { Engine } from '../../engine.js'
import { FakeMarket } from './fake-market.mjs'

const pool = new pg.Pool({ connectionString: workerData.databaseUrl, max: 4 })
const md = new FakeMarket()
const engine = new Engine(pool, md)
engine.running = true

parentPort.on('message', async ({ id, cmd, args }) => {
  try {
    let result
    if (cmd === 'price') { md.set(args.market, args.price); result = true }
    else if (cmd === 'loop') { await engine.loop(); result = true }
    else if (cmd === 'submit') result = await engine.submitOrder(args.userId, args.body, args.key, args.accountId)
    else if (cmd === 'close') result = await engine.closePosition(args.userId, args.positionId, args.opts)
    else if (cmd === 'end') { await pool.end(); result = true }
    parentPort.postMessage({ id, ok: true, result: JSON.parse(JSON.stringify(result ?? null)) })
  } catch (e) { parentPort.postMessage({ id, ok: false, error: e.message }) }
})
