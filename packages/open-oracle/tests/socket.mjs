import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarketRegistry, convertQuote, OracleEngine, SourceQuality, replay, CandleEngine, bucket, TIMEFRAMES, HistoryStore, createOracleServer, DEFAULT_CONFIG } from '../src/index.mjs';
import { TIME, registry, sources, observation as o } from './helpers.mjs';
test('local read-only routes and subscription cleanup', async () => {
  const e = new OracleEngine({ registry: registry(), candles: new CandleEngine({ timeframes: ['1s'] }) });
  const api = createOracleServer(e), address = await api.listen(), url = `http://127.0.0.1:${address.port}`;
  try {
    for (const path of ['markets', 'sources', 'health', 'methodology']) assert.equal((await fetch(`${url}/v1/${path}`)).status, 200);
    assert.equal((await fetch(`${url}/v1/prices`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${url}/v1/prices`, { headers: { origin: 'https://untrusted.invalid' } })).status, 403);
    assert.equal((await fetch(`${url}/v1/markets/missing`)).status, 404);
    e.ingest(o()); e.evaluate(TIME); const p = await (await fetch(`${url}/v1/prices/${encodeURIComponent('BTC/USD')}`)).json(); assert.equal(p.price, '100');
    const controller = new AbortController(), stream = await fetch(`${url}/v1/stream`, { signal: controller.signal });
    const reader = stream.body.getReader(); await reader.read(); e.ingest(o('gains', '101', TIME + 1000)); e.evaluate(TIME + 1000);
    const event = await reader.read(); assert(new TextDecoder().decode(event.value).includes('event: price')); controller.abort();
  } finally { await api.close(); }
  assert.equal(e.listeners.size, 0);
});
