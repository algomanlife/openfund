import { git, nextVersion } from './lib.mjs';
const tags = git('tag', '--merged', 'HEAD', '--list', 'v*').split('\n').filter(Boolean);
const latest = tags.filter(t => /^v\d+\.\d+\.\d+$/.test(t)).sort((a,b) => a.localeCompare(b, 'en', { numeric: true })).at(-1);
console.log(nextVersion(tags, git('log', '--format=%B', latest ? `${latest}..HEAD` : 'HEAD')));
