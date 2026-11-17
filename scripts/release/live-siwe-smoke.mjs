/** Live SIWE authentication gate.
 *
 * Proves the deployed (or locally booted) backend accepts a complete
 * EIP-4361 sign-in — nonce, real ECDSA signature from a generated
 * throw-away wallet, verified session — for every configured serving
 * domain, and rejects a domain outside ALLOWED_DOMAINS with
 * `invalid_domain`. No production origin or secret is hardcoded:
 * the target comes from RELEASE_PUBLIC_URL and the domain list from
 * RELEASE_SIWE_DOMAINS / ALLOWED_DOMAINS (default: the target's host).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { root } from './lib.mjs';

/* viem is resolved from the backend install only when a sign-in actually
   runs, so importing this module (e.g. for smokeDomains) needs no backend deps */
let viem
const loadViem = () => {
  if (!viem) {
    const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
    viem = { ...backendRequire('viem/accounts'), ...backendRequire('viem/siwe') };
  }
  return viem;
};

const CHAIN_ID = 42161; // the only chain the backend accepts (Arbitrum One)

async function json(response) {
  try { return await response.json(); } catch { return {}; }
}

async function signIn(baseUrl, domain, account, { expectRejected = false, originDomain = domain } = {}) {
  const { createSiweMessage } = loadViem();
  const scheme = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(originDomain) ? 'http' : 'https';
  /* The browser-controlled Origin header stays on an allowed domain; the
     rejection probe forges only the attacker-controlled SIWE message domain. */
  const origin = `${scheme}://${originDomain}`;
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  const nonceResponse = await fetch(new URL('/auth/nonce', baseUrl), {
    method: 'POST', headers, body: JSON.stringify({ address: account.address }),
    signal: AbortSignal.timeout(20000),
  });
  if (!nonceResponse.ok) throw Error(`SIWE gate: /auth/nonce returned ${nonceResponse.status} for ${domain}.`);
  const { nonce } = await json(nonceResponse);
  if (!nonce) throw Error(`SIWE gate: no nonce issued for ${domain}.`);
  const messageScheme = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(domain) ? 'http' : 'https';
  const message = createSiweMessage({
    address: account.address, chainId: CHAIN_ID, domain, nonce,
    uri: `${messageScheme}://${domain}/`, version: '1', issuedAt: new Date(),
  });
  const signature = await account.signMessage({ message });
  const verifyResponse = await fetch(new URL('/auth/verify', baseUrl), {
    method: 'POST', headers, body: JSON.stringify({ message, signature }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await json(verifyResponse);
  if (expectRejected) {
    if (verifyResponse.status !== 400 || body.error !== 'invalid_domain')
      throw Error(`SIWE gate: disallowed domain ${domain} was not rejected with invalid_domain (got ${verifyResponse.status} ${body.error || ''}).`);
    return { domain, rejected: true };
  }
  if (!verifyResponse.ok) throw Error(`SIWE gate: /auth/verify failed for ${domain} (${verifyResponse.status} ${body.error || ''}).`);
  const cookie = (verifyResponse.headers.getSetCookie?.() || [verifyResponse.headers.get('set-cookie')].filter(Boolean))
    .map(value => value.split(';')[0]).join('; ');
  if (!cookie) throw Error(`SIWE gate: verified sign-in for ${domain} set no session cookie.`);
  const meResponse = await fetch(new URL('/auth/me', baseUrl), {
    headers: { ...headers, Cookie: cookie }, signal: AbortSignal.timeout(20000),
  });
  if (!meResponse.ok) throw Error(`SIWE gate: authenticated /auth/me failed for ${domain} (${meResponse.status}).`);
  const me = await json(meResponse);
  const wallet = (me.user?.walletAddress || '').toLowerCase();
  if (wallet !== account.address.toLowerCase())
    throw Error(`SIWE gate: /auth/me identity mismatch for ${domain}.`);
  return { domain, authenticated: true };
}

export function smokeDomains(env = process.env) {
  const listed = (env.RELEASE_SIWE_DOMAINS || env.ALLOWED_DOMAINS || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  const domains = new Set(listed);
  if (env.RELEASE_PUBLIC_URL) domains.add(new URL(env.RELEASE_PUBLIC_URL).host);
  if (!domains.size) throw Error('SIWE gate: RELEASE_PUBLIC_URL or RELEASE_SIWE_DOMAINS/ALLOWED_DOMAINS is required.');
  return [...domains];
}

export async function liveSiweSmoke({ baseUrl, domains, disallowedDomain = 'siwe-gate-disallowed.invalid' }) {
  if (!baseUrl) throw Error('SIWE gate: a backend base URL is required.');
  const { generatePrivateKey, privateKeyToAccount } = loadViem();
  const results = [];
  for (const domain of domains) {
    results.push(await signIn(baseUrl, domain, privateKeyToAccount(generatePrivateKey())));
    console.log(`SIWE gate: live sign-in verified for ${domain}`);
  }
  if (domains.includes(disallowedDomain)) throw Error('SIWE gate: the disallowed probe domain is in the allowed list.');
  results.push(await signIn(baseUrl, disallowedDomain, privateKeyToAccount(generatePrivateKey()), { expectRejected: true, originDomain: domains[0] }));
  console.log(`SIWE gate: disallowed domain rejected (invalid_domain)`);
  return results;
}

if (process.argv[1]?.endsWith('/live-siwe-smoke.mjs')) {
  const baseUrl = process.argv[2] || process.env.RELEASE_PUBLIC_URL;
  await liveSiweSmoke({ baseUrl, domains: smokeDomains() });
  console.log('SIWE gate passed.');
}
