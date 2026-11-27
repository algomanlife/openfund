import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GainsAdapter, HyperliquidAdapter, GMXAdapter } from '../src/adapters.mjs';
import { PublicTransport } from '../src/transport.mjs';
import { TIME } from './helpers.mjs';
const f = JSON.parse(readFileSync(new URL('../fixtures/providers.json', import.meta.url)));
const mock = fn => ({ request: async (url, body) => structuredClone(await fn(url, body)), metrics: {} });
test('Gains inventory includes closed non-crypto markets; index is distinct from mark', async () => {
  const adapter = new GainsAdapter({ now: () => TIME, transport: mock(url => url.endsWith('/markets') ? f.gains.markets : url.endsWith('/prices') ? f.gains.prices : { data: [{ time: TIME, close: '100' }] }) });
  const markets = await adapter.discover(); assert.equal(markets.length, 2); assert.equal(markets[1].session, 'CLOSED');
  const [price] = await adapter.snapshot(); assert.equal(price.price, '100'); assert.equal(price.microstructure.markPrice, '100.01'); assert.equal(price.timestampKind, 'PROVIDER');
  const markAdapter = new GainsAdapter({ now: () => TIME, priceField: 'mark', transport: mock(() => f.gains.prices) });
  const [mark] = await markAdapter.snapshot(); assert.equal(mark.price, '100.01'); assert.equal(mark.microstructure.indexPrice, '100');
  assert.throws(() => new GainsAdapter({ priceField: 'last' }), /invalid_price_field/);
  const history = await adapter.historical('BTC/USD', { from: TIME - 1000, to: TIME }); assert.equal(history[0].dataKind, 'PROVIDER_REFERENCE');
  await assert.rejects(adapter.historical('BTC/USD', { from: TIME, to: TIME, interval: '1w' }));
});
test('Hyperliquid discovers default, every builder dex, and spot; no fabricated oracle timestamps', async () => {
  const adapter = new HyperliquidAdapter({ now: () => TIME, transport: mock((url, body) => body.type === 'perpDexs' ? f.hyperliquid.dexs : body.type === 'spotMeta' ? f.hyperliquid.spot : body.type === 'candleSnapshot' ? [{ t: TIME, c: '100' }] : body.dex ? f.hyperliquid.builder : f.hyperliquid.main) });
  const markets = await adapter.discover(); assert.equal(markets.length, 3); assert.equal(markets[1].identityVerified, false); assert.equal(markets[2].semantics, 'SPOT_MARK');
  const prices = await adapter.snapshot(); assert.equal(prices.length, 2); assert.equal(prices[0].timestampKind, 'RECEIPT'); assert.equal(prices[0].price, '100'); assert.equal(prices[0].microstructure.midPrice, '100.01');
  assert.equal((await adapter.historical('main/BTC', { from: TIME - 1000, to: TIME }))[0].semantics, 'TRADE_OHLC');
});
test('GMX keeps network and market/token identity; midpoint uses the whole-token 30-decimal API', async () => {
  const adapter = new GMXAdapter({ now: () => TIME, networks: [{ name: 'test', oracle: 'https://oracle.invalid', api: 'https://api.invalid' }],
    transport: mock(url => url.endsWith('/tokens') ? f.gmx.tokens : url.endsWith('/markets') ? f.gmx.markets : url.includes('candles') ? { candles: [[TIME / 1000, 99, 101, 98, 100]] } : f.gmx.prices) });
  assert.equal((await adapter.discover()).length, 2); const p = await adapter.snapshot(); assert.equal(p.length, 2); assert.equal(p[0].price, '100'); assert.equal(p[0].interval.scale, 30);
  assert.equal((await adapter.historical('test/0xtestmarket'))[0].dataKind, 'PROVIDER_REFERENCE');
  f.gmx.prices.prices['0xtesteth'].minPrice = '102000000000000000000000000000000';
  assert.equal((await adapter.snapshot()).length, 0); assert(adapter.errors.some(e => e.code === 'INVALID_INTERVAL'));
});
test('malformed schemas fail closed; missing reference index never becomes mark', async () => {
  await assert.rejects(new GainsAdapter({ transport: mock(() => ({})) }).discover(), /SCHEMA_INVALID/);
  await assert.rejects(new HyperliquidAdapter({ transport: mock(() => ({})) }).discover(), /SCHEMA_INVALID/);
  const adapter = new GainsAdapter({ transport: mock(() => ({ data: [{ market: 'BTC/USD', mark: '100' }] })) });
  assert.deepEqual(await adapter.snapshot(), []); assert.equal(adapter.errors.length, 1);
});
test('rate limits honor Retry-After and have bounded retries', async () => {
  let calls = 0; const sleeps = [];
  const t = new PublicTransport({ minIntervalMs: 0, sleep: async ms => { sleeps.push(ms); }, fetchImpl: async () => ++calls === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '2' } }) : new Response('{"ok":true}') });
  assert.deepEqual(await t.request('https://example.invalid'), { ok: true }); assert(sleeps.includes(2000)); assert.equal(t.metrics.rateLimits, 1);
  const down = new PublicTransport({ minIntervalMs: 0, retries: 1, sleep: async () => {}, fetchImpl: async () => { throw new Error('offline'); } });
  await assert.rejects(down.request('https://example.invalid'), /NETWORK/); assert.equal(down.metrics.requests, 2);
});
test('network response limits and invalid JSON are enforced', async () => {
  const t = new PublicTransport({ maxBytes: 3, retries: 0, minIntervalMs: 0, fetchImpl: async () => new Response('12345') });
  await assert.rejects(t.request('https://example.invalid'), /BODY_LIMIT/);
  await assert.rejects(new PublicTransport({ retries: 0, minIntervalMs: 0, fetchImpl: async () => new Response('broken') }).request('https://example.invalid'), /SCHEMA_INVALID/);
});
test('poll stream recovers after disconnect and releases on abort', async () => {
  let calls = 0; const controller = new AbortController();
  const a = new GainsAdapter({ transport: mock(() => { if (++calls === 1) throw new Error('connection_lost'); return f.gains.prices; }) });
  for await (const observations of a.stream({ signal: controller.signal, intervalMs: 500 })) { assert.equal(observations.length, 1); controller.abort(); }
  assert.equal(calls, 2); assert(a.errors.length > 0);
});
test('partial multi-network discovery preserves every successfully discovered GMX market', async () => {
  const adapter = new GMXAdapter({ networks: [{ name: 'ok', oracle: 'https://ok.invalid' }, { name: 'down', oracle: 'https://down.invalid' }],
    transport: mock(url => { if (url.includes('down.invalid')) throw new Error('offline'); return url.endsWith('/tokens') ? f.gmx.tokens : f.gmx.markets; }) });
  assert.equal((await adapter.discover()).length, 2); assert.equal(adapter.inventoryComplete, false);
});
test('partial Hyperliquid discovery preserves perp metadata when spot discovery fails', async () => {
  const adapter = new HyperliquidAdapter({ transport: mock((url, body) => {
    if (body.type === 'spotMeta') throw new Error('offline');
    return body.type === 'perpDexs' ? [null] : f.hyperliquid.main;
  }) });
  assert.equal((await adapter.discover()).length, 1); assert.equal(adapter.inventoryComplete, false);
});
test('GMX unwraps real catalog envelopes and explicit address-field identities', async () => {
  const adapter = new GMXAdapter({ now: () => TIME, networks: [{ name: 'test', oracle: 'https://oracle.invalid', api: 'https://api.invalid' }],
    transport: mock(url => url.endsWith('/tokens') ? { tokens: f.gmx.tokens } : url.endsWith('/markets') ? { markets: [{ marketTokenAddress: '0xtestmarket', indexTokenAddress: '0xtesteth' }] } : { originTs: TIME, prices: { '0xtesteth': { minPrice: '99000000000000000000000000000000', maxPrice: '101000000000000000000000000000000' } } }) });
  const inventory = await adapter.discover(); assert.equal(inventory.length, 2); assert.equal(inventory[0].identityVerified, true); assert.equal(inventory[0].tokenAddress, '0xtesteth');
  assert.equal((await adapter.snapshot())[0].price, '100');
});
