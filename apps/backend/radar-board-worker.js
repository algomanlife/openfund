/* Reads Hyperliquid's ~40 MB leaderboard, condenses it, prints the result as
   JSON on stdout and exits. It runs as a short-lived child process so the
   parse's transient memory (~250 MB) is returned to the operating system when
   it ends and never stays in the API process; only the condensed top of each
   window comes back.  Usage: node radar-board-worker.js <url> <maxBytes> */
import { condenseBoard } from './radar.js'

const [url, maxBytes] = [process.argv[2], Number(process.argv[3]) || 120e6]
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`upstream_${response.status}`)
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > maxBytes) throw new Error('upstream_too_large')
  process.stdout.write(JSON.stringify(condenseBoard(await response.json(), {}, Date.now())))
} catch (error) {
  process.stderr.write(String(error?.message || error))
  process.exitCode = 1
}
