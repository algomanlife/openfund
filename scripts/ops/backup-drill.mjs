/* Backup and restore drill.
 *
 * 1. pg_dump --format=custom of SOURCE (read-only for the source),
 * 2. SHA-256 of the dump,
 * 3. pg_restore into a NEW local scratch database (created here; refused if
 *    it exists or is not on localhost),
 * 4. compare exact per-table row counts and the column/constraint schema.
 * Prints a JSON report; exit 0 only when the restore matches the source.
 *
 *   node scripts/ops/backup-drill.mjs --source "$SOURCE_URL" \
 *     --scratch postgres://localhost:5432/openfund_restore_drill_<date> --out ./drill
 *
 * The owner runs it against production with a read-only source URL to prove
 * the backup is restorable before a release (runbook, Backup and rollback).
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[i + 1]]] : pairs, []));
if (!args.source || !args.scratch) throw Error('Usage: node scripts/ops/backup-drill.mjs --source <url> --scratch <new local url> [--out <dir>]');
const scratch = new URL(args.scratch);
if (!['localhost', '127.0.0.1'].includes(scratch.hostname)) throw Error('The scratch database must be local.');
const scratchName = scratch.pathname.slice(1);
if (!/^[a-z0-9_]+$/.test(scratchName) || !/(restore|drill|_test)/.test(scratchName)) throw Error('Name the scratch database *restore*/*drill*/*_test*.');
const out = path.resolve(args.out || 'output/backup-drill');
fs.mkdirSync(out, { recursive: true });
const psql = (url, sql) => execFileSync('psql', [url, '-XAtq', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const admin = new URL(scratch.href); admin.pathname = '/postgres';
if (psql(admin.href, `SELECT 1 FROM pg_database WHERE datname='${scratchName}'`)) throw Error(`Scratch database ${scratchName} already exists; choose a new name.`);

const dump = path.join(out, 'openfund.dump');
const started = Date.now();
execFileSync('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', dump, args.source], { stdio: 'inherit' });
const digest = crypto.createHash('sha256').update(fs.readFileSync(dump)).digest('hex');
psql(admin.href, `CREATE DATABASE ${scratchName}`);
execFileSync('pg_restore', ['--no-owner', '--no-privileges', '--exit-on-error', '--dbname', scratch.href, dump], { stdio: 'inherit' });

const countsSql = `SELECT string_agg(t, ',' ORDER BY t) FROM (SELECT format('%s=%s', c.relname,
  (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text) AS t
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = 'public') s`;
const schemaSql = `SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
  SELECT table_name||'.'||column_name||':'||data_type||':'||is_nullable AS x FROM information_schema.columns WHERE table_schema='public'
  UNION ALL SELECT conrelid::regclass||':'||conname||':'||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace) s`;
const parse = text => Object.fromEntries(text.split(',').filter(Boolean).map(p => p.split('=')).map(([t, n]) => [t, Number(n)]));
const source = { counts: parse(psql(args.source, countsSql)), schema: psql(args.source, schemaSql) };
const restored = { counts: parse(psql(scratch.href, countsSql)), schema: psql(scratch.href, schemaSql) };
const mismatched = [...new Set([...Object.keys(source.counts), ...Object.keys(restored.counts)])].filter(t => source.counts[t] !== restored.counts[t]);
const report = { drillAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), dump, dumpBytes: fs.statSync(dump).size, sha256: digest,
  tables: Object.keys(source.counts).length, rows: Object.values(source.counts).reduce((a, b) => a + b, 0),
  schemaMatches: source.schema === restored.schema, mismatchedTables: mismatched, scratchDatabase: scratchName,
  ok: source.schema === restored.schema && mismatched.length === 0 };
fs.writeFileSync(path.join(out, 'drill-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
