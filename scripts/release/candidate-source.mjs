
const repo = 'algomanlife/openfund';
const api = `https://api.github.com/repos/${repo}`;
const headers = {Accept:'application/vnd.github+json','User-Agent':'openfund-candidate-verifier'};
if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN || process.env.GH_TOKEN}`;
const githubGet = async route => {
  const response = await fetch(`${api}/${route}`, {headers,signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw Error(`GitHub candidate lookup failed: ${route} (${response.status}).`);
  return response.json();
};

/* `get` is injectable for network-free tests. */
export async function candidateSource(sha, { get = githubGet } = {}) {
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw Error('Candidate requires an exact source SHA.');
  const [branch, release, runs] = await Promise.all([
    get('branches/main'), get('releases/latest'), get(`commits/${sha}/check-runs?per_page=100`),
  ]);
  if (branch.commit.sha !== sha) throw Error('Candidate is not the current main commit.');
  if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) throw Error('Latest official release is invalid.');
  const compare = await get(`compare/${encodeURIComponent(release.tag_name)}...${sha}`);
  /* GitHub lists at most 250 commits per compare page while total_commits
     is exact, so the candidate is identified by status and the exact total,
     never by the length of the (paginated) commit list. */
  if (compare.status !== 'ahead' || !Number.isInteger(compare.total_commits) || compare.total_commits < 1)
    throw Error('Cannot derive an exact candidate version from the latest official release.');
  const required = ['Release package gates','Release secret scan','Directus bootstrap and public permissions','Backend (API + engine)','Web (React + Vite)','Secret scan','Render Blueprint'];
  for (const name of required) {
    if (!runs.check_runs?.some(run => run.name === name && run.conclusion === 'success' && run.app?.slug === 'github-actions'))
      throw Error(`Candidate check is not successful on ${sha}: ${name}.`);
  }
  return {version:release.tag_name.slice(1),sha,official:false,checks:required,latestOfficial:release.tag_name,commitsSinceOfficial:compare.total_commits};
}
