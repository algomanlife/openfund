import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEquivalences, OpenOracleService, SERVICE_CONFIG, isUsable, calculatePrice, MarketRegistry, GMXAdapter, DEFAULT_CONFIG } from '../src/index.mjs';
import { TIME, observation as o } from './helpers.mjs';

const gainsRow = (symbol, base, group = 'crypto', isOpen = true) => ({ symbol, base, quote: 'USD', group, isOpen });
const gainsInventory = rows => rows.map(r => ({ sourceMarketId: r.symbol, symbol: r.symbol, baseAsset: r.base, unit: r.base, quoteAsset: 'USD', assetClass: r.group, identityVerified: true, semantics: 'UNDERLYING_REFERENCE' }));
const hlMarket = coin => ({ sourceMarketId: `main/${coin}`, coin, dex: '', symbol: coin, baseAsset: coin, quoteAsset: 'USD', instrumentType: 'PERPETUAL_UNDERLYING', unit: coin, identityVerified: true, semantics: 'UNDERLYING_REFERENCE', delisted: false });
const gmxToken = (symbol, address, network = 'arbitrum') => ({ sourceMarketId: `${network}/token/${address}`, symbol, baseAsset: symbol, quoteAsset: 'USD', instrumentType: 'TOKEN_REFERENCE', unit: address, identityVerified: true, semantics: 'UNDERLYING_REFERENCE', network, tokenAddress: address });

test('equivalences join only price-confirmed crypto identities and keep everything else source-scoped', () => {
  const gains = gainsInventory([gainsRow('BTC/USD', 'BTC'), gainsRow('PEPE/USD', 'PEPE'), gainsRow('EUR/USD', 'EUR', 'forex'), gainsRow('USDC/USD', 'USDC'), gainsRow('FAKE/USD', 'FAKE'), gainsRow('NOPX/USD', 'NOPX')]);
  const hyperliquid = [hlMarket('BTC'), hlMarket('kPEPE'), hlMarket('EUR'), hlMarket('FAKE')];
  const gmx = [gmxToken('BTC', '0xbtc'), gmxToken('BTC', '0xbtc-avax', 'avalanche'), gmxToken('PEPE', '0xpepe'), gmxToken('PEPE', '0xpepe2')];
  const prices = { gains: new Map([['BTC/USD', '100000'], ['PEPE/USD', '0.00001'], ['EUR/USD', '1.1'], ['USDC/USD', '1'], ['FAKE/USD', '2']]),
    hyperliquid: new Map([['main/BTC', '100100'], ['main/kPEPE', '0.0101'], ['main/EUR', '1.1'], ['main/FAKE', '9']]), gmx: new Map([['arbitrum/token/0xbtc', '99950']]) };
  const { rules, rejected } = buildEquivalences({ gains, hyperliquid, gmx }, prices, { at: TIME });
  assert.deepEqual(rules.map(r => r.canonicalId), ['BTC/USD', 'PEPE/USD']);
  assert.deepEqual(rules[0].members.map(m => m.source), ['gains', 'hyperliquid', 'gmx']);
  const pepe = rules[1].members.find(m => m.source === 'hyperliquid');
  assert.equal(pepe.priceMultiplier, '0.001'); assert.equal(pepe.sourceUnit, 'kPEPE');
  assert.ok(rejected.some(r => r.market === 'PEPE/USD' && r.source === 'gmx' && r.reason === 'ambiguous_symbol'));
  assert.ok(rejected.some(r => r.market === 'FAKE/USD' && r.reason === 'price_unconfirmed'), 'ticker match alone is never enough');
  assert.ok(rejected.some(r => r.market === 'NOPX/USD' && r.reason === 'no_reference_price'));
  assert.ok(!rules.some(r => r.canonicalId === 'EUR/USD' || r.canonicalId === 'USDC/USD'), 'forex and stablecoins are never joined');
  // The registry accepts the generated rules: the HL kPEPE member normalizes per unit.
  const registry = new MarketRegistry({ equivalences: rules });
  for (const m of gains) registry.register('gains', m);
  registry.register('hyperliquid', hyperliquid[1]);
  assert.equal(registry.resolve('hyperliquid', 'main/kPEPE').id, 'PEPE/USD');
  assert.equal(registry.normalize({ source: 'hyperliquid', sourceMarketId: 'main/kPEPE', price: '0.0101' }).price, '0.0000101');
});

