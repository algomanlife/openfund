import fs from 'node:fs';
import path from 'node:path';
import { json, sha256, treeHash, filesIn } from './lib.mjs';
export function verify(dir, {version, commit} = {}) {
  const m = json(path.join(dir,'release-manifest.json'));
  if (version && m.tag !== version || commit && m.commit !== commit) throw Error('Release identity mismatch.');
  if (m.frontend.id !== treeHash(path.join(dir,'react'))) throw Error('Frontend payload hash mismatch.');
  if (JSON.stringify(m) !== JSON.stringify(json(path.join(dir,'react/release-manifest.json')))) throw Error('Frontend/backend manifest mismatch.');
  const checksums=json(path.join(dir,'file-checksums.json'));
  const files=filesIn(dir).filter(f=>f!=='file-checksums.json');
  if (JSON.stringify(files.sort()) !== JSON.stringify(Object.keys(checksums).sort())) throw Error('Unexpected or missing payload files.');
  for (const [file, hash] of Object.entries(checksums)) if (sha256(fs.readFileSync(path.join(dir,file))) !== hash) throw Error(`Payload checksum mismatch: ${file}`);
  return m;
}
if(process.argv[1]?.endsWith('/verify.mjs')) console.log(JSON.stringify(verify(path.resolve(process.argv[2])),null,2));
