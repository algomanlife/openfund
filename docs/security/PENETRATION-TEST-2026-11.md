# Penetration test — methodology and results (November 2026)

Part of the [November 2026 security assessment](SECURITY-AUDIT-2026-11.md).
This was a self-assessment by the project's coding agent, working for the
repository owner. It is not an independent penetration test or a
certification.

## Rules of engagement

| | |
| --- | --- |
| Targets | Local, disposable runtimes only: the backend and SPA on a test port, PostgreSQL test databases, and Directus 11.17.4 in a Docker network with throwaway credentials |
| Not targeted | Every deployed Openfund host (GLOBAL and IRAN), DePay, Gains Network, Hyperliquid, RPC providers, Render, Liara and wallet providers |
| Data | Generated test wallets (viem local accounts), generated test admin tokens, CI placeholder payment receiver; no real wallet, user record or credential |
| Money | None. Payment verification used deterministic receipt fixtures and stub verifiers; no transaction was sent to any chain |
| Load | No flooding or brute force. Concurrency tests fire at most ten parallel requests at one object |

## Environment

| Component | How it ran |
| --- | --- |
| Backend API + SPA | `apps/backend/server.js` on Node 26.13.0, `SIM_TEST_MODE=1`, test `ADMIN_API_TOKEN`, `PURCHASE_PAYMENT_RECEIVER` CI placeholder, production frontend build (`npm run build:web`) |
| Database | Disposable PostgreSQL databases (`*_audit_test`), migrated with `npm run migrate` and seeded with `npm run seed-plans` |
| Directus | `directus/directus:11.17.4` and `postgres:17-alpine` containers on a private network. The backend schema was migrated into the CMS database, then `apply_schema.py`, `register_user_tables.py`, `register_commerce_tables.py`, `register_support_tables.py` and `register_backstage_editor.py` were applied |
| Backstage | `apps/backstage` operations server test suite |
| Browser | Playwright Chromium (headless) |
| Scanner network | OWASP ZAP 2.16.1 in Docker, reaching the test server through the VM host gateway |

Tested commits: assessment base `293b3868` (`main`), remediation branch
`agent/claude/security-audit-2026-11` (see the pull request for the head
commit), Actions hardening branch `agent/claude/actions-hardening`.

## Methodology

1. **Recon:** enumerated every Express route and router, with its
   middleware (authentication, ownership, rate limit), from source.
2. **Automated scanning:**
   - SAST with CodeQL (GitHub default setup) and Semgrep;
   - SCA with npm audit, OSV-Scanner and Trivy;
   - secret scanning with gitleaks, over history and the working tree;
   - workflow analysis with actionlint and zizmor;
   - DAST with ZAP, as a baseline (passive) scan and a full (active) scan.
3. **Manual and scripted attacks** against the running API: a repeatable
   suite, `apps/backend/test/security-pentest.test.mjs`, plus the existing
   suites.
4. **Financial logic:**
   - property-based invariants (`financial-invariants.test.mjs`);
   - the existing payment, commerce, rewards and engine suites;
   - targeted review of the payment trust boundary.
5. **CMS:**
   - anonymous and per-role permission probes against the isolated
     Directus;
   - a direct-write probe as a Directus administrator.
6. **Browser:** session-cookie isolation, wallet switching, logout, CORS
   and framing, all with Playwright (`e2e/test-security-browser.cjs`).
7. **Fix and re-test:** for each confirmed finding, reproduce it, fix the
   root cause, add a regression test, and run it again.

## Results by attack class

