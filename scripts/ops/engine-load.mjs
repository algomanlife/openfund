/* Engine load measurement on a DISPOSABLE database (never production).
 * Creates N free-demo accounts, each with one open position opened through
 * the engine's own submitOrder, then measures:
 *  - monitoring-loop pass duration (Engine#loop over every open account),
 *  - per-account risk-view latency (Engine#state) on a sample of accounts.
 * The engine is used as-is; nothing in engine.js is changed or stubbed except
 * the market-data source (a deterministic in-memory feed, as in the tests).
 *
 *   DATABASE_URL=postgres://localhost:5432/<name>_load_test \
 *     node scripts/ops/engine-load.mjs 200 1000 2500 > load.json
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const backend = createRequire(path.join(root, 'apps/backend/package.json'));
const pg = backend('pg');
const { Engine } = await import(path.join(root, 'apps/backend/engine.js'));

const url = new URL(process.env.DATABASE_URL || 'postgres://invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/(?:_test|_load)/.test(url.pathname)) throw Error('Use a disposable local *_test/*_load database.');
const sizes = process.argv.slice(2).map(Number).filter(n => n > 0);
if (!sizes.length) throw Error('Usage: node scripts/ops/engine-load.mjs <accounts> [<accounts> ...]');

class FakeMarket {
  constructor() { this.prices = new Map(); this.marks = new Map() }
  set(symbol, price) { this.prices.set(symbol, String(price)); this.marks.set(symbol, { mark: String(price), at: Date.now() }) }
  marketMeta(symbol) { return { symbol, group: 'crypto', base: symbol.split('/')[0], quote: 'USD', maxLeverage: 100, isOpen: true } }
  mark(symbol) { const p = this.prices.get(symbol); return p == null ? null : { mark: p, at: Date.now(), injected: true } }
  tradeable(symbol) { const m = this.mark(symbol); return m ? { ok: true, meta: this.marketMeta(symbol), mark: m.mark } : { ok: false, reason: 'stale_price' } }
}

const pool = new pg.Pool({ connectionString: url.href, max: 10 });
const md = new FakeMarket();
const MARKETS = ['XLOADA/USD', 'XLOADB/USD', 'XLOADC/USD', 'XLOADD/USD'];
for (const m of MARKETS) md.set(m, 100);
const engine = new Engine(pool, md);
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))] };
const ms = t => Math.round(Number(process.hrtime.bigint() - t) / 1e5) / 10;

const users = [];
async function grow(target) {
  while (users.length < target) {
    const { rows: [u] } = await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', ['0xload' + randomUUID().replace(/-/g, '').slice(0, 34)]);
    await engine.ensureDemoAccount(u.id);
    const r = await engine.submitOrder(u.id, { market: MARKETS[users.length % MARKETS.length], side: users.length % 2 ? 'short' : 'long', order_type: 'market', margin: '100', leverage: 5 }, 'load-' + randomUUID());
    if (!r.ok) throw Error(`order failed: ${JSON.stringify(r).slice(0, 200)}`);
    users.push(u.id);
  }
}

const results = [];
engine.running = true;
for (const size of sizes) {
  const setup = process.hrtime.bigint();
  await grow(size);
  const setupMs = ms(setup);
  const passes = [];
  for (let i = 0; i < 3; i++) {
    for (const m of MARKETS) md.set(m, 100 + (i + 1) * 0.5);
    const t = process.hrtime.bigint(); await engine.loop(); passes.push(ms(t));
  }
  const sample = users.filter((_, i) => i % Math.max(1, Math.floor(users.length / 100)) === 0).slice(0, 100);
  const lat = [];
  for (const uid of sample) { const t = process.hrtime.bigint(); await engine.state(uid); lat.push(ms(t)); }
  const row = { accounts: size, openPositions: size, setupSeconds: Math.round(setupMs / 100) / 10,
    loopPassMs: { min: Math.min(...passes), median: pct(passes, 50), max: Math.max(...passes) },
    perAccountLoopMs: Math.round(pct(passes, 50) / size * 100) / 100,
    stateLatencyMs: { p50: pct(lat, 50), p95: pct(lat, 95), max: Math.max(...lat), samples: lat.length } };
  results.push(row);
  console.error(JSON.stringify(row));
}
engine.running = false;
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), node: process.version, loopIntervalMs: 1000, results }, null, 2));
await pool.end();
