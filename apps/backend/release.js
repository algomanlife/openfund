import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export function releaseDiagnostics() {
  const read = path => { try { return JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8')); } catch { return null; } };
  const backend=read('../../release-manifest.json'),frontend=read('../../react/release-manifest.json');
  const commit=process.env.RENDER_GIT_COMMIT || backend?.commit;
  const matches=!!backend && !!frontend && backend.commit===frontend.commit && backend.version===frontend.version && backend.frontend.id===frontend.frontend.id && backend.backend.id===frontend.backend.id && commit===backend.commit;
  return {status:!backend||!frontend?'unversioned':matches?'matched':'mismatch',version:backend?.version || null,commit:commit || null,backend:backend?{version:backend.version,commit:backend.commit,id:backend.backend.id}:null,frontend:frontend?{version:frontend.version,commit:frontend.commit,id:frontend.frontend.id}:null,manifest:backend};
}
export const releaseManifestPath = fileURLToPath(new URL('../../release-manifest.json',import.meta.url));
