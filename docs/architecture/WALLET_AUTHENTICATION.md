# Wallet authentication technical reference

[Wallet and Identity](../wallet/IDENTITY.md) is the maintained behavioral contract. The implementation is [server.js](../../apps/backend/server.js), [wallet config](../../apps/web-react/src/wallet/config.ts) and [session provider](../../apps/web-react/src/session/useOpenfundSession.tsx).

## API sequence

| Endpoint | Contract |
| --- | --- |
| POST `/auth/nonce` | Address-bound, ten-minute, single-use nonce |
| POST `/auth/verify` | Validate SIWE message/signature, consume nonce atomically, find/create normalized user, issue session cookie |
| GET `/auth/me` | Return session user and owned challenge records; reject revoked/expired/suspended sessions |
| POST `/auth/logout` | Delete session and clear cookie |

## Validation and session controls

Message verification checks domain against `ALLOWED_DOMAINS`, expected URI host/scheme, version, allowed chain (11155111 or 42161), issued/expiry/not-before times, nonce ownership and cryptographic signature. Contract-wallet verification uses the message chain. Signature and nonce validation failures return generic errors; rate limits and mutation-origin checks bound abuse.

Session IDs are opaque random 256-bit values, stored SHA-256-hashed. Cookies use HttpOnly, SameSite=Lax, path `/`, default seven-day expiry and Secure in production. Normalized wallet uniqueness preserves one identity per wallet. Suspension and session revocation are enforced server-side, including periodic SSE revalidation.

## Client ordering

The React provider keeps verification/logout cookie mutations ordered. Address changes invalidate previous private resources immediately and require matching reauthentication. Disconnect revokes the backend session. Product contexts derive accounts from the session, not a supplied address. Profile dialogs link to existing product dashboards.

## Evidence limits

Repository suites cover generated real ECDSA signatures, replay, invalid domains/chains, expiry, ownership, suspension, cookie lifecycle and switching. Generated EIP-1193 providers are test tools, not real extension/hardware/remote WalletConnect evidence. Live EIP-1271 and deployed HTTPS acceptance remain unverified. The historical Arbitrum Sepolia-only policy is superseded by [ADR 0003](../decisions/0003-trading-valuation-and-product-wallets.md).

[Sequence diagram](FLOWS.md#authentication) · [Security](../security/SECURITY.md)
