/* Validates the release SBOM (OF-2026-11 security automation): CycloneDX
 * JSON, generated for this exact release tag, and non-empty.
 *   node scripts/release/sbom-check.mjs <sbom.cdx.json> <tag> */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkSbom(sbom, tag) {
  if (sbom?.bomFormat !== 'CycloneDX') throw Error('SBOM is not CycloneDX JSON');
  if (!/^1\.[4-9]$/.test(String(sbom.specVersion))) throw Error(`unsupported CycloneDX spec version ${sbom.specVersion}`);
  const c = sbom.metadata?.component;
  if (c?.name !== 'openfund' || c?.version !== tag) throw Error(`SBOM describes ${c?.name}@${c?.version}, not openfund@${tag}`);
  const n = (sbom.components || []).length;
  if (n < 10) throw Error(`SBOM lists only ${n} components`);
  return n;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, tag] = process.argv.slice(2);
  const n = checkSbom(JSON.parse(fs.readFileSync(file, 'utf8')), tag);
  console.log(`SBOM OK: openfund@${tag}, ${n} components`);
}
