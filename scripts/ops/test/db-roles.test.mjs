/* OF-2026-11-12 regression suite: Directus database privilege isolation.
 *
 * Policy tests always run (no database). The database tests need a local,
 * disposable *_ci database that has been migrated and processed by
 * `node scripts/ops/db-roles.mjs apply`:
 *
 *   OWNER_DATABASE_URL  owner/migration role connection
 *   CMS_DATABASE_URL    connection as the Directus role
 *   RUNTIME_DATABASE_URL (optional) connection as the runtime role
 *
 * The Directus HTTP tests additionally need DIRECTUS_URL (local),
 * DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD for a Directus that
 * connects as the Directus role. Everything a test creates is disposable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { backendTables, loadPolicy, checkPolicy, verify } from '../db-roles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const policy = loadPolicy();
const backend = backendTables();
const local = url => url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname) && /(?:^|[_-])ci(?:$|[_-])/.test(new URL(url).pathname.slice(1));
const OWNER = process.env.OWNER_DATABASE_URL, CMS = process.env.CMS_DATABASE_URL, RUNTIME = process.env.RUNTIME_DATABASE_URL;
const DIRECTUS = process.env.DIRECTUS_URL;
const dbReady = local(OWNER) && local(CMS);
const directusReady = dbReady && DIRECTUS && ['localhost', '127.0.0.1'].includes(new URL(DIRECTUS).hostname);
if (process.env.DB_ROLES_REQUIRE_DATABASE === '1' && !dbReady) throw Error('DB_ROLES_REQUIRE_DATABASE=1 but OWNER_DATABASE_URL / CMS_DATABASE_URL are not local *_ci databases');
if (process.env.DB_ROLES_REQUIRE_DIRECTUS === '1' && !directusReady) throw Error('DB_ROLES_REQUIRE_DIRECTUS=1 but DIRECTUS_URL is not set to a local Directus');

/* ------------------------------------------------------------ policy -- */
test('every backend table has an explicit Directus classification', () => {
  assert.ok(backend.length > 100, `parsed only ${backend.length} backend tables`);
  assert.deepEqual(checkPolicy(policy, backend), []);
});

test('financial, trading, regional, governance and security tables are never writable by Directus', () => {
  const mustBeProtected = ['openfund_challenges', 'demo_accounts', 'trading_orders', 'trading_positions', 'trading_ledger', 'trading_events',
    'financial_audit_log', 'payments', 'payment_transactions', 'payment_allocations', 'purchase_orders', 'purchase_order_events', 'withdrawal_requests',
    'payout_transaction_claims', 'treasury_snapshots', 'treasury_token_movements', 'referral_commissions', 'profit_share_allocations', 'settlement_records',
    'revenue_allocation_journal', 'coupon_redemptions', 'challenge_events', 'account_equity_samples', 'certificates', 'region_outbox', 'audit_log', 'auth_sessions'];
  for (const t of mustBeProtected) {
    const e = policy.tables[t];
    assert.ok(e, t);
    assert.equal(e.protected, true, `${t} must be protected`);
    assert.ok(e.cms === 'none' || Object.keys(e.cms).every(k => k === 'select'), `${t} must be at most readable`);
  }
});

test('a protected table granted a write is rejected by the policy check', () => {
  const bad = structuredClone(policy);
  bad.tables.openfund_challenges.cms = { select: '*', update: ['status'] };
  assert.match(checkPolicy(bad, backend).join('\n'), /openfund_challenges: protected trading table must not be writable/);
  const missing = structuredClone(policy);
  delete missing.tables.withdrawal_requests;
  assert.match(checkPolicy(missing, backend).join('\n'), /withdrawal_requests: backend table missing/);
});

/* ---------------------------------------------------------- database -- */
const pg = createRequire(path.join(root, 'apps/backend/package.json'))('pg');
async function withClient(url, fn) { const c = new pg.Client({ connectionString: url }); await c.connect(); try { return await fn(c); } finally { await c.end(); } }
const denied = async (url, sql, params = []) => withClient(url, async c => {
  await assert.rejects(c.query(sql, params), e => ['42501', '42P01'].includes(e.code) || /permission denied|must be owner|must be superuser|must have admin option|not allowed/i.test(e.message), sql);
});

