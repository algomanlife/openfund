/* Prints the openfund-cms literal environment values from render.yaml as a
 * Docker --env-file, so CI runs Directus with exactly the deployed security
 * settings (OF-2026-11-11). Secrets are never literal in render.yaml
 * (sync: false / generateValue / fromService), so nothing secret is printed.
 * PORT is skipped: CI chooses its own port.
 *
 *   node scripts/ops/directus-env.mjs > /tmp/directus.env
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function directusEnv(file = path.join(root, 'render.yaml')) {
  const doc = yaml.load(fs.readFileSync(file, 'utf8'));
  const cms = doc.services.find(s => s.name === 'openfund-cms');
  if (!cms) throw Error('openfund-cms is not declared in render.yaml');
  return (cms.envVars || []).filter(v => 'value' in v && v.key !== 'PORT').map(v => [v.key, String(v.value)]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [k, v] of directusEnv()) {
    if (/[\r\n]/.test(v)) throw Error(`${k} contains a newline`);
    console.log(`${k}=${v}`);
  }
}
