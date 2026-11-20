/* Isolated, non-financial Perpetual UI simulation (TEST FIXTURE ONLY).
 *
 * installPerpetualSimulation() runs in the page under test through Playwright
 * (page.evaluate). It replaces the Perpetual product adapter that the shared
 * trading iframe reads (parent.__ofReadOnlyProductAdapter) with an in-memory
 * simulator, so the full order lifecycle can be presented without any
 * provider, chain or Openfund write:
 *
 *   validate → previewAsync → review dialog → submitAsync → pending → filled /
 *   rejected / unconfirmed, plus simulated close and cancel, provider outage
 *   and recovery.
 *
 * Isolation guarantees:
 * - The application bundle contains no switch, flag or URL that enables this:
 *   only a test harness that already controls the browser can install it.
 * - Every document shows a fixed "SIMULATION" banner while it is installed.
 * - It never calls fetch, a wallet provider or a chain RPC; ids carry the
 *   `sim:` prefix and records carry `source: "simulation"`.
 * - Values (entry, fees, liquidation) are fixed illustrative numbers, not
 *   Gains calculations, and must never be presented outside this harness.
 */
function installPerpetualSimulation() {
  const W = window;
  const BANNER = 'SIMULATION — test fixture. No transaction is created, signed or sent; values are illustrative.';
  const banner = doc => {
    if (!doc?.body || doc.querySelector('[data-simulation-banner]')) return;
    const b = doc.createElement('div');
    b.dataset.simulationBanner = '';
    b.setAttribute('role', 'status');
    b.textContent = BANNER;
    b.style.cssText = 'position:fixed;inset-inline:0;bottom:0;z-index:2147483647;background:#7a4b00;color:#fff;font:600 12px/1.4 system-ui,sans-serif;padding:6px 10px;text-align:center;pointer-events:none';
    doc.body.append(b);
  };
  const notify = () => W.dispatchEvent(new Event('of-trading-update'));
  const delay = ms => new Promise(r => setTimeout(r, ms));
  /* same illustrative prices as helpers/market-fixtures.cjs */
  const PRICE = { 'BTC/USD': 50000, 'ETH/USD': 3000, 'SOL/USD': 150, 'EUR/USD': 1.1, 'XAU/USD': 2000 };
  const px = market => PRICE[market] || 100;
  const sim = {
    simulation: true,
    readOnly: false,
    canTrade: true,
    serverMode: true,
    status: 'ready',
    walletState: 'connected',
    scenario: 'fill',          // fill | reject | pending | unconfirmed | previewError
    calls: [],
    positions: [], orders: [], history: [], seq: 0, release: null, subs: new Set(),
    get state() { return { positions: this.positions, orders: this.orders, history: this.history, fills: [], funding: [], notifications: [] }; },
    getAccount() {
      return { equity: null, available: 1000, marginUsed: this.positions.reduce((s, p) => s + p.margin, 0), upnl: null,
        positionCount: this.positions.length, orderCount: this.orders.length };
    },
    validate(req) {
      if (this.status !== 'ready') return ['SIMULATED provider unavailable: actions are blocked.'];
      if (!(Number(req.collateral) > 0)) return ['Enter collateral.'];
      if (!(Number(req.leverage) >= 1.1 && Number(req.leverage) <= 150)) return ['Leverage outside the market limits.'];
      if (req.type !== 'market' && !(Number(req.price) > 0)) return ['Enter a trigger price.'];
      return [];
    },
    async previewAsync(req) {
      this.calls.push(['preview', req.type]);
      if (this.scenario === 'previewError') throw new Error('SIMULATED provider unavailable: preview failed.');
      const entry = req.type === 'market' ? px(req.market) : Number(req.price);
      const notional = Number(req.collateral) * Number(req.leverage);
      return { entry_price: entry, quantity: notional / entry, notional, liquidation_price: entry * (req.side === 'long' ? 0.9 : 1.1),
        open_fee: 0, available_margin: 1000, required_margin: Number(req.collateral) };
    },
    record(req) {
      const id = 'sim:' + (++this.seq);
      if (req.type === 'market') {
        this.positions.push({ id, source: 'simulation', market: req.market || 'BTC/USD', side: req.side, entry: px(req.market), size: null,
          margin: Number(req.collateral), currency: 'USDC', leverage: Number(req.leverage), sl: req.sl || null, tp: req.tp || null,
          liq: null, openedAt: Date.now(), feePaid: null });
        return 'position';
      }
      this.orders.push({ id, source: 'simulation', market: req.market || 'BTC/USD', side: req.side, type: req.type, size: null,
        trigger: Number(req.price), createdAt: Date.now() });
      return 'order';
    },
    async submitAsync(req) {
      this.calls.push(['submit', this.scenario]);
      await delay(150);
      if (this.scenario === 'reject') return { ok: false, errors: ['SIMULATED rejection (SLIPPAGE): nothing was executed.'] };
      if (this.scenario === 'unconfirmed') throw new Error('SIMULATED timeout');
      if (this.scenario === 'pending') await new Promise(r => { this.release = r; });
      const kind = this.record(req);
      notify();
      return { ok: true, kind };
    },
    async closePosition(id) {
      this.calls.push(['close', id]);
      const p = this.positions.find(x => x.id === id);
      if (!p) throw new Error('SIMULATED: position not found.');
      this.positions = this.positions.filter(x => x.id !== id);
      this.history.push({ id: id + ':close', market: p.market, side: p.side, size: null, price: px(p.market), time: Date.now(), type: 'SimulatedClose', result: 'SimulatedClose' });
      notify();
    },
    async cancelOrder(id) {
      this.calls.push(['cancel', id]);
      this.orders = this.orders.filter(x => x.id !== id);
      notify();
    },
    liqPrice() { return null; },
    subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
    checkTriggers() {}, loadDemoScenario() {},
    getPosition(id) { return this.positions.find(p => p.id === id); },
    refresh() { notify(); },
    setStatus(status) { this.status = status; notify(); },
  };
  /* the React shell re-assigns its own adapter on renders: keep the simulator
     pinned and the banner present (the iframe may be rebuilt) */
  const pin = () => {
    if (W.__ofReadOnlyProductAdapter !== sim) {
      Object.defineProperty(W, '__ofReadOnlyProductAdapter', { value: sim, configurable: true, writable: true });
      notify();
    }
    banner(document);
    for (const f of document.querySelectorAll('iframe')) { try { banner(f.contentDocument); } catch { /* cross-origin */ } }
  };
  W.__ofSim = sim;
  W.__ofSimTimer = setInterval(pin, 100);
  pin();
  return true;
}

module.exports = { installPerpetualSimulation };
