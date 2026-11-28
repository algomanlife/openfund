/* OF-2026-11-12 in production: give Directus its own least-privilege
 * PostgreSQL role and switch openfund-cms to it, with a freshly generated
 * password (docs/security/DATABASE_ROLES.md, "Automated path").
 *
 *   node scripts/ops/db-roles-production.mjs plan    redacted statements, no change
 *   node scripts/ops/db-roles-production.mjs apply   roles + grants, new Directus
 *                                                    password, switch and verify
 *   node scripts/ops/db-roles-production.mjs verify  read-only drift check
 *
 * Runs only from the "Production database roles" workflow, in the protected
 * production environment. It needs RENDER_API_TOKEN and RELEASE_CMS_URL; the
 * owner connection is read from the Render API at run time and never stored.
 * Every credential is masked in the job log before it is used and is never
 * printed. On a failed switch the previous DB_CONNECTION_STRING is restored
 * and openfund-cms restarted (the grants do not need reverting for Directus
 * to run as the owner again).
 */
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = 'https://api.render.com/v1';
const DB_NAME = process.env.RENDER_DATABASE_NAME || 'openfund-db';
const CMS_NAME = process.env.RENDER_CMS_SERVICE_NAME || 'openfund-cms';
const CMS_ROLE = process.env.DB_ROLE_CMS || 'openfund_directus';
const KEY = 'DB_CONNECTION_STRING';

