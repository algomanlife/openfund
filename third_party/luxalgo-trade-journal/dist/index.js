// third_party/luxalgo-trade-journal/packages-core/src/round-trips.ts
var FLAT_EPS = 1e-9;
var sum = (values) => values.reduce((total, v) => total + v, 0);
var openQuantityOf = (cycle) => sum(cycle.lots.map((lot) => lot.quantity));
var consumeLots = (cycle, quantity, method) => {
  let remaining = quantity;
  let matchedNotional = 0;
  if (method === "wavg") {
    const totalQty = openQuantityOf(cycle);
    const totalNotional = sum(cycle.lots.map((lot) => lot.quantity * lot.price));
    const avgPrice = totalQty > 0 ? totalNotional / totalQty : 0;
    matchedNotional = avgPrice * quantity;
    const scale = totalQty > 0 ? (totalQty - quantity) / totalQty : 0;
    cycle.lots = cycle.lots.map((lot) => ({ ...lot, quantity: lot.quantity * scale })).filter((lot) => lot.quantity > FLAT_EPS);
    return matchedNotional;
  }
  while (remaining > FLAT_EPS && cycle.lots.length > 0) {
    const index = method === "fifo" ? 0 : cycle.lots.length - 1;
    const lot = cycle.lots[index];
    const take = Math.min(lot.quantity, remaining);
    matchedNotional += take * lot.price;
    lot.quantity -= take;
    remaining -= take;
    if (lot.quantity <= FLAT_EPS) cycle.lots.splice(index, 1);
  }
  return matchedNotional;
};
var finalizeCycle = (cycle, accountId, symbol, assetClass, closedAt, keyCollisions, importGroup, contractMultiplier) => {
  const openQuantity = openQuantityOf(cycle);
  const netPnl = cycle.grossPnl - cycle.fees;
  const isOpen = openQuantity > FLAT_EPS;
  const status = isOpen ? "open" : Math.abs(netPnl) <= 1e-9 ? "breakeven" : netPnl > 0 ? "win" : "loss";
  const baseKey = `${accountId}|${symbol}|${cycle.direction}|${cycle.openedAt}${importGroup ? `|import:${encodeURIComponent(importGroup)}` : ""}`;
  const collision = keyCollisions.get(baseKey) ?? 0;
  keyCollisions.set(baseKey, collision + 1);
  const key = collision === 0 ? baseKey : `${baseKey}|${collision}`;
  return {
    key,
    accountId,
    symbol,
    assetClass,
    direction: cycle.direction,
    status,
    openedAt: cycle.openedAt,
    closedAt: isOpen ? void 0 : closedAt,
    quantity: cycle.entryQuantity,
    openQuantity: isOpen ? openQuantity : 0,
    avgEntry: cycle.entryQuantity > 0 ? cycle.entryNotional / cycle.entryQuantity : 0,
    avgExit: cycle.exitQuantity > 0 ? cycle.exitNotional / cycle.exitQuantity : void 0,
    grossPnl: cycle.grossPnl,
    fees: cycle.fees,
    netPnl,
    executionCount: cycle.executionCount,
    executionIds: cycle.executionIds,
    exits: cycle.exits,
    durationMs: !isOpen && closedAt ? Date.parse(closedAt) - Date.parse(cycle.openedAt) : void 0,
    ...contractMultiplier !== void 0 ? { contractMultiplier } : {}
  };
};
var compareNumbers = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var importOrderOf = (execution) => execution.importMetadata?.order ?? Number.POSITIVE_INFINITY;
var compareExecutions = (a, b) => compareNumbers(Date.parse(a.executedAt), Date.parse(b.executedAt)) || compareNumbers(importOrderOf(a), importOrderOf(b)) || a.id.localeCompare(b.id);
var buildRoundTrips = (executions, options = {}) => {
  const method = options.method ?? "fifo";
  const trips = [];
  const keyCollisions = /* @__PURE__ */ new Map();
  const groups = /* @__PURE__ */ new Map();
  for (const execution of executions) {
    const groupKey = `${execution.accountId}\0${execution.symbol}${execution.importMetadata?.group ? `\0${execution.importMetadata.group}` : ""}`;
    const group = groups.get(groupKey);
    if (group) group.push(execution);
    else groups.set(groupKey, [execution]);
  }
  for (const group of groups.values()) {
    group.sort(compareExecutions);
    const { accountId, symbol } = group[0];
    const importGroup = group[0].importMetadata?.group;
    const contractMultiplier = options.multipliers?.[symbol];
    const multiplier = contractMultiplier ?? 1;
    const assetClass = group.find((e) => e.assetClass)?.assetClass;
    let cycle = null;
    for (const execution of group) {
      let signedQty = execution.side === "buy" ? execution.quantity : -execution.quantity;
      let feeRemaining = execution.fee;
      let counted = false;
      while (Math.abs(signedQty) > FLAT_EPS) {
        if (!cycle) {
          cycle = {
            direction: signedQty > 0 ? "long" : "short",
            openedAt: execution.executedAt,
            lots: [],
            entryQuantity: 0,
            entryNotional: 0,
            exitQuantity: 0,
            exitNotional: 0,
            grossPnl: 0,
            fees: 0,
            executionIds: [],
            exits: [],
            executionCount: 0
          };
        }
        const isEntry = cycle.direction === "long" && signedQty > 0 || cycle.direction === "short" && signedQty < 0;
        if (!counted) {
          cycle.executionIds.push(execution.id);
          cycle.executionCount += 1;
          counted = true;
        } else if (!cycle.executionIds.includes(execution.id)) {
          cycle.executionIds.push(execution.id);
          cycle.executionCount += 1;
        }
        if (isEntry) {
          const qty = Math.abs(signedQty);
          cycle.lots.push({ quantity: qty, price: execution.price });
          cycle.entryQuantity += qty;
          cycle.entryNotional += qty * execution.price;
          cycle.fees += feeRemaining;
          feeRemaining = 0;
          signedQty = 0;
        } else {
          const openQty = openQuantityOf(cycle);
          const exitQty = Math.min(Math.abs(signedQty), openQty);
          const matchedNotional = consumeLots(cycle, exitQty, method);
          const exitNotional = exitQty * execution.price;
          const chunkGross = execution.importMetadata?.reportedGrossPnl ?? (cycle.direction === "long" ? (exitNotional - matchedNotional) * multiplier : (matchedNotional - exitNotional) * multiplier);
          const feeShare = Math.abs(signedQty) > 0 ? feeRemaining * (exitQty / Math.abs(signedQty)) : 0;
          cycle.grossPnl += chunkGross;
          cycle.fees += feeShare;
          feeRemaining -= feeShare;
          cycle.exitQuantity += exitQty;
          cycle.exitNotional += exitNotional;
          cycle.exits.push({ executionId: execution.id, grossPnl: chunkGross, quantity: exitQty });
          signedQty += cycle.direction === "long" ? exitQty : -exitQty;
          if (openQuantityOf(cycle) <= FLAT_EPS) {
            trips.push(
              finalizeCycle(
                cycle,
                accountId,
                symbol,
                assetClass,
                execution.executedAt,
                keyCollisions,
                importGroup,
                contractMultiplier
              )
            );
            cycle = null;
          }
        }
      }
      if (feeRemaining !== 0 && cycle) {
        cycle.fees += feeRemaining;
      }
    }
    if (cycle) {
      trips.push(
        finalizeCycle(
          cycle,
          accountId,
          symbol,
          assetClass,
          void 0,
          keyCollisions,
          importGroup,
          contractMultiplier
        )
      );
    }
  }
  trips.sort(
    (a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt) || a.key.localeCompare(b.key)
  );
  return trips;
};