test('receipt timestamps are accepted per source only when that source policy allows it', () => {
  const config = { ...DEFAULT_CONFIG, sourcePolicies: { hyperliquid: { halfLifeMs: 2000, maxAgeMs: 10000, allowReceiptTimestamps: true } } };
  const observations = [o('gains', '100'), o('hyperliquid', '100', TIME, { timestampKind: 'RECEIPT' }), o('gmx', '100', TIME, { timestampKind: 'RECEIPT' })];
  const price = calculatePrice('BTC/USD', observations, TIME, config);
  assert.equal(price.pricingMode, 'DUAL_SOURCE');
  assert.equal(price.sources.find(s => s.source === 'gmx').exclusionReason, 'timestamp_unverified');
  assert.throws(() => calculatePrice('BTC/USD', observations, TIME, { ...config, sourcePolicies: { hyperliquid: { halfLifeMs: 2000, maxAgeMs: 10000, allowReceiptTimestamps: 'yes' } } }), /invalid_source_policy/);
});

test('an invalid unit multiplier is rejected when the rules are configured, not during registration', () => {
  assert.throws(() => new MarketRegistry({ equivalences: [{ canonicalId: 'X/USD', quoteAsset: 'USD', unit: 'X', evidence: 'test', members: [{ source: 'gmx', sourceMarketId: 'x', priceMultiplier: '0' }] }] }), /invalid_unit_multiplier/);
});

test('GMX never matches a market without an index address to a token without an address', async () => {
  const adapter = new GMXAdapter({ now: () => TIME, networks: [{ name: 'test', oracle: 'https://oracle.invalid', api: 'https://api.invalid' }],
    transport: { metrics: {}, request: async url => url.endsWith('/tokens') ? [{ symbol: 'NOADDR' }] : [{ marketToken: '0xmarket' }] } });
  const inventory = await adapter.discover();
  const market = inventory.find(m => m.instrumentType === 'PERPETUAL_UNDERLYING');
  assert.equal(market.identityVerified, false); assert.equal(market.quoteAsset, null);
  const token = inventory.find(m => m.instrumentType === 'TOKEN_REFERENCE');
  assert.equal(token.identityVerified, false); assert.ok(!String(token.sourceMarketId).includes('[object'));
});

function service(now) {
  const external = { hyperliquid: [hlMarket('BTC')], gmx: [gmxToken('BTC', '0xbtc')] };
  const s = new OpenOracleService({ now: () => now.t, logger: {} });
  s.setGainsCatalog([gainsRow('BTC/USD', 'BTC'), gainsRow('EUR/USD', 'EUR', 'forex'), gainsRow('AAPL/USD', 'AAPL', 'stocks', false)]);
  s.ingestGains('BTC/USD', { price: '100000', updatedAt: now.t, receivedAt: now.t });
  s.ingestGains('EUR/USD', { price: '1.1', updatedAt: now.t, receivedAt: now.t });
  for (const source of ['hyperliquid', 'gmx']) s.external[source].inventory = external[source];
  return s;
}
const feed = (s, source, price, now, kind = 'PROVIDER') => s.accept(source, [{ source, sourceMarketId: source === 'hyperliquid' ? 'main/BTC' : 'arbitrum/token/0xbtc',
  price, timestamp: now, receivedAt: now, timestampKind: kind, semantics: 'UNDERLYING_REFERENCE' }]);

