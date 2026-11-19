/* PostgreSQL least-privilege roles (OF-2026-11-12).
 *
 * Separates four database identities:
 *   owner     the database owner and migration role (DATABASE_URL today):
 *             runs migrate.js and owns every backend table, sequence and
 *             function. It is never given to Directus.
 *   runtime   optional backend API role: DML on backend tables, no DDL.
 *   cms       the Directus role: owns directus_* and the editorial
 *             collections it creates; on backend tables it gets only the
 *             grants in infra/postgres/cms-privileges.json.
 *   readonly  NOLOGIN reporting role: SELECT on backend tables.
 *
 *   node scripts/ops/db-roles.mjs plan    print the statements (no changes)
 *   node scripts/ops/db-roles.mjs apply   create missing roles, transfer
 *                                         Directus ownership, apply grants
 *                                         (one transaction)
 *   node scripts/ops/db-roles.mjs verify  read-only drift check: exit 1 when
 *                                         the database differs from policy
 *
 * Connects with OWNER_DATABASE_URL (or DATABASE_URL) as the owner role.
 * Passwords for roles that do not exist yet come only from CMS_DB_PASSWORD
 * and RUNTIME_DB_PASSWORD; they are never printed. Role names can be
 * overridden with DB_ROLE_CMS, DB_ROLE_RUNTIME and DB_ROLE_READONLY.
 * Idempotent: running apply twice yields the same privileges.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCHEMA_FILES = ['apps/backend/schema.sql', 'apps/backend/footprint/schema.sql'];
const POLICY_FILE = 'infra/postgres/cms-privileges.json';
const ACTIONS = ['select', 'insert', 'update', 'delete'];

export function backendTables(files = SCHEMA_FILES) {
  const names = new Set();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) names.add(m[1].toLowerCase());
  }
  return [...names].sort();
}

export function loadPolicy(file = POLICY_FILE) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

/* Static policy checks (no database): every backend table classified,
   no stale entries, protected tables at most readable, valid shapes. */
export function checkPolicy(policy, tables) {
  const problems = [];
  const listed = Object.keys(policy.tables);
  for (const t of tables) if (!policy.tables[t]) problems.push(`${t}: backend table missing from ${POLICY_FILE}`);
  for (const t of listed) if (!tables.includes(t)) problems.push(`${t}: listed in ${POLICY_FILE} but not created by the backend schema`);
  for (const [t, e] of Object.entries(policy.tables)) {
    if (e.cms === 'none') continue;
    if (!e.cms || typeof e.cms !== 'object') { problems.push(`${t}: cms must be "none" or an object`); continue; }
    for (const k of Object.keys(e.cms)) if (!ACTIONS.includes(k)) problems.push(`${t}: unknown action ${k}`);
    for (const k of ['select', 'insert', 'update']) {
      const v = e.cms[k];
      if (v !== undefined && v !== '*' && !(Array.isArray(v) && v.length && v.every(c => /^[a-z_][a-z0-9_]*$/.test(c)))) problems.push(`${t}: ${k} must be "*" or a column list`);
    }
    if (e.cms.delete !== undefined && e.cms.delete !== true) problems.push(`${t}: delete must be true when present`);
    if (e.protected && (e.cms.insert || e.cms.update || e.cms.delete)) {
      /* the single append-only exception: coupon audit rows are written by
         the coupon triggers with the writer's privileges */
      const appendOnly = t === 'coupon_audit' && e.cms.insert && !e.cms.update && !e.cms.delete;
      if (!appendOnly) problems.push(`${t}: protected ${e.domain} table must not be writable by Directus`);
    }
    if (!e.reason) problems.push(`${t}: a granted table needs a reason`);
  }
  return problems;
}