// third_party/luxalgo-trade-journal/packages-core/src/time.ts
var dateFormatters = /* @__PURE__ */ new Map();
var partFormatters = /* @__PURE__ */ new Map();
var dateFormatter = (timeZone) => {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter;
};
var partFormatter = (timeZone) => {
  let formatter = partFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      hour12: false
    });
    partFormatters.set(timeZone, formatter);
  }
  return formatter;
};
var dayKeyOf = (iso, timeZone = "UTC") => dateFormatter(timeZone).format(new Date(iso));
var monthKeyOf = (iso, timeZone = "UTC") => dayKeyOf(iso, timeZone).slice(0, 7);
var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var weekdayOf = (iso, timeZone = "UTC") => {
  const parts = partFormatter(timeZone).formatToParts(new Date(iso));
  return parts.find((p) => p.type === "weekday")?.value ?? "Sun";
};
var hourOf = (iso, timeZone = "UTC") => {
  const parts = partFormatter(timeZone).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return hour === 24 ? 0 : hour;
};

// third_party/luxalgo-trade-journal/packages-core/src/equity.ts
var closedByCloseTime = (trades) => trades.filter((t) => t.status !== "open" && !!t.closedAt).sort(
  (a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt) || a.key.localeCompare(b.key)
);
var equityCurve = (trades) => {
  let cum = 0;
  return closedByCloseTime(trades).map((trade) => {
    cum += trade.netPnl;
    return { t: trade.closedAt, cumNetPnl: cum };
  });
};
var dailyStats = (trades, timeZone = "UTC") => {
  const days = /* @__PURE__ */ new Map();
  for (const trade of closedByCloseTime(trades)) {
    const date = dayKeyOf(trade.closedAt, timeZone);
    let day = days.get(date);
    if (!day) {
      day = {
        date,
        netPnl: 0,
        grossPnl: 0,
        fees: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        volume: 0
      };
      days.set(date, day);
    }
    day.netPnl += trade.netPnl;
    day.grossPnl += trade.grossPnl;
    day.fees += trade.fees;
    day.trades += 1;
    day.volume += trade.quantity;
    if (trade.status === "win") day.wins += 1;
    else if (trade.status === "loss") day.losses += 1;
    else day.breakevens += 1;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
};
var dailyCumulative = (trades, timeZone = "UTC") => {
  return dailyCumulativeFromDays(dailyStats(trades, timeZone));
};
var dailyCumulativeFromDays = (days) => {
  let cum = 0;
  return days.map((day) => {
    cum += day.netPnl;
    return { t: day.date, cumNetPnl: cum };
  });
};
var relativeDrawdownCurve = (curve, initialBalance = 0) => {
  let peak = 0;
  return curve.map((point) => {
    if (point.cumNetPnl > peak) peak = point.cumNetPnl;
    const base = initialBalance + peak;
    return {
      t: point.t,
      drawdownPct: base > 0 ? (peak - point.cumNetPnl) / base : null
    };
  });
};
var drawdown = (curve, initialBalance = 0) => {
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = null;
  for (const point of curve) {
    if (point.cumNetPnl > peak) peak = point.cumNetPnl;
    const dd = peak - point.cumNetPnl;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      const base = initialBalance + peak;
      maxDrawdownPct = base > 0 ? dd / base : null;
    }
  }
  return { maxDrawdown, maxDrawdownPct, peak };
};
var intradayCurve = (trades, executionTimes, date, timeZone = "UTC") => {
  const events = [];
  for (const trade of trades) {
    const totalExitQty = trade.exits.reduce((total, exit) => total + exit.quantity, 0);
    for (const exit of trade.exits) {
      const t = executionTimes.get(exit.executionId);
      if (!t || dayKeyOf(t, timeZone) !== date) continue;
      const feeShare = totalExitQty > 0 ? trade.fees * (exit.quantity / totalExitQty) : 0;
      events.push({ t, pnl: exit.grossPnl - feeShare });
    }
  }
  events.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  let cum = 0;
  return events.map((event) => {
    cum += event.pnl;
    return { t: event.t, cumNetPnl: cum };
  });
};