const mask = value => { if (value) for (const part of new Set([value, encodeURIComponent(value)])) console.log(`::add-mask::${part}`); };
const summary = lines => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function render(method, route, body) {
  const r = await fetch(API + route, {
    method,
    headers: { Authorization: `Bearer ${process.env.RENDER_API_TOKEN}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw Error(`Render API ${method} ${route.split('?')[0]}: HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}

/** one resource by exact name; the list endpoints wrap each item */
async function byName(kind, name) {
  const rows = await render('GET', `/${kind}?name=${encodeURIComponent(name)}&limit=20`);
  const found = rows.map(r => r.postgres || r.service || r).filter(x => x?.name === name);
  if (found.length !== 1) throw Error(`Expected exactly one ${kind} named ${name}, found ${found.length}.`);
  return found[0];
}

/* TLS for the external connection: certificate verified by default;
   DB_SSLMODE=encrypt-only (libpq "require") only if Render's certificate
   chain does not verify on the runner. Nothing changes before it connects. */
export function tlsUrl(connectionString, mode = process.env.DB_SSLMODE || 'verify-full') {
  const u = new URL(connectionString);
  u.searchParams.delete('sslmode');
  if (mode === 'encrypt-only') { u.searchParams.set('sslmode', 'require'); u.searchParams.set('uselibpqcompat', 'true'); }
  else u.searchParams.set('sslmode', 'verify-full');
  return u.toString();
}

export function withCredentials(connectionString, user, password) {
  const u = new URL(connectionString);
  u.username = encodeURIComponent(user);
  u.password = encodeURIComponent(password);
  return u.toString();
}

function rolesScript(command, env) {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/ops/db-roles.mjs'), command], { env: { ...process.env, ...env }, encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status;
}

async function cmsUp(base, deadline) {
  while (Date.now() < deadline) {
    try { if ((await fetch(new URL('/server/ping', base), { signal: AbortSignal.timeout(10_000) })).ok) return true; } catch { /* restarting */ }
    await sleep(5000);
  }
  return false;
}

async function main() {
  const [command] = process.argv.slice(2);
  if (!['plan', 'apply', 'verify'].includes(command)) throw Error('Usage: db-roles-production.mjs plan|apply|verify');
  for (const k of ['RENDER_API_TOKEN', ...(command === 'apply' ? ['RELEASE_CMS_URL'] : [])]) if (!process.env[k]) throw Error(`Configure ${k} in the production environment.`);

  const db = await byName('postgres', DB_NAME);
  const info = await render('GET', `/postgres/${db.id}/connection-info`);
  for (const v of [info.password, info.externalConnectionString, info.internalConnectionString, info.psqlCommand]) mask(v);
  if (!info.externalConnectionString || !info.internalConnectionString) throw Error('Render returned no connection strings for the database.');
  const owner = tlsUrl(info.externalConnectionString);
  mask(owner);

  if (command !== 'apply') {
    /* plan prints redacted statements; verify is read-only */
    const status = rolesScript(command, { OWNER_DATABASE_URL: owner });
    summary([`### Database roles: ${command}`, '', status === 0 ? 'OK' : `Exit ${status}`]);
    process.exitCode = status;
    return;
  }

  const cms = await byName('services', CMS_NAME);
  const previous = (await render('GET', `/services/${cms.id}/env-vars/${KEY}`).catch(() => null))?.value ?? null;
  mask(previous);
  if (!previous) throw Error(`${CMS_NAME} has no ${KEY}; set it to the current working connection before switching.`);

  const password = crypto.randomBytes(32).toString('base64url');
  mask(password);
  if (rolesScript('apply', { OWNER_DATABASE_URL: owner, CMS_DB_PASSWORD: password }) !== 0) throw Error('db-roles apply failed; nothing was switched.');

  /* rotate: the role may already exist with an older password */
  const pg = createRequire(path.join(root, 'apps/backend/package.json'))('pg');
  const admin = new pg.Client({ connectionString: owner });
  await admin.connect();
  try {
    const { rows: [lit] } = await admin.query('SELECT quote_literal($1) AS v', [password]);
    await admin.query(`ALTER ROLE ${CMS_ROLE} WITH LOGIN PASSWORD ${lit.v}`);
  } finally { await admin.end(); }

  /* prove the new credential before Directus depends on it */
  const probe = new pg.Client({ connectionString: withCredentials(owner, CMS_ROLE, password) });
  await probe.connect();
  const who = (await probe.query('SELECT current_user AS u')).rows[0].u;
  await probe.end();
  if (who !== CMS_ROLE) throw Error(`The new credential connected as ${who}, not ${CMS_ROLE}; nothing was switched.`);

  const next = withCredentials(info.internalConnectionString, CMS_ROLE, password);
  mask(next);
  const restore = async reason => {
    console.error(`Switch failed (${reason}); restoring the previous ${KEY} on ${CMS_NAME}.`);
    await render('PUT', `/services/${cms.id}/env-vars/${KEY}`, { value: previous });
    await render('POST', `/services/${cms.id}/restart`);
    const back = await cmsUp(process.env.RELEASE_CMS_URL, Date.now() + 6 * 60_000);
    summary(['### Database roles: apply', '', `Switch failed (${reason}). Previous connection restored; CMS ${back ? 'is up' : 'did NOT come back: check Render now'}.`]);
    process.exitCode = 1;
  };

  await render('PUT', `/services/${cms.id}/env-vars/${KEY}`, { value: next });
  await render('POST', `/services/${cms.id}/restart`);
  await sleep(20_000);
  if (!await cmsUp(process.env.RELEASE_CMS_URL, Date.now() + 8 * 60_000)) return restore('/server/ping did not answer');

  /* Directus is up: it must now be connected as its own role */
  const check = new pg.Client({ connectionString: owner });
  await check.connect();
  let sessions = 0;
  for (let i = 0; i < 12 && !sessions; i++) {
    sessions = Number((await check.query('SELECT count(*) AS n FROM pg_stat_activity WHERE usename=$1', [CMS_ROLE])).rows[0].n);
    if (!sessions) await sleep(5000);
  }
  await check.end();
  if (!sessions) return restore(`no ${CMS_ROLE} session after the restart`);

  const verified = rolesScript('verify', { OWNER_DATABASE_URL: owner }) === 0;
  summary(['### Database roles: apply (OF-2026-11-12)', '',
    `- Roles and grants applied; ${CMS_ROLE} password rotated (generated in this run, stored only on Render).`,
    `- ${CMS_NAME} ${KEY} switched to ${CMS_ROLE}; /server/ping OK; ${sessions} ${CMS_ROLE} session(s).`,
    `- Drift check: ${verified ? 'OK' : 'FAILED'}.`,
    '', 'Next: confirm a Backstage content edit and a public published read, then record the evidence in docs/status/status.json.']);
  process.exitCode = verified ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