| Class | What was tried | Result |
| --- | --- | --- |
| Authentication bypass | 12 protected routes with no cookie, random, empty, path-like, oversized and SQL-like session values | All 401/404 (PT-01) |
| Session replay | Reusing a session id after logout on several routes | 401 everywhere (PT-02) |
| SIWE attacks | Replayed signature, wrong chain id, foreign domain, address swapped in a signed message, another wallet's signature over the victim's nonce | All refused (PT-03) |
| IDOR / BOLA | Second user reads and changes the first user's order, events, attempts, receipt, payment status, trade, account state, positions, protection, pending order, intents and verification | No data returned and no state changed (PT-04). Owner-scoped list endpoints return an empty list |
| Privilege escalation | A wallet session plus forged `Authorization` and `X-Admin-Actor` headers against 10 admin endpoints, plus coupon creation | All 401/403/404 (PT-05) |
| CSRF / CORS | State-changing requests with a foreign `Origin`; credentialed cross-origin reads; preflight | Refused with `invalid_origin`; no `Access-Control-Allow-Origin` for foreign origins (PT-06, B5) |
| Error handling | Truncated JSON, arrays, prototype-pollution payloads, NoSQL-style objects, SQL text in numbers, a 64 KB body | 4xx, no stack traces, 413 for oversize (PT-07) |
| Input fuzzing | 23 hostile values (NUL, broken percent encoding, traversal, script, SQL, template, huge numbers, emoji) × 32 routes and parameters | **Found 500s** (OF-2026-11-10): non-uuid ids on trading, challenge and trade routes, a NUL byte, and a negative paging limit. After the fix, every probe is 4xx (PT-08) |
| Security headers | CSP, framing, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Powered-By` | **`Permissions-Policy` was missing** (OF-2026-11-15), now set. The rest were already present (PT-09, ZAP) |
| Internal and debug endpoints | Test seams with wrong-length and wrong tokens | 401, never 500, after OF-2026-11-02 (PT-10). The seams mount only in test mode |
| Live stream access | Anonymous stream, another user's account stream | 401 / 404 (PT-15) |
| Race conditions | 10 parallel orders with one idempotency key; 10 parallel closes of one position; 8 parallel paid-order confirmations with different transactions; plus the existing suites (parallel coupon redemption, idempotent orders, payout approval, DePay delivery replays) | Exactly one position, one close, one challenge (PT-11 to PT-13). The existing suites pass |
| Business logic | Client-supplied entry price, balance, user id, list price and discount; extreme and negative leverage and margin | Ignored or refused; the server price and mark decide (PT-14) |
| Payment trust boundary | A provider-attested payment signed by a wallet other than the order owner's | **Auto-provisioned before the fix** (OF-2026-11-05). Now held for operator review by default (P23b, D3) |
| CMS isolation | Anonymous read and write of all 166 collections; role scopes; a Directus administrator writing a financial row | Anonymous access limited to published editorial content, the active plan catalog and one public file folder. Editor and support roles have no financial collections. **A Directus administrator changed a challenge status directly** (OF-2026-11-12) |
| Browser session | Cookie readable by script, Web Storage leakage, wallet A→B switch, logout, framing | Pass (B1–B5) |

## Scanner results

| Tool | Scope | Result | Triage |
| --- | --- | --- | --- |
| CodeQL (GitHub default setup) | Repository | 67 open alerts at assessment start | 44 `missing-rate-limiting` (the custom limiter is not recognized; see OF-2026-11-08); 21 in vendored code or scripts. Two real issues were fixed (OF-2026-11-13 exception text as HTML, OF-2026-11-14 modulo bias). The redirect alert is a false positive: the target is always `/` plus the query |
| Semgrep 1.185.0 | First-party code (`p/javascript`, `p/typescript`, `p/nodejsscan`, `p/secrets`, `p/github-actions`, `p/dockerfile`) | 221 results | Every ERROR in first-party code was reviewed. All were false positives (fixed-origin redirects, JSON in an SSE stream, comparisons of non-secrets, test-only Playwright URLs). The `regex_dos` warnings are anchored literal patterns |
| OSV-Scanner 2.7.1, Trivy 0.76.2 (fs) | All lockfiles | Advisories in `apps/web-react`, `apps/open-trade`, the dormant `packages/openfund-protocol`, and the vendored `vendor/gains-sdk` and `vendor/vela` lockfiles | See the dependency section of the report |
| Trivy (config) | `infra/**/Dockerfile` | 0 misconfigurations | Images run as non-root (`node`, `openfund`, uid 101) |
| Trivy (image) | Base images and Directus | See the report | Results are informational |
| gitleaks 8.30.1 | Full history (563 commits) and working tree | History: no leaks. Working tree: 49 hits | All 49 are public contract addresses and locale strings in vendored and dormant code |
| actionlint 1.7.12 / zizmor 1.32.0 | Workflows | zizmor: 74 unpinned uses, 30 credential persistence, 1 template injection, 1 `secrets: inherit` | Fixed in the Actions hardening pull request, except `secrets: inherit` (accepted) and the two workflows that push |
| ZAP 2.16.1 baseline | SPA and API on the test server | 0 FAIL, 8 WARN, 59 PASS | Missing `Permissions-Policy` (fixed); CSP `unsafe-eval` and `style-src 'unsafe-inline'` (needed by the chart engine; accepted, OF-2026-11-16); the rest informational |
| ZAP 2.16.1 full (active) | Same | See the report | See the report |

## Evidence

Machine-readable outputs are kept outside the public repository: ZAP
reports, scanner JSON, the Directus permission probe and the full test logs.
The [private findings record](SECURITY-AUDIT-2026-11.md#private-record) lists
them. The regression tests in this repository reproduce every fixed finding.

## Limits

- No production testing, no third-party testing, and no social engineering.
- ZAP explored the SPA and the APIs it discovered. Authenticated API
  coverage comes from the scripted suite, not from ZAP.
- The DePay tracking service could not be exercised, so OF-2026-11-05 was
  fixed fail-closed instead of being proven exploitable.
- No load or stress testing.