async function seed() {
  return withClient(OWNER, async c => {
    const wallet = '0x' + crypto.randomBytes(20).toString('hex');
    const { rows: [u] } = await c.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', [wallet]);
    const { rows: [p] } = await c.query('SELECT id FROM challenge_plans ORDER BY created_at LIMIT 1');
    const { rows: [a] } = await c.query(`INSERT INTO demo_accounts (user_id, account_type, balance) VALUES ($1, 'challenge', 100000) RETURNING id`, [u.id]);
    const { rows: [ch] } = await c.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, demo_account_id) VALUES ($1, $2, 'started', $3) RETURNING id`, [u.id, p.id, a.id]);
    return { user: u.id, plan: p.id, account: a.id, challenge: ch.id };
  });
}

test('database: the applied privileges match the policy (verify)', { skip: !dbReady && 'no local CI database' }, async () => {
  const names = { cms: process.env.DB_ROLE_CMS || policy.roles.cms.default, runtime: process.env.DB_ROLE_RUNTIME || policy.roles.runtime.default, readonly: policy.roles.readonly.default };
  const problems = await withClient(OWNER, c => verify(c, { policy, backend, names }));
  assert.deepEqual(problems, []);
});

test('database: the Directus role cannot change challenge status, balances, positions or financial records', { skip: !dbReady && 'no local CI database' }, async () => {
  const s = await seed();
  await denied(CMS, `UPDATE openfund_challenges SET status = 'passed' WHERE id = $1`, [s.challenge]);
  await denied(CMS, `UPDATE demo_accounts SET balance = 999999999 WHERE id = $1`, [s.account]);
  await denied(CMS, `DELETE FROM openfund_challenges WHERE id = $1`, [s.challenge]);
  await denied(CMS, `INSERT INTO trading_ledger (account_id, user_id, event, amount, balance_after) VALUES ($1, $2, 'adjustment', 1, 1)`, [s.account, s.user]);
  await denied(CMS, `UPDATE trading_positions SET realized_pnl = 1`);
  await denied(CMS, `INSERT INTO financial_audit_log DEFAULT VALUES`);
  await denied(CMS, `UPDATE purchase_orders SET status = 'paid'`);
  await denied(CMS, `UPDATE withdrawal_requests SET status = 'approved'`);
  await denied(CMS, `SELECT * FROM withdrawal_requests LIMIT 1`);
  await denied(CMS, `SELECT * FROM payment_transactions LIMIT 1`);
  await denied(CMS, `SELECT * FROM auth_sessions LIMIT 1`);
  await denied(CMS, `TRUNCATE trading_events`);
  await denied(CMS, `UPDATE openfund_users SET wallet_address = 'x' WHERE id = $1`, [s.user]);
  await denied(CMS, `UPDATE openfund_users SET status = 'suspended' WHERE id = $1`, [s.user]);
  await denied(CMS, `INSERT INTO region_outbox (stream, stream_seq, type, payload) VALUES ('forged', 1, 'user.v1', '{}')`);
  await denied(CMS, `UPDATE coupons SET uses_consumed = 0`);
  await denied(CMS, `UPDATE coupon_audit SET actor = 'forged'`);
  await denied(CMS, `DELETE FROM coupon_audit`);
  const status = await withClient(OWNER, c => c.query('SELECT status FROM openfund_challenges WHERE id = $1', [s.challenge]));
  assert.equal(status.rows[0].status, 'started');
});

test('database: the Directus role cannot escalate or alter backend objects', { skip: !dbReady && 'no local CI database' }, async () => {
  const owner = new URL(OWNER).username;
  const cmsRole = new URL(CMS).username;
  await denied(CMS, `ALTER ROLE ${cmsRole} SUPERUSER`);
  await denied(CMS, `ALTER ROLE ${cmsRole} CREATEROLE`);
  await denied(CMS, `GRANT ${owner} TO ${cmsRole}`);
  await denied(CMS, `SET ROLE ${owner}`);
  await denied(CMS, `ALTER TABLE openfund_challenges DISABLE TRIGGER ALL`);
  await denied(CMS, `ALTER TABLE trading_ledger OWNER TO ${cmsRole}`);
  await denied(CMS, `DROP TABLE financial_audit_log`);
  await denied(CMS, `CREATE TRIGGER x BEFORE UPDATE ON demo_accounts FOR EACH ROW EXECUTE FUNCTION reject_mutation()`);
  await denied(CMS, `CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$`);
  await denied(CMS, `CREATE SCHEMA cms_escape`);
  /* a GRANT by a role without grant option is a no-op warning, never a grant */
  await withClient(CMS, c => c.query(`GRANT UPDATE ON openfund_challenges TO ${cmsRole}`));
  assert.equal((await withClient(OWNER, c => c.query(`SELECT has_table_privilege($1, 'openfund_challenges', 'UPDATE') AS ok`, [cmsRole]))).rows[0].ok, false);
  await denied(CMS, `COPY openfund_challenges TO PROGRAM 'id'`);
});

test('database: a table the Directus role pre-creates under a backend name is caught by verify', { skip: !dbReady && 'no local CI database' }, async () => {
  /* squatting a not-yet-migrated backend name cannot silently take over a
     future financial table: migrate.js refuses foreign-owned backend tables
     and verify reports them */
  const name = 'cms_squat_probe_' + crypto.randomBytes(3).toString('hex');
  await withClient(CMS, c => c.query(`CREATE TABLE ${name} (id int)`));
  try {
    const owned = await withClient(OWNER, c => c.query(`SELECT pg_get_userbyid(relowner) AS o FROM pg_class WHERE relname = $1`, [name]));
    assert.equal(owned.rows[0].o, new URL(CMS).username);
    const names = { cms: new URL(CMS).username, runtime: policy.roles.runtime.default, readonly: policy.roles.readonly.default };
    const problems = await withClient(OWNER, c => verify(c, { policy, backend: [...backend], names }));
    assert.ok(problems.some(p => p.includes(`unclassified relation ${name}`)), problems.join('\n'));
  } finally { await withClient(OWNER, c => c.query(`DROP TABLE IF EXISTS ${name}`)); }
});

test('database: permitted Directus writes still work (catalog, coupons, support queue)', { skip: !dbReady && 'no local CI database' }, async () => {
  const s = await seed();
  await withClient(CMS, async c => {
    await c.query('BEGIN');
    await c.query(`UPDATE challenge_plans SET name = name WHERE id = $1`, [s.plan]);
    await c.query(`SELECT id, wallet_address, status FROM openfund_users WHERE id = $1`, [s.user]);
    const code = 'CI' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const { rows: [cp] } = await c.query(`INSERT INTO coupons (code, kind, value, status) VALUES ($1, 'percent', 10, 'inactive') RETURNING id`, [code]);
    await c.query(`UPDATE coupons SET status = 'active' WHERE id = $1`, [cp.id]);
    await c.query(`INSERT INTO coupon_challenge_plans (coupon_id, challenge_plan_id) VALUES ($1, $2)`, [cp.id, s.plan]);
    await c.query(`DELETE FROM coupon_challenge_plans WHERE coupon_id = $1`, [cp.id]);
    const audit = await c.query(`SELECT action, actor FROM coupon_audit WHERE coupon_id = $1 ORDER BY id`, [cp.id]);
    assert.deepEqual(audit.rows.map(r => r.action), ['created', 'activated', 'challenge_model_insert', 'challenge_model_delete']);
    assert.ok(audit.rows.every(r => r.actor === 'database:' + new URL(CMS).username));
    await c.query(`SELECT id, status FROM openfund_challenges WHERE id = $1`, [s.challenge]);
    await c.query(`SELECT id, balance FROM demo_accounts WHERE id = $1`, [s.account]);
    await c.query('ROLLBACK');
  });
});

test('database: the runtime role can run backend DML but no DDL', { skip: !(dbReady && local(RUNTIME)) && 'no runtime role connection' }, async () => {
  const s = await seed();
  await withClient(RUNTIME, async c => {
    await c.query('BEGIN');
    await c.query(`UPDATE demo_accounts SET balance = balance WHERE id = $1`, [s.account]);
    await c.query(`SELECT nextval('invoice_number_seq')`);
    await c.query('LOCK TABLE region_stream_heads IN EXCLUSIVE MODE');
    await c.query('ROLLBACK');
  });
  await denied(RUNTIME, `ALTER TABLE demo_accounts ADD COLUMN x int`);
  await denied(RUNTIME, `DROP TABLE trading_ledger`);
  await denied(RUNTIME, `ALTER TABLE financial_audit_log DISABLE TRIGGER ALL`);
  await denied(RUNTIME, `SELECT * FROM directus_users LIMIT 1`);
});

/* ---------------------------------------------------- Directus (HTTP) -- */
async function directus(method, p, token, body) {
  const r = await fetch(new URL(p, DIRECTUS), { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}
const adminToken = async () => (await directus('POST', '/auth/login', null, { email: process.env.DIRECTUS_ADMIN_EMAIL, password: process.env.DIRECTUS_ADMIN_PASSWORD })).body.data.access_token;

test('Directus admin: the original finding (PATCH a challenge to passed) is no longer reproducible', { skip: !directusReady && 'no local Directus' }, async () => {
  const s = await seed();
  const token = await adminToken();
  const r = await directus('PATCH', `/items/openfund_challenges/${s.challenge}`, token, { status: 'passed' });
  assert.notEqual(r.status, 200, 'a Directus administrator could still pass a challenge');
  const bal = await directus('PATCH', `/items/demo_accounts/${s.account}`, token, { balance: 999999999, status: 'suspended' });
  assert.notEqual(bal.status, 200, 'a Directus administrator could still change a trading balance');
  const del = await directus('DELETE', `/items/openfund_challenges/${s.challenge}`, token);
  assert.ok(del.status >= 400, 'a Directus administrator could delete a challenge');
  const row = await withClient(OWNER, c => c.query('SELECT o.status, a.balance, a.status AS acct FROM openfund_challenges o JOIN demo_accounts a ON a.id = o.demo_account_id WHERE o.id = $1', [s.challenge]));
  assert.deepEqual({ ...row.rows[0], balance: Number(row.rows[0].balance) }, { status: 'started', balance: 100000, acct: 'active' });
  /* the read-only view still works */
  const read = await directus('GET', `/items/openfund_challenges/${s.challenge}?fields=id,status`, token);
  assert.equal(read.status, 200);
  assert.equal(read.body.data.status, 'started');
});

test('Directus admin: creating a collection named like a financial table cannot reach backend data', { skip: !directusReady && 'no local Directus' }, async () => {
  const token = await adminToken();
  const r = await directus('POST', '/collections', token, { collection: 'withdrawal_requests', schema: {}, meta: {} });
  assert.ok(r.status >= 400, 'Directus created or adopted withdrawal_requests');
  const rows = await directus('GET', '/items/withdrawal_requests?limit=1', token);
  assert.ok(rows.status >= 400, 'Directus can read withdrawal_requests');
});

test('Directus: editorial CRUD, translations, public published reads and coupon administration still work', { skip: !directusReady && 'no local Directus' }, async () => {
  const token = await adminToken();
  const marker = 'roles-ci-' + crypto.randomUUID();
  const created = await directus('POST', '/items/ui_messages', token, { key: marker, namespace: 'terminal', status: 'draft', translations: [{ language_code: 'en', value: marker }, { language_code: 'fa', value: marker }] });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const id = created.body.data.id;
  const hidden = await directus('GET', `/items/ui_messages?filter[key][_eq]=${marker}`);
  assert.equal(hidden.body.data.length, 0, 'draft visible to the public');
  assert.equal((await directus('PATCH', `/items/ui_messages/${id}`, token, { status: 'published' })).status, 200);
  const pub = await directus('GET', `/items/ui_messages?filter[key][_eq]=${marker}&fields=key,translations.language_code,translations.value`);
  assert.equal(pub.body.data.length, 1);
  assert.deepEqual(pub.body.data[0].translations.map(t => t.language_code).sort(), ['en', 'fa']);
  assert.equal((await directus('DELETE', `/items/ui_messages/${id}`, token)).status, 204);
  /* coupon administration through Directus (business logic unchanged) */
  const code = 'ROLESCI' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const plans = await directus('GET', '/items/challenge_plans?fields=id&limit=1', token);
  const coupon = await directus('POST', '/items/coupons', token, { code, kind: 'percent', value: 5, status: 'inactive', challenge_models: [{ challenge_plan_id: plans.body.data[0].id }] });
  assert.equal(coupon.status, 200, JSON.stringify(coupon.body));
  assert.equal((await directus('PATCH', `/items/coupons/${coupon.body.data.id}`, token, { status: 'revoked' })).status, 200);
  const audit = await directus('GET', `/items/coupon_audit?filter[coupon_id][_eq]=${coupon.body.data.id}&fields=action`, token);
  assert.deepEqual(audit.body.data.map(a => a.action).sort(), ['challenge_model_insert', 'created', 'revoked']);
  /* catalog editing */
  const plan = plans.body.data[0].id;
  const before = (await directus('GET', `/items/challenge_plans/${plan}?fields=name`, token)).body.data.name;
  assert.equal((await directus('PATCH', `/items/challenge_plans/${plan}`, token, { name: before })).status, 200);
  /* files */
  const folder = await directus('GET', '/folders?limit=1', token);
  assert.equal(folder.status, 200);
});
