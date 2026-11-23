import fs from 'node:fs';
import { git, nextVersion, requestedVersion } from './lib.mjs';
const sha=git('rev-parse','HEAD');
const tags=git('tag','--merged',sha,'--list','v*').split('\n').filter(t=>/^v\d+\.\d+\.\d+$/.test(t));
const exact=git('tag','--points-at',sha).split('\n').find(t=>/^v\d+\.\d+\.\d+$/.test(t));
const latest=tags.sort((a,b)=>a.localeCompare(b,'en',{numeric:true})).at(-1);
const requested=process.env.RELEASE_REQUESTED_VERSION?.trim();
const keepMinorLine=process.env.RELEASE_KEEP_MINOR_LINE==='true';
if(keepMinorLine && !requested) throw Error('keep_minor_line needs an explicit release_version.');
if(requested && (process.env.GITHUB_EVENT_NAME!=='workflow_dispatch' || process.env.GITHUB_REF!=='refs/heads/main'))
  throw Error('Explicit release versions are allowed only on a main-branch manual dispatch.');
if(requested && exact && requested!==exact.slice(1))
  throw Error(`This commit already has immutable release tag ${exact}.`);
const candidate=process.env.RELEASE_CANDIDATE==='true';
const allocated=nextVersion(tags,git('log','--format=%B',latest?`${latest}..${sha}`:sha));
const version=exact?.slice(1) || (candidate && latest ? latest.slice(1) : requested ? requestedVersion({latest,requested,allocated,tags,keepMinorLine}) : allocated);
if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,`RELEASE_VERSION=${version}\n`);
console.log(version);
