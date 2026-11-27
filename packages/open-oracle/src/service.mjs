import { MarketRegistry } from './registry.mjs';
import { OracleEngine } from './engine.mjs';
import { DEFAULT_CONFIG, validateConfig } from './pricing.ts';
import { decimal } from './decimal.ts';
import { buildEquivalences } from './equivalence.mjs';
import { setTimeout as delay } from 'node:timers/promises';
/**
 * Openfund pricing service: the long-running form of Open Oracle.
 *
 * Gains observations are pushed in by the host (the backend already holds
 * the Gains price socket) or polled through a GainsAdapter. Hyperliquid and
 * GMX are polled within a fixed request budget. Every `evaluateMs` the
 * engine computes one composite per Gains market; joined crypto markets use
 * the price-confirmed equivalences from `buildEquivalences`, every other
 * market is honestly single-source. Composites are published per Gains
 * symbol, so existing market identifiers stay stable for every consumer.
 *
 * The service never fabricates a price: a market whose sources diverge or go
 * stale keeps its last composite flagged `stale`, and `isUsable` refuses it
 * for execution.
 */
export const SERVICE_CONFIG = Object.freeze({
  ...DEFAULT_CONFIG, version: 'openfund-service-1',
  halfLifeMs: 4000, maxAgeMs: 15000, maxAlignmentMs: 6000,
  dualTolerance: '0.02', hardDeviation: '0.05', allowReceiptTimestamps: false,
  // Hyperliquid's public context snapshot has no event time; receipt time is accepted only for it, with a short age bound.
  sourcePolicies: Object.freeze({ hyperliquid: Object.freeze({ halfLifeMs: 3000, maxAgeMs: 9000, allowReceiptTimestamps: true }) }),
});
export const USABLE_MODES = Object.freeze(new Set(['TRIPLE_SOURCE', 'DUAL_SOURCE', 'SINGLE_SOURCE']));
/** Execution gate: a fresh, non-stale composite in a usable mode. */
export function isUsable(record, now = Date.now(), maxAgeMs = 5000) {
  return Boolean(record && record.price !== null && !record.stale && USABLE_MODES.has(record.mode) && now - record.at <= maxAgeMs);
}
const NO_CANDLES = Object.freeze({ ingest: () => [], advance: () => [] });
const positiveString = value => { if (value === null || value === undefined) return null; const s = String(value); try { return decimal(s) > 0n ? s : null; } catch { return null; } };

