/*
 * Footprint price compatibility validator.
 *
 * The footprint paints Hyperliquid trade prices EXACTLY on the Gains chart's
 * price scale. This module only DECIDES whether that is meaningful; it never
 * shifts, rescales or normalizes any price, and it never feeds anything back
 * into the Gains price feed (it reads the chart's bars, nothing else).
 *
 * Comparable prices: per bar, the Hyperliquid LAST TRADE price in the bar vs
 * the Gains bar CLOSE (the Gains oracle mark at the bar's end). Both are the
 * last observed price of the same bucket; timestamps are checked so a bar is
 * only compared when the last Hyperliquid trade happened near the bar's end.
 *
 * Thresholds are per market, from measured calibration (scripts/footprint/
 * measure-basis.mjs → calibration.json): `medianBps` is the normal basis and
 * the band is the measured p05–p99 spread around it. No universal constant:
 *   warnBps = max(2 × band, 2 ticks)     (unusual divergence — show a notice)
 *   hideBps = max(5 × band, 6 ticks)     (incompatible — hide the footprint)
 * A market without calibration is `uncalibrated`: it is shown with a notice
 * only after enough live samples exist to estimate its own band.
 */

export const STATUS = Object.freeze({ OK: 'ok', WARN: 'warn', HIDE: 'hide', STALE: 'stale', CALIBRATING: 'calibrating' });

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Absolute / percent / bps difference between two comparable prices. */
export function priceDiff(hlPrice, gainsPrice) {
  const abs = hlPrice - gainsPrice;
  const pct = gainsPrice > 0 ? abs / gainsPrice * 100 : NaN;
  return { abs, pct, bps: pct * 100 };
}

/** Per-market limits in bps from a calibration record and the current tick. */
export function limitsFor(calibration, tickBps) {
  const tick = Number.isFinite(tickBps) && tickBps > 0 ? tickBps : 0;
  if (!calibration || !(calibration.n >= 30)) return null;
  const band = Math.max(Math.abs(calibration.p99Bps - calibration.medianBps), Math.abs(calibration.medianBps - calibration.p05Bps), calibration.madBps || 0);
  return {
    centerBps: calibration.medianBps,
    warnBps: Math.max(2 * band, 2 * tick),
    hideBps: Math.max(5 * band, 6 * tick),
  };
}

/**
 * Assess the compatibility of a footprint against the chart's Gains bars.
 *
 * input:
 *   gainsBars   [{ time, close }] ascending (the chart's own bars, read-only)
 *   hlLast      Map(barTime → { price, time }) — last Hyperliquid trade per bar
 *   tfMs        bar width in ms
 *   calibration measured record for this market (or null)
 *   tickPrice   current Hyperliquid tick (price units) for the tick floor
 *   feed        { connected, lastHeartbeat } from the live service
 *   now         clock (ms)
 *   staleMs     heartbeat age after which the live feed is stale
 *
 * output: { status, reason, samples, recentBps, limits, perBar: Map(time → bps) }
 */
export function assessCompatibility({ gainsBars, hlLast, tfMs, calibration, tickPrice, feed, now = Date.now(), staleMs = 20_000, recent = 5 }) {
  const perBar = new Map();
  const devs = [];
  for (const b of gainsBars || []) {
    const h = hlLast?.get(b.time);
    if (!h || !(b.close > 0) || !(h.price > 0)) continue;
    /* only compare when the last trade is close to the bar's end — otherwise the
       two prices belong to different instants */
    const barEnd = b.time + tfMs;
    if (barEnd - h.time > Math.max(60_000, tfMs * 0.25)) continue;
    perBar.set(b.time, priceDiff(h.price, b.close).bps);
  }
  const ordered = [...perBar.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const last = ordered.slice(-recent);
  const refPrice = gainsBars?.length ? gainsBars[gainsBars.length - 1].close : 0;
  const tickBps = refPrice > 0 && tickPrice > 0 ? tickPrice / refPrice * 1e4 : 0;

  let limits = limitsFor(calibration, tickBps);
  let calibrated = !!limits;
  if (!limits && ordered.length >= 30) {
    /* no stored calibration: estimate the band from this chart's own history */
    const med = median(ordered);
    const mad = median(ordered.map(x => Math.abs(x - med)));
    limits = { centerBps: med, warnBps: Math.max(6 * mad, 2 * tickBps), hideBps: Math.max(15 * mad, 6 * tickBps) };
    calibrated = true;
  }
  const recentBps = last.length ? median(last) : null;
  const base = { samples: ordered.length, recentBps, limits, perBar };

  if (feed && feed.connected === false) return { ...base, status: STATUS.STALE, reason: 'feed_disconnected' };
  if (feed && (!(feed.lastHeartbeat > 0) || now - feed.lastHeartbeat > staleMs)) return { ...base, status: STATUS.STALE, reason: 'feed_heartbeat_late' };
  if (!calibrated) return { ...base, status: STATUS.CALIBRATING, reason: 'insufficient_samples' };
  if (recentBps == null) return { ...base, status: STATUS.OK, reason: 'no_recent_overlap' };
  const dev = Math.abs(recentBps - limits.centerBps);
  if (dev > limits.hideBps) return { ...base, status: STATUS.HIDE, reason: 'basis_incompatible' };
  if (dev > limits.warnBps) return { ...base, status: STATUS.WARN, reason: 'basis_unusual' };
  return { ...base, status: STATUS.OK, reason: 'within_measured_band' };
}
