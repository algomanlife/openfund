import fs from 'node:fs';
import { git, nextVersion, requestedPatchVersion } from './lib.mjs';
const sha=git('rev-parse','HEAD');
const tags=git('tag','--merged',sha,'--list','v*').split('\n').filter(t=>/^v\d+\.\d+\.\d+$/.test(t));
const exact=git('tag','--points-at',sha).split('\n').find(t=>/^v\d+\.\d+\.\d+$/.test(t));
const latest=tags.sort((a,b)=>a.localeCompare(b,'en',{numeric:true})).at(-1);
const requested=process.env.RELEASE_REQUESTED_VERSION?.trim();
if(requested && (process.env.GITHUB_EVENT_NAME!=='workflow_dispatch' || process.env.GITHUB_REF!=='refs/heads/main'))
  throw Error('Explicit release versions are allowed only on a main-branch manual dispatch.');
if(requested && exact && requested!==exact.slice(1))
  throw Error(`This commit already has immutable release tag ${exact}.`);
const version=exact?.slice(1) || (requested ? requestedPatchVersion(latest,requested) : nextVersion(tags,git('log','--format=%B',latest?`${latest}..${sha}`:sha)));
if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,`RELEASE_VERSION=${version}\n`);
console.log(version);
