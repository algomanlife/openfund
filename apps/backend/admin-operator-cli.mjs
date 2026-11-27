/**
 * Manage admin operators from a shell with database access (Render shell, local).
 *
 *   npm run operator -- list
 *   npm run operator -- set <username> <owner|finance|support|content|viewer> [active|disabled]
 *
 * `set` asks for the password on standard input (never as an argument, so it
 * stays out of shell history and process lists); press Enter to keep the
 * existing password of an operator being changed. The first operator must be
 * an owner, and creating it switches operator enforcement on.
 */
import pg from 'pg'
import { createInterface } from 'node:readline/promises'
import { configureAdminOperators, listOperators, upsertOperator } from './admin-operators.js'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is required'); process.exit(2) }
const pool = new pg.Pool({ connectionString: url })
configureAdminOperators(pool)
const [command, username, role, status = 'active'] = process.argv.slice(2)
try {
  if (command === 'list') {
    console.table(await listOperators())
  } else if (command === 'set' && username && role) {
    const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: process.stdin.isTTY })
    const password = (await rl.question('Password (16+ characters, Enter to keep): ')).trim()
    rl.close()
    const operator = await upsertOperator({ username, role, status, password: password || undefined }, 'cli')
    console.log(`operator ${operator.username}: ${operator.role}, ${operator.status}`)
  } else {
    console.error('usage: operator list | operator set <username> <role> [active|disabled]')
    process.exitCode = 2
  }
} catch (error) {
  console.error('operator:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
