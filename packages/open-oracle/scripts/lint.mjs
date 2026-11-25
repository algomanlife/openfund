import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const directories = ['src', 'scripts', 'tests']; let checked = 0;
for (const directory of directories) for (const name of readdirSync(new URL(`../${directory}/`, import.meta.url))) {
  if (!/\.(?:mjs|ts)$/.test(name)) continue;
  const path = new URL(`../${directory}/${name}`, import.meta.url);
  const text = readFileSync(path, 'utf8');
  if (/\b(?:eval|Function)\s*\(/.test(text) || /(?:from|import\()\s*['"][^'"]*(?:apps\/backend|web-react|open-trade)/.test(text)) throw new Error(`forbidden production coupling or dynamic code in ${name}`);
  if (/\s+$/.test(text.replace(/\n$/, '')) || text.split('\n').some(line => /[\t ]+$/.test(line))) throw new Error(`trailing whitespace in ${name}`);
  const result = spawnSync(process.execPath, ['--check', path.pathname], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  checked++;
}
console.log(`Syntax, whitespace and isolation checks passed for ${checked} source files.`);
