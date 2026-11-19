/* Summarises an OSV-Scanner JSON report (security.yml) as Markdown:
 * vulnerable packages per lockfile. Usage: node scripts/ci/osv-summary.mjs <osv.json> */
import fs from 'node:fs';

export function summarise(report) {
  const rows = [];
  for (const r of report.results || []) {
    const n = (r.packages || []).filter(p => (p.vulnerabilities || []).length).length;
    if (n) rows.push([String(r.source?.path || '').replace(/^\/repo\//, ''), n]);
  }
  return ['### OSV-Scanner: vulnerable packages per lockfile', '', ...(rows.length ? rows.map(([k, v]) => `- \`${k}\`: ${v}`) : ['- none'])].join('\n');
}
if (process.argv[2]) console.log(summarise(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))));
