import fs from 'node:fs';
import path from 'node:path';
import { git, root, json, writeJson, sha256, semver, treeHash } from './lib.mjs';
/** Derive the runtime pins from their authoritative sources instead of
 * hardcoding them: render.yaml owns the Node major, Postgres major and the
 * Directus image; apps/backend/package.json engines.node must agree. */
export function runtimePins({ renderYaml, backendEngines } = {}) {
  const blueprint = renderYaml ?? fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  const engines = backendEngines ?? json(path.join(root, 'apps/backend/package.json')).engines?.node;
  const nodeVersion = blueprint.match(/-\s*key:\s*NODE_VERSION\s*\n\s*value:\s*"?(\d+)(?:\.\d+)*"?/)?.[1];
  const postgres = blueprint.match(/postgresMajorVersion:\s*"?(\d+)"?/)?.[1];
  const image = blueprint.match(/url:\s*(?:docker\.io\/)?(directus\/directus:[0-9A-Za-z.\-]+)/)?.[1];
  if (!nodeVersion || !postgres || !image) throw Error('render.yaml must pin NODE_VERSION, postgresMajorVersion and the Directus image.');
  const engineMajor = String(engines ?? '').match(/(\d+)/)?.[1];
  if (!engineMajor || engineMajor !== nodeVersion) throw Error(`apps/backend engines.node (${engines}) must agree with render.yaml NODE_VERSION (${nodeVersion}).`);
  return { nodeMajor: Number(nodeVersion), postgresMajor: Number(postgres), directusImage: image };
}
export function manifest({version, verification = {status: 'unverified'}, official = false, output = root, commit = git('rev-parse', 'HEAD')}) {
  if (!semver.test(version) || !/^[a-f0-9]{40}$/.test(commit)) throw Error('Invalid release version or source SHA.');
  const schema = sha256(fs.readFileSync(path.join(root, 'apps/backend/schema.sql')));
  const backendFiles = fs.readdirSync(path.join(root, 'apps/backend')).filter(f => /\.(js|sql|json)$/.test(f)).sort();
  const backend = sha256(backendFiles.map(f => f + '\0' + sha256(fs.readFileSync(path.join(root, 'apps/backend', f)))).join('\n'));
  const result = {schemaVersion:1, version, tag:`v${version}`, commit, builtAt:new Date().toISOString(), official,
    frontend:{id:treeHash(path.join(output,'react')),base:'/'}, backend:{id:backend}, database:{migrationVersion:`schema-sha256:${schema}`,strategy:'additive-idempotent; backups required before deploy'},
    components:Object.fromEntries(['package.json','apps/web-react/package.json','apps/backend/package.json','vendor/vela/package.json'].map(f=>[f,json(path.join(root,f)).version])),
    configuration:{sameOriginBackend:true,cms:'runtime:/runtime-config.js',walletConnect:'runtime:/runtime-config.js'},
    verification, deployment:{status:'not_deployed'}, toolchain:{node:process.version},
    runtime:runtimePins()};
  writeJson(path.join(output,'release-manifest.json'),result);
  writeJson(path.join(output,'react/release-manifest.json'),result);
  return result;
}
if(process.argv[1]?.endsWith('/manifest.mjs')) manifest({version:process.env.RELEASE_VERSION || '0.1.0',commit:process.env.RENDER_GIT_COMMIT || git('rev-parse','HEAD')});