const q = id => '"' + String(id).replace(/"/g, '""') + '"';
const cols = list => list.map(q).join(', ');
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";

function roleNames(policy, env) {
  return {
    cms: env.DB_ROLE_CMS || policy.roles.cms.default,
    runtime: env.DB_ROLE_RUNTIME || policy.roles.runtime.default,
    readonly: env.DB_ROLE_READONLY || policy.roles.readonly.default,
  };
}

async function inventory(db) {
  const { rows: [me] } = await db.query(`SELECT current_user AS owner, current_database() AS database,
    (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser,
    (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user) AS createrole`);
  const { rows: rels } = await db.query(`SELECT c.relname AS name, c.relkind AS kind, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')`);
  const hasCollections = rels.some(r => r.name === 'directus_collections' && r.kind === 'r');
  const collections = hasCollections ? new Set((await db.query('SELECT collection FROM directus_collections')).rows.map(r => r.collection)) : new Set();
  const { rows: roles } = await db.query('SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolcanlogin FROM pg_roles');
  return { ...me, rels, collections, roles: Object.fromEntries(roles.map(r => [r.rolname, r])) };
}

/* Classify every relation in schema public. Fail closed: anything that is
   neither backend, Directus system nor a registered Directus collection is
   left untouched and reported. */
export function classify(inv, backend) {
  const b = new Set(backend);
  const out = { backend: [], directus: [], editorial: [], sequences: [], unclassified: [] };
  for (const r of inv.rels) {
    if (r.kind === 'S') { out.sequences.push(r); continue; }
    if (b.has(r.name)) out.backend.push(r);
    else if (r.name.startsWith('directus_')) out.directus.push(r);
    else if (inv.collections.has(r.name)) out.editorial.push(r);
    else out.unclassified.push(r);
  }
  return out;
}

export function buildStatements({ policy, backend, inv, names, env = {} }) {
  const s = [];
  const owner = inv.owner;
  const cls = classify(inv, backend);
  const ensureRole = (role, { login, password }) => {
    /* an existing role keeps its attributes here (a CREATEROLE owner may not
       touch SUPERUSER, REPLICATION or BYPASSRLS); verify refuses any of them */
    if (inv.roles[role]) return;
    if (login && !password && !env.PLAN_ONLY) throw Error(`Role ${role} does not exist: set ${role === names.cms ? 'CMS_DB_PASSWORD' : 'RUNTIME_DB_PASSWORD'} to create it (never passed on the command line).`);
    s.push({ sql: `CREATE ROLE ${q(role)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS ${login ? 'LOGIN PASSWORD ' + lit(password) : 'NOLOGIN'}`, redacted: `CREATE ROLE ${q(role)} ... ${login ? 'LOGIN PASSWORD <redacted>' : 'NOLOGIN'}` });
  };
  ensureRole(names.cms, { login: true, password: env.CMS_DB_PASSWORD });
  ensureRole(names.readonly, { login: false });
  if (env.RUNTIME_DB_PASSWORD || inv.roles[names.runtime]) ensureRole(names.runtime, { login: true, password: env.RUNTIME_DB_PASSWORD });
  const runtime = env.RUNTIME_DB_PASSWORD || inv.roles[names.runtime] ? names.runtime : null;

  /* the owner manages the CMS role's objects. The reverse (Directus as a
     member of the owner or runtime role) is refused by verify. */
  if (!inv.superuser) s.push(`GRANT ${q(names.cms)} TO ${q(owner)} WITH INHERIT TRUE, SET TRUE`);

  s.push(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
  s.push(`GRANT CONNECT ON DATABASE ${q(inv.database)} TO ${q(names.cms)}`);
  s.push(`GRANT USAGE, CREATE ON SCHEMA public TO ${q(names.cms)}`);
  s.push(`GRANT USAGE ON SCHEMA public TO ${q(names.readonly)}`);
  if (runtime) s.push(`GRANT CONNECT ON DATABASE ${q(inv.database)} TO ${q(runtime)}`, `GRANT USAGE ON SCHEMA public TO ${q(runtime)}`);

  /* Directus system tables and editorial collections belong to the CMS role
     (Directus runs its own migrations on them) */
  for (const r of [...cls.directus, ...cls.editorial]) {
    if (r.owner === names.cms) continue;
    const kw = r.kind === 'v' ? 'VIEW' : r.kind === 'm' ? 'MATERIALIZED VIEW' : 'TABLE';
    s.push(`ALTER ${kw} ${q(r.name)} OWNER TO ${q(names.cms)}`);
  }

  /* backend tables: explicit grants only */
  for (const t of backend) {
    const e = policy.tables[t];
    s.push(`REVOKE ALL ON TABLE ${q(t)} FROM ${q(names.cms)}`);
    s.push(`REVOKE ALL ON TABLE ${q(t)} FROM PUBLIC`);
    if (e.cms !== 'none') {
      for (const a of ['select', 'insert', 'update']) {
        const v = e.cms[a];
        if (v === '*') s.push(`GRANT ${a.toUpperCase()} ON TABLE ${q(t)} TO ${q(names.cms)}`);
        else if (Array.isArray(v)) s.push(`GRANT ${a.toUpperCase()} (${cols(v)}) ON TABLE ${q(t)} TO ${q(names.cms)}`);
      }
      if (e.cms.delete) s.push(`GRANT DELETE ON TABLE ${q(t)} TO ${q(names.cms)}`);
      if (e.cms.insert) s.push({ sequencesFor: t, role: names.cms });
    }
    s.push(`GRANT SELECT ON TABLE ${q(t)} TO ${q(names.readonly)}`);
    if (runtime) s.push(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${q(t)} TO ${q(runtime)}`);
  }
  if (runtime) s.push(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${q(runtime)}`);

  /* future backend tables: runtime and readonly get access, Directus none */
  s.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${q(owner)} IN SCHEMA public REVOKE ALL ON TABLES FROM ${q(names.cms)}`);
  s.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${q(owner)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${q(names.cms)}`);
  s.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${q(owner)} IN SCHEMA public GRANT SELECT ON TABLES TO ${q(names.readonly)}`);
  if (runtime) {
    s.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${q(owner)} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${q(runtime)}`);
    s.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${q(owner)} IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${q(runtime)}`);
  }
  return { statements: s, classification: cls, runtime };
}

/* Read-only verification against the policy. Returns a list of problems. */
export async function verify(db, { policy, backend, names }) {
  const inv = await inventory(db);
  const cls = classify(inv, backend);
  const problems = [];
  const cms = inv.roles[names.cms];
  if (!cms) return [`role ${names.cms} does not exist`];
  for (const a of ['rolsuper', 'rolcreaterole', 'rolcreatedb', 'rolreplication', 'rolbypassrls']) if (cms[a]) problems.push(`${names.cms} has ${a}`);
  const member = async (role, of) => (await db.query('SELECT pg_has_role($1, $2, $3) AS m', [role, of, 'USAGE'])).rows[0].m;
  for (const other of [inv.owner, names.runtime].filter(r => inv.roles[r])) if (await member(names.cms, other)) problems.push(`${names.cms} inherits ${other}`);
  if ((await db.query(`SELECT has_database_privilege($1, current_database(), 'CREATE') AS c`, [names.cms])).rows[0].c) problems.push(`${names.cms} can create schemas`);
  for (const r of cls.backend) if (r.owner !== inv.owner) problems.push(`backend table ${r.name} is owned by ${r.owner}, not ${inv.owner}`);
  for (const r of [...cls.directus, ...cls.editorial]) if (r.owner !== names.cms) problems.push(`Directus table ${r.name} is owned by ${r.owner}, not ${names.cms}`);
  for (const r of cls.unclassified) problems.push(`unclassified relation ${r.name} (owner ${r.owner})`);
  const present = new Set(cls.backend.map(r => r.name));
  for (const t of backend) {
    if (!present.has(t)) { problems.push(`backend table ${t} is missing (run migrate first)`); continue; }
    const e = policy.tables[t];
    const g = e.cms === 'none' ? {} : e.cms;
    const { rows: colRows } = await db.query(`SELECT attname FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped`, [t]);
    const columns = colRows.map(r => r.attname);
    for (const a of ['select', 'insert', 'update']) {
      const allowed = g[a] === '*' ? new Set(columns) : new Set(g[a] || []);
      for (const c of columns) {
        const { rows: [{ ok }] } = await db.query('SELECT has_column_privilege($1, $2::regclass, $3, $4) AS ok', [names.cms, t, c, a.toUpperCase()]);
        if (ok && !allowed.has(c)) problems.push(`${names.cms} can ${a.toUpperCase()} ${t}.${c} (policy: ${g[a] ? 'columns ' + [...allowed].join(',') : 'no'})`);
        if (!ok && allowed.has(c)) problems.push(`${names.cms} lacks ${a.toUpperCase()} on ${t}.${c} required by policy`);
      }
    }
    for (const p of ['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const { rows: [{ ok }] } = await db.query('SELECT has_table_privilege($1, $2::regclass, $3) AS ok', [names.cms, t, p]);
      const want = p === 'DELETE' && g.delete === true;
      if (ok !== want) problems.push(`${names.cms} ${ok ? 'has' : 'lacks'} ${p} on ${t}`);
    }
  }
  const { rows: defs } = await db.query(`SELECT pg_get_userbyid(defaclrole) AS grantor, defaclobjtype AS type, defaclacl::text AS acl
    FROM pg_default_acl WHERE defaclacl::text ~ ('(^|[{,"])' || $1 || '=')`, [names.cms]);
  for (const d of defs) if (d.grantor !== names.cms) problems.push(`default privileges of ${d.grantor} grant ${d.type} to ${names.cms}`);
  const { rows: fns } = await db.query(`SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, p.prosecdef FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'`);
  for (const f of fns) {
    if (f.owner === names.cms) problems.push(`function ${f.proname} is owned by ${names.cms} (Directus must not define functions)`);
    if (f.prosecdef) problems.push(`function ${f.proname} is SECURITY DEFINER (review required)`);
  }
  return problems;
}

async function run(db, statements, sequencesForSql) {
  for (const st of statements) {
    if (typeof st === 'string') await db.query(st);
    else if (st.sql) await db.query(st.sql);
    else if (st.sequencesFor) for (const sql of await sequencesForSql(st.sequencesFor, st.role)) await db.query(sql);
  }
}

async function main() {
  const [command] = process.argv.slice(2);
  if (!['plan', 'apply', 'verify'].includes(command)) throw Error('Usage: node scripts/ops/db-roles.mjs plan|apply|verify');
  const url = process.env.OWNER_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw Error('Set OWNER_DATABASE_URL (or DATABASE_URL) to the owner/migration role connection.');
  const pg = createRequire(path.join(root, 'apps/backend/package.json'))('pg');
  const policy = loadPolicy();
  const backend = backendTables();
  const problems = checkPolicy(policy, backend);
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  const names = roleNames(policy, process.env);
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    if (command === 'verify') {
      const found = await verify(db, { policy, backend, names });
      console.log(JSON.stringify({ verifiedAt: new Date().toISOString(), roles: names, backendTables: backend.length, ok: found.length === 0, problems: found }, null, 2));
      process.exitCode = found.length ? 1 : 0;
      return;
    }
    const inv = await inventory(db);
    if (!inv.superuser && !inv.createrole && (!inv.roles[names.cms] || !inv.roles[names.readonly]))
      throw Error(`${inv.owner} has no CREATEROLE: create ${names.cms} (LOGIN) and ${names.readonly} (NOLOGIN) as a privileged user first, then rerun.`);
    const { statements, classification } = buildStatements({ policy, backend, inv, names, env: { ...process.env, PLAN_ONLY: command === 'plan' ? '1' : '' } });
    const sequencesForSql = async (t, role) => (await db.query(
      `SELECT pg_get_serial_sequence(quote_ident($1), attname) AS s FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped`, [t]))
      .rows.filter(r => r.s).map(r => `GRANT USAGE, SELECT ON SEQUENCE ${r.s} TO ${q(role)}`);
    if (command === 'plan') {
      for (const st of statements) console.log((typeof st === 'string' ? st : st.redacted || `-- sequences owned by ${st.sequencesFor} → USAGE for ${st.role}`) + ';');
      console.error(`-- backend ${classification.backend.length}, directus ${classification.directus.length}, editorial ${classification.editorial.length}, unclassified ${classification.unclassified.length}`);
      return;
    }
    if (classification.unclassified.length) console.error(`warning: left untouched (unclassified): ${classification.unclassified.map(r => r.name).join(', ')}`);
    await db.query('BEGIN');
    try { await run(db, statements, sequencesForSql); await db.query('COMMIT'); }
    catch (e) { await db.query('ROLLBACK'); throw e; }
    const found = await verify(db, { policy, backend, names });
    console.log(JSON.stringify({ appliedAt: new Date().toISOString(), roles: names, statements: statements.length, ok: found.length === 0, problems: found }, null, 2));
    process.exitCode = found.length ? 1 : 0;
  } finally { await db.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