// third_party/luxalgo-trade-journal/packages-core/src/analysis.ts
var FILTER_KEYS = [
  "accounts",
  "from",
  "to",
  "symbol",
  "excludeSymbol",
  "tag",
  "mistake",
  "playbookId",
  "direction",
  "status",
  "assetClass",
  "reviewed",
  "ratingMin",
  "ratingMax",
  "quantityMin",
  "quantityMax",
  "entryMin",
  "entryMax",
  "exitMin",
  "exitMax",
  "durationMin",
  "durationMax",
  "rMin",
  "rMax",
  "plannedRMin",
  "plannedRMax",
  "pnlMin",
  "pnlMax",
  "weekdays",
  "entryAfter",
  "entryBefore",
  "exitAfter",
  "exitBefore"
];
var readFilters = (params) => Object.fromEntries(
  FILTER_KEYS.flatMap((key) => params.get(key) ? [[key, params.get(key)]] : [])
);
function tradeRisk(trade) {
  const stop = trade.annotations?.stopLoss;
  const multiplier = trade.contractMultiplier ?? (["futures", "option", "cfd", "forex"].includes(trade.assetClass ?? "") ? null : 1);
  if (stop == null || multiplier == null || multiplier <= 0 || trade.quantity <= 0) return null;
  const distance = (trade.avgEntry - stop) * (trade.direction === "long" ? 1 : -1);
  return distance > 0 ? distance * trade.quantity * multiplier : null;
}
function tradeR(trade) {
  const risk = tradeRisk(trade);
  return risk && trade.status !== "open" ? trade.netPnl / risk : null;
}
function plannedR(trade) {
  const stop = trade.annotations?.stopLoss;
  const target = trade.annotations?.profitTarget;
  if (stop == null || target == null) return null;
  const sign = trade.direction === "long" ? 1 : -1;
  const risk = (trade.avgEntry - stop) * sign;
  const reward = (target - trade.avgEntry) * sign;
  return risk > 0 && reward >= 0 ? reward / risk : null;
}
var partsCache = /* @__PURE__ */ new Map();
function clockTime(iso, timeZone) {
  let format = partsCache.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    partsCache.set(timeZone, format);
  }
  return format.format(new Date(iso));
}
var list = (value) => (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
var within = (value, min, max) => {
  if (!min && !max) return true;
  if (value == null || !Number.isFinite(value)) return false;
  return (!min || Number.isFinite(Number(min)) && value >= Number(min)) && (!max || Number.isFinite(Number(max)) && value <= Number(max));
};
function inTime(iso, after, before, tz) {
  if (!after && !before) return true;
  if (!iso) return false;
  const t = clockTime(iso, tz);
  return after && before && after > before ? t >= after || t <= before : (!after || t >= after) && (!before || t <= before);
}
function matchesFilters(t, f, tz = "UTC") {
  const a = t.annotations;
  if (f.accounts && !list(f.accounts).includes(t.accountId)) return false;
  if (f.from || f.to) {
    const day = dayKeyOf(t.closedAt ?? t.openedAt, tz);
    if (f.from && day < f.from || f.to && day > f.to) return false;
  }
  if (f.symbol && !list(f.symbol.toUpperCase()).includes(t.symbol.toUpperCase())) return false;
  if (list(f.excludeSymbol?.toUpperCase()).includes(t.symbol.toUpperCase())) return false;
  if (f.tag && !list(f.tag).every((tag) => a?.tags?.includes(tag))) return false;
  if (f.mistake && !list(f.mistake).every((tag) => a?.mistakes?.includes(tag))) return false;
  if (f.playbookId && a?.playbook !== f.playbookId) return false;
  if (f.direction && t.direction !== f.direction) return false;
  if (f.status && (f.status === "closed" ? t.status === "open" : t.status !== f.status))
    return false;
  if (f.assetClass && t.assetClass !== f.assetClass) return false;
  if (f.reviewed && Boolean(a?.reviewed) !== (f.reviewed === "yes")) return false;
  if (!within(a?.rating, f.ratingMin, f.ratingMax) || !within(t.quantity, f.quantityMin, f.quantityMax) || !within(t.avgEntry, f.entryMin, f.entryMax) || !within(t.avgExit, f.exitMin, f.exitMax) || !within(t.durationMs == null ? null : t.durationMs / 6e4, f.durationMin, f.durationMax) || (f.rMin || f.rMax) && !within(tradeR(t), f.rMin, f.rMax) || (f.plannedRMin || f.plannedRMax) && !within(plannedR(t), f.plannedRMin, f.plannedRMax) || !within(t.netPnl, f.pnlMin, f.pnlMax))
    return false;
  if (f.weekdays) {
    const dayIndex = (/* @__PURE__ */ new Date(dayKeyOf(t.openedAt, tz) + "T12:00:00Z")).getUTCDay();
    if (!list(f.weekdays).includes(String(dayIndex))) return false;
  }
  return inTime(t.openedAt, f.entryAfter, f.entryBefore, tz) && inTime(t.closedAt, f.exitAfter, f.exitBefore, tz);
}
var DIMENSIONS = {
  symbol: "Symbol",
  playbook: "Strategy",
  tag: "Tag",
  mistake: "Mistake",
  direction: "Direction",
  assetClass: "Asset class",
  weekday: "Weekday",
  month: "Month",
  entryHour: "Entry hour",
  exitHour: "Exit hour",
  entry15: "Entry \xB7 15 minutes",
  exit15: "Exit \xB7 15 minutes",
  duration: "Holding time",
  quantity: "Position size",
  entryPrice: "Entry price",
  exitPrice: "Exit price",
  realizedR: "Realized R",
  plannedR: "Planned R",
  outcome: "Outcome"
};
var bands = (n, bounds, labels) => n == null || Number.isNaN(n) ? "Unspecified" : labels[bounds.findIndex((b) => n < b)] ?? labels[labels.length - 1];
function dimensionKeys(t, dimension, tz) {
  const bucketTime = (iso, step) => {
    if (!iso) return "Open";
    const time = clockTime(iso, tz);
    return time.slice(0, 3) + String(Math.floor(Number(time.slice(3)) / step) * step).padStart(2, "0");
  };
  switch (dimension) {
    case "tag":
      return t.annotations?.tags?.length ? t.annotations.tags : ["Untagged"];
    case "mistake":
      return t.annotations?.mistakes?.length ? t.annotations.mistakes : ["None"];
    case "playbook":
      return [t.annotations?.playbook ?? "Unassigned"];
    case "symbol":
      return [t.symbol];
    case "direction":
      return [t.direction];
    case "outcome":
      return [t.status];
    case "assetClass":
      return [t.assetClass ?? "Unspecified"];
    case "month":
      return [dayKeyOf(t.closedAt ?? t.openedAt, tz).slice(0, 7)];
    case "weekday":
      return [
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(/* @__PURE__ */ new Date(dayKeyOf(t.openedAt, tz) + "T12:00:00Z")).getUTCDay()]
      ];
    case "entryHour":
      return [bucketTime(t.openedAt, 60)];
    case "exitHour":
      return [bucketTime(t.closedAt, 60)];
    case "entry15":
      return [bucketTime(t.openedAt, 15)];
    case "exit15":
      return [bucketTime(t.closedAt, 15)];
    case "duration":
      return [
        bands(
          t.durationMs == null ? void 0 : t.durationMs / 6e4,
          [1, 5, 15, 60, 240, 1440],
          ["<1m", "1\u20135m", "5\u201315m", "15\u201360m", "1\u20134h", "4\u201324h", "1d+"]
        )
      ];
    case "quantity":
      return [
        bands(t.quantity, [1, 10, 100, 1e3], ["<1", "1\u201310", "10\u2013100", "100\u20131,000", "1,000+"])
      ];
    case "entryPrice":
    case "exitPrice":
      return [
        bands(
          dimension === "entryPrice" ? t.avgEntry : t.avgExit,
          [1, 10, 50, 100, 500],
          ["<1", "1\u201310", "10\u201350", "50\u2013100", "100\u2013500", "500+"]
        )
      ];
    case "realizedR":
    case "plannedR":
      return [
        bands(
          (dimension === "realizedR" ? tradeR(t) : plannedR(t)) ?? void 0,
          [-2, -1, 0, 1, 2, 3],
          ["<-2R", "-2 to -1R", "-1 to 0R", "0\u20131R", "1\u20132R", "2\u20133R", "3R+"]
        )
      ];
  }
}
function summarizeGroup(all) {
  const ts = all.filter((t) => t.status !== "open");
  const mean2 = (ns) => {
    const vs = ns.filter((x) => x != null && Number.isFinite(x));
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  const profit = ts.reduce((s, t) => s + Math.max(0, t.netPnl), 0), loss = ts.reduce((s, t) => s - Math.min(0, t.netPnl), 0);
  return {
    trades: ts.length,
    netPnl: ts.reduce((s, t) => s + t.netPnl, 0),
    winRate: ts.length ? ts.filter((t) => t.status === "win").length / ts.length : null,
    avgRealizedR: mean2(ts.map(tradeR)),
    avgPlannedR: mean2(ts.map(plannedR)),
    avgDurationMs: mean2(ts.map((t) => t.durationMs)),
    volume: ts.reduce((s, t) => s + t.quantity, 0),
    profitFactor: loss ? profit / loss : null,
    noLosses: profit > 0 && loss === 0
  };
}
function analyzeGroups(trades, primary, secondary, tz = "UTC") {
  const groups = /* @__PURE__ */ new Map();
  for (const t of trades.filter((t2) => t2.status !== "open"))
    for (const row of new Set(dimensionKeys(t, primary, tz)))
      for (const column of new Set(secondary ? dimensionKeys(t, secondary, tz) : [""])) {
        const key = JSON.stringify([row, column]);
        if (!groups.has(key)) groups.set(key, { row, column, trades: [] });
        groups.get(key).trades.push(t);
      }
  return [...groups.values()].map((g) => ({ row: g.row, column: g.column, ...summarizeGroup(g.trades) })).sort((a, b) => b.netPnl - a.netPnl || a.row.localeCompare(b.row));
}

// third_party/luxalgo-trade-journal/packages-core/src/metrics.ts
var mean = (values) => values.length === 0 ? null : values.reduce((total, v) => total + v, 0) / values.length;
var realizedR = (trade) => {
  return tradeR(trade);
};
var computeMetrics = (trades, options = {}) => metricsFromOverview(
  trades,
  options,
  dailyStats(trades, options.timeZone ?? "UTC"),
  equityCurve(trades)
);
var metricsFromOverview = (trades, options, days, curve) => {
  const closed = trades.filter((t) => t.status !== "open");
  const wins = closed.filter((t) => t.status === "win");
  const losses = closed.filter((t) => t.status === "loss");
  const breakevens = closed.filter((t) => t.status === "breakeven");
  const grossProfit = closed.reduce((total, t) => total + Math.max(0, t.netPnl), 0);
  const grossLoss = closed.reduce((total, t) => total - Math.min(0, t.netPnl), 0);
  const winningDays = days.filter((d) => d.netPnl > 0).length;
  const ordered = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let run = 0;
  for (const trade of ordered) {
    if (trade.status === "breakeven") continue;
    const direction = trade.status === "win" ? 1 : -1;
    run = Math.sign(run) === direction ? run + direction : direction;
    if (run > maxWinStreak) maxWinStreak = run;
    if (-run > maxLossStreak) maxLossStreak = -run;
  }
  const dd = drawdown(curve, options.initialBalance ?? 0);
  const netPnl = closed.reduce((total, t) => total + t.netPnl, 0);
  const avgWin = mean(wins.map((t) => t.netPnl));
  const avgLoss = mean(losses.map((t) => Math.abs(t.netPnl)));
  const winRate = closed.length > 0 ? wins.length / closed.length : null;
  const dayProfits = days.filter((d) => d.netPnl > 0).map((d) => d.netPnl);
  const totalDayProfit = dayProfits.reduce((total, v) => total + v, 0);
  const rMultiples = trades.map((trade) => realizedR(trade)).filter((r) => r !== null);
  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    netPnl,
    grossPnl: closed.reduce((total, t) => total + t.grossPnl, 0),
    fees: closed.reduce((total, t) => total + t.fees, 0),
    winRate,
    dayWinRate: days.length > 0 ? winningDays / days.length : null,
    tradingDays: days.length,
    profitFactor: closed.length === 0 ? null : grossLoss > 0 ? grossProfit / grossLoss : null,
    profitFactorIsInfinite: closed.length > 0 && grossLoss === 0 && grossProfit > 0,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgWin !== null && avgLoss !== null && avgLoss > 0 ? avgWin / avgLoss : null,
    expectancy: closed.length > 0 ? netPnl / closed.length : null,
    largestWin: wins.reduce((max, t) => Math.max(max, t.netPnl), 0),
    largestLoss: losses.reduce((min, t) => Math.min(min, t.netPnl), 0),
    maxWinStreak,
    maxLossStreak,
    currentStreak: run,
    totalVolume: trades.reduce((total, t) => total + t.quantity, 0),
    avgDurationMs: mean(
      closed.map((t) => t.durationMs).filter((d) => d !== void 0)
    ),
    maxDrawdown: dd.maxDrawdown,
    maxDrawdownPct: dd.maxDrawdownPct,
    recoveryFactor: dd.maxDrawdown > 0 ? netPnl / dd.maxDrawdown : null,
    profitConcentration: totalDayProfit > 0 ? dayProfits.reduce((max, value) => Math.max(max, value), 0) / totalDayProfit : null,
    avgRealizedR: mean(rMultiples),
    tradesWithRisk: rMultiples.length
  };
};
var computeOverview = (trades, options = {}) => {
  const timeZone = options.timeZone ?? "UTC";
  const days = dailyStats(trades, timeZone);
  const equity = equityCurve(trades);
  return {
    metrics: metricsFromOverview(trades, options, days, equity),
    days,
    equity
  };
};