test('the service publishes one composite per Gains symbol with honest modes', () => {
  const now = { t: TIME };
  const s = service(now);
  feed(s, 'hyperliquid', '100100', now.t, 'RECEIPT'); feed(s, 'gmx', '99900', now.t);
  now.t += 1000; s.tick();
  const btc = s.get('BTC/USD');
  assert.equal(btc.mode, 'TRIPLE_SOURCE'); assert.equal(btc.sources.length, 3); assert.ok(isUsable(btc, now.t));
  assert.ok(Number(btc.price) > 99900 && Number(btc.price) < 100100);
  assert.equal(s.get('EUR/USD').mode, 'SINGLE_SOURCE');
  assert.equal(s.get('AAPL/USD').mode, 'MARKET_CLOSED'); assert.equal(isUsable(s.get('AAPL/USD'), now.t), false);
  assert.equal(s.status().joinedMarkets, 1); assert.deepEqual(s.status().members, { hyperliquid: 1, gmx: 1 });
  assert.ok(!JSON.stringify(s.snapshot()).includes('rawObservation'), 'provider payloads are never published');
});

test('divergent sources block execution and keep the last composite flagged stale', () => {
  const now = { t: TIME };
  const s = service(now);
  feed(s, 'hyperliquid', '100000', now.t, 'RECEIPT'); now.t += 1000; s.tick();
  assert.equal(s.get('BTC/USD').mode, 'DUAL_SOURCE');
  const good = s.get('BTC/USD').price;
  s.ingestGains('BTC/USD', { price: '100000', updatedAt: now.t, receivedAt: now.t }); feed(s, 'hyperliquid', '110000', now.t, 'RECEIPT');
  now.t += 1000; const changed = s.tick();
  const btc = s.get('BTC/USD');
  assert.equal(btc.mode, 'DIVERGENT'); assert.equal(btc.stale, true); assert.equal(btc.price, good);
  assert.equal(isUsable(btc, now.t), false); assert.ok(changed.some(r => r.market === 'BTC/USD'));
});

test('stale inputs degrade instead of publishing an old price as fresh', () => {
  const now = { t: TIME };
  const s = service(now); now.t += 1000; s.tick();
  assert.equal(s.get('EUR/USD').mode, 'SINGLE_SOURCE');
  now.t += SERVICE_CONFIG.sourcePolicies.gains.maxAgeMs + 1000; s.tick();
  const eur = s.get('EUR/USD');
  assert.equal(eur.mode, 'STALE'); assert.equal(eur.stale, true); assert.equal(isUsable(eur, now.t), false);
});

test('a rebuild keeps the stale fallback and the catalog session updates in place', () => {
  const now = { t: TIME };
  const s = service(now); now.t += 1000; s.tick();
  const eur = s.get('EUR/USD').price;
  s.setGainsCatalog([gainsRow('BTC/USD', 'BTC'), gainsRow('EUR/USD', 'EUR', 'forex', false), gainsRow('AAPL/USD', 'AAPL', 'stocks', false)]);
  now.t += 1000; s.tick();
  assert.equal(s.get('EUR/USD').mode, 'MARKET_CLOSED'); assert.equal(s.get('EUR/USD').price, eur);
  s.rebuildPending = true; now.t += SERVICE_CONFIG.sourcePolicies.gains.maxAgeMs + 1000; s.tick();
  assert.equal(s.get('EUR/USD').price, eur, 'the previous composite survives a registry rebuild');
});

test('markets whose prices arrive after the first rebuild are joined on the next one', () => {
  const now = { t: TIME };
  const s = new OpenOracleService({ now: () => now.t, logger: {} });
  s.setGainsCatalog([gainsRow('BTC/USD', 'BTC')]);
  s.external.hyperliquid.inventory = [hlMarket('BTC')];
  feed(s, 'hyperliquid', '100000', now.t, 'RECEIPT');
  now.t += 1000; s.tick();
  assert.equal(s.status().joinedMarkets, 0); assert.ok(s.awaitingPrice.has('BTC/USD'));
  s.ingestGains('BTC/USD', { price: '100100', updatedAt: now.t, receivedAt: now.t });
  now.t += 1000; s.tick(); assert.equal(s.status().joinedMarkets, 0, 'rebuilds are throttled');
  now.t += 5000; feed(s, 'hyperliquid', '100050', now.t, 'RECEIPT'); s.tick();
  assert.equal(s.status().joinedMarkets, 1); assert.equal(s.get('BTC/USD').mode, 'DUAL_SOURCE');
});
