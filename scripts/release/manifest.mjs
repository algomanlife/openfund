import fs from 'node:fs';
import path from 'node:path';
import { git, root, json, writeJson, sha256, semver, treeHash } from './lib.mjs';
export function manifest({version, verification = {status: 'unverified'}, official = false, output = root, commit = git('rev-parse', 'HEAD')}) {
  if (!semver.test(version) || !/^[a-f0-9]{40}$/.test(commit)) throw Error('Invalid release version or source SHA.');
  const schema = sha256(fs.readFileSync(path.join(root, 'apps/backend/schema.sql')));
  const backendFiles = fs.readdirSync(path.join(root, 'apps/backend')).filter(f => /\.(js|sql|json)$/.test(f)).sort();
  const backend = sha256(backendFiles.map(f => f + '\0' + sha256(fs.readFileSync(path.join(root, 'apps/backend', f)))).join('\n'));
  const result = {schemaVersion:1, version, tag:`v${version}`, commit, builtAt:new Date().toISOString(), official,
    frontend:{id:treeHash(path.join(output,'react')),base:'/react/'}, backend:{id:backend}, database:{migrationVersion:`schema-sha256:${schema}`,strategy:'additive-idempotent; backups required before deploy'},
    components:Object.fromEntries(['package.json','apps/web-react/package.json','apps/backend/package.json','vendor/vela/package.json'].map(f=>[f,json(path.join(root,f)).version])),
    configuration:{sameOriginBackend:true,cms:'runtime:/react/runtime-config.js',walletConnect:'runtime:/react/runtime-config.js'},
    verification, deployment:{status:'not_deployed'}, toolchain:{node:process.version},
    runtime:{nodeMajor:22,postgresMajor:17,directusImage:'directus/directus:11.9.1'}};
  writeJson(path.join(output,'release-manifest.json'),result);
  writeJson(path.join(output,'react/release-manifest.json'),result);
  return result;
}
if(process.argv[1]?.endsWith('/manifest.mjs')) manifest({version:process.env.RELEASE_VERSION || '0.1.0',commit:process.env.RENDER_GIT_COMMIT || git('rev-parse','HEAD')});