// third_party/luxalgo-trade-journal/packages-core/src/aggregate.ts
var bucketStats = (key, trades) => {
  let closed = 0, wins = 0, netPnl = 0, profit = 0, loss = 0, volume = 0;
  for (const trade of trades) {
    volume += trade.quantity;
    if (trade.status === "open") continue;
    closed++;
    if (trade.status === "win") wins++;
    netPnl += trade.netPnl;
    profit += Math.max(0, trade.netPnl);
    loss -= Math.min(0, trade.netPnl);
  }
  return {
    key,
    trades: trades.length,
    netPnl,
    winRate: closed ? wins / closed : null,
    profitFactor: loss > 0 ? profit / loss : null,
    volume
  };
};
var groupInto = (trades, keysOf) => {
  const groups = /* @__PURE__ */ new Map();
  for (const trade of trades) {
    for (const key of keysOf(trade)) {
      const group = groups.get(key);
      if (group) group.push(trade);
      else groups.set(key, [trade]);
    }
  }
  return [...groups.entries()].map(([key, group]) => bucketStats(key, group)).sort((a, b) => b.netPnl - a.netPnl);
};
var bySymbol = (trades) => groupInto(trades, (t) => [t.symbol]);
var byTag = (trades) => groupInto(trades, (t) => t.annotations?.tags ?? []);
var byMistake = (trades) => groupInto(trades, (t) => t.annotations?.mistakes ?? []);
var byPlaybook = (trades) => groupInto(trades, (t) => t.annotations?.playbook ? [t.annotations.playbook] : []);
var byAssetClass = (trades) => groupInto(trades, (t) => [t.assetClass ?? "other"]);
var byDirection = (trades) => groupInto(trades, (t) => [t.direction]);
var byWeekday = (trades, timeZone = "UTC") => {
  const buckets = groupInto(trades, (t) => [weekdayOf(t.openedAt, timeZone)]);
  return [...buckets].sort(
    (a, b) => WEEKDAYS.indexOf(a.key) - WEEKDAYS.indexOf(b.key)
  );
};
var byHour = (trades, timeZone = "UTC") => groupInto(trades, (t) => [String(hourOf(t.openedAt, timeZone)).padStart(2, "0")]).sort(
  (a, b) => a.key.localeCompare(b.key)
);
var DURATION_BUCKETS = [
  { key: "< 1m", maxMs: 6e4 },
  { key: "1-5m", maxMs: 3e5 },
  { key: "5-15m", maxMs: 9e5 },
  { key: "15-60m", maxMs: 36e5 },
  { key: "1-4h", maxMs: 144e5 },
  { key: "4-24h", maxMs: 864e5 },
  { key: "> 1d", maxMs: Number.POSITIVE_INFINITY }
];
var byDuration = (trades) => {
  const buckets = groupInto(
    trades.filter((t) => t.durationMs !== void 0),
    (t) => [DURATION_BUCKETS.find((b) => t.durationMs < b.maxMs).key]
  );
  return [...buckets].sort(
    (a, b) => DURATION_BUCKETS.findIndex((d) => d.key === a.key) - DURATION_BUCKETS.findIndex((d) => d.key === b.key)
  );
};
var byMonth = (trades, timeZone = "UTC") => groupInto(
  trades.filter((t) => t.closedAt),
  (t) => [dayKeyOf(t.closedAt, timeZone).slice(0, 7)]
).sort((a, b) => a.key.localeCompare(b.key));
var calendarMonth = (trades, year, month, timeZone = "UTC") => calendarMonthFromDays(dailyStats(trades, timeZone), year, month);
var calendarMonthFromDays = (dayStats, year, month) => {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const days = new Map(
    dayStats.filter((d) => d.date.startsWith(monthPrefix)).map((d) => [d.date, d])
  );
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = first.getUTCDay();
  const cells = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    cells.push(
      days.get(date) ?? {
        date,
        netPnl: 0,
        grossPnl: 0,
        fees: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        volume: 0
      }
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    const weekDays = cells.slice(i, i + 7);
    weeks.push({
      days: weekDays,
      weekNetPnl: weekDays.reduce((total, d) => total + (d?.netPnl ?? 0), 0),
      weekTrades: weekDays.reduce((total, d) => total + (d?.trades ?? 0), 0)
    });
  }
  const traded = [...days.values()];
  return {
    year,
    month,
    weeks,
    monthNetPnl: traded.reduce((total, d) => total + d.netPnl, 0),
    monthTrades: traded.reduce((total, d) => total + d.trades, 0),
    tradingDays: traded.filter((d) => d.trades > 0).length,
    winningDays: traded.filter((d) => d.netPnl > 0).length
  };
};

