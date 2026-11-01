# Wallet authentication (SIWE) — technical reference

## Flow (EIP-4361)

```text
1  connect wallet (RainbowKit)                         — UI state only
2  POST /auth/nonce  {address}          → {nonce}      — single-use, 10 min TTL
3  build SIWE message (viem createSiweMessage):
     domain = window.location.host   (allow-listed server-side)
     address, uri = origin, chainId = 421614, nonce, version = 1
4  wallet signs the message (wagmi signMessageAsync)
5  POST /auth/verify {message, signature}
6  backend validates:
     • message parses (address + nonce present)
     • domain ∈ ALLOWED_DOMAINS
     • chainId = 421614 (Arbitrum Sepolia)
     • nonce exists, unused, unexpired, belongs to the address
     • signature: viem verifySiweMessage(client, …) — EOAs (EIP-191)
       and contract wallets (EIP-1271 / ERC-6492)
7  find-or-create user by lowercase wallet address (UNIQUE ⇒ one identity/wallet)
8  create session: opaque id (256-bit), stored SHA-256-hashed,
   7-day server-side expiry → Set-Cookie: openfund_session
   HttpOnly; SameSite=Lax; Secure (production); Path=/
9  GET /auth/me → user + own challenges (ownership via session join)
10 POST /auth/logout → session row deleted, cookie cleared
```

## Hardening implemented

| Control | Detail |
| :--- | :--- |
| Replay protection | nonces single-use (`used_at`), 10-minute expiry, address-bound |
| Domain binding | server allow-list (`ALLOWED_DOMAINS`) — `localhost:5173/4173` locally |
| Chain binding | chainId must equal 421614 |
| Session theft surface | cookie is opaque; the id is stored hashed; no tokens in JS |
| CSRF | SameSite=Lax + JSON-only endpoints (no form posts) |
| Account switch | frontend detects address change → forces logout + re-auth |
| Suspension | blocked at login AND on live sessions (cookie cleared, 403) |
| Rate limiting | per-IP per-route caps (60/min auth routes locally, tunable) |
| Audit | `audit_log` rows for login, failed auth, suspension blocks, logout |
| Input validation | address/nonce/signature shape checks before DB or crypto |
| Error safety | generic error codes; no stacks or internals leaked |

## Verification matrix (automated — `apps/backend/test/siwe.test.mjs`, 22/22)

valid signature · wrong signer · malformed signature · nonce reuse ·
wrong domain · wrong chain · cookie session (set/valid/invalid-after-logout) ·
one-identity-per-wallet · distinct users · multi-challenge listing ·
ownership isolation · suspension (blocked + reactivation) · signature recovery cross-check.

## Testing honesty

Automated wallet flows use a **real secp256k1 signer** (programmatic viem
account behind a mock EIP-1193 provider that also announces EIP-6963) — the
exact cryptographic path of production wallets, but not a browser extension.
Browser-extension flows were exercised manually in development.

## Frontend contract

`useOpenfundSession()` exposes `status`, `user`, `challenges`, `signIn()`,
`logout()`. The sign-in chip renders only when a wallet is connected but
unauthenticated; a signature is requested **once per session** (refresh keeps
the session — no repeated prompts).
