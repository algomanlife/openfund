/** Product-scoped read models and private journal. Financial writes stay in Engine. */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { gainsPortfolio } from "./gains-portfolio.js";
import { feePct } from "./engine.js";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, message) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const integer = (v, def, max) => {
  if (v === undefined) return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max)
    throw fail(400, "invalid_pagination");
  return n;
};
export function filters(q) {
  const out = {
    limit: integer(q.limit, 25, 100),
    offset: integer(q.offset, 0, 1000000),
  };
  for (const key of ["from", "to"])
    if (q[key]) {
      if (
        typeof q[key] !== "string" ||
        !/^\d{4}-\d{2}-\d{2}(T.*Z)?$/.test(q[key]) ||
        !Number.isFinite(Date.parse(q[key])) ||
        new Date(q[key]).toISOString().slice(0, 10) !== q[key].slice(0, 10)
      )
        throw fail(400, "invalid_date");
      out[key] =
        q[key].length === 10
          ? q[key] + (key === "to" ? "T23:59:59.999Z" : "T00:00:00.000Z")
          : q[key];
    }
  if (out.from && out.to && out.from > out.to)
    throw fail(400, "invalid_date_range");
  for (const [k, allowed] of Object.entries({
    side: ["long", "short"],
    status: ["open", "closed", "liquidated"],
    sort: ["closed_desc", "opened_asc", "pnl_desc", "pnl_asc"],
  })) {
    if (q[k] && !allowed.includes(q[k])) throw fail(400, "invalid_filter");
    if (q[k]) out[k] = q[k];
  }
  if (q.market) out.market = String(q.market).slice(0, 80);
  return out;
}
function entryInput(raw) {
  if (!raw || typeof raw !== "object") throw fail(400, "invalid_entry");
  const {
    title,
    body,
    date,
    tags = [],
    classification = "",
    tradeId = null,
  } = raw;
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 160 ||
    typeof body !== "string" ||
    body.length > 10000
  )
    throw fail(400, "invalid_entry");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw fail(400, "invalid_date");
  if (
    !Array.isArray(tags) ||
    tags.length > 20 ||
    tags.some((t) => typeof t !== "string" || t.length > 60)
  )
    throw fail(400, "invalid_tags");
  if (
    typeof classification !== "string" ||
    classification.length > 80 ||
    (tradeId !== null && !uuid.test(tradeId))
  )
    throw fail(400, "invalid_entry");
  return {
    title: title.trim(),
    body,
    date,
    tags: [...new Set(tags.map((t) => t.trim()).filter(Boolean))],
    classification,
    tradeId,
  };
}
export function productRoutes({ pool, portfolio, engine, auth }) {
  const router = Router({ mergeParams: true });
  router.use(
    auth,
    wrap(async (req, res, next) => {
      const product = req.params.product;
      if (!["prop", "perpetual"].includes(product))
        throw fail(404, "unknown_product");
      const userId = req.user.user_id;
      const account =
        product === "prop" ? await engine.getAccount(userId) : null;
      const accountRef =
        product === "prop"
          ? account?.id
          : `gains:arbitrum:${req.user.wallet_address}`;
      if (!accountRef) throw fail(404, "account_not_found");
      if (req.query.account && req.query.account !== accountRef)
        throw fail(404, "account_not_found");
      req.scope = { product, userId, accountRef, account };
      next();
    }),
  );
  router.get(
    "/context",
    wrap(async (req, res) => {
      const s = req.scope;
      res.json({
        pricing:
          s.product === "prop"
            ? Object.fromEntries(
                [...portfolio.md.markets].map(([symbol, meta]) => [
                  symbol,
                  Number(feePct(meta, symbol)) / 100,
                ]),
              )
            : null,
        product: s.product,
        accountRef: s.accountRef,
        wallet: req.user.wallet_address,
        accounts: [
          {
            id: s.accountRef,
            type: s.product === "prop" ? "free_demo" : "wallet",
            currency: s.account?.currency ?? null,
          },
        ],
        capabilities: {
          simulatedTrading: s.product === "prop",
          execution: s.product === "prop" ? "simulation" : "unavailable",
          marketData: "gains",
          positions: true,
          history: true,
          journal: true,
        },
        state: s.product === "prop" ? await engine.state(s.userId) : null,
      });
    }),
  );
  router.get(
    "/gains",
    wrap(async (req, res) => {
      if (req.scope.product !== "perpetual") throw fail(404, "not_found");
      res.json(
        await gainsPortfolio(req.user.wallet_address, {
          ...filters(req.query),
          cursor: req.query.cursor,
        }),
      );
    }),
  );
  router.get(
    "/overview",
    wrap(async (req, res) => {
      const f = filters(req.query);
      if (req.scope.product !== "prop")
        throw fail(409, "use_native_gains_records");
      res.json(await portfolio.overview(req.scope.userId, f));
    }),
  );
  router.get(
    "/buckets",
    wrap(async (req, res) => {
      const f = filters(req.query);
      if (req.scope.product !== "prop")
        throw fail(409, "use_native_gains_records");
      res.json(await portfolio.buckets(req.scope.userId, f));
    }),
  );
  router.get(
    "/trades",
    wrap(async (req, res) => {
      const f = filters(req.query);
      if (req.scope.product !== "prop")
        throw fail(409, "use_native_gains_records");
      res.json(await portfolio.history(req.scope.userId, f));
    }),
  );
  router.get(
    "/orders",
    wrap(async (req, res) => {
      const f = filters(req.query);
      if (req.scope.product !== "prop")
        throw fail(409, "use_native_gains_records");
      const params = [req.scope.userId, req.scope.accountRef];
      let where = "user_id=$1 AND account_id=$2";
      if (f.market) {
        params.push(`%${f.market}%`);
        where += ` AND market ILIKE $${params.length}`;
      }
      for (const [key, op] of [
        ["from", ">="],
        ["to", "<="],
      ])
        if (f[key]) {
          params.push(f[key]);
          where += ` AND created_at ${op} $${params.length}`;
        }
      const count = (
        await pool.query(
          `SELECT count(*)::int total FROM trading_orders WHERE ${where}`,
          params,
        )
      ).rows[0].total;
      const rows = (
        await pool.query(
          `SELECT id, market, side, order_type, status, margin, leverage, target_price, created_at, updated_at, reject_reason FROM trading_orders WHERE ${where} ORDER BY created_at DESC, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, f.limit, f.offset],
        )
      ).rows;
      res.json({ total: count, orders: rows });
    }),
  );
  router.get(
    "/trades/:id",
    wrap(async (req, res) => {
      if (req.scope.product !== "prop" || !uuid.test(req.params.id))
        throw fail(404, "trade_not_found");
      const detail = await portfolio.details(req.scope.userId, req.params.id);
      if (!detail) throw fail(404, "trade_not_found");
      res.json(detail);
    }),
  );
  router.put(
    "/notes",
    wrap(async (req, res) => {
      if (req.scope.product !== "prop") throw fail(400, "trade_not_available");
      res.json(
        await portfolio.upsertNote(
          req.scope.userId,
          req.body.tradeKey,
          req.body.notes,
          req.body.tags,
        ),
      );
    }),
  );
  const scoped = (s) => [s.userId, s.product, s.accountRef];
  router.get(
    "/journal",
    wrap(async (req, res) => {
      const f = filters(req.query),
        params = scoped(req.scope);
      let where = "user_id=$1 AND product=$2 AND account_ref=$3";
      if (req.query.search) {
        params.push(`%${String(req.query.search).slice(0, 120)}%`);
        where += ` AND (title ILIKE $${params.length} OR body ILIKE $${params.length} OR tags::text ILIKE $${params.length} OR classification ILIKE $${params.length})`;
      }
      for (const [key, op] of [
        ["from", ">="],
        ["to", "<="],
      ])
        if (f[key]) {
          params.push(f[key].slice(0, 10));
          where += ` AND entry_date ${op} $${params.length}::date`;
        }
      const total = (
        await pool.query(
          `SELECT count(*)::int c FROM journal_entries WHERE ${where}`,
          params,
        )
      ).rows[0].c;
      const rows = (
        await pool.query(
          `SELECT id, title, body, to_char(entry_date,'YYYY-MM-DD') AS date, tags, classification, trade_id AS "tradeId", version, updated_at AS "updatedAt" FROM journal_entries WHERE ${where} ORDER BY entry_date DESC, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, f.limit, f.offset],
        )
      ).rows;
      res.json({ total, entries: rows });
    }),
  );
  async function writeEntry(client, scope, raw, importing = false) {
    const e = entryInput(raw),
      id = raw.id || randomUUID();
    if (!uuid.test(id)) throw fail(400, "invalid_id");
    if (e.tradeId) {
      if (scope.product !== "prop") throw fail(400, "trade_not_available");
      const owned = await client.query(
        "SELECT id FROM trading_positions WHERE id=$1 AND user_id=$2 AND account_id=$3",
        [e.tradeId, scope.userId, scope.accountRef],
      );
      if (!owned.rows.length) throw fail(404, "trade_not_found");
    }
    const existing = (
      await client.query(
        "SELECT user_id, product, account_ref, version FROM journal_entries WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (
      existing &&
      (existing.user_id !== scope.userId ||
        existing.product !== scope.product ||
        existing.account_ref !== scope.accountRef)
    )
      throw fail(404, "entry_not_found");
    // Imports are idempotent and preserve newer local edits; interactive edits use revision checks.
    if (existing && importing) return { id, skipped: true };
    if (existing && raw.version !== existing.version)
      throw fail(409, "entry_changed_reload");
    const params = [
      id,
      ...scoped(scope),
      e.title,
      e.body,
      e.date,
      JSON.stringify(e.tags),
      e.classification,
      e.tradeId,
    ];
    const row = await client.query(
      `INSERT INTO journal_entries (id,user_id,product,account_ref,title,body,entry_date,tags,classification,trade_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET title=$5,body=$6,entry_date=$7,tags=$8,classification=$9,trade_id=$10,version=journal_entries.version+1,updated_at=now()
      WHERE journal_entries.user_id=$2 AND journal_entries.product=$3 AND journal_entries.account_ref=$4 AND journal_entries.version=$11
      RETURNING id, version`,
      [...params, raw.version ?? 0],
    );
    if (!row.rows.length) throw fail(409, "entry_changed_reload");
    return row.rows[0];
  }
  router.put(
    "/journal",
    wrap(async (req, res) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const row = await writeEntry(client, req.scope, req.body);
        await client.query("COMMIT");
        res.json(row);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }),
  );
  router.post(
    "/journal/import",
    wrap(async (req, res) => {
      if (
        req.body.format !== "openfund-journal-v1" ||
        req.body.product !== req.scope.product ||
        req.body.accountRef !== req.scope.accountRef ||
        !Array.isArray(req.body.entries) ||
        req.body.entries.length > 50
      )
        throw fail(400, "invalid_import_scope_or_size");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = [];
        for (const raw of req.body.entries) {
          if (!uuid.test(raw?.id || "")) throw fail(400, "import_id_required");
          result.push(await writeEntry(client, req.scope, raw, true));
        }
        await client.query("COMMIT");
        res.json({
          imported: result.filter((x) => !x.skipped).length,
          skipped: result.filter((x) => x.skipped).length,
        });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }),
  );
  router.delete(
    "/journal/:id",
    wrap(async (req, res) => {
      if (!uuid.test(req.params.id)) throw fail(404, "entry_not_found");
      const version = integer(req.query.version, 0, 1000000000);
      const result = await pool.query(
        "DELETE FROM journal_entries WHERE id=$1 AND user_id=$2 AND product=$3 AND account_ref=$4 AND version=$5 RETURNING id",
        [req.params.id, ...scoped(req.scope), version],
      );
      if (!result.rows.length) throw fail(409, "entry_changed_or_missing");
      res.json({ ok: true });
    }),
  );
  return router;
}