// third_party/luxalgo-trade-journal/packages-core/src/edge-score.ts
var EDGE_SCORE_VERSION = 2;
var EDGE_SCORE_WEIGHTS = {
  winRate: 15,
  profitFactor: 25,
  avgWinLoss: 20,
  drawdown: 15,
  recovery: 10,
  consistency: 15
};
var clamp01 = (value) => Math.min(Math.max(value, 0), 1);
var computeEdgeScore = (metrics) => {
  const winRate = clamp01((metrics.winRate ?? 0) / 0.6) * 100;
  const pf = metrics.profitFactorIsInfinite ? 3 : metrics.profitFactor ?? 0;
  const profitFactor = clamp01(pf / 3) * 100;
  const avgWinLoss = clamp01((metrics.avgWinLossRatio ?? 0) / 2.5) * 100;
  const ddPct = metrics.maxDrawdownPct;
  const drawdownScore = ddPct === null ? 50 : (1 - clamp01(ddPct / 0.25)) * 100;
  const recovery = metrics.maxDrawdown > 0 ? clamp01((metrics.recoveryFactor ?? 0) / 3) * 100 : metrics.netPnl > 0 ? 100 : 0;
  const concentration = metrics.profitConcentration;
  const consistency = concentration === null ? 0 : concentration <= 0.15 ? 100 : (1 - clamp01((concentration - 0.15) / 0.85)) * 100;
  const components = {
    winRate,
    profitFactor,
    avgWinLoss,
    drawdown: drawdownScore,
    recovery,
    consistency
  };
  const totalWeight = Object.values(EDGE_SCORE_WEIGHTS).reduce((total, w) => total + w, 0);
  const weighted = Object.entries(components).reduce(
    (total, [k, v]) => total + v * EDGE_SCORE_WEIGHTS[k],
    0
  ) / totalWeight;
  return {
    version: EDGE_SCORE_VERSION,
    score: metrics.closedTrades >= 5 ? Math.round(weighted * 100) / 100 : null,
    components,
    closedTrades: metrics.closedTrades
  };
};