export class OpenOracleService {
  constructor({ adapters = {}, config = SERVICE_CONFIG, now = Date.now, evaluateMs = 1000,
    pollMs = { gains: 2000, hyperliquid: 3000, gmx: 2000 }, rediscoverMs = 600000, gmxNetwork = 'arbitrum',
    maxDeviation = '0.1', logger = console } = {}) {
    validateConfig(config);
    Object.assign(this, { adapters, config, now, evaluateMs, pollMs, rediscoverMs, gmxNetwork, maxDeviation, logger });
    this.catalog = new Map();        // Gains symbol → adapter-shaped inventory metadata
    this.gainsLatest = new Map();    // Gains symbol → last observation
    this.external = { hyperliquid: { inventory: [], discoveredAt: 0, latest: new Map(), observations: [], polls: 0, failures: 0, lastPollAt: 0, lastError: null },
      gmx: { inventory: [], discoveredAt: 0, latest: new Map(), observations: [], polls: 0, failures: 0, lastPollAt: 0, lastError: null } };
    this.records = new Map(); this.listeners = new Set(); this.rules = []; this.rejected = [];
    this.engine = null; this.registry = null; this.idToSymbol = new Map();
    this.rebuildPending = true; this.rebuilds = 0; this.lastRebuildAt = 0; this.lastEvaluation = 0; this.startedAt = 0;
    this.gainsReceived = 0; this.stopped = true; this.timer = null; this.controller = null;
  }
  /* ---------------- Gains input ---------------- */
  /** Accepts raw Gains catalog rows ({symbol, base, quote, group, isOpen}). */
  setGainsCatalog(markets) {
    const next = new Map();
    for (const m of markets) {
      if (!m || typeof m.symbol !== 'string' || !m.symbol || typeof m.base !== 'string') continue;
      next.set(m.symbol, { sourceMarketId: m.symbol, symbol: m.symbol, baseAsset: m.base, unit: m.base,
        quoteAsset: m.quote ?? (m.symbol.includes('/') ? m.symbol.split('/')[1] : null), assetClass: m.group ?? m.category ?? 'UNKNOWN',
        instrumentType: 'REFERENCE', priceDecimals: 24, marketHours: null,
        session: m.isOpen === false ? 'CLOSED' : m.isOpen === true ? 'OPEN' : 'UNKNOWN', identityVerified: true,
        semantics: 'UNDERLYING_REFERENCE', identityEvidence: 'Gains market catalog base/quote; source-scoped identity only' });
    }
    const changed = next.size !== this.catalog.size || [...next.keys()].some(k => !this.catalog.has(k));
    this.catalog = next;
    if (changed) this.rebuildPending = true;
    else if (this.registry) for (const m of next.values()) this.registry.register('gains', m); // session updates in place
  }
  /** One Gains price. `field` records whether the Gains index or mark was used. */
  ingestGains(symbol, { price, updatedAt, receivedAt = this.now(), field = 'index' }) {
    const p = positiveString(price);
    if (!p || !Number.isSafeInteger(updatedAt) || updatedAt <= 0) return false;
    const o = { source: 'gains', sourceMarketId: symbol, price: p, timestamp: Math.min(updatedAt, receivedAt), receivedAt,
      timestampKind: 'PROVIDER', semantics: 'UNDERLYING_REFERENCE', microstructure: { field } };
    this.gainsLatest.set(symbol, o); this.gainsReceived++;
    try { this.engine?.ingest(o); } catch (error) { this.logger.warn?.('[open-oracle] gains ingest', error.message); }
    return true;
  }
  /* ---------------- lifecycle ---------------- */
  start() {
    if (!this.stopped) return this;
    this.stopped = false; this.startedAt = this.now(); this.controller = new AbortController();
    for (const source of ['gains', 'hyperliquid', 'gmx']) if (this.adapters[source]) this.#loop(source).catch(() => {});
    this.timer = setInterval(() => { try { this.tick(); } catch (error) { this.logger.error?.('[open-oracle] evaluation', error.message); } }, this.evaluateMs);
    this.timer.unref?.();
    return this;
  }
  stop() { this.stopped = true; clearInterval(this.timer); this.timer = null; this.controller?.abort(); }
  async #loop(source) {
    const adapter = this.adapters[source], signal = this.controller.signal;
    let failures = 0, discoveredAt = 0;
    while (!this.stopped) {
      try {
        if (!discoveredAt || this.now() - discoveredAt > this.rediscoverMs) {
          const inventory = await adapter.discover(signal);
          discoveredAt = this.now();
          if (source === 'gains') this.setGainsCatalog(inventory.map(m => m.raw ?? m));
          else { this.external[source].inventory = inventory; this.external[source].discoveredAt = discoveredAt; this.rebuildPending = true; }
        }
        const observations = await adapter.snapshot(signal);
        this.accept(source, observations);
        failures = 0;
      } catch (error) {
        if (signal.aborted) break;
        failures++;
        if (this.external[source]) { this.external[source].failures++; this.external[source].lastError = error.code ?? error.message; }
        this.engine?.observeExpected(source, { time: this.now(), received: false, valid: false, timely: false });
      }
      const backoff = failures ? Math.min(60000, 1000 * 2 ** Math.min(failures, 6)) : 0;
      try { await delay(Math.max(this.pollMs[source] ?? 2000, backoff), undefined, { signal }); }
      catch { break; }
    }
  }
  /** One provider snapshot (also used by hosts and tests that poll on their own). */
  accept(source, observations) {
    if (source === 'gains') {
      for (const o of observations) this.ingestGains(o.sourceMarketId, { price: o.price, updatedAt: o.timestamp, receivedAt: o.receivedAt, field: 'index' });
      return;
    }
    const state = this.external[source], first = state.latest.size === 0;
    state.latest = new Map(observations.map(o => [o.sourceMarketId, o.price]));
    state.observations = observations; state.polls++; state.lastPollAt = this.now(); state.lastError = null;
    if (first && observations.length) this.rebuildPending = true; // price confirmation needs a first snapshot
    if (!this.engine) return;
    for (const o of observations) { if (this.registry.resolve(source, o.sourceMarketId)) try { this.engine.ingest(o); } catch { /* diagnostic only */ } }
    const now = this.now();
    this.engine.observeExpected(source, { time: now, received: true, valid: observations.length > 0, timely: observations.some(o => now - o.timestamp <= 10000) });
  }
  /* ---------------- registry ---------------- */
  rebuild() {
    const at = this.now(), gains = [...this.catalog.values()];
    const { rules, rejected } = buildEquivalences(
      { gains, hyperliquid: this.external.hyperliquid.inventory, gmx: this.external.gmx.inventory },
      { gains: new Map([...this.gainsLatest].map(([k, o]) => [k, o.price])), hyperliquid: this.external.hyperliquid.latest, gmx: this.external.gmx.latest },
      { gmxNetwork: this.gmxNetwork, maxDeviation: this.maxDeviation, at });
    const registry = new MarketRegistry({ equivalences: rules, maxMarkets: 10000 });
    for (const m of gains) registry.register('gains', m);
    const inventories = { hyperliquid: new Map(this.external.hyperliquid.inventory.map(m => [m.sourceMarketId, m])), gmx: new Map(this.external.gmx.inventory.map(m => [m.sourceMarketId, m])) };
    for (const rule of rules) for (const member of rule.members) if (member.source !== 'gains') {
      const metadata = inventories[member.source]?.get(member.sourceMarketId);
      if (metadata) registry.register(member.source, metadata);
    }
    const engine = new OracleEngine({ registry, config: this.config, candles: NO_CANDLES });
    const idToSymbol = new Map();
    for (const entry of registry.list()) { const g = entry.sourceMappings.find(m => m.source === 'gains'); if (g) idToSymbol.set(entry.id, g.sourceMarketId); }
    // Keep the last composite per market as the stale fallback, and replay the latest inputs into the new engine.
    const symbolToId = new Map([...idToSymbol].map(([id, symbol]) => [symbol, id]));
    if (this.engine) for (const [id, price] of this.engine.prices) {
      const nextId = symbolToId.get(this.idToSymbol.get(id));
      if (nextId) engine.prices.set(nextId, { ...price, marketId: nextId });
    }
    for (const o of this.gainsLatest.values()) try { engine.ingest(o); } catch { /* skip */ }
    for (const source of ['hyperliquid', 'gmx']) for (const o of this.external[source].observations) if (registry.resolve(source, o.sourceMarketId)) try { engine.ingest(o); } catch { /* skip */ }
    Object.assign(this, { registry, engine, idToSymbol, rules, rejected, rebuildPending: false, lastRebuildAt: at });
    this.rebuilds++;
    return { rules: rules.length, rejected: rejected.length };
  }
  /* ---------------- evaluation ---------------- */
  tick() {
    if (!this.catalog.size) return [];
    if (this.rebuildPending || (this.lastRebuildAt && this.now() - this.lastRebuildAt > this.rediscoverMs)) this.rebuild();
    const time = Math.max(this.now(), this.engine.lastEvaluation + 1);
    const outputs = this.engine.evaluate(time), changed = [];
    for (const output of outputs) {
      const symbol = this.idToSymbol.get(output.marketId);
      if (!symbol) continue;
      const previous = this.records.get(symbol), record = publicRecord(symbol, output);
      this.records.set(symbol, record);
      if (!previous || previous.price !== record.price || previous.mode !== record.mode || previous.stale !== record.stale) changed.push(record);
    }
    this.lastEvaluation = time;
    for (const fn of this.listeners) try { fn(changed, time); } catch (error) { this.logger.warn?.('[open-oracle] listener', error.message); }
    return changed;
  }
  onUpdate(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  get(symbol) { return this.records.get(symbol) ?? null; }
  snapshot() { return [...this.records.values()]; }
  status() {
    const modes = {};
    for (const r of this.records.values()) modes[r.mode] = (modes[r.mode] ?? 0) + 1;
    const members = { hyperliquid: 0, gmx: 0 };
    for (const rule of this.rules) for (const m of rule.members) if (m.source in members) members[m.source]++;
    const external = Object.fromEntries(Object.entries(this.external).map(([source, s]) => [source, {
      enabled: Boolean(this.adapters[source]), inventory: s.inventory.length, prices: s.latest.size, polls: s.polls, failures: s.failures,
      lastPollAt: s.lastPollAt || null, lastError: s.lastError }]));
    return { running: !this.stopped, startedAt: this.startedAt || null, lastEvaluation: this.lastEvaluation || null,
      algorithmVersion: this.config.algorithmVersion, configurationVersion: this.config.version,
      markets: this.records.size, modes, joinedMarkets: this.rules.length, members, rebuilds: this.rebuilds, lastRebuildAt: this.lastRebuildAt || null,
      sources: { gains: { catalog: this.catalog.size, prices: this.gainsLatest.size, received: this.gainsReceived }, ...external } };
  }
}
/** The public, provider-payload-free view of a composite. */
export function publicRecord(symbol, output) {
  return { market: symbol, price: output.price, mode: output.pricingMode, confidence: output.confidence, stale: output.stale,
    session: output.marketSession, at: output.timestamp, referenceTimestamp: output.referenceTimestamp,
    eligibleSources: output.eligibleSourceCount, configuredSources: output.configuredSourceCount, spread: output.spread,
    sources: output.sources.map(c => ({ source: c.source, price: c.normalizedPrice, rawPrice: c.rawPrice, ageMs: c.ageMs,
      eligible: c.eligible, reason: c.exclusionReason, weight: c.weight })),
    algorithmVersion: output.algorithmVersion, configurationVersion: output.configurationVersion };
}