// third_party/luxalgo-trade-journal/packages-core/src/adherence.ts
function analyzeAdherence(trades, books, checks) {
  const tradesByBook = /* @__PURE__ */ new Map();
  for (const trade of trades) {
    const id = trade.annotations?.playbook;
    if (!id || trade.status === "open") continue;
    const group = tradesByBook.get(id) ?? [];
    group.push(trade);
    tradesByBook.set(id, group);
  }
  const checksByBook = /* @__PURE__ */ new Map();
  for (const check of checks) {
    const book = checksByBook.get(check.playbookId) ?? /* @__PURE__ */ new Map();
    const trade = book.get(check.tradeKey) ?? /* @__PURE__ */ new Map();
    trade.set(check.rule, check.followed);
    book.set(check.tradeKey, trade);
    checksByBook.set(check.playbookId, book);
  }
  return books.map((book) => {
    const ts = tradesByBook.get(book.id) ?? [];
    const rules = [...new Set(book.rules)].map((rule) => ({
      rule,
      followed: [],
      broken: []
    }));
    const followed = [], broken = [];
    let evaluated = 0, positive = 0;
    for (const trade of ts) {
      const assessed = checksByBook.get(book.id)?.get(trade.key);
      let complete = rules.length > 0, hasBroken = false;
      for (const rule of rules) {
        const result = assessed?.get(rule.rule);
        if (result === void 0) {
          complete = false;
          continue;
        }
        evaluated++;
        if (result) {
          positive++;
          rule.followed.push(trade);
        } else {
          hasBroken = true;
          rule.broken.push(trade);
        }
      }
      if (hasBroken) broken.push(trade);
      else if (complete) followed.push(trade);
    }
    return {
      id: book.id,
      total: ts.length,
      evaluated,
      possible: ts.length * rules.length,
      rate: evaluated ? positive / evaluated : null,
      accountIds: [...new Set(ts.map((t) => t.accountId))],
      followed: summarizeGroup(followed),
      broken: summarizeGroup(broken),
      unassessed: ts.length - followed.length - broken.length,
      rules: rules.map((rule) => ({
        rule: rule.rule,
        evaluated: rule.followed.length + rule.broken.length,
        rate: rule.followed.length + rule.broken.length ? rule.followed.length / (rule.followed.length + rule.broken.length) : null,
        followed: summarizeGroup(rule.followed),
        broken: summarizeGroup(rule.broken)
      }))
    };
  });
}

// third_party/luxalgo-trade-journal/packages-core/src/returns.ts
function netReturnOnEntry(trade) {
  const multiplier = trade.contractMultiplier ?? (["futures", "option", "forex", "cfd"].includes(trade.assetClass ?? "") ? null : 1);
  if (multiplier === null || !Number.isFinite(multiplier) || multiplier <= 0 || !Number.isFinite(trade.netPnl) || !Number.isFinite(trade.avgEntry) || !Number.isFinite(trade.quantity) || trade.quantity <= 0)
    return null;
  const notional = Math.abs(trade.avgEntry) * trade.quantity * multiplier;
  if (!Number.isFinite(notional) || notional <= 0) return null;
  const result = trade.netPnl / notional;
  return Number.isFinite(result) ? result : null;
}
export {
  DIMENSIONS,
  DURATION_BUCKETS,
  EDGE_SCORE_VERSION,
  EDGE_SCORE_WEIGHTS,
  FILTER_KEYS,
  WEEKDAYS,
  analyzeAdherence,
  analyzeGroups,
  buildRoundTrips,
  byAssetClass,
  byDirection,
  byDuration,
  byHour,
  byMistake,
  byMonth,
  byPlaybook,
  bySymbol,
  byTag,
  byWeekday,
  calendarMonth,
  calendarMonthFromDays,
  clockTime,
  computeEdgeScore,
  computeMetrics,
  computeOverview,
  dailyCumulative,
  dailyCumulativeFromDays,
  dailyStats,
  dayKeyOf,
  dimensionKeys,
  drawdown,
  equityCurve,
  hourOf,
  intradayCurve,
  matchesFilters,
  monthKeyOf,
  netReturnOnEntry,
  plannedR,
  readFilters,
  realizedR,
  relativeDrawdownCurve,
  summarizeGroup,
  tradeR,
  tradeRisk,
  weekdayOf
};
